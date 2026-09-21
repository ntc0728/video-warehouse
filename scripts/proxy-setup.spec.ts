/**
 * 代理配置页 (ProxySetup) 测试用例
 * 路由: /proxy-setup（设置页的子页，从设置页进入）
 * 覆盖: PROXY-001 ~ PROXY-003
 *
 * 2026-09-21 用户拍板：设置页**子页**（源检测 / 代理配置）移出默认 e2e 套，改按需
 *   `npm run test:e2e:subpages`。设置页本体（settings.spec）保留默认套。
 *   本文件用例自 regression.spec.ts 的「代理配置」describe 原样抽出（断言不弱化）。
 */
import { test, expect } from './fixtures/mock-tmdb';

test.describe('代理配置', () => {
  test('PROXY-001: 路由可访问，页面结构完整', async ({ page }) => {
    await page.goto('/proxy-setup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.proxy-setup', { timeout: 10000 });
    // 等标题渲染，替代固定 800ms 睡眠
    await expect(page.locator('.proxy-setup__title')).toBeVisible({ timeout: 2000 });
    const title = await page.locator('.proxy-setup__title').textContent();
    expect(title).toContain('一键配置代理');
    const cardCount = await page.locator('.proxy-setup__card').count();
    expect(cardCount).toBe(2);
    const consoleVisible = await page.locator('.proxy-setup__console').isVisible().catch(() => false);
    expect(consoleVisible).toBe(true);
  });

  test('PROXY-002/003: 选择高亮 + 未填 Token 报错', async ({ page }) => {
    await page.goto('/proxy-setup', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.proxy-setup', { timeout: 10000 });
    // 等卡片渲染，替代固定 800ms 睡眠
    const corsCard = page.locator('.proxy-setup__card').first();
    await expect(corsCard).toBeVisible({ timeout: 2000 });
    await corsCard.click();
    // 等选中态 class 生效，替代固定 300ms 睡眠
    await expect.poll(() => corsCard.evaluate((el) => el.classList.contains('is-selected')),
      { timeout: 2000 }).toBe(true);
    expect(await corsCard.evaluate((el) => el.classList.contains('is-selected'))).toBe(true);
    const logText = await page.locator('.proxy-setup__console').textContent();
    expect(logText).toContain('已选择');

    // PROXY-003
    await page.getByRole('button', { name: /开始一键配置 Worker/ }).click();
    // 等控制台输出「请填写 Cloudflare API Token」，替代固定 300ms 睡眠
    await expect.poll(async () => (await page.locator('.proxy-setup__console').textContent()) ?? '',
      { timeout: 2000 }).toContain('请填写 Cloudflare API Token');
    const logText2 = await page.locator('.proxy-setup__console').textContent();
    expect(logText2).toContain('请填写 Cloudflare API Token');
  });
});
