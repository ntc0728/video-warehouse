/**
 * IPTV 播放页 (IPTVPlayer) 测试用例（精简合并版）
 * 路由: /iptv/play?url=...&id=...&name=...（独立顶层路由）
 * 配置依赖: Level 3（全配置）— 需 IPTV 代理 + 频道数据
 *
 * 覆盖: IPTVP-001 ~ IPTVP-023
 * 合并映射: 11.1(007,008) / 11.2(010,011) / 11.3(013,014)
 *          11.4(020~023) 播放页 chrome 尺寸契约（2026-09-10）：
 *            OSD 78vw 单曲线 / 左右翼等宽+控件居中 / 音轨恒显示+窄屏图标化
 *            / 频道列表一级栏内容派生宽度 + ≤479 窄屏档
 *          11.4 依赖 `scripts/fixtures/iptv-seed.ts` 注入频道缓存（零网络请求），
 *          该文件的头注释记录了三个「不能错」的注入细节，改前先读。
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/mock-tmdb';
import { seedIptvChannels } from './fixtures/iptv-seed';

// ═══════════════════════════════════════════════════════════════
// 11.1 页面加载与频道匹配
// ═══════════════════════════════════════════════════════════════

test.describe('11.1 页面加载与频道匹配', () => {
  test('IPTVP-007/008: 空 URL 参数 + 返回按钮', async ({ page }) => {
    // 007 空 URL 参数
    await page.goto('/iptv/play', { waitUntil: 'domcontentloaded' });
    await expect
      .poll(
        () => page.evaluate(() => !!document.querySelector('.iptv-player-page, .iptv-page, [class*="player"]')),
        { timeout: 4000 },
      )
      .toBe(true);

    // 008 返回按钮
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('.up-header-back, [class*="header-back"]')), {
        timeout: 4000,
      })
      .toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 11.2 平台适配
// ═══════════════════════════════════════════════════════════════

test.describe('11.2 平台适配', () => {
  test('IPTVP-010/011: 桌面端 + 移动端播放', async ({ page }) => {
    const playerMounted = () =>
      page.evaluate(() => !!document.querySelector('.player-page, [class*="player"]'));

    // 010 桌面端播放
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect.poll(playerMounted, { timeout: 4000 }).toBe(true);

    // 011 移动端播放
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect.poll(playerMounted, { timeout: 4000 }).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 11.3 IPTV 播放独立逻辑（IPTV 走独立播放流程，不复用点播交互）
// ═══════════════════════════════════════════════════════════════

test.describe('11.3 IPTV 播放独立逻辑', () => {
  test('IPTVP-013/014: 不显示中间播放按钮 + 不显示点播类 toast', async ({ page }) => {
    // 负向断言无法直接轮询「不出现」：先等播放器 chrome 挂载（正向锚点），再断言目标节点计数为 0
    const playerChrome = page.locator('.up-header-back, [class*="header-back"]').first();

    // 013 IPTV 不显示中间播放按钮
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect(playerChrome).toBeAttached({ timeout: 4500 });
    await expect(page.locator('.up-player-paused-overlay')).toHaveCount(0, { timeout: 2500 });

    // 014 IPTV 右上角不显示点播类 toast 提示
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect(playerChrome).toBeAttached({ timeout: 4500 });
    await expect(page.locator('.up-player-toast')).toHaveCount(0, { timeout: 2500 });
  });
});

// ═══════════════════════════════════════════════════════════════
// 11.4 播放页 chrome 尺寸契约（2026-09-10 落地）
//   覆盖：OSD 宽度单曲线 / OSD 左右翼等宽与控件居中 / 控件行不裁切
//        / 「音轨」恒显示 / 频道列表一级栏内容派生宽度 + 窄屏档
//   口径说明见 docs/agents/patterns.md「IPTV 播放页 chrome」段。
// ═══════════════════════════════════════════════════════════════

/** 读 OSD 与控件行的几何量（全在页内跑，避免多次 round-trip 拿到不一致的快照） */
function readOsd(page: Page) {
  return page.evaluate(() => {
    const q = (s: string) => document.querySelector(s) as HTMLElement | null;
    const osd = q('.iptv-osd-bar');
    const left = q('.iptv-osd-left');
    const right = q('.iptv-osd-right');
    const center = q('.iptv-osd-center');
    const ctrl = q('.iptv-osd-controls-row');
    if (!osd || !left || !right || !center || !ctrl) return null;
    const o = osd.getBoundingClientRect();
    const c = ctrl.getBoundingClientRect();
    const cs = getComputedStyle(document.documentElement);
    return {
      vw: window.innerWidth,
      osdW: o.width,
      marginLeft: o.left,
      wingLeft: left.getBoundingClientRect().width,
      wingRight: right.getBoundingClientRect().width,
      ctrlOffset: c.left + c.width / 2 - (o.left + o.width / 2),
      ctrlScrollOverflow: ctrl.scrollWidth - ctrl.clientWidth,
      ctrlFitsInCenter: ctrl.scrollWidth - center.clientWidth,
      ctrlBtnCount: document.querySelectorAll('.iptv-osd-control-btn').length,
      ctrlLabelShown: (() => {
        const s = q('.iptv-osd-control-btn span');
        return s ? getComputedStyle(s).display !== 'none' : null;
      })(),
      // 兜底留白 token：OSD 若被 max-width 截断，这里会小于该值
      padX: parseFloat(cs.getPropertyValue('--space-lg')) || 0,
    };
  });
}

/** 读频道列表一级/二级栏几何量（需先 seedIptvChannels 并打开列表） */
function readChannelList(page: Page) {
  return page.evaluate(() => {
    const q = (s: string) => document.querySelector(s) as HTMLElement | null;
    const g = q('.up-channel-groups');
    const c = q('.up-channel-channels');
    const panel = q('.up-channel-list');
    const quality = q('.up-channel-item-quality');
    if (!g || !c || !panel) return null;
    return {
      panelW: panel.getBoundingClientRect().width,
      groupW: g.getBoundingClientRect().width,
      channelW: c.getBoundingClientRect().width,
      qualityShown: quality ? getComputedStyle(quality).display !== 'none' : false,
    };
  });
}

test.describe('11.4 播放页 chrome 尺寸契约', () => {
  test('IPTVP-020: OSD 宽度走 78vw 单曲线，且左右留白不低于 --space-lg', async ({ page }) => {
    // 1024 / 1280 / 1440 三档都落在 78vw 段（上限 1400 要到 ≈1795px 才触顶）
    for (const [w, h] of [[1024, 768], [1280, 800], [1440, 900]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 20000 });

      await expect
        .poll(async () => (await readOsd(page))?.osdW ?? 0, { timeout: 10000 })
        .toBeGreaterThan(200);
      const m = await readOsd(page);
      expect(m).not.toBeNull();
      // 78vw（±2%）；旧的两段式锚点曲线在 1024 处是 98vw、1440 处 84vw，都会落在区间外
      expect(m!.osdW / m!.vw).toBeGreaterThan(0.76);
      expect(m!.osdW / m!.vw).toBeLessThan(0.8);
      // 未被 max-width 吃掉：左右各留出至少 --space-lg
      expect(m!.marginLeft).toBeGreaterThanOrEqual(m!.padX - 1);
    }
  });

  test('IPTVP-021: ≥1024 左右翼等宽 → 控件行真正居中；控件行不裁切', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 20000 });
    await expect.poll(async () => (await readOsd(page))?.osdW ?? 0, { timeout: 10000 }).toBeGreaterThan(200);

    const m = await readOsd(page);
    // 左右翼等宽（改前左 169.4 / 右 113.6，差 55.8）
    expect(Math.abs(m!.wingLeft - m!.wingRight)).toBeLessThan(1.5);
    // 控件行相对 OSD 几何中心居中（改前右偏 +27.9）
    expect(Math.abs(m!.ctrlOffset)).toBeLessThan(1.5);
    // nowrap 的安全网：控件行自身不溢出，且窄于中列 → 任何视口都不会被裁
    expect(m!.ctrlScrollOverflow).toBeLessThanOrEqual(0);
    expect(m!.ctrlFitsInCenter).toBeLessThanOrEqual(0);
  });

  test('IPTVP-022: 「音轨」恒显示（无音轨时也在）+ 窄屏只留图标且不裁切', async ({ page }) => {
    // 桌面：4 个控件按钮（列表 / 节目单 / 换源 / 音轨）
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 20000 });
    await expect.poll(async () => (await readOsd(page))?.ctrlBtnCount ?? 0, { timeout: 10000 }).toBe(4);
    // 桌面显示文字标签
    expect((await readOsd(page))!.ctrlLabelShown).toBe(true);

    // 375：控件收成纯图标（4 个带文字按钮需 ~200px，中列只有 ~163px）
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 20000 });
    await expect.poll(async () => (await readOsd(page))?.ctrlBtnCount ?? 0, { timeout: 10000 }).toBe(4);
    const m = await readOsd(page);
    expect(m!.ctrlLabelShown).toBe(false);
    expect(m!.ctrlScrollOverflow).toBeLessThanOrEqual(0);
    expect(m!.ctrlFitsInCenter).toBeLessThanOrEqual(0);
  });

  test('IPTVP-023: 频道列表一级栏按内容定宽（不是面板 50%），≤479 走窄屏档', async ({ page }) => {
    // 1440：一级 132px、二级吃剩余；质量徽章保留
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 20000 });
    await seedIptvChannels(page, ['CCTV-1 综合', 'CCTV-5 体育赛事高清', 'CCTV-6 电影', 'CCTV-13 新闻']);
    await page.goto('/iptv/play?url=test&id=ch-1&name=CCTV-1%20%E7%BB%BC%E5%90%88', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 20000 });
    await page.locator('.iptv-osd-control-btn[title="频道列表"]').first().click({ force: true });

    await expect.poll(async () => (await readChannelList(page))?.groupW ?? 0, { timeout: 10000 }).toBeGreaterThan(50);
    let m = await readChannelList(page);
    expect(m!.groupW).toBeGreaterThan(130);
    expect(m!.groupW).toBeLessThan(135);
    // 二级栏吃剩余：必须明显宽于一级栏（改前两者都是 222.3，相等）
    expect(m!.channelW).toBeGreaterThan(m!.groupW * 1.8);
    expect(m!.qualityShown).toBe(true);

    // 375：窄屏档 一级 116px + 质量徽章让位给频道名
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 20000 });
    await seedIptvChannels(page, ['CCTV-1 综合', 'CCTV-5 体育赛事高清', 'CCTV-6 电影', 'CCTV-13 新闻']);
    await page.goto('/iptv/play?url=test&id=ch-1&name=CCTV-1%20%E7%BB%BC%E5%90%88', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 20000 });
    await page.locator('.iptv-osd-control-btn[title="频道列表"]').first().click({ force: true });

    await expect.poll(async () => (await readChannelList(page))?.groupW ?? 0, { timeout: 10000 }).toBeGreaterThan(50);
    m = await readChannelList(page);
    expect(m!.groupW).toBeGreaterThan(114);
    expect(m!.groupW).toBeLessThan(118);
    expect(m!.channelW).toBeGreaterThan(m!.groupW);
    expect(m!.qualityShown).toBe(false);
  });
});
