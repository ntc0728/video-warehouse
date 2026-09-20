/**
 * TMDB API Mock Fixture
 *
 * 使用 Playwright 的 page.route() 拦截所有 api.tmdb.org 请求，
 * 返回缓存的 mock 数据，避免测试过程中调用真实 TMDB API。
 *
 * 策略：
 *   日常开发 → 启用 mock（默认），保护 Token 不被封禁
 *   发版回归 → TMDB_MOCK=false，验证真实 API 兼容性
 *
 * mock 模式下附带「网络守卫」：所有未命中任何专用拦截的公网请求立即 abort，
 * 彻底杜绝测试挂在真实 IPTV 大 m3u / 死代理 / TMDB 逃逸上（E2E 卡死根因之一）。
 *
 * 用法：
 *   import { test, expect } from './fixtures/mock-tmdb';
 *   // 测试代码不变，TMDB API 自动被拦截
 *
 * 环境变量：
 *   TMDB_MOCK=false  → 关闭 mock，使用真实 TMDB API
 *   TMDB_MOCK=（默认）→ 启用 mock
 */
import { test as base, expect } from '@playwright/test';
import { matchMockRoute } from './tmdb-mock-data';
import { buildNetworkMockRules, getProxyAllowedHostnames } from './test-env';

// 是否启用 mock（通过环境变量控制）
const ENABLE_MOCK = process.env.TMDB_MOCK !== 'false';

// mock 拦截计数（用于统计）
let mockCount = 0;
let realCount = 0;
let guardedCount = 0;

/** 本地/专用 mock 域：127.0.0.1、::1、*.local、*.example.com（测试桩域名）等 */
const LOCAL_OR_MOCK_HOST =
  /^(?:127\.0\.0\.1|localhost|::1|\[::1\]|\[0:0:0:0:0:0:0:1\]|0\.0\.0\.0|.*\.(?:local|localhost|example\.com|example\.org))$/;

/** .env.local 配置的真实代理主机（正规数据通道）也在放行之列 */
const PROXY_ALLOWED_HOSTS = new Set(getProxyAllowedHostnames());

/**
 * 网络守卫：mock 模式下（默认）任何未命中专用拦截的公网请求一律立即 abort。
 * 根因：storageState 注入的是真实 IPTV/CMS 源与占位代理，公网不可达/慢速时
 * 每条请求会挂到浏览器级超时，整轮 E2E 表现为「跑不完/卡死」。守卫让逃逸请求
 * 毫秒级失败，测试语义从「等外网」变为确定性的「外网不可用」分支。
 * 逃生门：TMDB_MOCK=false（发版回归）时守卫与 mock 一并关闭，走真实网络。
 */
function isLocalOrMockHost(hostname: string): boolean {
  return LOCAL_OR_MOCK_HOST.test(hostname) || PROXY_ALLOWED_HOSTS.has(hostname);
}

/**
 * 扩展的 test fixture，自动拦截 TMDB API 请求
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    if (ENABLE_MOCK) {
      // ── 网络守卫：必须最先注册 —— Playwright 对多条匹配路由按「后注册优先」裁决
      // （types.d.ts: "the most recently registered route takes precedence"），
      // 因此 TMDB/图片/各测试自建的专用 route 都会盖过守卫，只有无人认领的公网请求才落到这里被 abort。
      await page.route('**/*', async (route) => {
        const req = route.request();
        const url = req.url();
        // WebSocket / 非 http(s) 直接放行（vite HMR ws 等）
        if (/^(wss?|https?):\/\//.test(url) === false) {
          await route.fallback();
          return;
        }
        let hostname = '';
        try {
          hostname = new URL(url).hostname;
        } catch {
          await route.abort('blockedbyclient');
          return;
        }
        if (isLocalOrMockHost(hostname)) {
          await route.continue();
        } else {
          guardedCount++;
          await route.abort('internetdisconnected');
        }
      });

      // ── 注入源与 iptv-org 主干（大 m3u / 7.5MB channels.json）确定性 mock：
      // 注册在守卫之后 ⇒ 优先于 abort。频道卡片始终有 3 条数据可渲染，永不真出网。
      for (const rule of buildNetworkMockRules()) {
        await page.route(rule.pattern, async (route) => {
          if (rule.delayMs) await new Promise((r) => setTimeout(r, rule.delayMs));
          const res = rule.respond(route.request().url());
          return route.fulfill({
            status: 200,
            contentType: res.contentType,
            body: res.body,
            headers: { 'content-length': String(Buffer.byteLength(res.body)) },
          });
        });
      }

      // 拦截所有 TMDB API 请求
      await page.route('**/api.tmdb.org/**', async (route) => {
        const url = route.request().url();
        const mockResponse = matchMockRoute(url);

        if (mockResponse !== null) {
          mockCount++;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockResponse),
          });
        } else {
          // mock 模式即不回真实网络：未命中缓存返回 404 空响应（确定性失败），
          // 避免 route.continue() 逃逸到公网后吃满浏览器级超时拖慢整轮。
          realCount++;
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ status_code: 404, status_message: 'not mocked' }),
          });
        }
      });

      // 拦截 image.tmdb.org 图片请求（返回 1x1 透明像素）
      await page.route('**/image.tmdb.org/**', async (route) => {
        const pixel = Buffer.from(
          'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          'base64',
        );
        await route.fulfill({
          status: 200,
          contentType: 'image/gif',
          body: pixel,
        });
      });
    }

    await use(page);
  },
  // autouse 清理：每个 test 结束后释放页面级资源（媒体元素 / 应用暴露的销毁钩子），
  // 缓解 worker teardown 挂起（HLS/DASH/Native 适配器持有的 <video> 与 BroadcastChannel 残留）。
  _teardownCleanup: [
    async ({ page }, use) => {
      await use(page);
      try {
        await page.evaluate(() => {
          // 停止并卸载所有媒体元素，断开 HLS/DASH/Native 适配器持有的 <video>/<audio>
          document.querySelectorAll('video, audio').forEach((el) => {
            const m = el as HTMLMediaElement;
            try {
              m.pause();
              m.removeAttribute('src');
              m.removeAttribute('srcObject');
              m.load();
            } catch {
              /* noop */
            }
          });
          // 若应用挂了 E2E 销毁钩子则调用（UniversalPlayer 等可借此 close BroadcastChannel / destroy 实例）
          const w = window as unknown as { __e2eCleanup?: () => void };
          if (typeof w.__e2eCleanup === 'function') {
            try {
              w.__e2eCleanup();
            } catch {
              /* noop */
            }
          }
        });
      } catch {
        /* 页面可能已关闭，忽略 */
      }
    },
    { auto: true },
  ],
});

/**
 * 测试结束后输出 mock 统计（仅 mock 模式）
 */
export function getMockStats() {
  return { mockCount, realCount, guardedCount, enabled: ENABLE_MOCK };
}

export { expect, ENABLE_MOCK };
