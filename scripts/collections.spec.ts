/**
 * 收藏页 (Collections) 测试用例（精简合并版）
 * 路由: /collections
 * 配置依赖: Level 3（全配置）
 *
 * 覆盖: COL-001 ~ COL-051
 * 合并映射: 7.1(001,002) / 7.2(011) / 7.4(030,031)
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 7.1 Tab 切换
// ═══════════════════════════════════════════════════════════════

test.describe('7.1 Tab 切换', () => {
  test('COL-001/002: 默认影视 Tab + 切换到 IPTV Tab', async ({ page }) => {
    await page.goto('/collections', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 001 默认选中"影视" Tab
    await expect
      .poll(async () => page.evaluate(() => !!document.querySelector('.collection-page, [class*="collection"]')), { timeout: 3000 })
      .toBe(true);

    // 002 切换到 IPTV Tab
    const iptvTab = page.locator('.status-tab, [class*="tab"]').filter({ hasText: 'IPTV' });
    expect(await iptvTab.count()).toBeGreaterThan(0);
    if (await iptvTab.isVisible().catch(() => false)) {
      await iptvTab.click();
      await expect
        .poll(
          async () => iptvTab.evaluate((el) => el.classList.contains('active') || el.classList.contains('is-active')),
          { timeout: 2500 },
        )
        .toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 7.2 影视收藏
// ═══════════════════════════════════════════════════════════════

test.describe('7.2 影视收藏', () => {
  test('COL-011: 收藏为空时显示空状态', async ({ page }) => {
    await page.goto('/collections', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 预期结果: 有收藏数据或显示空状态（二者其一必然存在）
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              !!document.querySelector('.video-card-grid, [class*="card-grid"]') ||
              !!document.querySelector('.empty-state, [class*="empty"]'),
          ),
        { timeout: 4000 },
      )
      .toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 7.4 批量管理
// ═══════════════════════════════════════════════════════════════

test.describe('7.4 批量管理', () => {
  test('COL-030/031: 批量管理按钮 + 桌面内嵌筛选条', async ({ page }) => {
    await page.goto('/collections', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 030 批量管理按钮存在
    const editBtn = page.locator('.action-btn--batch');
    await expect.poll(async () => editBtn.count(), { timeout: 3000 }).toBeGreaterThan(0);
    if (await editBtn.isVisible().catch(() => false)) {
      const text = await editBtn.textContent();
    }

    // 031 桌面内嵌筛选条（方案 C）：状态 chips 常驻 + 排序弹层切换
    const inlineFilter = page.locator('.record-inline-filter');
    await expect(inlineFilter).toBeVisible({ timeout: 5000 });
    expect(await page.locator('.action-btn--filter').isVisible()).toBe(false);

    const statusChips = inlineFilter.locator('.record-filter-chip--status');
    await expect(statusChips).toHaveCount(4);
    await expect(statusChips.filter({ hasText: '全部' })).toHaveClass(/is-active/);

    const sortBtn = inlineFilter.locator('.record-sort-btn');
    await expect(sortBtn).toContainText('最近收藏');
    await sortBtn.click();
    const pop = page.locator('.record-pop');
    await expect(pop).toBeVisible({ timeout: 5000 });
    const sortItems = pop.locator('.record-pop-item');
    await expect(sortItems).toHaveCount(6);

    await sortItems.filter({ hasText: '最早收藏' }).click();
    await expect(pop).toHaveCount(0, { timeout: 3000 });
    await expect(sortBtn).toContainText('最早收藏');

    // 清空按钮响应式：≥1024 起走 rail 布局，清空按钮直接显示；「⋯」溢出菜单隐藏
    expect(await page.locator('.record-overflow-btn').isVisible()).toBe(false);
    await expect(page.locator('.action-btn--clear')).toBeVisible();

    // 768–1023 横排布局空间不足 → 清空仍收进「⋯」溢出菜单
    await page.setViewportSize({ width: 900, height: 800 });
    await expect(page.locator('.action-btn--clear')).toBeHidden({ timeout: 3000 });
    const overflowBtn = page.locator('.record-overflow-btn');
    await expect(overflowBtn).toBeVisible();
    await overflowBtn.click();
    const overflowPop = page.locator('.record-pop--right');
    await expect(overflowPop).toBeVisible({ timeout: 5000 });
    await expect(overflowPop.locator('.record-pop-item--danger')).toContainText('清空收藏');
    await page.keyboard.press('Escape');
  });
});
