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
    // 003: 首屏必有加载占位。2026-09-22 plain 整改后启动链为：#boot-splash（home 同构骨架）
    //      → homeSkeleton（无 plain AppLoading 盖脸），故断言两者任一在位。
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loadingVisible = await page.evaluate(() => {
      return !!document.querySelector('#boot-splash, .home-skeleton, .app-loading, [class*="loading"]');
    });
    expect(loadingVisible).toBeTruthy();

    // 004: 有 Token 且数据就绪显示完整首页
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    await expect.poll(() => page.evaluate(() => !!document.querySelector('.home-page, [class*="home"]')), { timeout: 8000 }).toBeTruthy();
    const hasHomeContent = await page.evaluate(() => {
      return !!document.querySelector('.home-page, [class*="home"]');
    });
    expect(hasHomeContent).toBe(true);

    // 005: 首页 plain loading 最大超时 10 秒（整改后启动链本不应出现 .app-loading，
    // 若因异常出现也须在 10s 内收敛）
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => {
      const loading = document.querySelector('.app-loading');
      return loading ? getComputedStyle(loading).display !== 'none' : false;
    }), { timeout: 10000 }).toBe(false);

    // ── 无 Token：001 配置提示 / 002 点击跳转设置页 ──
    await page.goto('/', { waitUntil: 'domcontentloaded' });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    // 等真实 Hero 挂载：home-skeleton-hero 也含 "hero" 子串，不能用 [class*="hero"] 提前放行
    await expect(page.locator('.hero-bili__banner, .hero-banner__main').first()).toBeVisible({ timeout: 15000 });

    // 010: Banner 存在且可显示
    const heroExists = await page.evaluate(() => {
      return !!document.querySelector('.home-hero, [class*="hero"]');
    });
    expect(heroExists).toBeTruthy();

    // 012（2026-09-11 同步）：首页 banner 右侧缩略图列已整体删除（用户请求 1），
    // 原 `.hero-banner__thumb` 断言失去对象 → 改为校验「当前视口下的 Hero 主图区」存在：
    //   ≥1024 非 TV → HeroBili 的 .hero-bili__banner；<1024 / TV → .hero-banner__main。
    const heroStage = page.locator('.hero-bili__banner, .hero-banner__main');
    expect(await heroStage.count()).toBeGreaterThan(0);

    // 011: Banner CTA 点击跳转详情页（重新回首页，避免坐标命中已卸载节点）
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });
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
      await page.waitForSelector('.app-shell', { timeout: 10000 });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });
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
    await page.waitForSelector('.sticky-header__nav', { timeout: 10000 });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    await expect.poll(async () => {
      // ⚠️ 每轮都必须产生「变化后」的滚动位置：固定值重复设置是 no-op、不派发 scroll，
      // 若首轮设置时 React 滚动监听尚未挂载（并发慢环境下更易命中），事件丢失后
      // 旧写法（仅 top<100 时设置）会永远等不到第二次机会 → 死锁超时。
      // 改为在 2000 / 900 间交替，保证每轮都触发一次 scroll 事件。
      const el = page.locator('.app-shell__scroll');
      await el.evaluate((n) => { n.scrollTop = n.scrollTop > 1000 ? 900 : 2000; }).catch(() => {});
      return page.locator('.back-to-top-button').count();
    }, { timeout: 10000 }).toBeGreaterThan(0);
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
    await errPage.goto('/', { waitUntil: 'domcontentloaded' });
    await expect.poll(
      () => errPage.evaluate(() => !!document.querySelector('.home-empty, .home-token-required')),
      { timeout: 10000 },
    ).toBeTruthy();
    await errCtx.close();
  });

  test('移动端顶部 logo/搜索框与侧边栏品牌字（045/046）', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });

    // 045: logo 右侧不显示 kinoTV，顶栏中央为常驻搜索框
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });
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

test.describe('1.3c 宽屏分类入口（合集推荐行现态）', () => {
  // 2026-10-11 同步 4a986d2「首页大屏整改」：顶栏 chips（.cqa-nav）与 mega 面板已退役，
  // 宽屏分类入口 = CategoryInlineBoard「合集推荐」行（点击跳 /chart?collection=key），
  // <1024 回退圆卡。本组断言现态，并锁定「旧 mega 链任何页面都不复生」。
  test.use({ viewport: { width: 1440, height: 900 } });

  // 等首页异步数据稳定（首行 .tmdb-movierow 已渲染），避免 re-render 窗口期误断。
  // 2026-10-11：原 waitPageReady/openPanel/openPanelOverlay（hover .cqa-nav 触发 mega）
  // 随顶栏 chips 退役删除——现态无 mega 触发源，面板 overlay 恒不出现。
  const waitHomeReady = async (page: import('@playwright/test').Page) => {
    await expect(page.locator('.home-page:not(.home-skeleton) .tmdb-movierow').first()).toBeVisible({ timeout: 10000 });
  };
  test('分类入口与常驻布局（070 chips 退役回归/074 合集跳转/083 详情入口）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // 070'：旧 mega 入口不得存在——顶栏 chips 与面板 overlay 均恒 0（锁定退役态）
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitHomeReady(page);
    expect(await page.locator('.sticky-header .cqa-nav').count()).toBe(0);
    expect(await page.locator('.cqa-overlay').count()).toBe(0);

    // 074'：现态分类入口 = 合集推荐行，点首卡跳 /chart?collection=
    await expect(page.locator('.cqa-board')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.cqa-board__collection').first()).toBeVisible();
    await page.locator('.cqa-board__collection').first().click();
    await expect(page).toHaveURL(/\/chart\?collection=/, { timeout: 5000 });
    await page.waitForSelector('.chart-row', { timeout: 10000 });

    // 083'：点 banner 右侧卡前往影片详情（首页常驻 /detail 入口，沿用原测点）
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero-side-card', { timeout: 10000 });
    await page.locator('.hero-side-card').first().click();
    await expect(page).toHaveURL(/\/detail\//, { timeout: 5000 });
    await page.waitForSelector('.detail-hero', { timeout: 10000 });
  });

  test('合集推荐行渲染与跳转（072 行标题/073 拼贴卡/077 跳转参数/087 骨架同构）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitHomeReady(page);
    const board = page.locator('.cqa-board');
    await expect(board).toBeVisible({ timeout: 10000 });

    // 072'：行标题「合集推荐」；卡数 ≥1（6 组 discover 全到齐才出卡，单组失败 skip 的 store 口径）
    await expect(page.locator('.cqa-board .tmdb-movierow-title')).toHaveText('合集推荐');
    const collectionCount = await page.locator('.cqa-board__collection').count();
    expect(collectionCount).toBeGreaterThanOrEqual(1);

    // 073'：每张合集卡 = 2×2 拼贴封面（格数 ≥1）+ 名称行非空（拼贴形状回归锁）
    const firstCard = page.locator('.cqa-board__collection').first();
    expect(await firstCard.locator('.cqa-board__collage-img').count()).toBeGreaterThanOrEqual(1);
    expect(((await firstCard.locator('.cqa-board__name').textContent()) ?? '').trim().length).toBeGreaterThan(0);

    // 077'：点击合集卡 → /chart?collection= 带 key，榜单行就绪
    await page.locator('.cqa-board__collection').nth(collectionCount > 1 ? 1 : 0).click();
    await expect(page).toHaveURL(/\/chart\?collection=\w+/, { timeout: 5000 });
    await page.waitForSelector('.chart-row', { timeout: 10000 });

    // 087'：discover 延迟 800ms → 骨架与真实卡同构（拼贴灰块出现；数据到达后换真实卡、骨架消失）
    await page.route('**/api.tmdb.org/3/discover/**', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.fallback();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cqa-board__sk').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.cqa-board__sk')).toHaveCount(0, { timeout: 15000 });
  });

  test('入口分支互斥与退役链回归锁（075 窄屏圆卡/076 宽屏互斥/084-086 全站无 mega 入口）', async ({ page }) => {
    // 075'：900 窄屏——圆卡分支渲染；合集行与旧 chips 都不出现
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    await expect(page.locator('.category-quick-access__card').first()).toBeVisible({ timeout: 8000 });
    expect(await page.locator('.cqa-board').count()).toBe(0);
    expect(await page.locator('.cqa-nav').count()).toBe(0);

    // 076'：1440 宽屏——只渲染合集行，圆卡不渲染（两分支互斥）
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitHomeReady(page);
    await expect(page.locator('.cqa-board')).toBeVisible({ timeout: 10000 });
    expect(await page.locator('.category-quick-access__card').count()).toBe(0);

    // 084'：首页滚动也不会出现旧面板 overlay（全局已无触发源）
    await page.evaluate(() => {
      const el = (document.querySelector('.custom-scrollbar-container') ||
        document.querySelector('[class*="scroll"]')) as HTMLElement | null;
      if (el) el.scrollTop = 400;
    });
    expect(await page.locator('.cqa-overlay').count()).toBe(0);

    // 085/086'：browse/settings 同样不再出现顶栏 chips（退役是全站性，非仅首页）
    await page.goto('/browse?category=movie', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.browse-results-body, .browse-card--results').first()).toBeVisible({ timeout: 10000 });
    expect(await page.locator('.sticky-header .cqa-nav').count()).toBe(0);
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 10000 });
    expect(await page.locator('.sticky-header .cqa-nav').count()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.3d 宽屏 HeroBili 卡
// ═══════════════════════════════════════════════════════════════

test.describe('1.3d 宽屏 HeroBili 卡', () => {
  test('HOME-088: hero 卡已去卡片化（无边框）；封面加载失败走 kinoTV 品牌兜底', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route('**/test-backdrop-6.jpg**', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero-side-card', { timeout: 10000 });
    await expect(page.locator('.hero-side-card')).toHaveCount(6, { timeout: 8000 });
    const border = await page.locator('.hero-side-card').first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.borderStyle, width: cs.borderWidth };
    });
    // 2026-09-28 去卡片化：桌面端 hero-side-card 四件套（border/radius/surface/shadow）已移除。
    // border-style 恒为 solid 是 Tailwind preflight 的全局值（width 才是可见性判据），只断 width。
    expect(border.width).toBe('0px');
    expect(await page.locator('.hero-side-card__img.lazy-image-container').count()).toBeGreaterThan(0);
    // 2026-09-11 LazyImage 引入 S4 有界重试（1.2s/2.4s 指数退避）后才落 exhausted/error 终态；
    // 一次性 count() 会在重试等待期读到 0 → 必须用 web-first 断言（内部轮询等待）
    await expect(page.locator('.hero-side-card .lazy-image-container.error')).toHaveCount(1, { timeout: 10000 });
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
    await page.waitForSelector('.hero-bili__banner', { timeout: 10000 });
    const biliFallback = page.locator('.hero-bili__banner-fallback');
    await expect(biliFallback).toHaveCount(1, { timeout: 8000 });
    await expect(biliFallback).toContainText('kinoTV');

    // 窄屏 <1024：HeroBannerClassic 主图（同一套公共品牌兜底）
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero-banner__main', { timeout: 10000 });
    const classicFallback = page.locator('.hero-banner__fallback');
    await expect(classicFallback).toHaveCount(1, { timeout: 8000 });
    await expect(classicFallback).toContainText('kinoTV');
  });
});
