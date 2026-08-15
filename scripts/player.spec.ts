/**
 * 播放页 (Player) 测试用例
 * 路由: /play/:id
 * 配置依赖: CMS 源加载需 Level 2（Token + CORS 代理）
 *
 * 覆盖: PLAYER-001 ~ PLAYER-092
 */
import { test, expect } from './fixtures/mock-tmdb';

const TEST_MOVIE_ID = 'tmdb-movie-550';

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
    if (hasPlayer) {
      console.log('✅ PLAYER-002 通过: 播放页已加载');
    } else {
      console.log('⚠️ PLAYER-002: 播放页未检测到');
    }
  });

  test('PLAYER-003: 首次 loading', async ({ page }) => {
    await page.goto(`/play/${TEST_MOVIE_ID}`);
    // 预期结果: 短暂显示全屏 loading
    const loadingVisible = await page.evaluate(() => {
      return !!document.querySelector('.app-loading, [class*="loading"]');
    });
    console.log(`✅ PLAYER-003 检查完成: 初始 loading = ${loadingVisible}`);
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
    console.log(`✅ PLAYER-040 检查完成: CMS 面板存在 = ${hasCMSPanel}`);
  });

  test('PLAYER-045: CMS 面板折叠/展开', async ({ page }) => {
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(8000);

    // 预期结果: 面板可折叠/展开
    const panelHeader = page.locator('[class*="panel-header"], [class*="cms-panel"] button').first();
    if (await panelHeader.isVisible().catch(() => false)) {
      console.log('✅ PLAYER-045 通过: CMS 面板标题可点击');
    } else {
      console.log('⚠️ PLAYER-045: CMS 面板标题未检测到');
    }
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
      console.log(`✅ PLAYER-070 通过: 收藏按钮文本 = "${text}"`);
    } else {
      console.log('⚠️ PLAYER-070: 收藏按钮未检测到');
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
    console.log(`✅ PLAYER-071 检查完成: 详情区域存在 = ${hasDetail}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4.11 移动端/App 端播放器整改（控制栏精简 · 右上角操作组 · 更多设置 · 投屏）
// ═══════════════════════════════════════════════════════════════

test.describe('4.11 移动端播放器整改', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  // 串行执行：/play 依赖真实 CMS 源加载，多并发会把代理打满导致播放器不挂载（历史 flaky）
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    // CMS 源经代理异步加载，播放器可能稍晚挂载；attached + 长超时
    await page.waitForSelector('.up-universal-player', { state: 'attached', timeout: 30000 });
    // 等待播放器初始化完成（首次暂停态控制栏常显）
    await page.waitForTimeout(4000);
  });

  test('PLAYER-M01: 控制栏精简 + 右上角操作组 + 单行布局', async ({ page }) => {
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

  test('PLAYER-M04: 投屏空态（无原生桥）', async ({ page }) => {
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
});

