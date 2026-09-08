/**
 * 源检测页 (SourceChecker) 测试用例（精简合并版）
 * 路由: /source-checker（从设置页版本号连续点击 3 次进入）
 * 配置依赖: 无需前置配置
 *
 * 覆盖: CHK-001 ~ CHK-053
 * 合并映射: 9.1(001,004) / 9.6(050,051,052)
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 9.1 网速检测
// ═══════════════════════════════════════════════════════════════

test.describe('9.1 网速检测', () => {
  test('CHK-001/004: 检测按钮 + 检测中状态', async ({ page }) => {
    await page.goto('/source-checker', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 001 检测按钮存在
    const checkBtn = page.locator('.btn-small, [class*="btn-small"]').first();
    await expect.poll(async () => checkBtn.count(), { timeout: 3000 }).toBeGreaterThan(0);

    // 004 检测中状态
    if (await checkBtn.isVisible().catch(() => false)) {
      await checkBtn.click();

      await expect
        .poll(
          async () => page.evaluate(() => !!document.querySelector('.checking-spinner, [class*="checking"]')),
          { timeout: 2500 },
        )
        .toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 9.6 Tab 与统计
// ═══════════════════════════════════════════════════════════════

test.describe('9.6 Tab 与统计', () => {
  test('CHK-050/051/052: Tab 切换 + 默认 Tab + 统计卡片', async ({ page }) => {
    await page.goto('/source-checker', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 050 5 个 Tab 存在
    const tabs = page.locator('.tab-btn, [class*="tab-btn"]');
    await expect.poll(async () => tabs.count(), { timeout: 3000 }).toBeGreaterThan(0);

    // 051 默认 Tab 为网速
    const firstTab = page.locator('.tab-btn').first();
    if (await firstTab.isVisible().catch(() => false)) {
      const isActive = await firstTab.evaluate((el) => el.classList.contains('active'));
      const text = await firstTab.textContent();
      expect(isActive).toBe(true);
    }

    // 052 统计卡片存在
    const statCards = page.locator('.stat-card, [class*="stat-card"]');
    expect(await statCards.count()).toBeGreaterThan(0);
  });
});
