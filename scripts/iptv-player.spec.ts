/**
 * IPTV 播放页 (IPTVPlayer) 测试用例（精简合并版）
 * 路由: /iptv/play?url=...&id=...&name=...（独立顶层路由）
 * 配置依赖: Level 3（全配置）— 需 IPTV 代理 + 频道数据
 *
 * 覆盖: IPTVP-001 ~ IPTVP-014
 * 合并映射: 11.1(007,008) / 11.2(010,011) / 11.3(013,014)
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 11.1 页面加载与频道匹配
// ═══════════════════════════════════════════════════════════════

test.describe('11.1 页面加载与频道匹配', () => {
  test('IPTVP-007/008: 空 URL 参数 + 返回按钮', async ({ page }) => {
    // 007 空 URL 参数
    await page.goto('/iptv/play', { waitUntil: 'domcontentloaded' });
    await expect
      .poll(
        () => page.evaluate(() => !!document.querySelector('.iptv-player-page, .iptv-page, [class*="player"]')),
        { timeout: 4000 },
      )
      .toBe(true);

    // 008 返回按钮
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('.up-header-back, [class*="header-back"]')), {
        timeout: 4000,
      })
      .toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 11.2 平台适配
// ═══════════════════════════════════════════════════════════════

test.describe('11.2 平台适配', () => {
  test('IPTVP-010/011: 桌面端 + 移动端播放', async ({ page }) => {
    const playerMounted = () =>
      page.evaluate(() => !!document.querySelector('.player-page, [class*="player"]'));

    // 010 桌面端播放
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect.poll(playerMounted, { timeout: 4000 }).toBe(true);

    // 011 移动端播放
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect.poll(playerMounted, { timeout: 4000 }).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 11.3 IPTV 播放独立逻辑（IPTV 走独立播放流程，不复用点播交互）
// ═══════════════════════════════════════════════════════════════

test.describe('11.3 IPTV 播放独立逻辑', () => {
  test('IPTVP-013/014: 不显示中间播放按钮 + 不显示点播类 toast', async ({ page }) => {
    // 负向断言无法直接轮询「不出现」：先等播放器 chrome 挂载（正向锚点），再断言目标节点计数为 0
    const playerChrome = page.locator('.up-header-back, [class*="header-back"]').first();

    // 013 IPTV 不显示中间播放按钮
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect(playerChrome).toBeAttached({ timeout: 4500 });
    await expect(page.locator('.up-player-paused-overlay')).toHaveCount(0, { timeout: 2500 });

    // 014 IPTV 右上角不显示点播类 toast 提示
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect(playerChrome).toBeAttached({ timeout: 4500 });
    await expect(page.locator('.up-player-toast')).toHaveCount(0, { timeout: 2500 });
  });
});
