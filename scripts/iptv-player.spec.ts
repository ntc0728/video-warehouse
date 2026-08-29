/**
 * IPTV 播放页 (IPTVPlayer) 测试用例
 * 路由: /iptv/play?url=...&id=...&name=...（独立顶层路由）
 * 配置依赖: Level 3（全配置）— 需 IPTV 代理 + 频道数据
 *
 * 覆盖: IPTVP-001 ~ IPTVP-014
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 11.1 页面加载与频道匹配
// ═══════════════════════════════════════════════════════════════

test.describe('11.1 页面加载与频道匹配', () => {
  test('IPTVP-007: 空 URL 参数', async ({ page }) => {
    // 前置条件: 无 url 参数
    await page.goto('/iptv/play', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 预期结果: 无 url 时路由应落在 IPTV 播放/列表相关页面（空播放器或回落到频道列表）
    const hasContent = await page.evaluate(() => {
      return !!document.querySelector('.iptv-player-page, .iptv-page, [class*="player"]');
    });
    expect(hasContent).toBeTruthy();
  });

  test('IPTVP-008: 返回按钮', async ({ page }) => {
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 预期结果: 返回按钮存在
    const hasBack = await page.evaluate(() => {
      return !!document.querySelector('.up-header-back, [class*="header-back"]');
    });
    expect(hasBack).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 11.2 平台适配
// ═══════════════════════════════════════════════════════════════

test.describe('11.2 平台适配', () => {
  test('IPTVP-010: 桌面端播放', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 预期结果: 桌面端布局
    const hasContent = await page.evaluate(() => {
      return !!document.querySelector('.player-page, [class*="player"]');
    });
    expect(hasContent).toBeTruthy();
  });

  test('IPTVP-011: 移动端播放', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 预期结果: 移动端布局
    const hasContent = await page.evaluate(() => {
      return !!document.querySelector('.player-page, [class*="player"]');
    });
    expect(hasContent).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 11.3 IPTV 播放独立逻辑（IPTV 走独立播放流程，不复用点播交互）
// ═══════════════════════════════════════════════════════════════

test.describe('11.3 IPTV 播放独立逻辑', () => {
  test('IPTVP-013: IPTV 不显示中间播放按钮', async ({ page }) => {
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // 预期结果: IPTV 直播加载即播，不应渲染点播类中间暂停遮罩（.up-player-paused-overlay）
    const hasCenterPlay = await page.evaluate(() => {
      return !!document.querySelector('.up-player-paused-overlay');
    });
    expect(hasCenterPlay).toBe(false);
  });

  test('IPTVP-014: IPTV 右上角不显示点播类 toast 提示', async ({ page }) => {
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // 预期结果: IPTV 右上角操作提示容器（.up-player-toast）不渲染任何点播类提示
    const hasToast = await page.evaluate(() => {
      return !!document.querySelector('.up-player-toast');
    });
    expect(hasToast).toBe(false);
  });
});
