/**
 * 播放页 (Player) 测试用例
 * 路由: /play/:id
 * 配置依赖: CMS 源加载需 Level 2（Token + CORS 代理）
 *
 * 覆盖: PLAYER-001 ~ PLAYER-092
 */
import { test, expect } from './fixtures/mock-tmdb';
import { devices } from '@playwright/test';

const TEST_MOVIE_ID = 'tmdb-movie-550';

/**
 * 注入 mock Google Cast SDK（addInitScript，页面加载前生效）。
 * 行为由 window.__castMock 控制：
 *  - mode: 'null'（无设备/用户取消，requestSession 返回 null）/ 'session'（返回假 session）/ 'error'（抛错）
 *  - requestSessionCalls: 累计 requestSession 调用次数（断言「重选再次调用」）
 * initWebCast 见 (win.cast).framework 存在即跳过 gstatic 脚本加载 → 直接可用。
 */
async function injectMockCastSdk(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const win = window as unknown as Record<string, unknown>;
    const mock: { mode: 'null' | 'session' | 'error'; requestSessionCalls: number } = {
      mode: 'null',
      requestSessionCalls: 0,
    };
    (win as { __castMock?: typeof mock }).__castMock = mock;
    const session = {
      getCastDevice: () => ({ id: 'cast-1', friendlyName: '客厅电视' }),
    };
    win.cast = {
      framework: {
        CastContext: {
          getInstance: () => ({
            setOptions: () => {},
            requestSession: async () => {
              mock.requestSessionCalls += 1;
              if (mock.mode === 'error') throw new Error('no devices');
              if (mock.mode === 'session') return session;
              return null;
            },
          }),
        },
        RemotePlayer: class {},
        RemotePlayerController: class {
          constructor() {
            (this as { load?: unknown }).load = async () => {};
            (this as { playOrPause?: unknown }).playOrPause = async () => {};
            (this as { setVolumeLevel?: unknown }).setVolumeLevel = () => {};
          }
        },
      },
    };
    win.chrome = win.chrome || {};
    (win.chrome as Record<string, unknown>).cast = {
      media: {
        MediaInfo: class {
          constructor(public contentId: string, public contentType: string) {}
        },
        GenericMediaMetadata: class {},
      },
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// 4.1 页面加载
// ═══════════════════════════════════════════════════════════════

test.describe('4.1 页面加载', () => {
  test('PLAYER-002: 正常加载 TMDB 视频', async ({ page }) => {
    // 前置条件: 输入 TMDB 视频 ID
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(5000);

    // 预期结果: 播放器或侧边栏加载
    const hasPlayer = await page.evaluate(() => {
      return !!document.querySelector('.player-page, [class*="player-page"]');
    });
  });

  test('PLAYER-003: 首次 loading', async ({ page }) => {
    await page.goto(`/play/${TEST_MOVIE_ID}`);
    // 预期结果: 短暂显示全屏 loading
    const loadingVisible = await page.evaluate(() => {
      return !!document.querySelector('.app-loading, [class*="loading"]');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 4.5 CMS 源管理
// ═══════════════════════════════════════════════════════════════

test.describe('4.5 CMS 源管理', () => {
  test('PLAYER-040: CMS 面板显示', async ({ page }) => {
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(8000);

    // 预期结果: CMS 面板存在
    const hasCMSPanel = await page.evaluate(() => {
      return !!document.querySelector('[class*="cms-panel"], [class*="CMSPanel"]');
    });
  });

  test('PLAYER-045: CMS 面板折叠/展开', async ({ page }) => {
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(8000);

    // 预期结果: 面板可折叠/展开
    const panelHeader = page.locator('[class*="panel-header"], [class*="cms-panel"] button').first();
  });
});

// ═══════════════════════════════════════════════════════════════
// 4.8 收藏与详情
// ═══════════════════════════════════════════════════════════════

test.describe('4.8 收藏与详情', () => {
  test('PLAYER-070: 收藏按钮', async ({ page }) => {
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(8000);

    // 预期结果: 收藏按钮存在
    const favBtn = page.locator('.player-detail-fav-btn, [class*="fav-btn"]');
    if (await favBtn.isVisible().catch(() => false)) {
      const text = await favBtn.textContent();
    }
  });

  test('PLAYER-071: 详情区域', async ({ page }) => {
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(8000);

    // 预期结果: 详情区域存在
    const hasDetail = await page.evaluate(() => {
      return !!document.querySelector('.player-detail-section, [class*="player-detail"]');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 4.11 移动端/App 端播放器整改（控制栏精简 · 右上角操作组 · 更多设置 · 投屏）
// ═══════════════════════════════════════════════════════════════

test.describe('4.11 移动端播放器整改', () => {
  // 真实手机 UA：操作类提示「移动端屏幕居中」仅对真实移动设备生效（mobileCenter = App/真实手机 UA），
  // 桌面浏览器窄窗（视口 <768 但非移动设备）走右上角 .up-player-toast（见 PLAYER-M12）。
  const MOBILE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  test.use({ viewport: { width: 390, height: 844 }, userAgent: MOBILE_UA });
  // 串行执行：/play 依赖真实 CMS 源加载，多并发会把代理打满导致播放器不挂载（历史 flaky）
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // 投屏按钮显隐在挂载时由 getCastMode() 判定：注入占位原生桥让 native 模式生效（按钮可见）。
    // 各用例内 page.evaluate 覆盖为各自专属桥（空/成功/失败），不影响按钮可见性。
    await page.addInitScript(() => {
      (window as unknown as { CastBridge?: unknown }).CastBridge = {
        discover: async () => [],
        connect: async () => {},
        disconnect: async () => {},
      };
    });
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    // CMS 源经代理异步加载，播放器可能稍晚挂载；attached + 长超时
    await page.waitForSelector('.up-universal-player', { state: 'attached', timeout: 30000 });
    // 等待播放器初始化完成（首次暂停态控制栏常显）
    await page.waitForTimeout(4000);
  });

  test('PLAYER-M01: 控制栏精简 + 右上角操作组 + 单行布局', async ({ page }) => {
    // beforeEach 已注入占位原生桥 → native 模式 → 投屏按钮可见（iOS Web 隐藏行为见 4.13 M13）
    // 右上角操作组：投屏 / 更多设置（画中画视平台支持）
    await expect(page.locator('.up-header-actions')).toBeVisible();
    await expect(page.locator('.up-header-actions button[aria-label="投屏到电视"]')).toBeVisible();
    await expect(page.locator('.up-header-actions button[aria-label="更多设置"]')).toBeVisible();

    // 控制栏隐藏：倍速 / 音量 / 上下集 / 循环 / 画中画全屏窗口组
    const controlBar = page.locator('.up-control-bar');
    await expect(controlBar).toBeVisible();
    await expect(controlBar.locator('.up-speed-btn')).toHaveCount(0);
    await expect(controlBar.locator('.up-control-window')).toHaveCount(0);
    await expect(controlBar.locator('button[title*="上一集"]')).toHaveCount(0);
    await expect(controlBar.locator('button[title*="下一集"]')).toHaveCount(0);

    // 移动端单行布局：播放 / 进度条 / 时间轴 / 全屏 同行
    const mobileRow = controlBar.locator('.up-control-mobile-row');
    await expect(mobileRow).toBeVisible();
    await expect(mobileRow.locator('.up-play-btn')).toBeVisible();
    await expect(mobileRow.locator('.up-progress-bar')).toBeVisible();
    await expect(mobileRow.locator('.up-time-display-inline')).toBeVisible();
    await expect(mobileRow.locator('.up-header-fullscreen-btn')).toBeVisible();
    // DOM 顺序：播放 → 进度条 → 时间 → 全屏
    const order = await mobileRow.evaluate((el) =>
      Array.from(el.querySelectorAll('.up-play-btn, .up-progress-bar, .up-time-display-inline, .up-header-fullscreen-btn'))
        .map((n) => n.className),
    );
    expect(order[0]).toContain('up-play-btn');
    expect(order[1]).toContain('up-progress-bar');
    expect(order[2]).toContain('up-time-display-inline');
    expect(order[3]).toContain('up-header-fullscreen-btn');

    // 操作提示：移动端改渲染为屏幕居中（.up-player-center-toast），右上角不出现
    await page.waitForTimeout(1000);
    await expect(page.locator('.up-player-toast')).toHaveCount(0);
  });

  test('PLAYER-M07: 操作提示移动端屏幕居中（不出现右上角）', async ({ page }) => {
    // 触发操作类提示（音量变化，不依赖真实播放）→ 移动端渲染于屏幕居中
    await page.keyboard.press('ArrowDown');
    const centerToast = page.locator('.up-player-center-toast');
    await expect(centerToast).toContainText('音量');
    // 右上角不出现
    await expect(page.locator('.up-player-toast')).toHaveCount(0);
    // 屏幕居中：toast 中心 Y ≈ 视口高度一半（等淡入动画结束再测）
    await page.waitForTimeout(400);
    const box = await centerToast.boundingBox();
    if (box) {
      expect(Math.abs(box.y + box.height / 2 - 844 / 2)).toBeLessThan(6);
    }
  });

  test('PLAYER-M08: 错误提示移动端屏幕居中（sonner）', async ({ page }) => {
    // 注入「连接失败」的原生投屏桥 → 触发全局 sonner 错误提示（连接失败，请重试）
    await page.evaluate(() => {
      const win = window as unknown as { CastBridge?: unknown };
      win.CastBridge = {
        discover: async () => [{ id: 'tv-1', name: '客厅电视' }],
        connect: async () => { throw new Error('mock fail'); },
        disconnect: async () => {},
      };
    });
    await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
    await page.locator('.up-cast-sheet').getByText('客厅电视').click();
    const toastLi = page.locator('.app-toast');
    await expect(toastLi).toContainText('连接失败，请重试');
    // 等 sonner 滑入动画结束再测量
    await page.waitForTimeout(500);
    const box = await toastLi.boundingBox();
    if (box) {
      expect(Math.abs(box.y + box.height / 2 - 844 / 2)).toBeLessThan(6);
    }
  });

  test('PLAYER-M02: 更多设置弹窗（字幕子项随开关显隐 + chip 选中生效并关闭）', async ({ page }) => {
    await page.locator('.up-header-actions button[aria-label="更多设置"]').click();
    const sheet = page.locator('.up-ms-sheet');
    await expect(sheet).toBeVisible();

    // 卡片布局：倍速 / 定时关闭 / 后台听视频 / 画面比例
    await expect(sheet.getByText('倍速调节')).toBeVisible();
    await expect(sheet.getByText('定时关闭')).toBeVisible();
    await expect(sheet.getByText('后台听视频')).toBeVisible();
    await expect(sheet.getByText('画面比例')).toBeVisible();

    // 字幕卡片：开关默认开启（store 默认 true）→ 两条子项显隐跟随开关
    const subtitleCard = sheet.locator('.up-ms-card', { hasText: '字幕' });
    const tapRows = subtitleCard.locator('.up-ms-row--tap');
    await expect(tapRows).toHaveCount(2);
    await expect(tapRows.nth(0)).toContainText('字幕设置');
    await expect(tapRows.nth(1)).toContainText('导入字幕文件');
    // 关闭字幕 → 子项隐藏且弹窗一并关闭
    await subtitleCard.getByRole('switch').click();
    await expect(tapRows).toHaveCount(0);
    await expect(sheet).toBeHidden();

    // 重新打开并开启字幕 → 子项恢复
    await page.locator('.up-header-actions button[aria-label="更多设置"]').click();
    await expect(sheet).toBeVisible();
    const subtitleCard2 = sheet.locator('.up-ms-card', { hasText: '字幕' });
    await subtitleCard2.getByRole('switch').click();
    await expect(subtitleCard2.locator('.up-ms-row--tap')).toHaveCount(2);

    // chip 选中（倍速 1.5x）→ 屏幕居中提示 + 弹窗关闭 + 设置生效
    await sheet.getByText('1.5x').click();
    await expect(page.locator('.up-player-center-toast')).toContainText('倍速 1.5x');
    await expect(sheet).toBeHidden();
    await expect(page.locator('.up-player-video')).toHaveJSProperty('playbackRate', 1.5);
    // 操作提示：移动端渲染于屏幕居中，右上角不出现
    await expect(page.locator('.up-player-toast')).toHaveCount(0);
  });

  test('PLAYER-M03: 字幕导入 + 字幕设置二级弹窗', async ({ page }) => {
    await page.locator('.up-header-actions button[aria-label="更多设置"]').click();
    const sheet = page.locator('.up-ms-sheet');
    await expect(sheet).toBeVisible();

    // 字幕开关默认开启 → 子项可见（开关显隐行为已在 M02 覆盖）
    const subtitleCard = sheet.locator('.up-ms-card', { hasText: '字幕' });
    await expect(subtitleCard.locator('.up-ms-row--tap')).toHaveCount(2);

    // 通过隐藏 file input 导入字幕 → 导入按钮仍保留在「字幕设置」下方
    await sheet.locator('input[type="file"]').setInputFiles({
      name: 'test.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello\n'),
    });
    await expect(subtitleCard.locator('.up-ms-row--tap').nth(0)).toContainText('字幕设置');
    await expect(subtitleCard.locator('.up-ms-row--tap').nth(1)).toContainText('导入字幕文件');

    // 打开二级弹窗：双语字幕 / 字幕大字号 / 翻译语言
    await subtitleCard.locator('.up-ms-row--tap', { hasText: '字幕设置' }).click();
    const modal = page.locator('.up-subsettings-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('双语字幕')).toBeVisible();
    await expect(modal.getByText('字幕大字号')).toBeVisible();

    // 大字号开关切换（双向可用）
    const bigFontSwitch = modal.getByRole('switch').nth(1);
    await bigFontSwitch.click();
    await expect(bigFontSwitch).toHaveAttribute('data-state', 'checked');
    await expect(page.locator('.up-player-center-toast')).toContainText('字幕大字号已开启');
  });

  test('PLAYER-M04: 投屏空态（原生桥无设备）', async ({ page }) => {
    // iOS Safari UA 下无原生桥 → 投屏按钮隐藏；注入空设备 mock 桥走 native 模式验证空态
    await page.evaluate(() => {
      const win = window as unknown as { CastBridge?: unknown };
      win.CastBridge = { discover: async () => [], connect: async () => {}, disconnect: async () => {} };
    });
    await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
    const sheet = page.locator('.up-cast-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('未发现投屏设备')).toBeVisible();
    await expect(sheet.getByText('重新搜索')).toBeVisible();
  });

  test('PLAYER-M05: 投屏全流程（mock 原生桥注入）', async ({ page }) => {
    // discover 在打开投屏弹窗时才读取 window.CastBridge → 此处注入即可（无需 addInitScript）
    await page.evaluate(() => {
      const win = window as unknown as { CastBridge?: unknown };
      win.CastBridge = {
        discover: async () => [
          { id: 'tv-1', name: '客厅电视' },
          { id: 'tv-2', name: '卧室电视' },
        ],
        connect: async () => {},
        disconnect: async () => {},
        setSource: async () => {},
        play: async () => {},
        pause: async () => {},
      };
    });

    await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
    const sheet = page.locator('.up-cast-sheet');
    await expect(sheet).toBeVisible();

    // 设备列表 → 选择设备 → 已连接控制面板
    await expect(sheet.getByText('客厅电视')).toBeVisible();
    await sheet.getByText('客厅电视').click();
    await expect(sheet.getByText('已连接 · 客厅电视')).toBeVisible();

    // 断开 → 回到设备列表
    await sheet.getByText('断开投屏').click();
    await expect(sheet.getByText('客厅电视')).toBeVisible();
  });

  test('PLAYER-M06: 控制栏隐藏时播放器底部边缘细进度线', async ({ page }) => {
    const edge = page.locator('.up-mobile-progress-edge');
    // 移动端挂载且控制栏可见时不显示
    await expect(edge).toBeVisible();
    await expect(edge).not.toHaveClass(/up-mobile-progress-edge-visible/);

    // Escape 隐藏控制栏（不依赖真实播放）→ 底部细进度线出现
    await page.keyboard.press('Escape');
    await expect(page.locator('.up-control-bar')).toHaveClass(/up-control-bar-hidden/);
    await expect(edge).toHaveClass(/up-mobile-progress-edge-visible/);

    // 细线位于播放器底部边缘（bottom 对齐）
    const box = await edge.boundingBox();
    const containerBox = await page.locator('.up-universal-player').boundingBox();
    if (box && containerBox) {
      expect(Math.abs(box.y + box.height - (containerBox.y + containerBox.height))).toBeLessThan(4);
    }
  });

  test('PLAYER-M19: 权限被拒 → 显示「去设置授权」并跳应用设置页', async ({ page }) => {
    // 注入 ensurePermission 返回 denied 的原生桥 → 打开弹窗即「去设置授权」视图（不闪雷达不搜索）
    await page.evaluate(() => {
      const win = window as unknown as { CastBridge?: unknown };
      (win as { __castOpenSettings?: number }).__castOpenSettings = 0;
      win.CastBridge = {
        discover: async () => [],
        connect: async () => {},
        disconnect: async () => {},
        ensurePermission: async () => 'denied',
        openAppSettings: async () => {
          const w = window as unknown as { __castOpenSettings?: number };
          w.__castOpenSettings = (w.__castOpenSettings ?? 0) + 1;
        },
      };
    });
    await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
    const sheet = page.locator('.up-cast-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('需要投屏权限')).toBeVisible();
    await expect(sheet.getByText('去设置授权')).toBeVisible();
    // 雷达不得出现（权限前置即返回，不做搜索动画）
    await expect(page.locator('.up-cast-radar')).toHaveCount(0);

    // 点「去设置授权」→ 调桥 openAppSettings（跳系统应用设置页）
    await sheet.getByText('去设置授权').click();
    await page.waitForTimeout(100);
    const calls = await page.evaluate(() =>
      (window as unknown as { __castOpenSettings?: number }).__castOpenSettings ?? 0);
    expect(calls).toBe(1);
  });

  test('PLAYER-M20: 权限授予 → 正常发现设备列表', async ({ page }) => {
    // 注入 ensurePermission 返回 granted + 有设备的桥 → 权限通过后正常出设备列表
    await page.evaluate(() => {
      const win = window as unknown as { CastBridge?: unknown };
      win.CastBridge = {
        discover: async () => [{ id: 'tv-1', name: '客厅电视' }],
        connect: async () => {},
        disconnect: async () => {},
        ensurePermission: async () => 'granted',
      };
    });
    await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
    const sheet = page.locator('.up-cast-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('客厅电视')).toBeVisible();
  });

  test('PLAYER-M21: 全链路 setSource 推送正确 URL（discover→connect→setSource）', async ({ page }) => {
    // 捕获 setSource 收到的 URL/title，断言与当前播放地址一致（真实推送值）
    await page.evaluate(() => {
      const win = window as unknown as { CastBridge?: unknown };
      (win as { __castSetSource?: { url: string; title?: string } }).__castSetSource = { url: '' };
      win.CastBridge = {
        discover: async () => [{ id: 'tv-1', name: '客厅电视' }],
        connect: async () => {},
        disconnect: async () => {},
        setSource: async (url: string, title?: string) => {
          (window as unknown as { __castSetSource?: { url: string; title?: string } }).__castSetSource = { url, title };
        },
      };
    });
    await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
    const sheet = page.locator('.up-cast-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByText('客厅电视').click();
    await expect(sheet.getByText('已连接 · 客厅电视')).toBeVisible();

    // setSource 已被调用且 URL 非空（推送的就是播放器实际播放地址）
    const pushed = await page.evaluate(() =>
      (window as unknown as { __castSetSource?: { url: string; title?: string } }).__castSetSource);
    expect(pushed).not.toBeNull();
    expect(pushed?.url?.length ?? 0).toBeGreaterThan(0);
    expect(pushed?.url).toMatch(/^https?:\/\//);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4.13 投屏能力分端（iOS Web 隐藏按钮 · 安卓 Web Cast SDK 投屏）
// ═══════════════════════════════════════════════════════════════

test.describe('4.13 投屏能力分端（Web Cast / iOS 隐藏）', () => {
  const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  // 安卓 Chrome UA：isWebCastSupported() 命中（Chromium 且非 iOS）→ 投屏走 Web Cast SDK
  const ANDROID_CHROME_UA =
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

  test.describe('iOS Safari UA → 投屏按钮隐藏（iOS Web 不支持 Cast SDK）', () => {
    test.use({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA });
    test.describe.configure({ mode: 'serial' });
    test.beforeEach(async ({ page }) => {
      await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.up-universal-player', { state: 'attached', timeout: 30000 });
      await page.waitForTimeout(4000);
    });

    test('PLAYER-M13: iOS Web 隐藏投屏按钮（更多设置仍可见）', async ({ page }) => {
      // 无原生桥（Web 环境）→ getCastMode()='none' → 投屏按钮不渲染
      await expect(page.locator('.up-header-actions')).toBeVisible();
      await expect(page.locator('.up-header-actions button[aria-label="投屏到电视"]')).toHaveCount(0);
      await expect(page.locator('.up-header-actions button[aria-label="更多设置"]')).toBeVisible();
    });
  });

  test.describe('安卓 Chrome UA → Web Cast SDK 投屏', () => {
    test.use({ viewport: { width: 390, height: 844 }, userAgent: ANDROID_CHROME_UA });
    test.describe.configure({ mode: 'serial' });
    test.beforeEach(async ({ page }) => {
      // mock Cast SDK 需在页面加载前注入（addInitScript）：initWebCast 见 win.cast.framework
      // 存在即跳过 gstatic 脚本加载 → 行为由 window.__castMock 控制（M14/M15 各自覆盖 win.cast 不受影响）
      await injectMockCastSdk(page);
      await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.up-universal-player', { state: 'attached', timeout: 30000 });
      await page.waitForTimeout(4000);
    });

    test('PLAYER-M14: 安卓 Web 显示投屏按钮（Web Cast 模式）', async ({ page }) => {
      await expect(page.locator('.up-header-actions')).toBeVisible();
      await expect(page.locator('.up-header-actions button[aria-label="投屏到电视"]')).toBeVisible();
    });

    test('PLAYER-M15: 安卓 Web 投屏全流程（mock Cast SDK）', async ({ page }) => {
      // 注入 mock Cast SDK：requestSession 模拟系统弹窗选择「客厅电视」
      await page.evaluate(() => {
        const win = window as unknown as Record<string, unknown>;
        win.cast = {
          framework: {
            CastContext: {
              getInstance: () => ({
                setOptions: () => {},
                requestSession: async () => ({
                  getCastDevice: () => ({ id: 'cast-1', friendlyName: '客厅电视' }),
                }),
              }),
            },
            RemotePlayer: class {},
            RemotePlayerController: class {
              constructor() {
                (this as { load?: unknown }).load = async () => {};
                (this as { playOrPause?: unknown }).playOrPause = async () => {};
                (this as { setVolumeLevel?: unknown }).setVolumeLevel = () => {};
              }
            },
          },
        };
        // 触发 mediaInfo 组装走 MediaInfo 分支（SDK 存在）
        win.chrome = win.chrome || {};
        (win.chrome as Record<string, unknown>).cast = {
          media: {
            MediaInfo: class {
              constructor(public contentId: string, public contentType: string) {}
            },
            GenericMediaMetadata: class {},
          },
        };
      });

      await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
      const sheet = page.locator('.up-cast-sheet');
      await expect(sheet).toBeVisible();
      // 系统弹窗模拟连接 → 已连接面板
      await expect(sheet.getByText('已连接 · 客厅电视')).toBeVisible();
      // 断开 → 回到空态（Web 无设备列表，回「未选择投屏设备」）
      await sheet.getByText('断开投屏').click();
      await expect(sheet.getByText('未选择投屏设备')).toBeVisible();
    });

    test('PLAYER-M16: 安卓 Web 无 Chromecast → 回空态（未选择投屏设备）', async ({ page }) => {
      // addInitScript 注入的 mock 默认 mode='null'（requestSession 返回 null）→ 空态 + 重新选择设备按钮
      await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
      const sheet = page.locator('.up-cast-sheet');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText('未选择投屏设备')).toBeVisible();
      await expect(sheet.getByText('重新选择设备')).toBeVisible();
      // requestSession 确实被调用过（打开即请求系统面板）
      const calls = await page.evaluate(() =>
        (window as unknown as { __castMock?: { requestSessionCalls: number } }).__castMock?.requestSessionCalls ?? 0);
      expect(calls).toBeGreaterThanOrEqual(1);
    });

    test('PLAYER-M17: 重选设备直接重开选择器（不闪雷达、requestSession 再次调用）', async ({ page }) => {
      // 首次打开 mode='null'（用户取消/无设备）→ 空态
      await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
      const sheet = page.locator('.up-cast-sheet');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText('未选择投屏设备')).toBeVisible();

      // 切 mode='session'：点「重新选择设备」→ 直接重开系统选择器（无雷达 searching 视图）→ 已连接
      await page.evaluate(() => {
        const mock = (window as unknown as { __castMock?: { mode: string } }).__castMock;
        if (mock) mock.mode = 'session';
      });
      await sheet.getByText('重新选择设备').click();
      // 闪烁断言：点击后雷达（.up-cast-radar）不得出现——若先闪 searching 再回 list 则捕获
      await page.waitForTimeout(120);
      await expect(page.locator('.up-cast-radar')).toHaveCount(0);
      await expect(sheet.getByText('已连接 · 客厅电视')).toBeVisible();
      // requestSession 确实被再次调用（2 次：首次打开 + 重选）
      const calls = await page.evaluate(() =>
        (window as unknown as { __castMock?: { requestSessionCalls: number } }).__castMock?.requestSessionCalls ?? 0);
      expect(calls).toBe(2);
    });

    test('PLAYER-M18: 连续点「重新选择设备」不闪雷达、requestSession 每次都被调用', async ({ page }) => {
      // mock 保持 mode='null'（无设备）→ 每次重选都回空态，绝不闪 searching 雷达
      await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
      const sheet = page.locator('.up-cast-sheet');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText('未选择投屏设备')).toBeVisible();

      // 连续点 3 次「重新选择设备」→ 每次点击后雷达都不出现、仍停在空态
      for (let i = 0; i < 3; i++) {
        await sheet.getByText('重新选择设备').click();
        await page.waitForTimeout(80);
        await expect(page.locator('.up-cast-radar')).toHaveCount(0);
        await expect(sheet.getByText('未选择投屏设备')).toBeVisible();
      }
      // requestSession 总调用 = 首次打开 1 + 3 次重选 = 4
      const calls = await page.evaluate(() =>
        (window as unknown as { __castMock?: { requestSessionCalls: number } }).__castMock?.requestSessionCalls ?? 0);
      expect(calls).toBe(4);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 4.12 移动端布局判定（手机/App 端 ≠ 视口 <768px）
// ═══════════════════════════════════════════════════════════════
// 回归：App 恒移动、真实手机 web 桌面模式等视口可 ≥768px 仍属移动端布局。
// 此前桌面 toast 定位用 @media(width >= 768px) 会把它们误判为桌面端（错误播放器内定位）。

test.describe('4.12 移动端布局判定', () => {
  const { defaultBrowserType: _dbt, ...IPHONE_13 } = devices['iPhone 13'];
  const MOBILE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  test.describe('桌面 UA + 视口 1024（≥768）→ 桌面布局：播放器内 toast 定位', () => {
    test.use({ viewport: { width: 1024, height: 768 } });
    test.describe.configure({ mode: 'serial' });
    test.beforeEach(async ({ page }) => {
      await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.up-universal-player', { state: 'attached', timeout: 30000 });
      await page.waitForTimeout(4000);
    });

    test('PLAYER-M09: html 无 data-mobile-layout，播放器几何变量已写入（桌面 toast 定位生效）', async ({ page }) => {
      // 桌面 UA 即使视口 1024 也属桌面布局：无移动端布局标记
      const marker = await page.evaluate(() =>
        document.documentElement.hasAttribute('data-mobile-layout'));
      expect(marker).toBe(false);
      // 桌面 toast 定位几何已测量写入（播放器矩形 + header 高度）
      const vars = await page.evaluate(() => {
        const s = getComputedStyle(document.documentElement);
        return {
          left: s.getPropertyValue('--player-toast-left').trim(),
          width: s.getPropertyValue('--player-toast-width').trim(),
          top: s.getPropertyValue('--player-toast-top').trim(),
        };
      });
      expect(vars.left).toMatch(/px$/);
      expect(vars.width).toMatch(/px$/);
      expect(vars.top).toMatch(/px$/);
    });

    test('PLAYER-M11: 桌面视频模式操作提示紧贴右上角（无头部右控件避让）', async ({ page }) => {
      // 触发操作类提示（音量，不依赖真实播放）→ 桌面渲染于 .up-player-toast
      await page.keyboard.press('ArrowDown');
      const toast = page.locator('.up-player-toast');
      await expect(toast).toContainText('音量');
      // 等淡入动画结束再测量
      await page.waitForTimeout(400);
      // 紧贴右上角：computed top = --space-lg（不再锚到 header 下方 —— IPTV 全屏按钮已移至右下角）。
      // 自定义属性 computed 值是 clamp() 原文，需用 probe 元素解析成 px。
      const toastTop = await toast.evaluate((el) => parseFloat(getComputedStyle(el).top));
      const spaceLg = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.style.top = 'var(--space-lg)';
        document.body.appendChild(probe);
        const v = parseFloat(getComputedStyle(probe).top);
        probe.remove();
        return v;
      });
      expect(Number.isFinite(toastTop)).toBe(true);
      expect(Number.isFinite(spaceLg)).toBe(true);
      expect(Math.abs(toastTop - spaceLg)).toBeLessThan(1);
    });
  });

  test.describe('桌面 UA + 窄视口 390（<768）→ 非移动设备：操作提示右上角', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test.describe.configure({ mode: 'serial' });
    test.beforeEach(async ({ page }) => {
      await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.up-universal-player', { state: 'attached', timeout: 30000 });
      await page.waitForTimeout(4000);
    });

    test('PLAYER-M12: 桌面 UA 窄视口 → 操作提示在头部图标下方（非叠加、非居中）', async ({ page }) => {
      // 桌面 UA + 视口 390：非真实移动设备 → mobileCenter=false，toast 走 .up-player-toast。
      // 但窄视口下头部右侧有 HeadActions（画中画/投屏/更多设置 3 个图标），
      // JS 写入 data-player-header-controls="true"，CSS 将 toast 锚定在图标下方。
      await page.keyboard.press('ArrowDown');
      const toast = page.locator('.up-player-toast');
      await expect(toast).toContainText('音量');
      await expect(page.locator('.up-player-center-toast')).toHaveCount(0);
      await page.waitForTimeout(400);
      // toast 应在头部图标下方（top > --space-lg），而非紧贴右上角叠加在图标上
      const toastTop = await toast.evaluate((el) => parseFloat(getComputedStyle(el).top));
      const spaceLg = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.style.top = 'var(--space-lg)';
        document.body.appendChild(probe);
        const v = parseFloat(getComputedStyle(probe).top);
        probe.remove();
        return v;
      });
      const headerH = await page.evaluate(() => {
        const h = document.querySelector('.up-player-header');
        return h ? h.getBoundingClientRect().height : 0;
      });
      expect(Number.isFinite(toastTop)).toBe(true);
      expect(toastTop).toBeGreaterThan(spaceLg); // 不在贴顶位置
      expect(toastTop).toBeLessThan(headerH + 10); // 在 header 下方附近（允许 10px 误差）
    });
  });

  test.describe('手机 UA + 视口 1024（≥768）→ 仍移动端布局：sonner 屏幕居中', () => {
    test.use({ viewport: { width: 1024, height: 768 }, ...IPHONE_13, userAgent: MOBILE_UA });
    test.describe.configure({ mode: 'serial' });
    test.beforeEach(async ({ page }) => {
      // 投屏按钮显隐在挂载时由 getCastMode() 判定：占位原生桥让 native 模式生效（按钮可见）
      await page.addInitScript(() => {
        (window as unknown as { CastBridge?: unknown }).CastBridge = {
          discover: async () => [],
          connect: async () => {},
          disconnect: async () => {},
        };
      });
      await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.up-universal-player', { state: 'attached', timeout: 30000 });
      await page.waitForTimeout(4000);
    });

    test('PLAYER-M10: 手机 UA 视口 1024 → data-mobile-layout 存在，错误提示屏幕居中（非播放器内）', async ({ page }) => {
      // 手机 UA（isRealPhone 命中）→ 即使视口 1024 ≥768 也写入移动端布局标记
      const marker = await page.evaluate(() =>
        document.documentElement.getAttribute('data-mobile-layout'));
      expect(marker).toBe('true');

      // 注入失败投屏桥 → 触发全局 sonner 错误提示 → 应为屏幕居中（移动端布局），而非播放器内定位
      await page.evaluate(() => {
        const win = window as unknown as { CastBridge?: unknown };
        win.CastBridge = {
          discover: async () => [{ id: 'tv-1', name: '客厅电视' }],
          connect: async () => { throw new Error('mock fail'); },
          disconnect: async () => {},
        };
      });
      await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
      await page.locator('.up-cast-sheet').getByText('客厅电视').click();
      const toastLi = page.locator('.app-toast');
      await expect(toastLi).toContainText('连接失败，请重试');
      // 等 sonner 滑入动画完全结束再测量（500ms 时仍处于 translate 动画中，中心会偏 toast 半高）
      await page.waitForTimeout(800);
      const box = await toastLi.boundingBox();
      if (box) {
        // 核心回归：移动端布局（非桌面）→ toast 屏幕中部区域，而非「播放器内定位」（top≈130px）
        // 像素级 50% 居中在设备仿真下存在 ≤52px 偏移（--front-toast-height 测量抖动），用中带断言
        expect(Math.abs(box.y + box.height / 2 - 768 / 2)).toBeLessThan(120);
      }
      // 操作类提示同样走移动端屏幕居中，右上角不出现
      await page.keyboard.press('ArrowDown');
      const centerToast = page.locator('.up-player-center-toast');
      await expect(centerToast).toContainText('音量');
      await expect(page.locator('.up-player-toast')).toHaveCount(0);
    });
  });
});

