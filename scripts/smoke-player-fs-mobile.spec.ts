import { test, expect, type Page } from './fixtures/mock-tmdb';

/**
 * 真实播放器（UniversalPlayer）移动端全屏整改冒烟测试
 *
 * 覆盖自测整改后的核心行为（对照 commit f02eb23 的需求①/②/④ + 本轮需求①②）：
 *   ① 全屏整改仅限真机移动端 —— PC 桌面 web 全屏保持原样（无角落组/右侧抽屉，音量/画中画组/更多菜单保留）
 *   ② 右侧更多设置抽屉：背景对齐右键菜单、隐藏倍速/字幕/快捷键，保留循环/镜像/画面比例/解码模式
 *   ④ 细节交互：点空白关抽屉、重进全屏抽屉不自动开、移动端点击控制栏已显→不再隐藏（改暂停）
 *   + 改子设置项后自动关抽屉，操作提示（center-toast）完整避开 up-player-header
 *
 * 用 iPhone UA 模拟真机；全屏走 Fullscreen API（headless Chromium 支持）或回退 CSS 伪全屏，
 * 两种都会置 isFullscreen=true → fsMobile 成立 → 触发整改 UI。
 *
 * 运行前需 dev server 就绪（playwright.config webServer 会自动起，或手动 npm run dev）。
 * 本测试使用 `__smoke_fullscreen=1` 参数：开发/冒烟场景下允许在 hasError 时仍进入全屏，
 * 便于在无有效 CMS 源的环境验证全屏 UI（生产构建中该参数无效）。
 */
const TEST_MOVIE_ID = 'tmdb-movie-550';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    // 外链示例视频/代理类网络报错在冒烟中不计为运行时错误
    if (m.type() === 'error' && !/net::ERR|Failed to load resource|MEDIA/i.test(text)) {
      errors.push(`console.error: ${text}`);
    }
  });
  return errors;
}

/** 带冒烟逃生口的播放页 URL */
function playUrl(id: string) {
  return `/play/${id}?__smoke_fullscreen=1`;
}

/** 等播放器挂载并初始化 */
async function waitPlayer(page: Page) {
  await page.waitForSelector('.up-universal-player', { state: 'attached', timeout: 30000 });
  await page.waitForTimeout(3500);
}

/** 让错误遮罩不拦截点击，使点击能落到播放器容器/视频层（用于点击交互测试） */
async function allowClickThroughError(page: Page) {
  await page.addStyleTag({
    content: '.up-player-error-boundary, .up-player-error-boundary * { pointer-events: none !important; }',
  });
}

/** 进入全屏：移动端单行栏里的全屏按钮 */
async function enterFullscreen(page: Page) {
  await page.locator('.up-control-mobile-row .up-header-fullscreen-btn').click();
  await page.waitForSelector('.up-fs-corner', { state: 'visible', timeout: 8000 });
}

test.describe('PC 桌面 web 全屏 —— 整改不生效（需求①）', () => {
  test.use({ viewport: { width: 1280, height: 720 } }); // 默认桌面 UA
  test('PLAYER-FS-PC: 全屏后无角落组/抽屉，音量/画中画组/更多菜单保留', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(playUrl(TEST_MOVIE_ID), { waitUntil: 'domcontentloaded' });
    await waitPlayer(page);

    // 全屏前：无角落组、无抽屉
    await expect(page.locator('.up-fs-corner')).toHaveCount(0);
    await expect(page.locator('.up-fs-drawer')).toHaveCount(0);

    // 进入全屏（桌面底栏全屏按钮）。fullscreen prop 仅对真机移动端为真，
    // PC 桌面全屏应保留原桌面布局（不带移动端整改类）。
    await page.locator('.up-control-bar .up-header-fullscreen-btn').first().click();
    await page.waitForTimeout(1000);

    // 核心回归：PC 桌面全屏不改 —— 无角落组、无右侧抽屉，且控制栏不带移动端整改类
    await expect(page.locator('.up-fs-corner')).toHaveCount(0);
    await expect(page.locator('.up-fs-drawer')).toHaveCount(0);
    await expect(page.locator('.up-control-bar')).not.toHaveClass(/up-control-bar--fullscreen/);

    // 桌面原控制项保留：音量 / 画中画+全屏组 / 更多菜单
    await expect(page.locator('.up-volume-control')).toBeVisible();
    await expect(page.locator('.up-control-window')).toBeVisible();
    await expect(page.locator('.up-more-menu')).toBeVisible();

    expect(errors, `页面存在报错：\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('移动竖屏 —— 底部更多设置弹窗内容不裁（基线）', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA });
  test('PLAYER-FS-V1: 竖屏更多设置弹窗含倍速/字幕（未裁）', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(playUrl(TEST_MOVIE_ID), { waitUntil: 'domcontentloaded' });
    await waitPlayer(page);

    // 竖屏未全屏：无角落组
    await expect(page.locator('.up-fs-corner')).toHaveCount(0);

    // 顶部操作组「更多设置」开竖版弹窗
    await page.locator('.up-header-actions button[aria-label="更多设置"]').click();
    const sheet = page.locator('.up-ms-sheet');
    await expect(sheet).toBeVisible();

    // 竖版保留全部项（含倍速/字幕），抽屉裁剪只针对全屏
    await expect(sheet).toContainText('倍速调节');
    await expect(sheet).toContainText('字幕');
    await expect(sheet).toContainText('画面比例');

    expect(errors, `页面存在报错：\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('移动横屏全屏 —— 角落组 + 右侧抽屉（需求②）', () => {
  test.use({ viewport: { width: 844, height: 390 }, userAgent: IPHONE_UA });
  test('PLAYER-FS-M1: 角落组 + 底栏去音量/循环 + 右侧抽屉（裁剪倍速/字幕/快捷键）', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(playUrl(TEST_MOVIE_ID), { waitUntil: 'domcontentloaded' });
    await waitPlayer(page);

    await enterFullscreen(page);

    // 单行栏已切为全屏桌面布局
    await expect(page.locator('.up-control-mobile-row')).toHaveCount(0);
    await expect(page.locator('.up-control-bar--fullscreen')).toBeVisible();

    // 底栏已移除音量 / 画中画+全屏组（PiP+全屏改由角落组承担）
    await expect(page.locator('.up-control-bar--fullscreen .up-volume-control')).toHaveCount(0);
    await expect(page.locator('.up-control-bar--fullscreen .up-control-window')).toHaveCount(0);

    // 右上角常驻操作组：画中画 / 投屏 / 更多设置
    await expect(page.locator('.up-fs-corner button[aria-label="更多设置"]')).toBeVisible();

    // 点「更多设置」→ 右侧抽屉（不是底部弹窗）
    await page.locator('.up-fs-corner button[aria-label="更多设置"]').click();
    const drawer = page.locator('.up-fs-drawer');
    await expect(drawer).toBeVisible();
    await expect(page.locator('.up-ms-sheet')).toHaveCount(0);

    // 抽屉背景对齐右键菜单（rgba(20,20,20,0.96)）
    await expect(drawer).toHaveCSS('background-color', 'rgba(20, 20, 20, 0.96)');

    // 抽屉保留：循环 / 定时关闭 / 后台听视频 / 镜像 / 画面比例 / 解码模式
    await expect(drawer).toContainText('循环');
    await expect(drawer).toContainText('定时关闭');
    await expect(drawer).toContainText('后台听视频');
    await expect(drawer).toContainText('镜像');
    await expect(drawer).toContainText('画面比例');
    await expect(drawer).toContainText('解码模式');
    await expect(drawer).toContainText('硬解');

    // 抽屉裁剪：倍速 / 字幕 / 键盘快捷键 不应出现
    await expect(drawer).not.toContainText('倍速调节');
    await expect(drawer).not.toContainText('字幕');
    await expect(drawer).not.toContainText('键盘快捷键');

    // 抽屉宽度增大（> 旧 340；横屏矮屏分支命中 @media max-height:480px → min(360px,44%)，常规分支 min(440px,50%)）
    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(340);
    expect(box!.width).toBeLessThan(844 * 0.7);

    expect(errors, `页面存在报错：\n${errors.join('\n')}`).toEqual([]);
  });

  test('PLAYER-FS-TOAST: 改子设置项后关抽屉 + 操作提示避让 header（需求①②）', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(playUrl(TEST_MOVIE_ID), { waitUntil: 'domcontentloaded' });
    await waitPlayer(page);

    await enterFullscreen(page);

    // hasError 场景 header 常显（visible = isControlsVisible || hasError）
    const header = page.locator('.up-player-header');
    await expect(header).toHaveClass(/up-player-header-visible/);

    // 打开抽屉，点「循环播放」子项 chip（默认 loopMode=none → 点「单集循环」必触发 onChange）
    await page.locator('.up-fs-corner button[aria-label="更多设置"]').click();
    const drawer = page.locator('.up-fs-drawer');
    await expect(drawer).toBeVisible();
    await drawer.locator('button').filter({ hasText: /单集循环|列表循环/ }).first().click();

    // 需求②：修改子设置项后抽屉自动关闭
    await expect(page.locator('.up-fs-drawer')).toHaveCount(0);

    // 需求②：播放器内部居中靠上操作提示出现（center-toast）
    const toast = page.locator('.up-player-center-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/单集循环|列表循环/);

    // 需求①：提示完整避开 up-player-header —— toast 顶部 ≥ header 底部
    const toastBox = await toast.boundingBox();
    const headerBox = await header.boundingBox();
    expect(toastBox).not.toBeNull();
    expect(headerBox).not.toBeNull();
    expect(toastBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);

    // 遮挡锁定（真机回归：全屏下 toast portal 到 body 会被 top layer/伪全屏 z-index:9998 盖住）：
    // fullscreen-api 档下 container 处于 top layer → center-toast 必须挂在 container 内部才可见
    const inContainer = await toast.evaluate((el) => el.closest('.up-universal-player') != null);
    expect(inContainer).toBe(true);

    expect(errors, `页面存在报错：\n${errors.join('\n')}`).toEqual([]);
  });

  test('PLAYER-FS-BACK: 全屏下点返回仅退出全屏，不导航离开播放页', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(playUrl(TEST_MOVIE_ID), { waitUntil: 'domcontentloaded' });
    await waitPlayer(page);
    await allowClickThroughError(page);

    await enterFullscreen(page);
    const urlBefore = page.url();

    // 点 header 返回按钮 → 只退出全屏（角落组消失），URL 不变（不导航）
    await page.locator('.up-header-back').click();
    await page.waitForTimeout(800);

    await expect(page.locator('.up-fs-corner')).toHaveCount(0);
    expect(page.url()).toBe(urlBefore);

    // 播放器仍在页面上（未离开播放页）
    await expect(page.locator('.up-universal-player')).toBeAttached();

    expect(errors, `页面存在报错：\n${errors.join('\n')}`).toEqual([]);
  });

  test('PLAYER-FS-M2: 点空白关抽屉 + 重进全屏抽屉不自动开（需求④）', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(playUrl(TEST_MOVIE_ID), { waitUntil: 'domcontentloaded' });
    await waitPlayer(page);
    await allowClickThroughError(page);

    await enterFullscreen(page);
    await page.locator('.up-fs-corner button[aria-label="更多设置"]').click();
    await page.waitForSelector('.up-fs-drawer', { state: 'visible', timeout: 5000 });

    // 点播放器空白（视频区，避开右侧抽屉与右上角组）→ 抽屉关闭
    // 用 force 穿透 .up-player-core 拦截层（仅绕过 Playwright actionability 检查，事件仍落到真实播放器处理器）
    await page.locator('.up-player-video').click({ force: true });
    await page.waitForTimeout(300);
    await expect(page.locator('.up-fs-drawer')).toHaveCount(0);

    // 退出全屏再进入：抽屉不应自动弹出（需手动点更多）
    await page.locator('.up-control-bar--fullscreen .up-header-fullscreen-btn').click();
    await expect(page.locator('.up-fs-corner')).toHaveCount(0);
    await enterFullscreen(page);
    // 重进后抽屉默认关闭
    await expect(page.locator('.up-fs-drawer')).toHaveCount(0);
    // 手动点更多才出现
    await page.locator('.up-fs-corner button[aria-label="更多设置"]').click();
    await expect(page.locator('.up-fs-drawer')).toBeVisible();

    expect(errors, `页面存在报错：\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('移动竖屏点击语义（需求④：已显→不隐藏，改暂停）', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA });
  test('PLAYER-FS-CLICK: 控制栏已显时单击空白不再隐藏控制栏', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(playUrl(TEST_MOVIE_ID), { waitUntil: 'domcontentloaded' });
    await waitPlayer(page);
    await allowClickThroughError(page);

    // 初始控制栏可见（首暂停态常显）
    const bar = page.locator('.up-control-bar');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveClass(/up-control-bar-visible/);

    // 单击播放器空白（视频区中心）；force 穿透 .up-player-core 拦截层
    await page.locator('.up-player-video').click({ force: true });
    // 等待 click 处理器的 250ms 定时器结束
    await page.waitForTimeout(450);

    // 新逻辑：控制栏已显 → 切换播放/暂停，而非隐藏。故控制栏不应进入 hidden 态
    await expect(bar).not.toHaveClass(/up-control-bar-hidden/);

    expect(errors, `页面存在报错：\n${errors.join('\n')}`).toEqual([]);
  });
});
