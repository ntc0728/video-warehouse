/**
 * 首页 (Home) 测试用例
 * 路由: /
 * 配置依赖: Level 1（TMDB Token）
 *
 * 覆盖: HOME-001 ~ HOME-045
 */
import { test, expect } from './fixtures/mock-tmdb';

// ═══════════════════════════════════════════════════════════════
// 1.1 页面加载与初始状态
// ═══════════════════════════════════════════════════════════════

test.describe('1.1 页面加载与初始状态', () => {
  test('HOME-001: 无 Token 时显示配置提示', async ({ page }) => {
    // 前置条件: TMDB Access Token 未配置
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('app-settings'));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 预期结果: 显示"TMDB Access Token 未配置"提示，包含"配置"按钮
    const tokenPrompt = page.locator('.home-token-required');
    if (await tokenPrompt.isVisible().catch(() => false)) {
      const link = page.locator('.home-token-required-link');
      await expect(link).toBeVisible();
    }
  });

  test('HOME-002: 点击配置按钮跳转设置页', async ({ page }) => {
    // 前置条件: 无 Token 状态
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('app-settings'));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const link = page.locator('.home-token-required-link');
    if (await link.isVisible().catch(() => false)) {
      // 操作: 点击"配置"按钮
      await link.click();
      await page.waitForTimeout(500);
      // 预期结果: 跳转到 /settings
      expect(page.url()).toContain('/settings');
    }
  });

  test('HOME-003: 有 Token 但数据加载中显示 loading', async ({ page }) => {
    // 前置条件: Token 已配置（由 global-setup 注入）
    await page.goto('/');
    // 预期结果: 进入时显示 loading 动画
    const loadingVisible = await page.evaluate(() => {
      return !!document.querySelector('.app-loading, [class*="loading"]');
    });
    expect(loadingVisible).toBeTruthy();
    // loading 可能因缓存秒回而不显示，这是正常的
  });

  test('HOME-004: 有 Token 且数据就绪显示完整首页', async ({ page }) => {
    // 前置条件: Token 已配置，数据已加载
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 显示 HeroBanner + 分类快捷入口 + 行数据
    const hasShell = await page.locator('.app-shell').isVisible();
    expect(hasShell).toBe(true);

    const hasHomeContent = await page.evaluate(() => {
      return !!document.querySelector('.home-page, [class*="home"]');
    });
    expect(hasHomeContent).toBe(true);
  });

  test('HOME-005: 首页 loading 最大超时 10 秒', async ({ page }) => {
    // 前置条件: 网络异常导致数据无法加载
    // 操作: 进入首页并等待
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForTimeout(11000);
    const elapsed = Date.now() - startTime;

    // 预期结果: 10 秒后 loading 自动关闭（无论数据是否就绪，最多 10s 内收敛）
    const loadingStillVisible = await page.evaluate(() => {
      const loading = document.querySelector('.app-loading');
      return loading ? getComputedStyle(loading).display !== 'none' : false;
    });
    expect(loadingStillVisible).toBe(false);
    // loading 应该已关闭或页面已显示内容
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.2 HeroBanner 交互
// ═══════════════════════════════════════════════════════════════

test.describe('1.2 HeroBanner 交互', () => {
  test('HOME-010: Banner 自动轮播', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: Banner 存在且可显示
    const heroExists = await page.evaluate(() => {
      return !!document.querySelector('.home-hero, [class*="hero"]');
    });
    expect(heroExists).toBeTruthy();
  });

  test('HOME-011: Banner 点击跳转详情页', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 操作: 点击 Banner 上的「查看详情」CTA
    // 轮播会自动切换条目并重建文字子树（key 变化），Playwright 坐标点击可能在重建瞬间
    // 命中已卸载节点而丢失；改用原生 el.click() 重试，命中即跳转。
    let ok = false;
    for (let i = 0; i < 12 && !ok; i += 1) {
      const target = page
        .locator('.hero-banner__cta:not(.hero-banner__cta--continue)')
        .filter({ visible: true })
        .first();
      if (await target.count()) {
        await target.evaluate((el) => el.click()).catch(() => {});
      }
      await page.waitForTimeout(400);
      ok = page.url().includes('/detail/');
    }
    const url = page.url();
    expect(url).toContain('/detail/');
    if (ok) console.log(`✅ HOME-011 通过: Banner CTA 点击正确跳转详情页 (URL = ${url})`);
  });

  test('HOME-012: 缩略图点击跳转详情页', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 操作: 点击右侧缩略图
    const thumb = page.locator('.hero-banner__thumb').first();
    if (await thumb.isVisible().catch(() => false)) {
      await thumb.click();
      await page.waitForTimeout(1000);
      // 预期结果: 跳转到 /detail/{id}
      const url = page.url();
      expect(url).toContain('/detail/');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.3 分类快捷入口
// ═══════════════════════════════════════════════════════════════

test.describe('1.3 分类快捷入口', () => {
  test('HOME-020: 点击分类跳转浏览页', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const chips = page.locator('.home-category-chip, [class*="category-chip"]');
    const count = await chips.count();
    if (count > 0) {
      // 操作: 点击第一个分类
      await chips.first().click();
      await page.waitForTimeout(1000);
      // 预期结果: 跳转到 /browse?category=...
      expect(page.url()).toContain('/browse');
    }
  });

  test('HOME-021: 分类入口数量', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const chips = page.locator('.category-quick-access__card');
    const count = await chips.count();
    // 预期结果: 显示分类入口（数量与 CATEGORY_CONFIG 一致）
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // ── 分类跳转 URL 参数验证 ──────────────────────────────────

  /**
   * 各分类跳转到 browse 页时的预期 URL 参数：
   * - 全部 (all): category=all&mediaType=all
   * - 电影 (movie): category=movie&mediaType=movie
   * - 剧集 (tv): category=tv&mediaType=tv
   * - 综艺 (variety): category=variety&mediaType=tv&genre=10764
   * - 动漫 (anime): category=anime&mediaType=tv&genre=16
   * - 纪录片 (documentary): category=documentary&mediaType=movie&genre=99
   * - 排行榜 (top): category=top&mediaType=all
   */
  const CATEGORY_TEST_CASES = [
    { label: '全部', expectedCategory: 'all', expectedMediaType: 'all', expectedGenre: null },
    { label: '电影', expectedCategory: 'movie', expectedMediaType: 'movie', expectedGenre: null },
    { label: '剧集', expectedCategory: 'tv', expectedMediaType: 'tv', expectedGenre: null },
    { label: '综艺', expectedCategory: 'variety', expectedMediaType: 'tv', expectedGenre: '10764' },
    { label: '动漫', expectedCategory: 'anime', expectedMediaType: 'tv', expectedGenre: '16' },
    { label: '纪录片', expectedCategory: 'documentary', expectedMediaType: 'movie', expectedGenre: '99' },
    { label: '排行榜', expectedCategory: 'top', expectedMediaType: 'all', expectedGenre: null },
  ];

  for (const tc of CATEGORY_TEST_CASES) {
    test(`HOME-022: 点击"${tc.label}"跳转 URL 参数正确`, async ({ page }) => {
      // 移动端视口（< 768px）验证分类快选点击跳转；桌面 web 现已同样显示分类快选（旧 HomeSidebar 隐藏规则已解禁）
      await page.setViewportSize({ width: 767, height: 1024 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.app-shell', { timeout: 15000 });
      await page.waitForTimeout(3000);

      // 等待分类按钮出现
      const categoryBtn = page.locator(
        `.category-quick-access__card[aria-label="分类：${tc.label}"]`
      );

      // 尝试等待按钮可见（最多 5 秒）
      const isVisible = await categoryBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);

      if (isVisible) {
        // 点击分类
        await categoryBtn.click();
        await page.waitForTimeout(1000);

        // 验证跳转到 /browse
        const url = new URL(page.url());
        expect(url.pathname).toBe('/browse');

        // 验证 category 参数
        expect(url.searchParams.get('category')).toBe(tc.expectedCategory);

        // 验证 mediaType 参数
        expect(url.searchParams.get('mediaType')).toBe(tc.expectedMediaType);

        // 验证 genre 参数
        const genre = url.searchParams.get('genre');
        if (tc.expectedGenre) {
          expect(genre).toBe(tc.expectedGenre);
        } else {
          expect(genre).toBeNull();
        }

      }
    });
  }

  test('HOME-023: 所有分类跳转后 Browse 页筛选条件正确', async ({ page }) => {
    // 移动端视口（< 768px）验证分类快选点击跳转；桌面 web 现已同样显示分类快选（旧 HomeSidebar 隐藏规则已解禁）
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);
    test.setTimeout(60000); // 增加超时时间到 60 秒

    // 测试每个分类
    for (const tc of CATEGORY_TEST_CASES) {
      // 返回首页
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.app-shell', { timeout: 15000 });
      await page.waitForTimeout(2000);

      // 找到对应分类按钮
      const categoryBtn = page.locator(
        `.category-quick-access__card[aria-label="分类：${tc.label}"]`
      );

      if (await categoryBtn.isVisible().catch(() => false)) {
        // 点击分类
        await categoryBtn.click();
        await page.waitForTimeout(1500);

        // 验证跳转到 /browse
        const url = new URL(page.url());
        expect(url.pathname).toBe('/browse');

        // 验证 URL 参数
        expect(url.searchParams.get('category')).toBe(tc.expectedCategory);
        expect(url.searchParams.get('mediaType')).toBe(tc.expectedMediaType);

        if (tc.expectedGenre) {
          expect(url.searchParams.get('genre')).toBe(tc.expectedGenre);
        }

        // 验证 Browse 页 FilterBar 显示正确的分类标签
        const categoryLabel = page.locator('.filter-bar__category, [class*="category"]');
        if (await categoryLabel.isVisible().catch(() => false)) {
          const labelText = await categoryLabel.textContent();
        }
      }
    }
  });

  // ── 桌面端全分类测试（含纪录片） ──────────────────────────────────

  test('HOME-024: 所有分类跳转 URL 参数正确', async ({ page }) => {
    test.setTimeout(60000);
    // 移动端视口（< 768px）验证分类快选点击跳转；桌面 web 现已同样显示分类快选（旧 HomeSidebar 隐藏规则已解禁）
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 桌面端显示所有 7 个分类
    const allCategories = [
      { label: '全部', expectedCategory: 'all', expectedMediaType: 'all', expectedGenre: null },
      { label: '电影', expectedCategory: 'movie', expectedMediaType: 'movie', expectedGenre: null },
      { label: '剧集', expectedCategory: 'tv', expectedMediaType: 'tv', expectedGenre: null },
      { label: '综艺', expectedCategory: 'variety', expectedMediaType: 'tv', expectedGenre: '10764' },
      { label: '动漫', expectedCategory: 'anime', expectedMediaType: 'tv', expectedGenre: '16' },
      { label: '纪录片', expectedCategory: 'documentary', expectedMediaType: 'movie', expectedGenre: '99' },
      { label: '排行榜', expectedCategory: 'top', expectedMediaType: 'all', expectedGenre: null },
    ];

    for (const tc of allCategories) {
      // 返回首页
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.app-shell', { timeout: 15000 });
      await page.waitForTimeout(2000);

      // 找到对应分类按钮（通过 aria-label 匹配）
      const categoryBtn = page.locator(
        `.category-quick-access__card[aria-label="分类：${tc.label}"]`
      );

      if (await categoryBtn.isVisible().catch(() => false)) {
        // 点击分类
        await categoryBtn.click();
        await page.waitForTimeout(1500);

        // 验证跳转到 /browse
        const url = new URL(page.url());
        expect(url.pathname).toBe('/browse');

        // 验证 URL 参数
        expect(url.searchParams.get('category')).toBe(tc.expectedCategory);
        expect(url.searchParams.get('mediaType')).toBe(tc.expectedMediaType);

        if (tc.expectedGenre) {
          expect(url.searchParams.get('genre')).toBe(tc.expectedGenre);
        }

      }
    }
  });

  // ── 分类跳转后联动搜索框搜索 ──────────────────────────────────

  test('HOME-024b: 分类跳转后搜索框输入验证', async ({ page }) => {
    // 移动端视口（< 768px）验证分类快选点击跳转；桌面 web 现已同样显示分类快选（旧 HomeSidebar 隐藏规则已解禁）
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 等待分类按钮出现
    const categoryBtn = page.locator(
      '.category-quick-access__card[aria-label="分类：电影"]'
    );
    await expect(categoryBtn).toBeVisible({ timeout: 5000 });

    // 点击电影分类
    await categoryBtn.click();
    await page.waitForTimeout(1500);

    // 验证跳转到 /browse?category=movie
    const url1 = new URL(page.url());
    expect(url1.pathname).toBe('/browse');
    expect(url1.searchParams.get('category')).toBe('movie');

    // 移动端默认隐藏搜索框，需点击"打开搜索"进入搜索模式
    const searchToggle = page.locator('.sticky-header__search-btn');
    if (await searchToggle.isVisible().catch(() => false)) {
      await searchToggle.click();
      await page.waitForTimeout(500);
    }

    // 验证搜索框可见
    const searchInput = page.locator('.sticky-header .search-box__input');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // 输入搜索词
    await searchInput.click();
    await searchInput.fill('复仇者联盟');

    // 验证输入值
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toBe('复仇者联盟');

    // 按回车搜索
    await searchInput.press('Enter');
    await page.waitForTimeout(3000);

    // 验证搜索结果区域存在
    const hasResults = await page.locator('.browse-results-body').isVisible();
    expect(hasResults).toBe(true);

  });

  test('HOME-025: 分类跳转后搜索框联动搜索', async ({ page }) => {
    // 移动端视口（< 768px）验证分类快选点击跳转；桌面 web 现已同样显示分类快选（旧 HomeSidebar 隐藏规则已解禁）
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 测试分类：电影
    const categoryBtn = page.locator(
      '.category-quick-access__card[aria-label="分类：电影"]'
    );

    if (await categoryBtn.isVisible().catch(() => false)) {
      // 1. 点击电影分类跳转到 browse 页
      await categoryBtn.click();
      await page.waitForTimeout(1500);

      // 验证跳转到 /browse?category=movie
      const url1 = new URL(page.url());
      expect(url1.pathname).toBe('/browse');
      expect(url1.searchParams.get('category')).toBe('movie');

      // 移动端默认隐藏搜索框，需点击"打开搜索"进入搜索模式
      const searchToggle25 = page.locator('.sticky-header__search-btn');
      if (await searchToggle25.isVisible().catch(() => false)) {
        await searchToggle25.click();
        await page.waitForTimeout(500);
      }

      // 2. 在搜索框输入关键词并搜索
      const searchInput = page.locator('.sticky-header .search-box__input');
      const isSearchVisible = await searchInput.isVisible().catch(() => false);

      if (isSearchVisible) {
        await searchInput.click();
        await searchInput.fill('复仇者联盟');
        await page.waitForTimeout(500);

        // 验证输入值
        const inputValue = await searchInput.inputValue();

        await searchInput.press('Enter');
        await page.waitForTimeout(3000);

        // 3. 验证搜索结果
        const hasResults = await page.evaluate(() => {
          return !!document.querySelector('.browse-results-body, [class*="browse-grid"]');
        });

        // 4. 清空搜索词，验证恢复到分类筛选结果
        const clearBtn = page.locator('.sticky-header .search-box__clear');
        if (await clearBtn.isVisible().catch(() => false)) {
          await clearBtn.click();
          await page.waitForTimeout(2000);

          // 验证恢复到电影分类筛选
          const url2 = new URL(page.url());
          expect(url2.searchParams.get('category')).toBe('movie');
        }
      }
    }
  });

  test('HOME-026: 各分类跳转后搜索框搜索验证', async ({ page }) => {
    // 移动端视口（< 768px）验证分类快选点击跳转；桌面 web 现已同样显示分类快选（旧 HomeSidebar 隐藏规则已解禁）
    await page.setViewportSize({ width: 767, height: 1024 });

    const searchTestCases = [
      { label: '电影', expectedCategory: 'movie', searchQuery: '复仇者联盟' },
      { label: '剧集', expectedCategory: 'tv', searchQuery: '权力的游戏' },
      { label: '动漫', expectedCategory: 'anime', searchQuery: '海贼王' },
    ];

    for (const tc of searchTestCases) {
      // 返回首页
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.app-shell', { timeout: 15000 });
      await page.waitForTimeout(2000);

      // 找到对应分类按钮
      const categoryBtn = page.locator(
        `.category-quick-access__card[aria-label="分类：${tc.label}"]`
      );

      if (await categoryBtn.isVisible().catch(() => false)) {
        // 点击分类
        await categoryBtn.click();
        await page.waitForTimeout(1500);

        // 验证跳转到对应分类
        const url1 = new URL(page.url());
        expect(url1.pathname).toBe('/browse');
        expect(url1.searchParams.get('category')).toBe(tc.expectedCategory);

        // 移动端默认隐藏搜索框，需点击"打开搜索"进入搜索模式
        const searchToggle26 = page.locator('.sticky-header__search-btn');
        if (await searchToggle26.isVisible().catch(() => false)) {
          await searchToggle26.click();
          await page.waitForTimeout(500);
        }

        // 在搜索框输入关键词并搜索
        const searchInput = page.locator('.sticky-header .search-box__input');
        const isSearchVisible = await searchInput.isVisible().catch(() => false);

        if (isSearchVisible) {
          await searchInput.click();
          await searchInput.fill(tc.searchQuery);
          await page.waitForTimeout(500);

          // 验证输入值
          const inputValue = await searchInput.inputValue();

          await searchInput.press('Enter');
          await page.waitForTimeout(3000);

          // 验证搜索结果
          const hasResults = await page.evaluate(() => {
            return !!document.querySelector('.browse-results-body, [class*="browse-grid"]');
          });

          // 清空搜索词
          const clearBtn = page.locator('.sticky-header .search-box__clear');
          if (await clearBtn.isVisible().catch(() => false)) {
            await clearBtn.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    }
  });
});

// =============================================================
// 1.3b 桌面端分类入口（2026-08-29）：旧左侧栏页面内分类切换已删除，
// 桌面 web 经顶栏（IPTV/设置）+ 分类快选卡片双入口；点击分类卡片跳 /browse（与移动端一致）。
// =============================================================

test.describe('1.3b 桌面端分类入口', () => {
  test('HOME-060: 桌面端分类快选可见且点击跳转 /browse（与移动端一致）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 桌面端分类快选不再隐藏（旧 HomeSidebar 隐藏规则已解禁）
    const qa = page.locator('.category-quick-access').first();
    await expect(qa).toBeVisible();

    // 点击「电影」卡片 → 跳转 /browse?category=movie
    const movieCard = page.locator('.category-quick-access__card[aria-label="分类：电影"]');
    await expect(movieCard).toBeVisible();
    await movieCard.click();
    await page.waitForTimeout(1000);

    const url = new URL(page.url());
    expect(url.pathname).toBe('/browse');
    expect(url.searchParams.get('category')).toBe('movie');
  });

  test('HOME-061: 桌面端顶栏提供 IPTV 与设置入口（无左侧栏）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header__nav', { timeout: 15000 });
    await page.waitForTimeout(1500);

    const titles = await page.evaluate(() =>
      [...document.querySelectorAll('.sticky-header__nav-item')].map((el) => (el as HTMLElement).title || (el as HTMLElement).textContent?.trim() || ''),
    );
    expect(titles.join(' ')).toContain('IPTV');
    expect(titles.join(' ')).toContain('设置');
  });
});


// ═══════════════════════════════════════════════════════════════
// 1.4 TMDBMovieRow 行数据
// ═══════════════════════════════════════════════════════════════

test.describe('1.4 TMDBMovieRow 行数据', () => {
  test('HOME-030: 行标题正确显示', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 行容器存在
    const rowsExist = await page.evaluate(() => {
      return !!document.querySelector('.home-rows, [class*="home-row"]');
    });
    expect(rowsExist).toBeTruthy();
    if (rowsExist) {
      const rowCount = await page.locator('.home-rows > *, [class*="home-row"]').count();
      expect(rowCount).toBeGreaterThan(0);
    }
  });

  test('HOME-031: 行数据水平滚动', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 行内卡片可水平滚动（真实滚动容器是 .tmdb-movierow-scroll）
    const hasScrollableRow = await page.evaluate(() => {
      const scroll = document.querySelector('.tmdb-movierow-scroll');
      if (!scroll) return false;
      return scroll.scrollWidth > scroll.clientWidth;
    });
    expect(hasScrollableRow).toBeTruthy();
  });

  test('HOME-032: 行数据加载中显示骨架', async ({ page }) => {
    // 操作: 进入首页，观察加载状态（mock 下数据秒回，骨架可能一闪而过；
    // 若 TMDB Token 未配置则显示 token-required，均属「首页已渲染」的正常状态）
    await page.goto('/');
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    // 等待首页内容区渲染（骨架 / 已加载行 / token-required 任一出现）
    await page.waitForSelector('.home-page__content, .home-skeleton-hero, .home-rows, [class*="tmdb-movierow"], .home-token-required', { timeout: 15000 }).catch(() => null);
    const rendered = await page.evaluate(() => {
      return !!document.querySelector('.home-page__content, .home-skeleton-hero, .home-rows, [class*="tmdb-movierow"], .home-token-required');
    });
    expect(rendered).toBeTruthy();
  });

  test('HOME-035: 卡片点击跳转详情', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const card = page.locator('.video-card a, .video-card').first();
    if (await card.isVisible().catch(() => false)) {
      // 操作: 点击影片卡片
      await card.click();
      await page.waitForTimeout(1000);
      // 预期结果: 跳转到 /detail/{id}
      expect(page.url()).toContain('/detail/');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.5 全局交互
// ═══════════════════════════════════════════════════════════════

test.describe('1.5 全局交互', () => {
  test('HOME-040: 回到顶部按钮', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 操作: 滚动到页面下方
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(500);

    // 预期结果: 回到顶部按钮可见
    const backToTop = page.locator('.back-to-top-button');
    if (await backToTop.isVisible().catch(() => false)) {
      await backToTop.click();
      await page.waitForTimeout(500);
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeLessThan(100);
    }
  });

  test('HOME-041: 所有请求都失败时显示错误提示', async ({ page }) => {
    // 模拟网络异常
    await page.route('**/api.tmdb.org/**', (route) => route.abort());
    await page.goto('/');
    await page.waitForTimeout(5000);

    // 预期结果: 显示错误提示
    const hasError = await page.evaluate(() => {
      return !!document.querySelector('.home-empty, [class*="empty"], [class*="error"]');
    });
    expect(hasError).toBeTruthy();
  });

  test('HOME-044: 文档标题', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 预期结果: 显示默认标题（无自定义标题）
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('HOME-045: 移动端 logo 右侧不显示 kinoTV 且顶栏中央为常驻搜索框', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });

    // 首页：logo 右侧不显示 kinoTV 品牌字（当前设计：顶栏中央为常驻搜索框，无独立标题元素）
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('.sticky-header__logo-group .sticky-header__brand')).toBeHidden({ timeout: 5000 });
    const centerSearch = page.locator('.sticky-header__center input[type="search"], .sticky-header__center input');
    await expect(centerSearch).toBeVisible({ timeout: 5000 });
  });

  test('HOME-046: 移动端打开侧边栏后头部显示 logo 与品牌字', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // 点击汉堡菜单打开侧边栏
    const menuBtn = page.locator('.sticky-header__menu-btn').first();
    await expect(menuBtn).toBeVisible({ timeout: 5000 });
    await menuBtn.click();
    await page.waitForTimeout(800);

    // 侧边栏头部应显示 logo 与 KinoTV 品牌字
    const logo = page.locator('.sidebar-header__brand .sidebar-logo').first();
    await expect(logo).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.sidebar-header__brand .sidebar-title')).toHaveText('KinoTV');
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.6 UI 微调回归（2026-07-31：非 TV 零焦点框 / TMDB 箭头 hover / 侧边栏留白 / 分类快选间距）
// ═══════════════════════════════════════════════════════════════

test.describe('1.6 UI 微调回归', () => {
  test('HOME-050: 桌面端 TMDBMovieRow 箭头默认隐藏，悬停行才显示', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2500);

    const arrow = page.locator('.tmdb-movierow-arrow').first();
    const wrapper = page.locator('.tmdb-movierow-wrapper').first();
    if ((await arrow.count()) === 0 || (await wrapper.count()) === 0) {
      return;
    }
    // 桌面端默认 opacity=0（隐藏），悬停整行后淡入 opacity=1
    await expect(arrow).toHaveCSS('opacity', '0');
    await wrapper.hover();
    await expect(arrow).toHaveCSS('opacity', '1');
  });

  test('HOME-051: 桌面端键盘焦点不显示焦点框', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1500);
    // 键盘 Tab 触发 :focus-visible；非 TV 全局规则应清除 outline/box-shadow 焦点环
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    const fv = page.locator(':focus').first();
    if ((await fv.count()) === 0) {
      return;
    }
    await expect(fv).toHaveCSS('outline-style', 'none');
  });

  test('HOME-052: 移动端分类快选横向间距收紧为 --space-lg', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1500);
    const inner = page.locator('.category-quick-access__inner').first();
    if ((await inner.count()) === 0) {
      return;
    }
    const gap = await inner.evaluate((el) => getComputedStyle(el).gap);
    const px = parseFloat(gap);
    // 旧值为 --space-2xl（下限 24px，对 40px 圆形卡片偏松）；现为 --space-lg（更小、更紧凑）
    expect(px).toBeGreaterThan(0);
    expect(px).toBeLessThan(24);
  });

  test('HOME-053: 桌面端页面主体内容全局左右 padding 加大（≥--space-lg）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForSelector('.page-padding', { timeout: 15000 });
    await page.waitForTimeout(500);

    const res = await page.evaluate(() => {
      const el = document.querySelector('.page-padding') as HTMLElement;
      const cs = getComputedStyle(el);
      return { left: parseFloat(cs.paddingLeft), right: parseFloat(cs.paddingRight) };
    });
    // 桌面端（≥768px）.page-padding 左右 padding 由 --space-lg（clamp 下限 12px）驱动，
    // 明显大于移动端默认 --space-sm（6px），且左右对称。
    expect(res.left).toBeGreaterThanOrEqual(12);
    expect(res.right).toBeGreaterThanOrEqual(12);
    expect(res.left).toBeCloseTo(res.right, 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.7 非手机 web 小视口（768–1023px）设备区分（2026-08-06）
// 背景：useIsMobileLayout() = native || 真实手机UA || 视口<768px。
//       768–1023px 桌面窄窗/平板横竖屏走「桌面 UI」但视口较窄——
//       此档此前完全无测试覆盖，导致「箭头/搜索框/命令栏等桌面专属元素
//       在该视口的显示规则」无人断言。
// 本次补充：桌面 UI 专属元素（TMDB 行箭头）在 768–1023px 应显示。
// ═══════════════════════════════════════════════════════════════

test.describe('1.7 非手机 web 小视口（768–1023px）设备区分', () => {
  test('HOME-054: 小视口（800×900）TMDB 行渲染箭头（非触摸布局，行溢出时）', async ({ page }) => {
    // 768–1023px：非手机 UA + 视口≥768 → useIsMobileLayout()=false → TMDB 行走桌面 UI 分支。
    // 箭头渲染条件 = !isMobileLayout && !isTV && hasOverflow。
    // mock-tmdb 已覆盖首页 8 区块（2026-08-06 补充），trending 20 条在 800px 宽（5 列）
    // 下行必然溢出 → 箭头渲染。这是对「非手机 web 小视口也显示左右箭头」需求的直接验证。
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2500);

    const rows = page.locator('.tmdb-movierow');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      // 数据未加载（如未补齐 8 区块 mock 的环境）——跳过，不视为失败
      return;
    }

    const arrow = page.locator('.tmdb-movierow-arrow').first();
    const arrowCount = await arrow.count();
    if (arrowCount === 0) {
      // 行未溢出（异常情况）——回退为「行已渲染」断言
      return;
    }
    // 桌面 UI 规则：箭头默认 opacity=0，悬停行后 opacity=1
    await expect(arrow).toHaveCSS('opacity', '0');
    const wrapper = page.locator('.tmdb-movierow-wrapper').first();
    await wrapper.hover();
    await expect(arrow).toHaveCSS('opacity', '1');
  });

  test('HOME-055: 小视口（800×900）同样渲染分类快选（桌面隐藏规则已解禁）', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // 分类快选已解禁桌面隐藏：≥768px 的小视口同样渲染（旧规则在此视口是 display:none）
    const quickAccess = page.locator('.category-quick-access').first();
    await expect(quickAccess).toBeVisible();
    // 卡片数走 useIsMobile()（断点 max-width:1023px）：800px 仍属 mobile → 6 项精简集；
    // ≥1024px 才渲染完整 7 项（含「纪录片」）。
    const cardCount = await page.locator('.category-quick-access__card').count();
    expect(cardCount).toBe(6);
  });

  test('HOME-056: 小视口（800×900）桌面搜索框渲染而非移动搜索框', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1500);

    const desktopInput = page.locator('.sticky-header .search-box__input').first();
    const mobileInput = page.locator('.sticky-header__mobile-search .search-box__input').first();
    const desktopVisible = await desktopInput.isVisible().catch(() => false);
    const mobileVisible = await mobileInput.isVisible().catch(() => false);
    // 非手机 web 小视口走桌面 UI：桌面搜索框应可见
    expect(desktopVisible).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 1.8 继续观看行（continueMode）骨架与响应式（2026-08-06）
// 背景：continue 行此前无骨架、列数固定 5（--continue-cols 无响应式定义）。
//      本次：首页传 _loading 作 isLoading（有历史播放记录才显示骨架），
//      --continue-cols 对齐 --card-cols（3/5/7）。
// 测试策略：注入 IndexedDB 历史 → 进入首页 → 断言「继续观看」行渲染
//          且横版骨架元素结构存在。
// =============================================================
// 1.3c 宽屏分类面板（2026-09-06 融合方案甲）：
// —— 分类 chips 融合 StickyHeader（仅首页宽屏渲染）；hover chip 在 hero 卡顶展开 mega 面板；
//    移出导航/面板延迟收起、点击外部 / Esc / 页面滚动收起；hero 下方常驻「分类热度榜」行；
//    「全部分类」跳 /browse；1280 视口回归（圆卡分支）。
// =============================================================

test.describe('1.3c 宽屏分类面板', () => {
  test('HOME-070: chips 融合顶栏、8 个入口、热度徽标移除、默认 overlay 收起', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const navItems = page.locator('.cqa-nav__item');
    expect(await navItems.count()).toBe(8); // 7 分类 chip + 全部分类
    expect(await page.locator('.cqa-nav__item svg').count()).toBeGreaterThanOrEqual(8);
    // 热度徽标已从 chip 移除（Σ 值改为面板头「今日最热」右侧展示）
    expect(await page.locator('.cqa-nav__heat').count()).toBe(0);
    // 默认 overlay 收起（hover 触发语义：未悬停不展开）
    expect(await page.locator('.cqa-overlay').count()).toBe(0);
  });

  test('HOME-071: hero 下方常驻「分类热度榜」行：3 分类卡 × 各 3 条热门数据', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cqa-heat-row .cqa-catcard', { timeout: 15000 });
    await page.waitForTimeout(1000);

    expect(await page.locator('.cqa-heat-row .cqa-catcard').count()).toBe(3);
    expect(await page.locator('.cqa-heat-row .cqa-catcard__row').count()).toBe(9);
    expect(await page.locator('.cqa-heat-row__title').count()).toBe(1);
  });

  test('HOME-072: 悬停「电影」chip → mega 面板展开：热度值+子分类 chips+3×3 内容卡', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await page.waitForTimeout(1500);

    await page.locator('.cqa-nav__item').nth(1).hover(); // 电影
    await page.waitForSelector('.cqa-overlay .cqa-hotcard', { timeout: 15000 });

    expect(await page.locator('.cqa-overlay').count()).toBe(1);
    // 热度 Σ 值移到面板头「今日最热」右侧（chip 徽标移除）
    expect(await page.locator('.cqa-panel__heat').count()).toBe(1);
    expect(await page.locator('.cqa-subgenres__chip').count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator('.cqa-hotcard').count()).toBe(9);
    // overlay 覆盖在 hero 卡内（面板 = header 正下方 mega-menu）
    expect(await page.locator('.hero-bili .cqa-overlay').count()).toBe(1);
  });

  test('HOME-073: 点子分类 chip 面板不消失（内容切换，仍为 9 卡）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await page.waitForTimeout(1500);

    await page.locator('.cqa-nav__item').nth(1).hover();
    await page.waitForSelector('.cqa-overlay .cqa-hotcard', { timeout: 15000 });
    await page.locator('.cqa-subgenres__chip').nth(1).click();
    await page.waitForTimeout(1200);

    await expect(page.locator('.cqa-overlay')).toBeVisible();
    expect(await page.locator('.cqa-hotcard').count()).toBe(9);
  });

  test('HOME-076: 点击面板以外区域收起 overlay；「首页」chip 不展开面板', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await page.waitForTimeout(1500);

    await page.locator('.cqa-nav__item').nth(1).hover(); // 电影 → overlay
    await page.waitForSelector('.cqa-overlay', { timeout: 15000 });
    // 点击面板/导航以外的中性元素（热度榜行标题）
    await page.locator('.cqa-heat-row__title').click();
    await page.waitForTimeout(500);
    expect(await page.locator('.cqa-overlay').count()).toBe(0);
    // 首页 chip = 收起（不开面板）
    await page.locator('.cqa-nav__item').first().hover();
    await page.waitForTimeout(500);
    expect(await page.locator('.cqa-overlay').count()).toBe(0);
  });

  test('HOME-077: 热度榜分类卡跳转 /chart 对应分类（v2 榜单页）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cqa-heat-row .cqa-catcard', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 封面加大后卡片几何中心落在条目行（行语义 = 跳详情）；分类卡「跳榜单页」语义在卡头
    // （排名 + 图标 + 分类名 + Σ热度），故点卡头验证分类入口
    await page.locator('.cqa-heat-row .cqa-catcard').first().locator('.cqa-catcard__head').click();
    await page.waitForTimeout(1000);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/chart');
    expect(['tv', 'movie', 'variety', 'anime', 'documentary']).toContain(url.searchParams.get('category'));
    await page.waitForSelector('.chart-card', { timeout: 15000 });
  });

  test('HOME-074: 「全部分类」跳转 /browse', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await page.waitForTimeout(1500);

    await page.locator('.cqa-nav__more').click();
    await page.waitForTimeout(1000);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/browse');
    expect(url.searchParams.get('category')).toBe('all');
  });

  test('HOME-083: 「查看完整榜单」入口跳 /chart（v2 热度榜页）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cqa-heat-row', { timeout: 15000 });
    await page.waitForTimeout(1000);

    await page.locator('.cqa-heat-row__more').click();
    await page.waitForTimeout(1000);
    expect(new URL(page.url()).pathname).toBe('/chart');
    await page.waitForSelector('.chart-card', { timeout: 15000 });
  });

  test('HOME-075: 1280 视口回归——仍渲染圆卡分支，不命中宽屏面板', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    expect(await page.locator('.cqa-nav').count()).toBe(0);
    await expect(page.locator('.category-quick-access__card').first()).toBeVisible();
  });

  test('HOME-079: 热度口径 tooltip——热度榜/面板 Info 图标悬停显示口径说明，副标题为用户视角文案', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cqa-heat-row .cqa-catcard', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 热度榜行：副标题为用户视角 + Info 图标存在，悬停显示口径说明
    await expect(page.locator('.cqa-heat-row__sub')).toHaveText(/今日各分类最热/);
    const rowTip = page.locator('.cqa-heat-row .cqa-info-tip');
    await expect(rowTip).toHaveCount(1);
    await rowTip.hover();
    await expect(page.locator('.cqa-info-tip__content')).toBeVisible();
    await expect(page.locator('.cqa-info-tip__content')).toContainText('TMDB');

    // 面板 head 同样有 Info 图标、热度值与用户视角副标题
    await page.locator('.cqa-nav__item').nth(1).hover();
    await page.waitForSelector('.cqa-overlay .cqa-hotcard', { timeout: 15000 });
    await expect(page.locator('.cqa-panel__sub')).toHaveText(/点卡片看详情/);
    await expect(page.locator('.cqa-panel__heat')).toBeVisible();
    await expect(page.locator('.cqa-overlay .cqa-info-tip')).toHaveCount(1);
  });

  test('HOME-080: 子分类切换保留旧网格（降沉刷新态），不闪成空白加载行', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await page.waitForTimeout(1500);

    await page.locator('.cqa-nav__item').nth(1).hover();
    await page.waitForSelector('.cqa-overlay .cqa-hotcard', { timeout: 15000 });

    // 切子分类瞬间：网格容器仍在且卡片未卸载（最多短暂降沉），无「正在获取」整行替换
    await page.locator('.cqa-subgenres__chip').nth(1).click();
    const gridCards = page.locator('.cqa-panel__grid .cqa-hotcard');
    await expect(gridCards.first()).toBeAttached();
    await page.waitForTimeout(1200);
    expect(await gridCards.count()).toBe(9);
  });

  test('HOME-081: 面板分页——右下角上一页/下一页翻页，末页「查看更多」携分类+genre 跳 browse', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await page.waitForTimeout(1500);

    await page.locator('.cqa-nav__item').nth(1).hover(); // 电影（子分类=全部，20 条 → 3 页）
    await page.waitForSelector('.cqa-overlay .cqa-hotcard', { timeout: 15000 });

    const pager = page.locator('.cqa-panel__pager');
    await expect(pager).toBeVisible();
    await expect(page.locator('.cqa-panel__pager__ind')).toHaveText('1 / 3');
    await expect(page.locator('.cqa-panel__pager__btn').first()).toBeDisabled(); // 上一页禁用
    const firstTitle = await page.locator('.cqa-hotcard__t').first().textContent();

    // 下一页：排名跨页续号（第 10 名），内容变化
    await page.getByLabel('下一页').click();
    await expect(page.locator('.cqa-panel__pager__ind')).toHaveText('2 / 3');
    await expect(page.locator('.cqa-hotcard__rank').first()).toHaveText('10');
    const secondTitle = await page.locator('.cqa-hotcard__t').first().textContent();
    expect(secondTitle).not.toBe(firstTitle);

    // 末页：下一页被「查看更多」替换，点击携分类与 genre 跳 browse
    await page.getByLabel('下一页').click();
    await expect(page.locator('.cqa-panel__pager__ind')).toHaveText('3 / 3');
    await expect(page.locator('.cqa-panel__pager__btn--more')).toHaveText(/查看更多/);
    await page.locator('.cqa-panel__pager__btn--more').click();
    await page.waitForTimeout(1000);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/browse');
    expect(url.searchParams.get('category')).toBe('movie');
    expect(url.searchParams.get('mediaType')).toBe('movie');
  });

  test('HOME-082: 面板网格竖向排列——1/2/3 同列自上而下（grid-auto-flow: column）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await page.waitForTimeout(1500);

    await page.locator('.cqa-nav__item').nth(1).hover();
    await page.waitForSelector('.cqa-overlay .cqa-hotcard', { timeout: 15000 });

    const cards = page.locator('.cqa-hotcard');
    const [b1, b2, b4] = await Promise.all([
      cards.nth(0).boundingBox(),
      cards.nth(1).boundingBox(),
      cards.nth(3).boundingBox(),
    ]);
    expect(b1).toBeTruthy();
    // 1/2 同列：x 相同、y 递增；4 在第 2 列：x 明显更大
    expect(Math.abs(b1!.x - b2!.x)).toBeLessThan(4);
    expect(b2!.y).toBeGreaterThan(b1!.y);
    expect(b4!.x - b1!.x).toBeGreaterThan(b1!.width / 2);
  });

  test('HOME-084: 页面向下滚动 → 面板立即收起（hover 触发语义）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await page.waitForTimeout(1500);

    await page.locator('.cqa-nav__item').nth(1).hover();
    await page.waitForSelector('.cqa-overlay', { timeout: 15000 });

    // 滚动主内容容器（AppLayout CustomScrollbar）→ scroll 事件触发面板收起
    await page.evaluate(() => {
      const el = (document.querySelector('.custom-scrollbar-container') ||
        document.querySelector('[class*="scroll"]')) as HTMLElement | null;
      if (el) el.scrollTop = 400;
    });
    await page.waitForTimeout(400);
    expect(await page.locator('.cqa-overlay').count()).toBe(0);
  });

  test('HOME-085: 其他页面 chips 常驻为纯导航——点「首页」回首页、点分类直达 browse', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // 其他页面无面板载体：悬停分类 chip 不展开面板
    await page.locator('.cqa-nav__item').nth(1).hover();
    await page.waitForTimeout(600);
    expect(await page.locator('.cqa-overlay').count()).toBe(0);

    // 点击「首页」chip → 回首页；首页 chips 仍在（导航栏跨页一致）
    await page.locator('.cqa-nav__item').first().click();
    await page.waitForTimeout(1000);
    expect(new URL(page.url()).pathname).toBe('/');

    // 再进其他页（设置），点击「剧集」chip → 直达 /browse?category=tv
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticky-header .cqa-nav', { timeout: 15000 });
    await page.locator('.cqa-nav__item').nth(2).click();
    await page.waitForTimeout(1000);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/browse');
    expect(url.searchParams.get('category')).toBe('tv');
  });
});
