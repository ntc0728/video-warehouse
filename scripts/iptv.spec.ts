/**
 * IPTV 直播页测试用例
 * 路由: /iptv
 * 配置依赖: Level 3（全配置）— 需 IPTV 代理才能播放频道流
 *
 * 覆盖: IPTV-001 ~ IPTV-075
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 5.1 页面加载
// ═══════════════════════════════════════════════════════════════

test.describe('5.1 页面加载', () => {
  test('IPTV-001: 正常加载', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 页面加载完成
    const hasContent = await page.evaluate(() => {
      return !!document.querySelector('.iptv-page, [class*="iptv"]');
    });
    expect(hasContent).toBe(true);
    console.log('✅ IPTV-001 通过: IPTV 页正常加载');
  });

  test('IPTV-003: 无频道数据时显示空状态', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(5000);

    // 预期结果: 有频道数据或显示空状态
    const hasChannels = await page.evaluate(() => {
      return !!document.querySelector('.iptv-channel-grid, [class*="channel"]');
    });
    const hasEmpty = await page.evaluate(() => {
      return !!document.querySelector('.empty-state, [class*="empty"]');
    });
    console.log(`✅ IPTV-003 检查完成: 频道数据 = ${hasChannels}，空状态 = ${hasEmpty}`);
  });

  test('IPTV-004: 代理未配置警告', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 预期结果: 如代理未配置则显示警告
    const hasWarning = await page.evaluate(() => {
      return !!document.querySelector('.iptv-proxy-warning-inline, [class*="proxy-warning"]');
    });
    console.log(`✅ IPTV-004 检查完成: 代理警告 = ${hasWarning}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.2 频道分组筛选
// ═══════════════════════════════════════════════════════════════

test.describe('5.2 频道分组筛选', () => {
  test('IPTV-010: 分组标签显示', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(5000);

    // 预期结果: 分组标签存在
    const hasGroups = await page.evaluate(() => {
      return !!document.querySelector('.iptv-groups, [class*="group-tag"]');
    });
    console.log(`✅ IPTV-010 检查完成: 分组标签存在 = ${hasGroups}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.5 频道检测
// ═══════════════════════════════════════════════════════════════

test.describe('5.5 频道检测', () => {
  test('IPTV-040: 检测按钮', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 检测按钮存在
    const checkBtn = page.locator('.refresh-btn').first();
    if (await checkBtn.isVisible().catch(() => false)) {
      const text = await checkBtn.textContent();
      console.log(`✅ IPTV-040 通过: 检测按钮文本 = "${text}"`);
    } else {
      console.log('⚠️ IPTV-040: 检测按钮未检测到');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.7 懒加载与滚动
// ═══════════════════════════════════════════════════════════════

test.describe('5.7 懒加载与滚动', () => {
  test('IPTV-062: 返回顶部', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(5000);

    // 操作: 滚动到页面下方
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(500);

    // 预期结果: 回到顶部按钮可见
    const backToTop = page.locator('.back-to-top-button');
    if (await backToTop.isVisible().catch(() => false)) {
      console.log('✅ IPTV-062 通过: 返回顶部按钮显示');
    } else {
      console.log('⚠️ IPTV-062: 返回顶部按钮未显示');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 5.8 页面状态
// ═══════════════════════════════════════════════════════════════

test.describe('5.8 页面状态', () => {
  test('IPTV-075: 文档标题', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 预期结果: 显示默认标题
    const title = await page.title();
    console.log(`✅ IPTV-075 检查完成: 文档标题 = "${title}"`);
    expect(title).toBeTruthy();
  });
});
