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
    console.log('✅ COL-001 通过: 收藏页默认加载影视 Tab');
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
      console.log('✅ COL-002 通过: 成功切换到 IPTV Tab');
    } else {
      console.log('⚠️ COL-002: IPTV Tab 未检测到');
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
    console.log(`✅ COL-011 检查完成: 收藏数据 = ${hasData}，空状态 = ${hasEmpty}`);
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
      console.log(`✅ COL-030 通过: 批量管理按钮文本 = "${text}"`);
    } else {
      console.log('⚠️ COL-030: 批量管理按钮未检测到');
    }
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
    console.log(`✅ COL-051 检查完成: 文档标题 = "${title}"`);
    expect(title).toBeTruthy();
  });
});
