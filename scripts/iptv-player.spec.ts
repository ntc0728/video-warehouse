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

/** 读播放器强调色与频道列表活跃态的实际渲染色（两主题都跑） */
function readPrimary(page: Page) {
  return page.evaluate(() => {
    const q = (s: string) => document.querySelector(s) as HTMLElement | null;
    const root = q('.up-universal-player');
    const bar = q('.up-channel-group-active');
    const item = q('.up-channel-item-active');
    if (!root || !bar || !item) return null;
    const barBg = getComputedStyle(bar, '::before').backgroundColor;
    const m = barBg.match(/rgba?\(([^)]+)\)/);
    const parts = m ? m[1].split(',').map((x) => parseFloat(x)) : [];
    return {
      theme: document.documentElement.getAttribute('data-theme') ?? 'light',
      primary: getComputedStyle(root).getPropertyValue('--color-primary').trim(),
      primaryRgb: getComputedStyle(root).getPropertyValue('--color-primary-rgb').trim(),
      // 一级活跃左竖条：alpha 应接近 1（透明=不可见），且不能是黑/白（与深色面板同色）
      barAlpha: parts.length >= 4 ? parts[3] : 1,
      barMax: parts.length >= 3 ? Math.max(parts[0], parts[1], parts[2]) : 0,
      barMin: parts.length >= 3 ? Math.min(parts[0], parts[1], parts[2]) : 0,
      itemBorder: getComputedStyle(item).borderLeftColor,
    };
  });
}

test.describe('11.4 播放页 chrome 尺寸契约', () => {
  test('IPTVP-020: OSD 宽度走 78vw 单曲线，且左右留白不低于 --space-lg', async ({ page }) => {
    // 1024 / 1280 / 1440 三档都落在 78vw 段（上限 1400 要到 ≈1795px 才触顶）
    for (const [w, h] of [[1024, 768], [1280, 800], [1440, 900]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 10000 });

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
    await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 10000 });
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
    await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 10000 });
    await expect.poll(async () => (await readOsd(page))?.ctrlBtnCount ?? 0, { timeout: 10000 }).toBe(4);
    // 桌面显示文字标签
    expect((await readOsd(page))!.ctrlLabelShown).toBe(true);

    // 375：控件收成纯图标（4 个带文字按钮需 ~200px，中列只有 ~163px）
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/iptv/play?url=test', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 10000 });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    await seedIptvChannels(page, ['CCTV-1 综合', 'CCTV-5 体育赛事高清', 'CCTV-6 电影', 'CCTV-13 新闻']);
    await page.goto('/iptv/play?url=test&id=ch-1&name=CCTV-1%20%E7%BB%BC%E5%90%88', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 10000 });
    await page.locator('.iptv-osd-control-btn[title="频道列表"]').first().click({ force: true });

    await expect.poll(async () => (await readChannelList(page))?.groupW ?? 0, { timeout: 10000 }).toBeGreaterThan(50);
    let m = await readChannelList(page);
    expect(m!.groupW).toBeGreaterThan(130);
    // 2026-09-20：hermetic mock 数据档实测 136px（旧 132±2 档系真实 cn.m3u 内容校准的
    // 经验值）；契约不变——按内容定宽且明显小于面板 50%，见下 channelW 相对断言。
    expect(m!.groupW).toBeLessThan(140);
    // 二级栏吃剩余：必须明显宽于一级栏（改前两者都是 222.3，相等）
    expect(m!.channelW).toBeGreaterThan(m!.groupW * 1.8);
    expect(m!.qualityShown).toBe(true);

    // 375：窄屏档 一级 116px + 质量徽章让位给频道名
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    await seedIptvChannels(page, ['CCTV-1 综合', 'CCTV-5 体育赛事高清', 'CCTV-6 电影', 'CCTV-13 新闻']);
    await page.goto('/iptv/play?url=test&id=ch-1&name=CCTV-1%20%E7%BB%BC%E5%90%88', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 10000 });
    await page.locator('.iptv-osd-control-btn[title="频道列表"]').first().click({ force: true });

    await expect.poll(async () => (await readChannelList(page))?.groupW ?? 0, { timeout: 10000 }).toBeGreaterThan(50);
    m = await readChannelList(page);
    expect(m!.groupW).toBeGreaterThan(114);
    expect(m!.groupW).toBeLessThan(118);
    expect(m!.channelW).toBeGreaterThan(m!.groupW);
    expect(m!.qualityShown).toBe(false);
  });

  test('IPTVP-024: 播放器强调色不随主题退化为黑/白（频道列表活跃态可见）', async ({ page }) => {
    // 播放器 chrome 恒深色底，而 --color-primary 在浅色主题是 #000、暗色主题是 #fff ——
    // 两种情况都会让「用 primary 做强调」的规则与面板同色。实测修前：一级活跃左竖条
    // rgb(0,0,0)、二级活跃左边框 3px rgb(0,0,0)、计数药丸比未选中态更暗。
    // 断言刻意不锁死具体色值（只排除黑/白 + 要求近不透明），改配色时不会误红。
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.app-shell', { timeout: 10000 });
      // 先落 localStorage 让应用自己带上主题，再注入频道
      await page.evaluate((t) => {
        const raw = localStorage.getItem('app-settings');
        if (!raw) return;
        const o = JSON.parse(raw);
        o.state = { ...o.state, theme: t };
        localStorage.setItem('app-settings', JSON.stringify(o));
      }, theme);
      await seedIptvChannels(page, ['CCTV-1 综合', 'CCTV-5 体育赛事高清', 'CCTV-6 电影', 'CCTV-13 新闻']);
      await page.goto('/iptv/play?url=test&id=ch-1&name=CCTV-1%20%E7%BB%BC%E5%90%88', {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 10000 });
      // 兜底：应用若未按 storage 应用主题，直接改 html 属性（CSS 立即重算）
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.locator('.iptv-osd-control-btn[title="频道列表"]').first().click({ force: true });

      await expect.poll(async () => (await readPrimary(page))?.primary ?? '', { timeout: 10000 }).not.toBe('');
      const p = await readPrimary(page);
      expect(p).not.toBeNull();
      expect(p!.theme).toBe(theme);
      // 强调色不能与深色面板同色（黑）或与白字同色（白）
      expect(p!.primary).not.toBe('#000');
      expect(p!.primary).not.toBe('#fff');
      // 时移/换源那类 rgba(var(--color-primary-rgb), …) 消费点依赖这个 token，不能为空
      expect(p!.primaryRgb).not.toBe('');
      // 一级活跃左竖条：必须画出来（近不透明）且不是黑/白
      expect(p!.barAlpha).toBeGreaterThan(0.9);
      expect(p!.barMax).toBeGreaterThan(80);
      expect(p!.barMin).toBeLessThan(200);
      expect(p!.itemBorder).not.toBe('rgb(0, 0, 0)');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 11.5 EPG 节目单（backlog 第一波补测：产品有功能、此前 E2E 零覆盖）
//   UI：OSD「节目单」→ UniversalPlayer up-program-guide-panel → EPGProgramList
//   数据：测试内 route e.xml（覆盖 fixture 空 EPG mock，后注册优先），三态节目
//   匹配：epgService normalizeName(display-name ↔ 频道名)
// ═══════════════════════════════════════════════════════════════

const fmtXmltv = (d: Date) =>
  `${d.toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 14)} +0000`;

function buildEpgXml(now = Date.now()): string {
  const at = (min: number) => fmtXmltv(new Date(now + min * 60000));
  return `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="cctv1.epg"><display-name>CCTV-1 综合</display-name></channel>
  <programme start="${at(-90)}" stop="${at(-30)}" channel="cctv1.epg"><title>已播晨报</title></programme>
  <programme start="${at(-30)}" stop="${at(30)}" channel="cctv1.epg"><title>当红直播秀</title></programme>
  <programme start="${at(30)}" stop="${at(90)}" channel="cctv1.epg"><title>未来剧场</title></programme>
</tv>`;
}

async function openIptvPlay(page: Page, id: string, name: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await seedIptvChannels(page, ['CCTV-1 综合', 'CCTV-13 新闻', '湖南卫视', 'CCTV-6 电影']);
  await page.goto(`/iptv/play?url=test&id=${id}&name=${encodeURIComponent(name)}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('.iptv-osd-bar')).toBeAttached({ timeout: 10000 });
}

test.describe('11.5 EPG 节目单', () => {
  test('EPG-001/002: 三态节目 + 直播中徽标 + 关闭；无匹配频道空态', async ({ page }) => {
    await page.route('**/*e.xml*', (route) =>
      route.fulfill({ contentType: 'application/xml', body: buildEpgXml() }),
    );
    await openIptvPlay(page, 'ch-1', 'CCTV-1 综合');

    await page.locator('.iptv-osd-control-btn[title="节目单"]').first().click({ force: true });
    const panel = page.locator('.up-program-guide-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });
    const items = panel.locator('.epg-program-item');
    await expect.poll(async () => items.count(), { timeout: 10000 }).toBe(3);
    // 时间排序 + 三态标记（当前时间落在第二条窗口内）
    await expect(items.nth(0)).toHaveClass(/epg-program-item--past/);
    await expect(items.nth(1)).toHaveClass(/epg-program-item--current/);
    await expect(items.nth(1).locator('.epg-program-item__badge--live')).toBeVisible();
    await expect(items.nth(2)).toHaveClass(/epg-program-item--future/);
    // 时移回看默认关闭（catchup 开关未启用）→ 过去条目不可点击、无回看徽标
    await expect(items.nth(0).locator('.epg-program-item__badge--replay')).toHaveCount(0);

    await page.locator('.up-program-guide-close').click();
    await expect(panel).toHaveCount(0);
  });

  test('EPG-002: EPG 未覆盖的频道 → 节目单空态而非挂死', async ({ page }) => {
    await page.route('**/*e.xml*', (route) =>
      route.fulfill({ contentType: 'application/xml', body: buildEpgXml() }),
    );
    // 湖南卫视与 mock EPG 任意频道名都不构成模糊匹配（CCTV-13 会被模糊匹配到 CCTV-1，勿用作无数据样本）
    await openIptvPlay(page, 'ch-3', '湖南卫视');
    await page.locator('.iptv-osd-control-btn[title="节目单"]').first().click({ force: true });
    await expect(page.locator('.up-program-guide-panel .epg-program-list--empty')).toBeVisible({ timeout: 10000 });
    // 空态形态存在即契约；文案节点随 epg 状态翻转可能重建，不追断避免引入新竞态
  });
});

// ═══════════════════════════════════════════════════════════════
// 11.6 TV 遥控器焦点（backlog 补测：useTVRemote platform=tv 键链）
//   判定链：TV UA → useIsTV → IPTVPlayer platform='tv' → useTVRemote 生效
//   契约：列表开=方向键移焦点/右键切栏/Enter 选台；ContextMenu 键开关列表
// ═══════════════════════════════════════════════════════════════

test.describe('11.6 TV 遥控器焦点', () => {
  test('TV-001/002: 方向键焦点移动 + Enter 选台 + ContextMenu 开关列表', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (SMART-TV; Linux) AppleWebKit/537.36 Tizen/7.0',
        configurable: true,
      });
    });
    await openIptvPlay(page, 'ch-1', 'CCTV-1 综合');
    await page.locator('.iptv-osd-control-btn[title="频道列表"]').first().click({ force: true });
    const groups = page.locator('.up-channel-group-item');
    await expect(groups.first()).toBeVisible({ timeout: 10000 });

    const groupFocusIndex = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.up-channel-group-item')].findIndex((e) =>
          e.classList.contains('up-channel-group-focused'),
        ),
      );
    const channelFocusIndex = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.up-channel-item')].findIndex((e) =>
          e.classList.contains('up-channel-item-focused'),
        ),
      );

    // 产品语义（IPTVChannelList 打开自动定位当前播放频道，isTvMode 时 activeSection
    // 直接落在 'channels'）：列表打开 → 焦点在**当前播放频道**上，而非组栏 0。
    await expect(page.locator('.up-channel-item-focused')).toHaveCount(1, { timeout: 5000 });
    const c0 = await channelFocusIndex();
    expect(c0).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('ArrowDown');
    await expect.poll(channelFocusIndex, { timeout: 5000 }).toBe(c0 + 1);

    // 左键回组栏 → 组间下移 → 右键回频道栏
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.up-channel-group-focused')).toHaveCount(1, { timeout: 5000 });
    const before = await groupFocusIndex();
    await page.keyboard.press('ArrowDown');
    await expect.poll(groupFocusIndex, { timeout: 5000 }).toBeGreaterThan(before);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.up-channel-item-focused')).toHaveCount(1, { timeout: 5000 });

    // TV-002：Escape 收起列表 → ContextMenu 再开（同一 toggle 键两向）。
    // 必须在 Enter 选台前做：选台触发 URL replace 重挂载，列表状态会被重置。
    await page.keyboard.press('Escape');
    await expect(page.locator('.up-channel-group-item')).toHaveCount(0, { timeout: 5000 });
    await page.keyboard.press('ContextMenu');
    await expect(page.locator('.up-channel-group-item').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.up-channel-item-focused')).toHaveCount(1, { timeout: 5000 });

    // Enter 选台：onChannelSelect → IPTVPlayer 以 name 参数 replace 导航。
    // 频道名经 MarqueeText 渲染：溢出时会克隆第二个 .marquee-text 做无缝滚动
    // （IPTVChannelList.tsx:44）→ 读 .up-channel-item-name 的聚合 textContent 会得到
    // "名字名字" 双份。故只取首个 .marquee-text 的文本（恒单份），不依赖是否溢出。
    const focusedName = ((await page.locator('.up-channel-item-focused .up-channel-item-name .marquee-text').first().textContent()) ?? '').trim();
    expect(focusedName.length).toBeGreaterThan(0);
    await page.keyboard.press('Enter');
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const m = location.search.match(/name=([^&]*)/);
            return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
          }),
        { timeout: 10000 },
      )
      .toBe(focusedName);
  });
});
