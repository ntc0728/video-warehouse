/**
 * 代理配置页 (ProxySetup) 测试用例
 * 路由: /proxy-setup（设置页的子页，从设置页进入）
 * 覆盖: PROXY-001 ~ PROXY-003
 *
 * 设置页**子页**（源检测 / 代理配置）不在默认 e2e 套内，按需跑
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
    // 右栏常驻控制台为底部日志坞（收起为一行状态条）
    const dockBarVisible = await page.locator('.proxy-setup__dock-bar').isVisible().catch(() => false);
    expect(dockBarVisible).toBe(true);
  });

  test('PROXY-002/003: 选择高亮 + 步骤门控（未填置灰）', async ({ page }) => {
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

    // PROXY-003：2026-11-09 步骤门控 —— 必填值未填时「下一步」与未解锁的步骤导航项置灰不可点
    const step3Btn = page.getByRole('button', { name: /部署与回写/ });
    await expect(step3Btn).toBeDisabled({ timeout: 2000 });
    await page.getByRole('button', { name: /下一步：填凭证/ }).click();
    // 凭证未填：③ 仍锁定
    await expect(step3Btn).toBeDisabled({ timeout: 2000 });
    await page.locator('#cf-token').fill('test-token');
    await page.locator('#cf-account').fill('test-account');
    await expect(step3Btn).toBeEnabled({ timeout: 2000 });
    await step3Btn.click();
    const deployBtn = page.getByRole('button', { name: /开始一键配置 Worker/ });
    await expect(deployBtn).toBeVisible({ timeout: 2000 });
    // 拦截真实 Cloudflare 请求（快速失败），部署入口日志为同步写入，断言不依赖网络结果
    await page.route('**api.cloudflare.com/**', (route) => route.abort());
    await deployBtn.click();
    await expect.poll(async () => (await page.locator('.proxy-setup__console').textContent()) ?? '',
      { timeout: 2000 }).toContain('开始配置「视频采集 CORS 代理」');
  });
});
