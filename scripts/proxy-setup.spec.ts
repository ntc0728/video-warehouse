/**
 * 一键配置代理页 (ProxySetup) 测试用例
 * 路由: /proxy-setup（隐藏入口：设置页「关于」点 KinoTV 3 次）
 *
 * 覆盖: PROXY-001 ~ PROXY-003
 * [2026-08-07] 新增 ProxySetup 页面后补的 E2E。
 */
import { test, expect } from './fixtures/mock-tmdb';

test.describe('ProxySetup 一键配置代理页', () => {
  test('PROXY-001: 路由可访问，页面结构完整', async ({ page }) => {
    await page.goto('/proxy-setup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.proxy-setup', { timeout: 15000 });
    await page.waitForTimeout(800);

    // 标题
    const title = await page.locator('.proxy-setup__title').textContent();
    console.log(`✅ PROXY-001: 标题="${title}"`);
    expect(title).toContain('一键配置代理');

    // 两个入口卡片
    const cardCount = await page.locator('.proxy-setup__card').count();
    console.log(`✅ PROXY-001: 入口卡片数量 = ${cardCount}`);
    expect(cardCount).toBe(2);

    // 日志方框存在且含初始提示
    const consoleVisible = await page.locator('.proxy-setup__console').isVisible().catch(() => false);
    console.log(`✅ PROXY-001: 日志方框可见 = ${consoleVisible}`);
    expect(consoleVisible).toBe(true);
  });

  test('PROXY-002: 选择 CORS 入口卡片后高亮 + 日志追加', async ({ page }) => {
    await page.goto('/proxy-setup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.proxy-setup', { timeout: 15000 });
    await page.waitForTimeout(800);

    const corsCard = page.locator('.proxy-setup__card').first();
    await corsCard.click();
    await page.waitForTimeout(300);

    const isSelected = await corsCard.evaluate((el) => el.classList.contains('is-selected'));
    console.log(`✅ PROXY-002: CORS 卡片选中态 = ${isSelected}`);
    expect(isSelected).toBe(true);

    // 日志追加了「已选择」
    const logText = await page.locator('.proxy-setup__console').textContent();
    console.log(`✅ PROXY-002: 日志包含选择提示 = ${logText?.includes('已选择')}`);
    expect(logText).toContain('已选择');
  });

  test('PROXY-003: 未填 Token/AccountID 点配置 → 日志报错', async ({ page }) => {
    await page.goto('/proxy-setup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.proxy-setup', { timeout: 15000 });
    await page.waitForTimeout(800);

    // 选择入口
    await page.locator('.proxy-setup__card').first().click();
    await page.waitForTimeout(300);

    // 不填 Token / AccountID，直接点「开始一键配置 Worker」
    await page.getByRole('button', { name: /开始一键配置 Worker/ }).click();
    await page.waitForTimeout(300);

    const logText = await page.locator('.proxy-setup__console').textContent();
    console.log(`✅ PROXY-003: 日志含错误提示 = ${logText?.includes('请填写 Cloudflare API Token')}`);
    expect(logText).toContain('请填写 Cloudflare API Token');
  });
});
