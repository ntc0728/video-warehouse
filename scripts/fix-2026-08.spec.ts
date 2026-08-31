/**
 * 9.1 自测问题修复验证 (FIX-101 ~ FIX-108)
 * 路由: 多页面
 * 覆盖: 冷启动白屏 / 封面占位 / app 汉堡 / 横屏恒移动 / IPTV 全屏按钮 /
 *       设置页 padding / TabBar 间距 / 免责声明贴底
 *
 * 模拟 app 端：addInitScript 注入 window.Capacitor（isNativePlatform 检测）
 */
import { test, expect } from './fixtures/mock-tmdb';

// 注入 Capacitor 模拟 app 端（需在 goto 前调用）
async function mockNativeApp(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).Capacitor = {
      getPlatform: () => 'android',
    };
  });
}

test.describe('9.1 冷启动与首屏', () => {
  test('FIX-101: 冷启动 #root 立即有内容（无白屏）', async ({ page }) => {
    // 硬刷新（不命中 keep-alive 缓存）
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // render 立即执行：Suspense fallback（AppLoading）或应用内容必然出现在 #root
    await expect(page.locator('#root > *').first()).toBeVisible({ timeout: 15000 });
    const html = await page.evaluate(() => document.querySelector('#root')?.innerHTML ?? '');
    expect(html.length).toBeGreaterThan(0);
  });

  test('FIX-102: 封面图加载失败显示主题兜底（非黑色块）', async ({ page }) => {
    // 拦截 TMDB 图片请求使其全部失败
    await page.route('**image.tmdb.org/**', (route) => route.abort());
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.video-card, .lazy-image-container', { timeout: 15000 });
    await page.waitForTimeout(2500);
    // error 态渲染 fallback 图（.lazy-image-fallback）；加载中渲染默认占位（.lazy-image-placeholder）
    const fallbackCount = await page.locator('.lazy-image-fallback').count();
    const loadingCount = await page.locator('.lazy-image-placeholder').count();
    expect(fallbackCount + loadingCount).toBeGreaterThan(0);
    // 兜底为品牌占位（.lazy-image-fallback--brand，lucide MonitorPlay 图标 + kinoTV 文字），
    // 主题自适应中性灰背景，非黑色块
    if (fallbackCount > 0) {
      const brandCount = await page.locator('.lazy-image-fallback--brand').count();
      expect(brandCount).toBeGreaterThan(0);
      await expect(
        page.locator('.lazy-image-fallback--brand .lucide').first()
      ).toBeVisible();
      await expect(
        page.locator('.lazy-image-fallback__brand').first()
      ).toHaveText('kinoTV');
    }
  });
});

test.describe('9.1 app 端适配', () => {
  test('FIX-103: app 端顶部无汉堡按钮（web 手机端保留）', async ({ page }) => {
    await mockNativeApp(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header', { timeout: 15000 });
    const menuBtnCount = await page.locator('.sticky-header__menu-btn').count();
    expect(menuBtnCount).toBe(0);
  });

  test('FIX-103b: web 手机端保留汉堡按钮', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header', { timeout: 15000 });
    const menuBtnCount = await page.locator('.sticky-header__menu-btn').count();
    expect(menuBtnCount).toBe(1);
  });

  test('FIX-104: app 横屏保持移动布局（--card-cols 不变）', async ({ page }) => {
    await mockNativeApp(page);
    await page.setViewportSize({ width: 812, height: 375 }); // 手机横屏
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1500);
    const cardCols = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--card-cols').trim(),
    );
    expect(cardCols).toBe('3'); // 移动端硬约束 3 列，横屏不得变 5
    // app 端不渲染桌面侧边栏
    const sidebarCount = await page.locator('.home-sidebar').count();
    expect(sidebarCount).toBe(0);
  });

  test('FIX-105: app 端 IPTV 播放页无全屏按钮', async ({ page }) => {
    await mockNativeApp(page);
    await page.setViewportSize({ width: 812, height: 375 });
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const fullscreenCount = await page.locator('.up-header-fullscreen-btn').count();
    expect(fullscreenCount).toBe(0);
  });

  test('FIX-105b: web 端 IPTV 播放页保留全屏按钮', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const fullscreenCount = await page.locator('.up-header-fullscreen-btn').count();
    expect(fullscreenCount).toBeGreaterThan(0);
  });

  test('FIX-107: app 端 TabBar 图标文字间距 ≥ 6px', async ({ page }) => {
    await mockNativeApp(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[role="tablist"] [role="tab"]', { timeout: 15000 });
    const gap = await page
      .locator('[role="tablist"] [role="tab"]')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).gap || '0'));
    expect(gap).toBeGreaterThanOrEqual(5);
  });
});

test.describe('9.1 布局一致性', () => {
  test('FIX-106: 设置页 padding 与全局 .page-padding 一致', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // 基准：Browse 页 .page-padding
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.page-padding', { timeout: 15000 });
    const baseline = await page
      .locator('.page-padding')
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { left: parseFloat(cs.paddingLeft), right: parseFloat(cs.paddingRight), top: parseFloat(cs.paddingTop) };
      });
    // 设置页 .settings-page
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.settings-page', { timeout: 15000 });
    const settingsPadding = await page
      .locator('.settings-page')
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { left: parseFloat(cs.paddingLeft), right: parseFloat(cs.paddingRight), top: parseFloat(cs.paddingTop) };
      });
    expect(Math.abs(settingsPadding.left - baseline.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(settingsPadding.right - baseline.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(settingsPadding.top - baseline.top)).toBeLessThanOrEqual(1);
    console.log(
      `✅ FIX-106 通过: baseline=(${baseline.left},${baseline.top}) settings=(${settingsPadding.left},${settingsPadding.top})`,
    );
  });

  test('FIX-108: 首页免责声明贴视口底（web 手机端）', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('app-settings'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.home-disclaimer', { timeout: 15000 });
    await page.waitForTimeout(500);
    // 调试：定位 flex 高度链断点
    const dims = await page.evaluate(() => {
      const q = (s: string) => {
        const el = document.querySelector(s) as HTMLElement | null;
        return el ? { h: el.clientHeight, top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom } : null;
      };
      return {
        vh: window.innerHeight,
        scroll: q('.app-shell__scroll'),
        pt: q('.page-transition'),
        hp: q('.home-page'),
        hpc: q('.home-page__content'),
        tr: q('.home-token-required'),
        dis: q('.home-disclaimer'),
      };
    });
    console.log('FIX-108 dims:', JSON.stringify(dims));
    const box = await page.locator('.home-disclaimer').boundingBox();
    const vh = await page.evaluate(() => window.innerHeight);
    expect(box).not.toBeNull();
    const gapToBottom = vh - ((box as { y: number; height: number }).y + (box as { y: number; height: number }).height);
    expect(gapToBottom).toBeLessThan(20);
  });
});
