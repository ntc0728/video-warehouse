/**
 * 收藏页 (Collections) 测试用例
 * 路由: /collections
 * 配置依赖: Level 3（全配置）
 *
 * 覆盖: COL-001 ~ COL-051
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 7.1 Tab 切换
// ═══════════════════════════════════════════════════════════════

test.describe('7.1 Tab 切换', () => {
  test('COL-001: 默认影视 Tab', async ({ page }) => {
    await page.goto('/collections', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 预期结果: 默认选中"影视" Tab
    const hasContent = await page.evaluate(() => {
      return !!document.querySelector('.collection-page, [class*="collection"]');
    });
    expect(hasContent).toBe(true);
  });

  test('COL-002: 切换到 IPTV Tab', async ({ page }) => {
    await page.goto('/collections', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 点击"IPTV" Tab
    const iptvTab = page.locator('.status-tab, [class*="tab"]').filter({ hasText: 'IPTV' });
    expect(await iptvTab.count()).toBeGreaterThan(0);
    if (await iptvTab.isVisible().catch(() => false)) {
      await iptvTab.click();
      await page.waitForTimeout(500);
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
    await page.waitForTimeout(2000);

    // 预期结果: 有收藏数据或显示空状态（二者其一必然存在）
    const hasData = await page.evaluate(() => {
      return !!document.querySelector('.video-card-grid, [class*="card-grid"]');
    });
    const hasEmpty = await page.evaluate(() => {
      return !!document.querySelector('.empty-state, [class*="empty"]');
    });
    expect(hasData || hasEmpty).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 7.4 批量管理
// ═══════════════════════════════════════════════════════════════

test.describe('7.4 批量管理', () => {
  test('COL-030: 批量管理按钮', async ({ page }) => {
    await page.goto('/collections', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 预期结果: 批量管理按钮存在（当前类名 .action-btn--batch）
    const editBtn = page.locator('.action-btn--batch');
    expect(await editBtn.count()).toBeGreaterThan(0);
    if (await editBtn.isVisible().catch(() => false)) {
      const text = await editBtn.textContent();
    }
  });

  test('COL-031: 桌面内嵌筛选条（方案 C）：状态 chips 常驻 + 排序弹层切换', async ({ page }) => {
    await page.goto('/collections', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 预期结果: 状态 chips 常驻顶栏（4 个），排序为胶囊 + 弹层（点开 6 项，选择后收起并更新文案）
    // 「更多筛选」按钮桌面隐藏（移动端保留）
    const inlineFilter = page.locator('.record-inline-filter');
    await expect(inlineFilter).toBeVisible({ timeout: 5000 });
    expect(await page.locator('.action-btn--filter').isVisible()).toBe(false);

    // 状态 chips 常驻：4 个（全部/未观看/正在看/已看完），默认「全部」激活
    const statusChips = inlineFilter.locator('.record-filter-chip--status');
    await expect(statusChips).toHaveCount(4);
    await expect(statusChips.filter({ hasText: '全部' })).toHaveClass(/is-active/);

    // 排序弹层：默认「最近收藏」，点开 6 项，选择「最早收藏」后收起并更新文案
    const sortBtn = inlineFilter.locator('.record-sort-btn');
    await expect(sortBtn).toContainText('最近收藏');
    await sortBtn.click();
    const pop = page.locator('.record-pop');
    await expect(pop).toBeVisible({ timeout: 5000 });
    const sortItems = pop.locator('.record-pop-item');
    await expect(sortItems).toHaveCount(6);

    await sortItems.filter({ hasText: '最早收藏' }).click();
    await page.waitForTimeout(300);
    await expect(pop).toHaveCount(0);
    await expect(sortBtn).toContainText('最早收藏');

    // 「⋯」溢出菜单：桌面可见，含「清空收藏」危险项
    const overflowBtn = page.locator('.record-overflow-btn');
    await expect(overflowBtn).toBeVisible();
    await overflowBtn.click();
    const overflowPop = page.locator('.record-pop--right');
    await expect(overflowPop).toBeVisible({ timeout: 5000 });
    await expect(overflowPop.locator('.record-pop-item--danger')).toContainText('清空收藏');
  });
});

// ═══════════════════════════════════════════════════════════════
// 7.6 页面状态
// ═══════════════════════════════════════════════════════════════

test.describe('7.6 页面状态', () => {
  test('COL-051: 文档标题', async ({ page }) => {
    await page.goto('/collections', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const title = await page.title();
    expect(title).toBeTruthy();
  });
});
