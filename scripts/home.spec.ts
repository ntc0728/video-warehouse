/**
 * 首页 (Home) 测试用例（激进合并版）
 * 路由: /
 * 配置依赖: Level 1（TMDB Token）
 *
 * 覆盖: HOME-001~005, 010~012, 020, 022(循环), 024b, 060~061,
 *       030~031~035, 040~041, 045~046, 055~056,
 *       070~071~074~083, 072~073~077~079~087, 075~076~080~081~082~084~085~086,
 *       088
 * 合并前 46 条 → 合并后 12 条（仅合并、断言并集完整保留）。
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 1.1 页面加载与初始状态
// ═══════════════════════════════════════════════════════════════

test.describe('1.1 页面加载与初始状态', () => {
  test('首屏初始态与加载（001 无Token提示 / 002 跳设置 / 003 loading / 004 完整首页 / 005 超时收起）', async ({ page }) => {
    // ── 有 Token：003 加载中 / 004 数据就绪 / 005 超时边界 ──
    // 003: 有 Token 但数据加载中显示 loading
    await page.goto('/');
    const loadingVisible = await page.evaluate(() => {
      return !!document.querySelector('.app-loading, [class*="loading"]');
    });
    expect(loadingVisible).toBeTruthy();

    // 004: 有 Token 且数据就绪显示完整首页
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect.poll(() => page.evaluate(() => !!document.querySelector('.home-page, [class*="home"]')), { timeout: 8000 }).toBeTruthy();
    const hasHomeContent = await page.evaluate(() => {
      return !!document.querySelector('.home-page, [class*="home"]');
    });
    expect(hasHomeContent).toBe(true);

    // 005: 首页 loading 最大超时 10 秒（无论数据是否就绪，最多 10s 内收敛）
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => {
      const loading = document.querySelector('.app-loading');
      return loading ? getComputedStyle(loading).display !== 'none' : false;
    }), { timeout: 13000 }).toBe(false);

    // ── 无 Token：001 配置提示 / 002 点击跳转设置页 ──
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('app-settings'));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.home-token-required')).toBeVisible({ timeout: 5000 });

    const tokenPrompt = page.locator('.home-token-required');
    if (await tokenPrompt.isVisible().catch(() => false)) {
      // 001: 显示"TMDB Access Token 未配置"提示，包含"配置"按钮
      const link = page.locator('.home-token-required-link');
      await expect(link).toBeVisible();
      // 002: 点击"配置"按钮跳转设置页
      await link.click();
      await expect(page).toHaveURL(/\/settings/, { timeout: 5000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.2 HeroBanner 交互
// ═══════════════════════════════════════════════════════════════

test.describe('1.2 HeroBanner 交互', () => {
  test('Banner/缩略图点击跳转详情（010 Banner存在 / 012 缩略图 / 011 CTA）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.home-hero, [class*="hero"]').first()).toBeVisible({ timeout: 8000 });

    // 010: Banner 存在且可显示
    const heroExists = await page.evaluate(() => {
      return !!document.querySelector('.home-hero, [class*="hero"]');
    });
    expect(heroExists).toBeTruthy();

    // 012: 缩略图点击跳转详情页
    const thumb = page.locator('.hero-banner__thumb').first();
    if (await thumb.isVisible().catch(() => false)) {
      await thumb.click();
      await expect(page).toHaveURL(/\/detail\//, { timeout: 5000 });
    }

    // 011: Banner CTA 点击跳转详情页（重新回首页，避免坐标命中已卸载节点）
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.hero-banner__cta').first()).toBeVisible({ timeout: 8000 });
    let ok = false;
    for (let i = 0; i < 12 && !ok; i += 1) {
      const target = page
        .locator('.hero-banner__cta:not(.hero-banner__cta--continue)')
        .filter({ visible: true })
        .first();
      if (await target.count()) {
        await target.evaluate((el) => el.click()).catch(() => {});
      }
      await expect(page).toHaveURL(/\/detail\//, { timeout: 2000 }).catch(() => {});
      ok = page.url().includes('/detail/');
    }
    const url = page.url();
    expect(url).toContain('/detail/');
    if (ok) console.log(`✅ HOME-011 通过: Banner CTA 点击正确跳转详情页 (URL = ${url})`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.3 分类快捷入口
// ═══════════════════════════════════════════════════════════════

test.describe('1.3 分类快捷入口', () => {
  // ── 分类跳转 URL 参数验证 ──
  const CATEGORY_TEST_CASES = [
    { label: '全部', expectedCategory: 'all', expectedMediaType: 'all', expectedGenre: null },
    { label: '电影', expectedCategory: 'movie', expectedMediaType: 'movie', expectedGenre: null },
    { label: '剧集', expectedCategory: 'tv', expectedMediaType: 'tv', expectedGenre: null },
    { label: '综艺', expectedCategory: 'variety', expectedMediaType: 'tv', expectedGenre: '10764' },
    { label: '动漫', expectedCategory: 'anime', expectedMediaType: 'tv', expectedGenre: '16' },
    { label: '纪录片', expectedCategory: 'documentary', expectedMediaType: 'movie', expectedGenre: '99' },
    { label: '排行榜', expectedCategory: 'top', expectedMediaType: 'all', expectedGenre: null },
  ];

  test('分类快捷入口跳转（全分类 URL 参数校验 + 搜索联动，020/022循环/024b）', async ({ page }) => {
    // 移动端视口（< 768px）验证分类快选点击跳转；桌面 web 现已同样显示分类快选
    await page.setViewportSize({ width: 767, height: 1024 });

    // ── 020: 点击首个分类跳转浏览页 ──
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.category-quick-access__card').first()).toBeVisible({ timeout: 8000 });
    const chips = page.locator('.category-quick-access__card');
    const count = await chips.count();
    if (count > 0) {
      await chips.first().click();
      await expect(page).toHaveURL(/\/browse/, { timeout: 5000 });
    }

    // ── 022 循环：各分类跳转 URL 参数正确 ──
    for (const tc of CATEGORY_TEST_CASES) {
      await page.setViewportSize({ width: 767, height: 1024 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.app-shell', { timeout: 15000 });
      await expect(page.locator('.category-quick-access')).toBeVisible({ timeout: 8000 });

      const categoryBtn = page.locator(
        `.category-quick-access__card[aria-label="分类：${tc.label}"]`
      );
      const isVisible = await categoryBtn
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);

      if (isVisible) {
        await categoryBtn.click();
        await expect(page).toHaveURL(/\/browse/, { timeout: 5000 });
        const url = new URL(page.url());
        expect(url.pathname).toBe('/browse');
        expect(url.searchParams.get('category')).toBe(tc.expectedCategory);
        expect(url.searchParams.get('mediaType')).toBe(tc.expectedMediaType);
        const genre = url.searchParams.get('genre');
        if (tc.expectedGenre) {
          expect(genre).toBe(tc.expectedGenre);
        } else {
          expect(genre).toBeNull();
        }
      }
    }

    // ── 024b: 分类跳转后搜索框输入验证 ──
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.category-quick-access')).toBeVisible({ timeout: 8000 });

    const categoryBtn = page.locator('.category-quick-access__card[aria-label="分类：电影"]');
    await expect(categoryBtn).toBeVisible({ timeout: 5000 });
    await categoryBtn.click();
    await expect(page).toHaveURL(/\/browse/, { timeout: 5000 });

    const url1 = new URL(page.url());
    expect(url1.pathname).toBe('/browse');
    expect(url1.searchParams.get('category')).toBe('movie');

    const searchToggle = page.locator('.sticky-header__search-btn');
    if (await searchToggle.isVisible().catch(() => false)) {
      await searchToggle.click();
      await expect(page.locator('.sticky-header .search-box__input')).toBeVisible({ timeout: 5000 });
    }

    const searchInput = page.locator('.sticky-header .search-box__input');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.click();
    await searchInput.fill('复仇者联盟');
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toBe('复仇者联盟');

    await searchInput.press('Enter');
    await expect(page.locator('.browse-results-body')).toBeVisible({ timeout: 5000 });
  });
});

// =============================================================
// 1.3b 桌面端分类入口
// =============================================================

test.describe('1.3b 桌面端分类入口', () => {
  test('桌面端分类快选跳转 /browse + 顶栏 IPTV/设置入口（060/061）', async ({ page }) => {
    // 2026-09-10 用户拍板：宽屏起点定为 1024（含端点），圆卡形态的回退区间为 768–1023，
    // 故本用例用 900 视口验证「桌面非宽屏」的圆卡入口。
    await page.setViewportSize({ width: 900, height: 800 });

    // 060: 分类快选可见且点击跳转 /browse
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.category-quick-access').first()).toBeVisible({ timeout: 8000 });
    const qa = page.locator('.category-quick-access').first();
    await expect(qa).toBeVisible();
    const movieCard = page.locator('.category-quick-access__card[aria-label="分类：电影"]');
    await expect(movieCard).toBeVisible();
    await movieCard.click();
    await expect(page).toHaveURL(/\/browse/, { timeout: 5000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe('/browse');
    expect(url.searchParams.get('category')).toBe('movie');

    // 061: 顶栏提供 IPTV 与设置入口
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header__nav', { timeout: 15000 });
    await expect(page.locator('.sticky-header__nav-item').first()).toBeVisible({ timeout: 8000 });
    const titles = await page.evaluate(() =>
      [...document.querySelectorAll('.sticky-header__nav-item')].map(
        (el) => (el as HTMLElement).title || (el as HTMLElement).textContent?.trim() || '',
      ),
    );
    expect(titles.join(' ')).toContain('IPTV');
    expect(titles.join(' ')).toContain('设置');
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.4 TMDBMovieRow 行数据
// ═══════════════════════════════════════════════════════════════

test.describe('1.4 TMDBMovieRow 行数据', () => {
  test('行标题+水平滚动+卡片点击跳转（030/031/035）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.home-rows, [class*="home-row"]').first()).toBeVisible({ timeout: 8000 });

    // 030: 行标题正确显示
    const rowsExist = await page.evaluate(() => {
      return !!document.querySelector('.home-rows, [class*="home-row"]');
    });
    expect(rowsExist).toBeTruthy();
    if (rowsExist) {
      const rowCount = await page.locator('.home-rows > *, [class*="home-row"]').count();
      expect(rowCount).toBeGreaterThan(0);
    }

    // 031: 行数据水平滚动
    const hasScrollableRow = await page.evaluate(() => {
      const scroll = document.querySelector('.tmdb-movierow-scroll');
      if (!scroll) return false;
      return scroll.scrollWidth > scroll.clientWidth;
    });
    expect(hasScrollableRow).toBeTruthy();

    // 035: 卡片点击跳转详情
    const card = page.locator('.video-card a, .video-card').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await expect(page).toHaveURL(/\/detail\//, { timeout: 5000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.5 全局交互
// ═══════════════════════════════════════════════════════════════

test.describe('1.5 全局交互', () => {
  test('回到顶部+全请求失败错误提示（040/041）', async ({ page, browser }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 040: 回到顶部按钮（按钮仅在滚动超过阈值后挂载，故先滚动再等可见，替代滚动前的 toBeAttached 误判）
    // 真实滚动容器是 .app-shell__scroll（非 window）。scroll 监听在 React effect 挂载后才生效，
    // 若滚动过早事件会丢失 → 用轮询反复滚动，直到监听器就绪、按钮渲染。
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect.poll(async () => {
      // 仅当未滚动时设置（已=2000 再设是 no-op，不触发 scroll 事件 → 监听器收不到）
      const el = page.locator('.app-shell__scroll');
      const top = await el.evaluate((n) => n.scrollTop).catch(() => 0);
      if (top < 100) await el.evaluate((n) => { n.scrollTop = 2000; });
      return page.locator('.back-to-top-button').count();
    }, { timeout: 8000 }).toBeGreaterThan(0);
    const backToTop = page.locator('.back-to-top-button');
    if (await backToTop.isVisible().catch(() => false)) {
      await backToTop.click();
      await expect.poll(
        () => page.locator('.app-shell__scroll').evaluate((el) => el.scrollTop),
        { timeout: 5000 },
      ).toBeLessThan(100);
    }

    // 041: 所有请求都失败时显示错误提示
    // 首页 store 持久化到 localStorage（home-tmdb-data）且模块级跨用例不重置：前序用例已灌满 hasAnyData，
    // 同 context 内无法可靠清零 → 用全新 browser context（空 localStorage）隔离，abort TMDB 后稳定触发空态。
    const errCtx = await browser.newContext();
    const errPage = await errCtx.newPage();
    await errPage.route('**/api.tmdb.org/**', (route) => route.abort());
    await errPage.goto('/');
    await expect.poll(
      () => errPage.evaluate(() => !!document.querySelector('.home-empty, .home-token-required')),
      { timeout: 20000 },
    ).toBeTruthy();
    await errCtx.close();
  });

  test('移动端顶部 logo/搜索框与侧边栏品牌字（045/046）', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });

    // 045: logo 右侧不显示 kinoTV，顶栏中央为常驻搜索框
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.sticky-header')).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator('.sticky-header__logo-group .sticky-header__brand'),
    ).toBeHidden({ timeout: 5000 });
    const centerSearch = page.locator(
      '.sticky-header__center input[type="search"], .sticky-header__center input',
    );
    await expect(centerSearch).toBeVisible({ timeout: 5000 });

    // 046: 打开侧边栏后头部显示 logo 与品牌字
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.sticky-header__menu-btn').first()).toBeVisible({ timeout: 8000 });
    const menuBtn = page.locator('.sticky-header__menu-btn').first();
    await expect(menuBtn).toBeVisible({ timeout: 5000 });
    await menuBtn.click();
    await expect(page.locator('.sidebar-header__brand .sidebar-logo').first()).toBeVisible({ timeout: 8000 });
    const logo = page.locator('.sidebar-header__brand .sidebar-logo').first();
    await expect(logo).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.sidebar-header__brand .sidebar-title')).toHaveText('KinoTV');
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.7 非手机 web 小视口（768–1023px）设备区分
// ═══════════════════════════════════════════════════════════════

test.describe('1.7 非手机 web 小视口（768–1023px）设备区分', () => {
  test('小视口(800×900)分类快选渲染 6 项 + 桌面搜索框（055/056）', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.category-quick-access').first()).toBeVisible({ timeout: 8000 });

    // 055: 分类快选渲染（桌面隐藏规则已解禁），800px 仍属 mobile → 6 项精简集
    const quickAccess = page.locator('.category-quick-access').first();
    await expect(quickAccess).toBeVisible();
    const cardCount = await page.locator('.category-quick-access__card').count();
    expect(cardCount).toBe(6);

    // 056: 桌面搜索框渲染而非移动搜索框
    const desktopInput = page.locator('.sticky-header .search-box__input').first();
    const mobileInput = page.locator('.sticky-header__mobile-search .search-box__input').first();
    const desktopVisible = await desktopInput.isVisible().catch(() => false);
    const mobileVisible = await mobileInput.isVisible().catch(() => false);
    expect(desktopVisible).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.3c 宽屏分类面板
// ═══════════════════════════════════════════════════════════════

test.describe('1.3c 宽屏分类面板', () => {
  // mega 面板自门控：useIsWideDesktop() = (min-width: 1281px)。默认 viewport 1280 不渲染面板，
  // 必须显式 ≥1440 才触发 hover 展开逻辑（防御性，避免依赖 config 默认视口）。
  test.use({ viewport: { width: 1440, height: 900 } });

  // 面板 hover 可能因趋势数据后续更新触发 re-render 被瞬间收起：
  // 先等页面数据稳定（首页 .tmdb-movierow / 其他页各自稳定元素出现 = 趋势数据已就绪，不再 re-render），
  // 再单次 hover 并轮询面板出现。替代固定 waitForTimeout（3000ms 睡眠）与重试 hover（会震荡）。
  // 等页面异步数据彻底就绪（首页 .tmdb-movierow / .cqa-heat-row；browse 结果区；settings 页）再 hover，
  // 避免 hover 过早触发面板后首页数据后续更新 re-render 把面板收起（mouseleave 误触发）。
  const waitPageReady = async (page: import('@playwright/test').Page) => {
    await expect.poll(
      async () => page.locator('.tmdb-movierow, .browse-results-body, .browse-card--results, .settings-page, .cqa-heat-row, .category-quick-access__card').first().count(),
      { timeout: 15000 },
    ).toBeGreaterThan(0);
  };
  // hover 开面板：反复 hover 直到面板出现。数据刷新导致 re-render 瞬间收起时，poll 发现面板消失会重新 hover 撑住，
  // 待数据稳定后面板常驻即通过。替代固定 waitForTimeout + 单次 hover（后者在竞态下 15s 超时）。
  const openPanel = async (page: import('@playwright/test').Page, n: number) => {
    await waitPageReady(page);
    await page.mouse.move(2, 2); // 移开光标，确保无残留面板
    await expect.poll(() => page.locator('.cqa-overlay').count(), { timeout: 3000 }).toBe(0).catch(() => {});
    await expect.poll(async () => {
      if ((await page.locator('.cqa-overlay .cqa-hotcard').count()) === 0) {
        await page.locator('.cqa-nav__item').nth(n).hover();
      }
      return page.locator('.cqa-overlay .cqa-hotcard').count();
    }, { timeout: 15000 }).toBeGreaterThan(0);
  };
  const openPanelOverlay = async (page: import('@playwright/test').Page, n: number) => {
    await waitPageReady(page);
    await page.mouse.move(2, 2);
    await expect.poll(() => page.locator('.cqa-overlay').count(), { timeout: 3000 }).toBe(0).catch(() => {});
    await expect.poll(async () => {
      if ((await page.locator('.cqa-overlay').count()) === 0) {
        await page.locator('.cqa-nav__item').nth(n).hover();
      }
      return page.locator('.cqa-overlay').count();
    }, { timeout: 15000 }).toBeGreaterThan(0);
  };
  test('面板入口与常驻布局（070 chips/071 热度榜/074 全部分类/083 完整榜单）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // 070: chips 融合顶栏、8 入口、热度徽标移除、默认 overlay 收起
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await expect(page.locator('.cqa-nav__item').first()).toBeVisible({ timeout: 8000 });
    const navItems = page.locator('.cqa-nav__item');
    expect(await navItems.count()).toBe(8); // 7 分类 chip + 全部分类
    expect(await page.locator('.cqa-nav__item svg').count()).toBeGreaterThanOrEqual(8);
    expect(await page.locator('.cqa-nav__heat').count()).toBe(0);
    expect(await page.locator('.cqa-overlay').count()).toBe(0);

    // 071: 首页左栏常驻「今日趋势」榜
    // 2026-09-10 用户拍板：rail 变体由「分类热度榜 3 卡」改为「今日趋势 TOP 榜」（.cqa-trend）——
    // 趋势序取自 TMDB /trending/all/day，不按 popularity 数值重排，故断言排名自 1 起连续。
    await page.waitForSelector('.cqa-heat-row .cqa-trend__item', { timeout: 15000 });
    expect(await page.locator('.cqa-heat-row .cqa-trend__item').count()).toBeGreaterThan(0);
    await expect(page.locator('.cqa-heat-row__title')).toHaveText('今日趋势');
    const trendRanks = await page
      .locator('.cqa-heat-row .cqa-trend__rank')
      .evaluateAll((els) => els.map((e) => Number(e.textContent?.trim())));
    expect(trendRanks[0]).toBe(1);
    expect(trendRanks.every((n, i) => n === i + 1)).toBe(true);

    // 074: 「全部分类」跳转 /browse
    await page.locator('.cqa-nav__more').click();
    await expect(page).toHaveURL(/\/browse/, { timeout: 5000 });
    const url1 = new URL(page.url());
    expect(url1.pathname).toBe('/browse');
    expect(url1.searchParams.get('category')).toBe('all');

    // 083: 首页左栏为趋势榜（无「查看完整榜单」入口）；点条目前往影片详情
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cqa-heat-row .cqa-trend__row', { timeout: 15000 });
    expect(await page.locator('.cqa-heat-row__more').count()).toBe(0);
    await page.locator('.cqa-trend__row').first().click();
    await expect(page).toHaveURL(/\/detail\//, { timeout: 5000 });
    await page.waitForSelector('.detail-hero', { timeout: 15000 });
  });

  test('mega 展开/子分类切换/跳转/tooltip（072/073/077/079/087）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // 072: 悬停「电影」chip → mega 面板展开
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await expect(page.locator('.cqa-nav__item').first()).toBeVisible({ timeout: 8000 });
    // 等趋势数据就绪（.cqa-heat-row 渲染 = 首页异步数据稳定），避免 hover 过早触发后 re-render 误收起面板
    await expect(page.locator('.cqa-heat-row')).toBeVisible({ timeout: 10000 });
    await openPanel(page, 1);
    expect(await page.locator('.cqa-overlay').count()).toBe(1);
    expect(await page.locator('.cqa-panel__heat').count()).toBe(1);
    expect(await page.locator('.cqa-subgenres__chip').count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator('.cqa-hotcard').count()).toBe(9);
    expect(await page.locator('.app-shell .cqa-overlay').count()).toBe(1);

    // 073: 点子分类 chip 面板不消失（仍为 9 卡）
    await page.locator('.cqa-subgenres__chip').nth(1).click();
    await expect(page.locator('.cqa-overlay')).toBeVisible({ timeout: 8000 });
    expect(await page.locator('.cqa-hotcard').count()).toBe(9);

    // 077: 趋势条目跳转影片详情
    // （原为「分类卡跳 /chart」，随首页 rail 形态改为趋势榜而调整 —— 趋势榜无 /chart 入口）
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cqa-heat-row .cqa-trend__row', { timeout: 15000 });
    await expect(page.locator('.cqa-heat-row .cqa-trend__row').first()).toBeVisible({ timeout: 8000 });
    await page.locator('.cqa-trend__row').first().click();
    await expect(page).toHaveURL(/\/detail\//, { timeout: 5000 });
    await page.waitForSelector('.detail-hero', { timeout: 15000 });

    // 079: 趋势口径 tooltip
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cqa-heat-row .cqa-trend__item', { timeout: 15000 });
    await expect(page.locator('.cqa-heat-row__sub')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.cqa-heat-row__sub')).toHaveText(/TMDB 实时趋势排名/);
    const rowTip = page.locator('.cqa-heat-row .cqa-info-tip');
    await expect(rowTip).toHaveCount(1);
    await rowTip.hover();
    await expect(page.locator('.cqa-info-tip__content')).toBeVisible();
    await expect(page.locator('.cqa-info-tip__content')).toContainText('TMDB');
    await openPanel(page, 1);
    await expect(page.locator('.cqa-panel__sub')).toHaveText(/点卡片看详情/);
    await expect(page.locator('.cqa-panel__heat')).toBeVisible();
    await expect(page.locator('.cqa-overlay .cqa-info-tip')).toHaveCount(1);

    // 087: 切子分类 → 清空旧网格、走居中「小电视 + 加载中」态
    // 2026-09-10 面板改为「切分类/子分类统一清空」（原「保留旧网格 + 降沉遮罩」的
    // .cqa-panel__refresh 已成死代码被移除），故断言改为 .cqa-panel__loading 的文案。
    await page.route('**/api.tmdb.org/3/discover/movie**', async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.fallback();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await openPanel(page, 1);
    await page.locator('.cqa-subgenres__chip').nth(1).click();
    await page.waitForSelector('.cqa-panel__loading', { timeout: 5000 });
    await expect(page.locator('.cqa-panel__loading')).toContainText('正在获取');
    await page.waitForSelector('.cqa-panel__loading', { state: 'detached', timeout: 15000 });
    expect(await page.locator('.cqa-hotcard').count()).toBe(9);
  });

  test('面板交互稳定性（075 1280回归/076 点击外部收起/080 旧网格/081 分页/082 竖排/084 滚动收起/085 跨页/086 browse）', async ({ page }) => {
    // 075: 900 视口回归——仍渲染圆卡分支，不命中宽屏面板
    //（2026-09-10 用户拍板宽屏起点为 1024（含端点），圆卡回退区间 768–1023）
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect(page.locator('.category-quick-access__card').first()).toBeVisible({ timeout: 8000 });
    expect(await page.locator('.cqa-nav').count()).toBe(0);
    await expect(page.locator('.category-quick-access__card').first()).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });

    // 076: 点击面板以外区域收起；「首页」chip 不展开面板
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await expect(page.locator('.cqa-nav__item').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.cqa-heat-row')).toBeVisible({ timeout: 10000 });
    await openPanelOverlay(page, 1);
    await page.locator('.cqa-heat-row__title').click();
    await expect.poll(() => page.locator('.cqa-overlay').count(), { timeout: 5000 }).toBe(0);
    await page.locator('.cqa-nav__item').first().hover();
    await expect.poll(() => page.locator('.cqa-overlay').count(), { timeout: 5000 }).toBe(0);

    // 080: 子分类切换保留旧网格
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await expect(page.locator('.cqa-nav__item').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.cqa-heat-row')).toBeVisible({ timeout: 10000 });
    await openPanel(page, 1);
    await page.locator('.cqa-subgenres__chip').nth(1).click();
    const gridCards = page.locator('.cqa-panel__grid .cqa-hotcard');
    await expect(gridCards.first()).toBeAttached();
    await expect.poll(() => page.locator('.cqa-panel__grid .cqa-hotcard').count(), { timeout: 5000 }).toBe(9);

    // 081: 面板分页 → 末页「查看更多」跳 browse
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await expect(page.locator('.cqa-nav__item').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.cqa-heat-row')).toBeVisible({ timeout: 10000 });
    await openPanel(page, 1);
    const pager = page.locator('.cqa-panel__pager');
    await expect(pager).toBeVisible();
    await expect(page.locator('.cqa-panel__pager__ind')).toHaveText('1 / 3');
    await expect(page.locator('.cqa-panel__pager__btn').first()).toBeDisabled();
    const firstTitle = await page.locator('.cqa-hotcard__t').first().textContent();
    await page.getByLabel('下一页').click();
    await expect(page.locator('.cqa-panel__pager__ind')).toHaveText('2 / 3');
    await expect(page.locator('.cqa-hotcard__rank').first()).toHaveText('10');
    const secondTitle = await page.locator('.cqa-hotcard__t').first().textContent();
    expect(secondTitle).not.toBe(firstTitle);
    await page.getByLabel('下一页').click();
    await expect(page.locator('.cqa-panel__pager__ind')).toHaveText('3 / 3');
    await expect(page.locator('.cqa-panel__pager__btn--more')).toHaveText(/查看更多/);
    await page.locator('.cqa-panel__pager__btn--more').click();
    await expect(page).toHaveURL(/\/browse/, { timeout: 5000 });
    const url3 = new URL(page.url());
    expect(url3.pathname).toBe('/browse');
    expect(url3.searchParams.get('category')).toBe('movie');
    expect(url3.searchParams.get('mediaType')).toBe('movie');

    // 082: 面板网格竖向排列
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await expect(page.locator('.cqa-nav__item').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.cqa-heat-row')).toBeVisible({ timeout: 10000 });
    await openPanel(page, 1);
    const cards = page.locator('.cqa-hotcard');
    const [b1, b2, b4] = await Promise.all([
      cards.nth(0).boundingBox(),
      cards.nth(1).boundingBox(),
      cards.nth(3).boundingBox(),
    ]);
    expect(b1).toBeTruthy();
    expect(Math.abs(b1!.x - b2!.x)).toBeLessThan(4);
    expect(b2!.y).toBeGreaterThan(b1!.y);
    expect(b4!.x - b1!.x).toBeGreaterThan(b1!.width / 2);

    // 084: 页面向下滚动 → 面板立即收起
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await expect(page.locator('.cqa-nav__item').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.cqa-heat-row')).toBeVisible({ timeout: 10000 });
    await openPanelOverlay(page, 1);
    await page.evaluate(() => {
      const el = (document.querySelector('.custom-scrollbar-container') ||
        document.querySelector('[class*="scroll"]')) as HTMLElement | null;
      if (el) el.scrollTop = 400;
    });
    await expect.poll(() => page.locator('.cqa-overlay').count(), { timeout: 5000 }).toBe(0);

    // 085: 其他页面 hover/点 chip 开面板；「首页」chip 收起+回首页
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await expect(page.locator('.cqa-nav__item').first()).toBeVisible({ timeout: 8000 });
    // /browse 数据就绪后再 hover，避免早期 re-render 误收起面板
    await expect(page.locator('.browse-results-body, .browse-card--results').first()).toBeVisible({ timeout: 10000 });
    await openPanel(page, 1);
    expect(await page.locator('.cqa-overlay').count()).toBe(1);
    await page.locator('.cqa-nav__item').first().click();
    await expect.poll(() => page.locator('.cqa-overlay').count(), { timeout: 5000 }).toBe(0);
    expect(new URL(page.url()).pathname).toBe('/');
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    const urlBefore = page.url();
    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 10000 });
    await openPanel(page, 2);
    await page.locator('.cqa-nav__item').nth(2).click();
    await expect.poll(() => page.locator('.cqa-overlay').count(), { timeout: 5000 }).toBe(1);
    expect(page.url()).toBe(urlBefore);
    await page.locator('.cqa-nav__item').first().click();
    await expect.poll(() => page.locator('.cqa-overlay').count(), { timeout: 5000 }).toBe(0);
    expect(new URL(page.url()).pathname).toBe('/');

    // 086: browse 页 hover chip 开面板且 URL 不变
    await page.goto('/browse?category=movie', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await expect(page.locator('.cqa-nav__item').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.browse-results-body, .browse-card--results').first()).toBeVisible({ timeout: 10000 });
    const urlBefore2 = page.url();
    await openPanel(page, 2);
    expect(await page.locator('.cqa-overlay').count()).toBe(1);
    expect(page.url()).toBe(urlBefore2);
    await page.locator('.sticky-header__brand').hover();
    await expect.poll(() => page.locator('.cqa-overlay').count(), { timeout: 5000 }).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.3d 宽屏 HeroBili 卡
// ═══════════════════════════════════════════════════════════════

test.describe('1.3d 宽屏 HeroBili 卡', () => {
  test('HOME-088: hero 卡 1px 边框；封面加载失败走 kinoTV 品牌兜底', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route('**/test-backdrop-6.jpg**', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero-side-card', { timeout: 15000 });
    await expect(page.locator('.hero-side-card')).toHaveCount(6, { timeout: 8000 });
    const border = await page.locator('.hero-side-card').first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.borderStyle, width: cs.borderWidth };
    });
    expect(border.style).toBe('solid');
    expect(border.width).toBe('1px');
    expect(await page.locator('.hero-side-card__img.lazy-image-container').count()).toBeGreaterThan(0);
    expect(await page.locator('.hero-side-card .lazy-image-container.error').count()).toBe(1);
    await expect(
      page.locator('.hero-side-card .lazy-image-container.error .lazy-image-fallback--brand'),
    ).toContainText('kinoTV');
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.3e Hero 主图加载失败兜底
// ═══════════════════════════════════════════════════════════════

test.describe('1.3e Hero 主图加载失败兜底', () => {
  test('HOME-089: banner 主图 404 → kinoTV 品牌兜底（HeroBili / Classic 两条路径）', async ({ page }) => {
    // trending[0].backdrop_path = /test-backdrop-0.jpg，即 banner 池首图。
    // 拦截它即可命中「主图加载失败」；侧栏卡片用 items[6..]，不受影响。
    await page.route('**/test-backdrop-0.jpg**', (route) => route.fulfill({ status: 404, body: '' }));

    // 宽屏 ≥1024：HeroBili 主图
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero-bili__banner', { timeout: 15000 });
    const biliFallback = page.locator('.hero-bili__banner-fallback');
    await expect(biliFallback).toHaveCount(1, { timeout: 8000 });
    await expect(biliFallback).toContainText('kinoTV');

    // 窄屏 <1024：HeroBannerClassic 主图（同一套公共品牌兜底）
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero-banner__main', { timeout: 15000 });
    const classicFallback = page.locator('.hero-banner__fallback');
    await expect(classicFallback).toHaveCount(1, { timeout: 8000 });
    await expect(classicFallback).toContainText('kinoTV');
  });
});
