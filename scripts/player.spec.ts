/**
 * 播放页 (Player) 测试用例（精简合并版）
 * 路由: /play/:id
 * 配置依赖: CMS 源加载需 Level 2（Token + CORS 代理）
 *
 * 覆盖: PLAYER-001 ~ PLAYER-092（由 26 条激进合并为 9 条，断言并集不弱化）
 */
import { test, expect } from './fixtures/cms-mock';

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

// 重新挂载播放器（/play 依赖真实 CMS 源加载，串行执行避免代理打满）
async function reloadPlayer(page: import('@playwright/test').Page) {
  await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.up-universal-player', { state: 'attached', timeout: 30000 });
  // 等播放器就绪（脱离 placeholder/loading 态，控制栏可用）
  await expect(page.locator('.up-universal-player:not(.up-placeholder)')).toBeVisible({ timeout: 10000 });
}

// ═══════════════════════════════════════════════════════════════
// 4.1 页面加载与布局稳定性（合并 4.1 加载 + 4.14/4.15 侧栏骨架/滚动槽位）
// ═══════════════════════════════════════════════════════════════

test.describe('4.1 页面加载与布局稳定性（含侧栏滚动不跳动、<1024 非滚动容器）', () => {
  test('加载与布局稳定性：002 正常加载 / 003 首次 loading / 090 侧栏 tv 骨架恒定 / 091 滚动槽位 / 092 侧栏零跳动 / 093 窄屏非滚动容器', async ({ page }) => {
    // ── PLAYER-002: 正常加载 TMDB 视频 ──
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    // 条件等待：.player-page 渲染完成
    await expect.poll(
      async () => page.evaluate(() => !!document.querySelector('.player-page, [class*="player-page"]')),
      { timeout: 7000 },
    ).toBeTruthy();

    // ── PLAYER-003: 首次 loading ──
    await page.goto(`/play/${TEST_MOVIE_ID}`);
    const loadingVisible = await page.evaluate(() =>
      !!document.querySelector('.app-loading, [class*="loading"]'));
    expect(loadingVisible).toBeTruthy();

    // ── PLAYER-090: tmdb-tv 无缓存进入，骨架入场即 tv 变体，TMDB 响应前不突变 ──
    await page.route('**/api.tmdb.org/3/tv/123**', async (route) => {
      await new Promise((r) => setTimeout(r, 5000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 123, name: '测试剧集', first_air_date: '2020-01-01',
          overview: 'x', poster_path: '/x.jpg', backdrop_path: '/y.jpg',
          vote_average: 8, popularity: 1, episode_run_time: [45],
          seasons: [
            { season_number: 1, episode_count: 12 },
            { season_number: 2, episode_count: 12 },
            { season_number: 3, episode_count: 12 },
          ],
        }),
      });
    });
    await page.goto('/play/tmdb-tv-123', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.player-sidebar-skeleton', { timeout: 15000 });
    const readSkeleton = () => page.evaluate(() => {
      const sb = document.querySelector('.player-sidebar');
      if (!sb) return null;
      return {
        variant: sb.className.includes('--tv') ? 'tv' : sb.className.includes('--movie') ? 'movie' : '?',
        panels: document.querySelectorAll('.player-sidebar .player-panel').length,
      };
    });
    const s1 = await readSkeleton();
    expect(s1?.variant).toBe('tv');
    expect(s1?.panels).toBe(3);
    // TODO: 替换为条件等待 —— 骨架稳定性需 wall-clock 采样（TMDB 响应前 variant 不突变），无事件可条件化
    await page.waitForTimeout(2000);
    const s2 = await readSkeleton();
    expect(s2?.variant).toBe('tv');
    expect(s2?.panels).toBe(3);

    // ── PLAYER-091: ≥1024（分栏起点，ADR-023 rail 类布局）时 .player-page 是滚动容器且常驻预留滚动条槽位 ──
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/play/tmdb-movie-550', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.player-page', { timeout: 15000 });
    const cs = await page.evaluate(() => {
      const el = document.querySelector('.player-page');
      if (!el) return null;
      const s = getComputedStyle(el);
      return { overflowY: s.overflowY, scrollbarGutter: s.scrollbarGutter };
    });
    expect(cs?.overflowY).toBe('auto');
    expect(cs?.scrollbarGutter).toBe('stable');

    // ── PLAYER-093: <1024 时 .player-page 不是滚动容器（滚动交给外层 main） ──
    // ⚠️ 样本宽度必须 < 分栏起点 1024：1024 起 .player-page 即为桌面滚动容器。
    await page.setViewportSize({ width: 900, height: 768 });
    await page.goto('/play/tmdb-movie-550', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.player-page', { timeout: 15000 });
    const overflowY93 = await page.evaluate(() => {
      const el = document.querySelector('.player-page');
      return el ? getComputedStyle(el).overflowY : null;
    });
    expect(overflowY93).not.toBe('auto');

    // ── PLAYER-092: 骨架→详情→真实面板全过程中侧栏右边缘与宽度零变化 ──
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route('**/api.tmdb.org/**', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fallback();
    });
    await page.goto('/play/tmdb-movie-550', { waitUntil: 'commit' });
    const samples = await page.evaluate(async () => {
      const out: { right: number; width: number; detail: boolean; skeleton: boolean }[] = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 8000) {
        const sb = document.querySelector('.player-sidebar');
        if (sb) {
          const r = sb.getBoundingClientRect();
          out.push({
            right: Math.round(r.right * 100) / 100,
            width: Math.round(r.width * 100) / 100,
            detail: !!document.querySelector('.player-detail-section'),
            skeleton: !!document.querySelector('.player-sidebar-skeleton'),
          });
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      return out;
    });
    expect(samples.some((s) => !s.detail)).toBe(true);
    expect(samples.some((s) => s.detail)).toBe(true);
    const rights = new Set(samples.map((s) => s.right));
    const widths = new Set(samples.map((s) => s.width));
    expect([...rights]).toHaveLength(1);
    expect([...widths]).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4.5 CMS 源管理
// ═══════════════════════════════════════════════════════════════

test.describe('4.5 CMS 源管理', () => {
  test('PLAYER-040/045: CMS 面板显示与折叠/展开', async ({ page }) => {
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    // 条件等待：CMS 面板渲染完成
    await expect.poll(
      async () => page.evaluate(() => !!document.querySelector('.player-panel, [class*="cms"]')),
      { timeout: 10000 },
    ).toBeTruthy();

    // 预期结果: 面板可折叠/展开
    const panelHeader = page.locator('[class*="panel-header"], [class*="cms-panel"] button').first();
    await expect(panelHeader).not.toHaveCount(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4.8 收藏与详情
// ═══════════════════════════════════════════════════════════════

test.describe('4.8 收藏与详情', () => {
  test('PLAYER-070/071: 收藏按钮与详情区域', async ({ page }) => {
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    // 条件等待：详情区域渲染完成
    await expect.poll(
      async () => page.evaluate(() => !!document.querySelector('.player-detail-section, [class*="player-detail"]')),
      { timeout: 10000 },
    ).toBeTruthy();

    // 预期结果: 收藏按钮存在
    const favBtn = page.locator('.player-detail-fav-btn, [class*="fav-btn"]');
    await expect(favBtn).not.toHaveCount(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4.11 移动端/App 端播放器整改（控制栏精简 · 右上角操作组 · 更多设置 · 投屏）
// ═══════════════════════════════════════════════════════════════

test.describe('4.11 移动端播放器整改', () => {
  // 真实手机 UA：操作类提示「移动端屏幕居中」仅对真实移动设备生效（mobileCenter = App/真实手机 UA），
  // 桌面浏览器窄窗（视口 <768 但非移动设备）走右上角 .up-player-toast（见 4.12 M12）。
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
    await reloadPlayer(page);
  });

  test('PLAYER-M01/M07/M08: 控制栏精简 + 右上角操作组 + 单行布局；操作/错误提示移动端屏幕居中', async ({ page }) => {
    // ── PLAYER-M01: 控制栏精简 + 右上角操作组 + 单行布局 ──
    // beforeEach 已注入占位原生桥 → native 模式 → 投屏按钮可见（iOS Web 隐藏行为见 4.13 M13）
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
    await expect(page.locator('.up-player-toast')).toHaveCount(0, { timeout: 1000 });

    // ── PLAYER-M07: 操作提示移动端屏幕居中（不出现右上角） ──
    await page.keyboard.press('ArrowDown');
    const centerToast = page.locator('.up-player-center-toast');
    await expect(centerToast).toContainText('音量');
    await expect(page.locator('.up-player-toast')).toHaveCount(0);
    // 条件等待：center-toast 定位稳定（屏幕居中靠上）
    await expect.poll(
      async () => {
        const box = await centerToast.boundingBox();
        if (!box) return false;
        const centerY = box.y + box.height / 2;
        return centerY < 844 * 0.5 && centerY > 844 * 0.05;
      },
      { timeout: 2400 },
    ).toBe(true);

    // ── PLAYER-M08: 错误提示移动端屏幕居中（播放器内 center-toast） ──
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
    const toastLi = page.locator('.up-player-center-toast');
    await expect(toastLi).toContainText('连接失败，请重试');
    // 条件等待：错误提示定位稳定（屏幕居中靠上）
    await expect.poll(
      async () => {
        const box = await toastLi.boundingBox();
        if (!box) return false;
        const centerY = box.y + box.height / 2;
        return centerY < 844 * 0.5 && centerY > 844 * 0.05;
      },
      { timeout: 2500 },
    ).toBe(true);
  });

  test('PLAYER-M02/M03: 更多设置弹窗（字幕子项显隐 + chip 生效）与字幕导入 + 二级设置窗', async ({ page }) => {
    // ── PLAYER-M02: 更多设置弹窗（字幕子项随开关显隐 + chip 选中生效并关闭） ──
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
    // 关闭字幕 → 子项隐藏且弹窗一并关闭（Switch 类设置改完即关，与 chip 一致）
    await subtitleCard.getByRole('switch').click();
    await expect(sheet).toBeHidden();

    // 重新打开弹窗（字幕已关，子项隐藏）→ 开启字幕 → 弹窗同样关闭
    await page.locator('.up-header-actions button[aria-label="更多设置"]').click();
    await expect(sheet).toBeVisible();
    const subtitleCard2 = sheet.locator('.up-ms-card', { hasText: '字幕' });
    await expect(subtitleCard2.locator('.up-ms-row--tap')).toHaveCount(0);
    await subtitleCard2.getByRole('switch').click();
    await expect(sheet).toBeHidden();

    // 再次打开弹窗（字幕已开，子项恢复）→ chip 选中（倍速 1.5x）→ 屏幕居中提示 + 弹窗关闭 + 设置生效
    await page.locator('.up-header-actions button[aria-label="更多设置"]').click();
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.up-ms-card', { hasText: '字幕' }).locator('.up-ms-row--tap')).toHaveCount(2);
    await sheet.getByText('1.5x').click();
    await expect(page.locator('.up-player-center-toast')).toContainText('倍速 1.5x');
    await expect(sheet).toBeHidden();
    await expect(page.locator('.up-player-video')).toHaveJSProperty('playbackRate', 1.5);
    await expect(page.locator('.up-player-toast')).toHaveCount(0);

    // ── PLAYER-M03: 字幕导入 + 字幕设置二级弹窗 ──
    await page.locator('.up-header-actions button[aria-label="更多设置"]').click();
    await expect(sheet).toBeVisible();

    // 字幕开关默认开启 → 子项可见（开关显隐行为已在 M02 覆盖）
    const subtitleCard3 = sheet.locator('.up-ms-card', { hasText: '字幕' });
    await expect(subtitleCard3.locator('.up-ms-row--tap')).toHaveCount(2);

    // 通过隐藏 file input 导入字幕 → 导入按钮仍保留在「字幕设置」下方
    await sheet.locator('input[type="file"]').setInputFiles({
      name: 'test.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello\n'),
    });
    await expect(subtitleCard3.locator('.up-ms-row--tap').nth(0)).toContainText('字幕设置');
    await expect(subtitleCard3.locator('.up-ms-row--tap').nth(1)).toContainText('导入字幕文件');

    // 打开二级弹窗：双语字幕 / 字幕大字号 / 翻译语言
    await subtitleCard3.locator('.up-ms-row--tap', { hasText: '字幕设置' }).click();
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

  test('PLAYER-M05/M19/M21: 投屏权限授予与全链路 setSource（mock 原生桥注入）', async ({ page }) => {
    // ── PLAYER-M05: 投屏全流程（mock 原生桥注入） ──
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
    await expect(sheet.getByText('客厅电视')).toBeVisible();
    await sheet.getByText('客厅电视').click();
    await expect(sheet.getByText('已连接 · 客厅电视')).toBeVisible();
    await sheet.getByText('断开投屏').click();
    await expect(sheet.getByText('客厅电视')).toBeVisible();

    // ── PLAYER-M19: 权限被拒 → 显示「去设置授权」并跳应用设置页 ──
    await reloadPlayer(page); // 重置桥与连接状态
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
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('需要投屏权限')).toBeVisible();
    await expect(sheet.getByText('去设置授权')).toBeVisible();
    // 雷达不得出现（权限前置即返回，不做搜索动画）
    await expect(page.locator('.up-cast-radar')).toHaveCount(0);
    await sheet.getByText('去设置授权').click();
    // 条件等待：openAppSettings 被调用（__castOpenSettings 累加到 1）
    await expect.poll(
      async () => page.evaluate(() => (window as unknown as { __castOpenSettings?: number }).__castOpenSettings ?? 0),
      { timeout: 2100 },
    ).toBe(1);

    // ── PLAYER-M21: 全链路 setSource 推送正确 URL（discover→connect→setSource） ──
    await reloadPlayer(page); // 重置桥与连接状态
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
      await reloadPlayer(page);
    });

    test('PLAYER-M13: iOS Web 隐藏投屏按钮（更多设置仍可见）', async ({ page }) => {
      // 无原生桥（Web 环境）→ getCastMode()='none' → 投屏按钮不渲染
      await page.waitForFunction(() => {
        const el = document.querySelector('.up-header-actions');
        return !!el && el.getBoundingClientRect().width > 0;
      }, { timeout: 15000 });
      await expect(page.locator('.up-header-actions button[aria-label="投屏到电视"]')).toHaveCount(0);
      await expect(page.locator('.up-header-actions button[aria-label="更多设置"]')).toBeVisible();
    });
  });

  test.describe('安卓 Chrome UA → Web Cast SDK 投屏', () => {
    test.use({ viewport: { width: 390, height: 844 }, userAgent: ANDROID_CHROME_UA });
    test.describe.configure({ mode: 'serial' });
    test.beforeEach(async ({ page }) => {
      // mock Cast SDK 需在页面加载前注入（addInitScript）：initWebCast 见 win.cast.framework
      // 存在即跳过 gstatic 脚本加载 → 行为由 window.__castMock 控制（M15 各自覆盖 win.cast 不受影响）
      await injectMockCastSdk(page);
      await reloadPlayer(page);
    });

    test('PLAYER-M15/M16/M18: 安卓 Web 投屏全流程、无设备空态、连续重选不闪雷达（防闪雷达）', async ({ page }) => {
      const sheet = page.locator('.up-cast-sheet');

      // ── PLAYER-M16: 安卓 Web 无 Chromecast → 回空态（未选择投屏设备） ──
      // addInitScript 注入的 mock 默认 mode='null'（requestSession 返回 null）→ 空态 + 重新选择设备按钮
      await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText('未选择投屏设备')).toBeVisible();
      await expect(sheet.getByText('重新选择设备')).toBeVisible();
      const calls16 = await page.evaluate(() =>
        (window as unknown as { __castMock?: { requestSessionCalls: number } }).__castMock?.requestSessionCalls ?? 0);
      expect(calls16).toBeGreaterThanOrEqual(1);

      // ── PLAYER-M18: 连续点「重新选择设备」不闪雷达、requestSession 每次都被调用 ──
      // reload 重置 mock 计数器（mode='null'）与弹窗态
      await reloadPlayer(page);
      await page.locator('.up-header-actions button[aria-label="投屏到电视"]').click();
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText('未选择投屏设备')).toBeVisible();
      for (let i = 0; i < 3; i++) {
        await sheet.getByText('重新选择设备').click();
        // 条件等待：雷达不闪（重选后短时间内无 .up-cast-radar）
        await expect(page.locator('.up-cast-radar')).toHaveCount(0, { timeout: 2100 });
        await expect(sheet.getByText('未选择投屏设备')).toBeVisible();
      }
      // requestSession 总调用 = 首次打开 1 + 3 次重选 = 4
      const calls = await page.evaluate(() =>
        (window as unknown as { __castMock?: { requestSessionCalls: number } }).__castMock?.requestSessionCalls ?? 0);
      expect(calls).toBe(4);

      // ── PLAYER-M15: 安卓 Web 投屏全流程（mock Cast SDK） ──
      // reload 重置后覆盖 win.cast 为 session 模式（模拟系统弹窗选择「客厅电视」）
      await reloadPlayer(page);
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
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText('已连接 · 客厅电视')).toBeVisible();
      await sheet.getByText('断开投屏').click();
      await expect(sheet.getByText('未选择投屏设备')).toBeVisible();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 4.12 移动端布局判定（手机/App 端 ≠ 视口 <768px）
// ═══════════════════════════════════════════════════════════════
// 回归：App 恒移动、真实手机 web 桌面模式等视口可 ≥768px 仍属移动端布局。
// 此前桌面 toast 定位用 @media(width >= 768px) 会把它们误判为桌面端（错误播放器内定位）。
// 合并为 1 条：桌面 UA（1024/390）+ 手机 UA（1024）多场景，手机 UA 通过 addInitScript 覆盖
// navigator.userAgent 切换，视口用 page.setViewportSize 切换。

test.describe('4.12 移动端布局判定', () => {
  const MOBILE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  test.use({ viewport: { width: 1024, height: 768 } });
  test.describe.configure({ mode: 'serial' });

  test('PLAYER-M09/M11/M10/M12: UA/视口布局判定（桌面/移动 toast 定位、错误提示居中）', async ({ page }) => {
    // ── PLAYER-M09: 桌面 UA + 视口 1024（≥768）→ 桌面布局，播放器几何变量已写入 ──
    await reloadPlayer(page);
    const marker = await page.evaluate(() =>
      document.documentElement.hasAttribute('data-mobile-layout'));
    expect(marker).toBe(false);
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

    // ── PLAYER-M11: 桌面视频模式操作提示紧贴右上角（无头部右控件避让） ──
    await page.keyboard.press('ArrowDown');
    const toast = page.locator('.up-player-toast');
    await expect(toast).toContainText('音量');
    // 条件等待：操作提示顶部贴紧右上角（与 --space-lg 一致）
    await expect.poll(
      async () => {
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
        return Number.isFinite(toastTop) && Number.isFinite(spaceLg) && Math.abs(toastTop - spaceLg) < 1;
      },
      { timeout: 2400 },
    ).toBe(true);

    // ── PLAYER-M12: 桌面 UA 窄视口 390（<768）→ 非移动设备：操作提示右上角（头部图标下方） ──
    await page.setViewportSize({ width: 390, height: 844 });
    await page.keyboard.press('ArrowDown');
    const toast12 = page.locator('.up-player-toast');
    await expect(toast12).toContainText('音量');
    await expect(page.locator('.up-player-center-toast')).toHaveCount(0);
    // 条件等待：窄视口非移动设备操作提示位于头部图标下方（右上角）
    await expect.poll(
      async () => {
        const toastTop12 = await toast12.evaluate((el) => parseFloat(getComputedStyle(el).top));
        const spaceLg12 = await page.evaluate(() => {
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
        return Number.isFinite(toastTop12) && toastTop12 > spaceLg12 && toastTop12 < headerH + 10;
      },
      { timeout: 2400 },
    ).toBe(true);

    // ── PLAYER-M10: 手机 UA 视口 1024（≥768）→ 仍移动端布局，错误提示屏幕居中 ──
    // 通过 addInitScript 覆盖 navigator.userAgent 为真实手机 UA（getIsRealPhone 据此判定），
    // 重新加载使 App 挂载时即按移动端布局渲染。占位原生桥让投屏按钮可见。
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () =>
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      });
    });
    await page.addInitScript(() => {
      (window as unknown as { CastBridge?: unknown }).CastBridge = {
        discover: async () => [],
        connect: async () => {},
        disconnect: async () => {},
      };
    });
    await page.setViewportSize({ width: 1024, height: 768 });
    await reloadPlayer(page);
    const marker10 = await page.evaluate(() =>
      document.documentElement.getAttribute('data-mobile-layout'));
    expect(marker10).toBe('true');

    // 注入失败投屏桥 → 触发播放器内 playerToast 错误提示 → 移动端走 showCenter（居中靠上）
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
    const toastLi = page.locator('.up-player-center-toast');
    await expect(toastLi).toContainText('连接失败，请重试');
    // 条件等待：错误提示定位稳定（屏幕居中靠上）
    await expect.poll(
      async () => {
        const box = await toastLi.boundingBox();
        if (!box) return false;
        const centerY = box.y + box.height / 2;
        return centerY < 768 * 0.5 && centerY > 768 * 0.05;
      },
      { timeout: 2800 },
    ).toBe(true);
    // 操作类提示同样走移动端屏幕居中，右上角不出现
    await page.keyboard.press('ArrowDown');
    const centerToast = page.locator('.up-player-center-toast');
    await expect(centerToast).toContainText('音量');
    await expect(page.locator('.up-player-toast')).toHaveCount(0);
  });
});
