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
import http from 'http';
import { config } from 'dotenv';
import {
  VIDEO_SOURCE_INDICES as TEST_VIDEO_SOURCE_INDICES,
  IPTV_SOURCE_INDICES as TEST_IPTV_SOURCE_INDICES,
} from './fixtures/test-env';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 加载项目根目录的 .env.local 文件
config({ path: resolve(__dirname, '..', '.env.local') });

const STORAGE_STATE_PATH = resolve(__dirname, '..', 'test-storage-state.json');

// ─── 测试环境配置 ────────────────────────────────────────────
// 使用环境变量传入私人配置，本地开发时在 .env.local 中设置。
// 缺省占位值刻意用 127.0.0.1:1（必然 ECONNREFUSED 的本地端口）而不是公网占位域名：
// 未配 .env.local 时请求毫秒级失败，不会挂在 DNS/超时上拖慢整轮 E2E。
const TMDB_TOKEN = process.env.TMDB_TOKEN || 'test_placeholder_token';
const CORS_PROXY = process.env.CORS_PROXY || 'http://127.0.0.1:1/cors-proxy';
const IPTV_PROXY = process.env.IPTV_PROXY || 'http://127.0.0.1:1/iptv-proxy';

// ─── 视频 / IPTV 数据源下标（与 scripts/fixtures/test-env.ts 单一事实源同步） ─
const VIDEO_SOURCE_INDICES = TEST_VIDEO_SOURCE_INDICES;
const IPTV_SOURCE_INDICES = TEST_IPTV_SOURCE_INDICES;

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

// 防卡死探针（2026-09-20）：E2E 端口上的 Vite 可能处于「TCP 通、HTTP 永不响应」的
// 僵尸态，webServer.reuseExistingServer 判不出来 → 后续每条 goto 白耗 45s，
// 全量跑变成十几分钟无输出的「卡死」。这里用带超时的 HTTP 探测提前 fail-fast。
function probeHttp(url: string, timeoutMs = 3000): Promise<boolean> {
  return new Promise((done) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      done((res.statusCode || 0) === 200);
    });
    req.on('timeout', () => {
      req.destroy();
      done(false);
    });
    req.on('error', () => done(false));
  });
}

export default async function globalSetup(_config: FullConfig) {
  const baseURL = _config.projects[0].use.baseURL!;

  // fail-fast：8 秒内拿不到 200 就明确报错退出，绝不带着死端口往下跑
  const deadline = Date.now() + 8000;
  let healthy = false;
  while (Date.now() < deadline) {
    if (await probeHttp(baseURL)) {
      healthy = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!healthy) {
    throw new Error(
      `✗ ${baseURL} 在 8s 内未返回 HTTP 200 —— 端口上大概率是僵尸 dev server` +
        `（TCP 通但 HTTP 不响应）。请勿重试本命令，改用带清场+健康轮询的跑批器：\n` +
        `    node scripts/e2e-skeleton.mjs            # 全量/预览模式\n` +
        `    npm run test:e2e                          # 已委托 e2e-skeleton --all`,
    );
  }

  // 与 playwright.config.ts 的 use.channel 同源：受限环境（chrome-headless-shell
  // 以 0xC0000409 崩溃）下用 PW_BROWSER_CHANNEL=chromium 切到完整 chromium。
  const launchChannel = process.env.PW_BROWSER_CHANNEL || undefined;
  const browser = await chromium.launch({ channel: launchChannel });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 先加载应用页面，使 localStorage 域生效
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

  // 时序竞态修复（2026-08-11 根因不变；2026-09-20 由固定 sleep 3.6s 改为收敛轮询）：
  // 应用启动后有「异步写回风暴」（settingsStore 加密落盘重放 + sourceManager bootstrap
  // 回写全量索引），最终写入者胜。轮询判据 = 连续两次读到「存储值 === 注入值」才放行，
  // 风暴期最多回推重注，上限 4s；正常 1s 内收敛，比固定 sleep 快且更可靠。
  const write = () =>
    page.evaluate(({ appSettings, iptvStore }) => {
      localStorage.setItem('app-settings', JSON.stringify(appSettings));
      localStorage.setItem('iptv-store', JSON.stringify(iptvStore));
    }, { appSettings: APP_SETTINGS, iptvStore: IPTV_STORE });
  const isSettled = () =>
    page.evaluate(
      ({ appJson, iptvJson }) =>
        localStorage.getItem('app-settings') === appJson && localStorage.getItem('iptv-store') === iptvJson,
      { appJson: JSON.stringify(APP_SETTINGS), iptvJson: JSON.stringify(IPTV_STORE) },
    );
  const deadlineInject = Date.now() + 4000;
  let stableHits = 0;
  await write();
  while (Date.now() < deadlineInject && stableHits < 2) {
    await page.waitForTimeout(250);
    stableHits = (await isSettled()) ? stableHits + 1 : 0;
    if (!stableHits) await write();
  }
  // 未完全收敛也最后强制注一次：此刻起 worker 们读到的 storageState 以注入值为准
  await write();

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
