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

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE_PATH = resolve(__dirname, '..', 'test-storage-state.json');

// ─── 测试环境配置 ────────────────────────────────────────────
const TMDB_TOKEN = process.env.TMDB_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlYWNjZjRiMjc2NmQ0MTI2NDZmYzU5OTg1MmVlNjE2YSIsIm5iZiI6MTc4MDMwMTYwOS44NTUsInN1YiI6IjZhMWQzZjI5NjNlMzVkYTdjYjgxMjAzYyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.z8uzVf9xAIjMposAgQCYjIcRyME_36376U3pBB_yxyE';
const CORS_PROXY = 'https://video-warehouse.nmziptv.top';
const IPTV_PROXY = 'https://iptv.nmz996.cc.cd';

// ─── 视频数据源（5 个，覆盖不同类型） ───────────────────────
// video-sources.json 索引：
//   0=爱奇艺  1=豆瓣  6=猫眼  11=非凡  21=光速
const VIDEO_SOURCE_INDICES = [0, 1, 6, 11, 21];

// ─── IPTV 数据源（3 个，覆盖不同 CDN） ──────────────────────
// iptv-sources.json 索引：
//   0=IPTV(GitHub)  2=猫影视TV  7=风云TV4
const IPTV_SOURCE_INDICES = [0, 2, 7];

// ─── Zustand persist 格式的 localStorage 数据 ────────────────

// useSettingsStore（app-settings）
const APP_SETTINGS = {
  state: {
    videoSourceIndex: VIDEO_SOURCE_INDICES[0],
    videoSourceIndices: VIDEO_SOURCE_INDICES,
    iptvSourceIndex: IPTV_SOURCE_INDICES[0],
    iptvSourceIndices: IPTV_SOURCE_INDICES,
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

  // 注入应用设置
  await page.evaluate(({ appSettings, iptvStore }) => {
    localStorage.setItem('app-settings', JSON.stringify(appSettings));
    localStorage.setItem('iptv-store', JSON.stringify(iptvStore));
  }, { appSettings: APP_SETTINGS, iptvStore: IPTV_STORE });

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
