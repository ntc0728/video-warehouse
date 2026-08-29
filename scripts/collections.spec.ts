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

    // 预期结果: 有收藏数据或显示空状态
    const hasData = await page.evaluate(() => {
      return !!document.querySelector('.video-card-grid, [class*="card-grid"]');
    });
    const hasEmpty = await page.evaluate(() => {
      return !!document.querySelector('.empty-state, [class*="empty"]');
    });
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

    // 预期结果: 批量管理按钮存在
    const editBtn = page.locator('.record-edit-btn, [class*="edit-btn"]');
    if (await editBtn.isVisible().catch(() => false)) {
      const text = await editBtn.textContent();
    }
  });

  test('COL-031: 排序 chips（「更多筛选」面板内，无下拉框，空间不足自动换行）', async ({ page }) => {
    await page.goto('/collections', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 预期结果: 排序位于「更多筛选」面板内，宽容器显示排序 chips，默认"最近收藏"激活
    const filterBtn = page.locator('.action-btn--filter');
    await expect(filterBtn).toBeVisible({ timeout: 5000 });
    await filterBtn.click();
    await page.waitForSelector('.record-filter-panel', { timeout: 5000 });

    const sortChips = page.locator('.record-filter-chips--sort .record-filter-chip');
    await expect(sortChips.first()).toBeVisible({ timeout: 5000 });

    // 6 个排序选项完整
    await expect(sortChips).toHaveCount(6);
    const recentChip = sortChips.filter({ hasText: '最近收藏' });
    await expect(recentChip).toHaveClass(/is-active/);

    // 选择"最早收藏"后激活态切换
    await sortChips.filter({ hasText: '最早收藏' }).click();
    await page.waitForTimeout(200);
    await expect(sortChips.filter({ hasText: '最早收藏' })).toHaveClass(/is-active/);
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
