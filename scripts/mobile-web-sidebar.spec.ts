import { test, expect } from '@playwright/test';

/**
 * 移动端 Web 侧边栏交互测试
 *
 * useIsMobile() 基于 viewport ≤ 1023px 判断，不依赖 touch 属性。
 * Playwright 通过 setViewportSize 即可触发移动端布局。
 */

/* ─── data-device 属性 ─────────────────────────────────────── */
test.describe('Mobile web sidebar: data-device attribute', () => {
  test('html has data-device="mobile-web" on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const device = await page.getAttribute('html', 'data-device');
    expect(device).toBe('mobile-web');
  });

  test('html has empty data-device on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const device = await page.getAttribute('html', 'data-device');
    expect(device).toBe('');
  });
});

/* ─── 菜单图标 ─────────────────────────────────────────────── */
test.describe('Mobile web sidebar: menu button', () => {
  test('menu button is visible instead of logo on mobile web', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const menuBtn = page.locator('.sticky-header__menu-btn');
    await expect(menuBtn).toBeVisible();
    const logoGroup = page.locator('.sticky-header__logo-group');
    await expect(logoGroup).toHaveCount(0);
  });

  test('logo group is visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const logoGroup = page.locator('.sticky-header__logo-group');
    await expect(logoGroup).toBeVisible();
  });

  test('menu button replaces logo when viewport changes to mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('.sticky-header__logo-group')).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('.sticky-header__menu-btn')).toBeVisible();
    await expect(page.locator('.sticky-header__logo-group')).toHaveCount(0);
  });
});

/* ─── 侧边栏打开/关闭 ──────────────────────────────────────── */
test.describe('Mobile web sidebar: open/close', () => {
  test('clicking menu button opens sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.sticky-header__menu-btn').click();
    const sidebar = page.locator('.sidebar-container--mobile');
    await expect(sidebar).toHaveClass(/sidebar-container--open/);
  });

  test('clicking overlay closes sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.sticky-header__menu-btn').click();
    await expect(page.locator('.sidebar-container--mobile')).toHaveClass(/sidebar-container--open/);
    await page.locator('.sidebar-overlay').click({ position: { x: 300, y: 400 } });
    await expect(page.locator('.sidebar-container--mobile')).not.toHaveClass(/sidebar-container--open/);
  });

  test('clicking X button closes sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.sticky-header__menu-btn').click();
    await page.locator('.sidebar-toggle-btn').click();
    await expect(page.locator('.sidebar-container--mobile')).not.toHaveClass(/sidebar-container--open/);
  });

  test('menu icon toggles to X when sidebar is open', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const menuBtn = page.locator('.sticky-header__menu-btn');
    await expect(menuBtn).toHaveAttribute('aria-label', '打开导航菜单');
    await menuBtn.click();
    await expect(menuBtn).toHaveAttribute('aria-label', '关闭导航菜单');
  });
});

/* ─── 侧边栏导航项 ─────────────────────────────────────────── */
test.describe('Mobile web sidebar: navigation items', () => {
  test('sidebar contains all 5 navigation items', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.sticky-header__menu-btn').click();
    const items = page.locator('.sidebar-container--mobile .sidebar-nav-item');
    await expect(items).toHaveCount(5);
  });

  test('clicking nav item closes sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.sticky-header__menu-btn').click();
    await page.locator('.sidebar-container--mobile .sidebar-nav-item').nth(2).click();
    await expect(page.locator('.sidebar-container--mobile')).not.toHaveClass(/sidebar-container--open/);
  });

  test('clicking nav item navigates to correct route', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.sticky-header__menu-btn').click();
    await page.locator('.sidebar-container--mobile .sidebar-nav-item').nth(2).click();
    await page.waitForURL('**/collections');
    expect(page.url()).toContain('/collections');
  });
});

/* ─── 滚动锁定 ─────────────────────────────────────────────── */
test.describe('Mobile web sidebar: scroll lock', () => {
  test('body overflow is hidden when sidebar is open', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.sticky-header__menu-btn').click();
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('hidden');
  });

  test('body overflow is restored after sidebar closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.sticky-header__menu-btn').click();
    await page.locator('.sidebar-overlay').click({ position: { x: 300, y: 400 } });
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('');
  });
});

/* ─── header nav 隐藏 ───────────────────────────────────────── */
test.describe('Mobile web sidebar: header nav hidden', () => {
  test('header nav items are hidden on mobile web', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const navDisplay = await page.evaluate(() => {
      const navs = document.querySelectorAll('.sticky-header__nav');
      return Array.from(navs).map(n => getComputedStyle(n).display);
    });
    for (const d of navDisplay) {
      expect(d).toBe('none');
    }
  });

  test('header brand is not rendered on mobile web', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const brandCount = await page.locator('.sticky-header__brand').count();
    expect(brandCount).toBe(0);
  });
});
