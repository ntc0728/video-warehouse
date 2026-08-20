/**
 * Playwright 全局设置脚本
 *
 * 创建预配置的 storageState，包含：
 * - TMDB Access Token
 * - CORS 代理地址（视频采集站）
 * - IPTV 代理地址
 * - 多个视频源 / IPTV 源索引
 *
 * 所有测试自动继承这些配置，无需每个测试单独设置。
 */
import { chromium, type FullConfig } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 加载项目根目录的 .env.local 文件
config({ path: resolve(__dirname, '..', '.env.local') });

const STORAGE_STATE_PATH = resolve(__dirname, '..', 'test-storage-state.json');

// ─── 测试环境配置 ────────────────────────────────────────────
// 使用环境变量传入私人配置，本地开发时在 .env.local 中设置
// 示例值仅供参考，实际部署时通过 CI/CD 或环境变量注入
const TMDB_TOKEN = process.env.TMDB_TOKEN || 'your_tmdb_token_here';
const CORS_PROXY = process.env.CORS_PROXY || 'https://your-cors-proxy.example.com';
const IPTV_PROXY = process.env.IPTV_PROXY || 'https://your-iptv-proxy.example.com';

// ─── 视频数据源（5 个，覆盖不同类型） ───────────────────────
// video-sources.json 下标：
//   0=爱奇艺  1=豆瓣  6=猫眼  11=非凡  21=光速
const VIDEO_SOURCE_INDICES = [0, 1, 6, 11, 21];

// ─── IPTV 数据源（3 个，覆盖不同 CDN） ──────────────────────
// iptv-sources.json 下标：
//   0=IPTV(GitHub)  2=猫影视TV  7=风云TV4
const IPTV_SOURCE_INDICES = [0, 2, 7];

// ID 持久化：从配置文件解析内置源 ID（video = api_site key；iptv = url）
const videoSourcesJson = JSON.parse(
  readFileSync(resolve(__dirname, '../public/data/video-sources.json'), 'utf8'),
) as { api_site: Record<string, unknown> };
const iptvSourcesJson = JSON.parse(
  readFileSync(resolve(__dirname, '../public/data/iptv-sources.json'), 'utf8'),
) as { name: string; url: string }[];
const VIDEO_SOURCE_IDS = VIDEO_SOURCE_INDICES.map((i) => Object.keys(videoSourcesJson.api_site)[i]);
const IPTV_SOURCE_IDS = IPTV_SOURCE_INDICES.map((i) => iptvSourcesJson[i].url);

// ─── Zustand persist 格式的 localStorage 数据 ────────────────

// useSettingsStore（app-settings）
const APP_SETTINGS = {
  state: {
    videoSourceIds: VIDEO_SOURCE_IDS,
    iptvSourceIds: IPTV_SOURCE_IDS,
    theme: 'light',
    corsProxy: CORS_PROXY,
    epgUrls: ['http://epg.51zmt.top:8000/e.xml'],
    epgUpdateInterval: 6,
    rememberVolume: false,
    tmdbAccessToken: TMDB_TOKEN,
    tmdbLanguage: 'zh-CN',
    translationAppId: '',
    translationApiKey: '',
    autoTranslate: true,
    targetLang: 'zh',
    skipIntro: false,
    skipOutro: false,
    skipIntroDuration: 90,
    skipOutroDuration: 90,
    autoPlay: true,
  },
  version: 0,
};

// useIPTVStore（iptv-store）
const IPTV_STORE = {
  state: {
    settings: {
      aggregatorUrl: '',
      aggregatorUrls: [],
      proxyUrl: IPTV_PROXY,
      proxyPattern: '',
      priorityKeywords: [],
      autoRefresh: false,
    },
    filter: { search: '', sourceId: '', group: '' },
    playHistory: [],
    favoriteChannelIds: [],
  },
  version: 0,
};

export default async function globalSetup(_config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // 先加载应用页面，使 localStorage 域生效
  const baseURL = _config.projects[0].use.baseURL || 'http://127.0.0.1:3001';
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

  // 时序竞态修复（2026-08-11）：应用启动后会有「异步写回」覆盖注入值——
  // ① useSettingsStore 的加密持久化是异步写盘（setItem 里 void async 加密后
  //    localStorage.setItem），rehydrate 完成后可能基于「旧内存状态」异步写回；
  // ② main.tsx 的 useSourceManagerStore.bootstrap() 会把全量内置源索引同步回
  //    app-settings（videoSourceIndices: [28] 即全量源数）。
  // 若直接 evaluate 注入后立即 storageState，最终落盘可能是应用写回的空 Token。
  // 对策：先等初始化写回风暴结束 → 注入 → 再等 → 再注入（最后写入者胜）。
  await page.waitForTimeout(2500);

  // 注入应用设置
  await page.evaluate(({ appSettings, iptvStore }) => {
    localStorage.setItem('app-settings', JSON.stringify(appSettings));
    localStorage.setItem('iptv-store', JSON.stringify(iptvStore));
  }, { appSettings: APP_SETTINGS, iptvStore: IPTV_STORE });

  // 等注入后可能残留的异步写回（加密写盘）落盘，再覆盖一次确保注入值生效
  await page.waitForTimeout(800);
  await page.evaluate(({ appSettings, iptvStore }) => {
    localStorage.setItem('app-settings', JSON.stringify(appSettings));
    localStorage.setItem('iptv-store', JSON.stringify(iptvStore));
  }, { appSettings: APP_SETTINGS, iptvStore: IPTV_STORE });
  await page.waitForTimeout(300);

  // 保存 storageState（包含 cookies + localStorage）
  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();

  console.log(`✓ 测试环境配置完成:
  TMDB Token: ${TMDB_TOKEN.slice(0, 20)}...
  CORS Proxy: ${CORS_PROXY}
  IPTV Proxy: ${IPTV_PROXY}
  视频源: ${VIDEO_SOURCE_INDICES.length} 个 (${VIDEO_SOURCE_INDICES.join(', ')})
  IPTV源: ${IPTV_SOURCE_INDICES.length} 个 (${IPTV_SOURCE_INDICES.join(', ')})
  Storage: ${STORAGE_STATE_PATH}`);
}
