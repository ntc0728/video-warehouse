import { test, expect } from '@playwright/test';

/**
 * 移动端播放器整改 Demo 冒烟测试
 *
 * 覆盖用户提出的两个核心场景：
 *  ① 竖屏：点「更多设置」→ 底部弹窗必须占满设备宽度（回归「某些设备没占满」）
 *  ② 横屏：自动切全屏 UI → 右上角常驻画中画/投屏/更多设置，点更多设置开右侧抽屉
 *
 * 运行前需本地 dev server 就绪，端口可用 PML_BASE_URL 覆盖。
 */
const BASE = process.env.PML_BASE_URL ?? 'http://127.0.0.1:3001';

function collectErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    // demo 里会加载外链示例视频，网络类报错不算运行时错误
    if (m.type() === 'error' && !/net::ERR|Failed to load resource|MEDIA/i.test(text)) {
      errors.push(`console.error: ${text}`);
    }
  });
  return errors;
}

test.describe('竖屏（iPhone 14 · 390×844）', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('底部更多设置弹窗占满设备宽度', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${BASE}/player-mobile-lab`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pml-page', { timeout: 20000 });

    // 竖屏走精简控制栏
    await expect(page.locator('.pml-portrait-bar')).toBeVisible();
    await expect(page.locator('.pml-fs-corner')).toHaveCount(0);

    // 打开更多设置
    await page.locator('.pml-pt-btn[aria-label="更多设置"]').click();
    await page.waitForSelector('.pml-sheet', { state: 'visible', timeout: 5000 });

    const box = await page.locator('.pml-sheet').boundingBox();
    expect(box, '弹窗必须能取到尺寸').not.toBeNull();
    // 回归要点：宽度必须等于视口宽，不能因 max-width / body padding 补偿而收窄
    expect(Math.round(box!.width)).toBe(390);

    await expect(page.locator('.pml-sheet')).toContainText('倍速调节');
    await expect(page.locator('.pml-sheet')).toContainText('画面比例');

    expect(errors, `页面存在报错：\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('横屏（iPhone 14 横置 · 844×390）', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('自动切全屏 UI：右上角操作组 + 右侧抽屉', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${BASE}/player-mobile-lab`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pml-page', { timeout: 20000 });

    // 横屏自动进入改造后的全屏 UI（无需真全屏）
    await expect(page.locator('.pml-fs-corner')).toBeVisible();
    await expect(page.locator('.pml-fs-bar')).toBeVisible();
    // 竖屏精简栏不再出现
    await expect(page.locator('.pml-portrait-bar')).toHaveCount(0);

    // 右上角三个入口常驻
    await expect(page.locator('.pml-fs-corner-btn[aria-label="更多设置"]')).toBeVisible();
    await expect(page.locator('.pml-fs-corner-btn[aria-label="投屏"]')).toBeVisible();

    // 控制栏已移除音量与循环
    await expect(page.locator('.pml-fs-bar .pml-fs-btn[aria-label="音量"]')).toHaveCount(0);
    await expect(page.locator('.pml-fs-bar .pml-fs-btn[aria-label="循环"]')).toHaveCount(0);
    await expect(page.locator('.pml-volume')).toHaveCount(0);

    // 点更多设置 → 右侧抽屉（不是底部弹窗）
    await page.locator('.pml-fs-corner-btn[aria-label="更多设置"]').click();
    await page.waitForSelector('.pml-drawer', { state: 'visible', timeout: 5000 });
    await expect(page.locator('.pml-sheet')).toHaveCount(0);

    const drawer = await page.locator('.pml-drawer').boundingBox();
    expect(drawer).not.toBeNull();
    // 抽屉只占一侧，视频仍可见
    expect(drawer!.width).toBeLessThan(844 * 0.6);
    // 高度吃满播放器，横屏矮屏也不被压成横带
    expect(drawer!.height).toBeGreaterThan(300);

    // 原竖版弹窗内容已搬进抽屉
    await expect(page.locator('.pml-drawer')).toContainText('倍速调节');
    await expect(page.locator('.pml-drawer')).toContainText('字幕');
    await expect(page.locator('.pml-drawer')).toContainText('循环');
    await expect(page.locator('.pml-drawer')).toContainText('画面比例');

    // 抽屉内点击不应冒泡触发播放器暂停
    await page.locator('.pml-drawer .pml-chip').first().click();
    await expect(page.locator('.pml-drawer')).toBeVisible();

    expect(errors, `页面存在报错：\n${errors.join('\n')}`).toEqual([]);
  });
});
