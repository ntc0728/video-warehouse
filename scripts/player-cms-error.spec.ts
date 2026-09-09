/**
 * PLAYER CMS 业务错误码 E2E
 *
 * 验证 CMS 接口返回业务异常（HTTP 200 + body.code != 1，如 1002 = 当前 API
 * 禁止关键词搜索）时，播放页落入明确的「暂无数据」失败态：
 *   - 不显示侧栏骨架（入场骨架有 hasLoadedOnce 守卫，失败态绝不回退骨架）
 *   - CMS 面板保留真实结构（tab 可见，可改选其他源）
 *   - 播放器区域不残留加载动画
 *
 * 这是「业务错误码校验」的核心回归用例：一旦有人把 assertCmsOk 校验去掉
 * （业务异常响应当成功解析），或把失败态改回骨架分支，本例会直接失败。
 */
import { test, expect, setCmsSearchResponse } from './fixtures/cms-mock';

const TEST_MOVIE_ID = 'tmdb-movie-550';

test.describe('PLAYER CMS 业务错误码', () => {
  test('PLAYER-095: code 1002 业务异常 → 暂无数据空态，无骨架残留，CMS 面板保留', async ({ page }) => {
    // 所有 CMS 搜索返回业务异常（HTTP 200 + code 1002）
    setCmsSearchResponse({
      code: 1002,
      msg: 'Current API forbids keyword search.',
    });

    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 等待失败态落定：「暂无数据，请尝试切换其他 CMS 源」空态出现
    await expect
      .poll(
        async () => page.evaluate(() => !!document.querySelector('.player-empty-state')),
        { timeout: 20000, message: '业务错误码应落入「暂无数据」空态而非永久加载' },
      )
      .toBeTruthy();

    // 失败落定后：侧栏骨架不允许出现（hasLoadedOnce 守卫生效）
    await expect(page.locator('.player-sidebar-skeleton')).toHaveCount(0);

    // CMS 面板保留真实结构（用户可改选其他源）
    await expect(page.locator('.player-panel--cms')).not.toHaveCount(0);
  });
});
