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

// 是否启用 mock（通过环境变量控制）
const ENABLE_MOCK = process.env.TMDB_MOCK !== 'false';

// mock 拦截计数（用于统计）
let mockCount = 0;
let realCount = 0;

/**
 * 扩展的 test fixture，自动拦截 TMDB API 请求
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    if (ENABLE_MOCK) {
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
          // 未匹配到 mock，放行真实请求
          realCount++;
          await route.continue();
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
  return { mockCount, realCount, enabled: ENABLE_MOCK };
}

export { expect, ENABLE_MOCK };
