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
});

/**
 * 测试结束后输出 mock 统计（仅 mock 模式）
 */
export function getMockStats() {
  return { mockCount, realCount, enabled: ENABLE_MOCK };
}

export { expect, ENABLE_MOCK };
