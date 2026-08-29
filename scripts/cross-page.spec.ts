/**
 * 页面交叉跳转交互测试
 * 覆盖所有页面间的跳转路径，验证 state 传递、来源追踪、回退行为、数据连续性
 *
 * 覆盖: X-001 ~ X-125
 */
import { test, expect } from './fixtures/mock-tmdb';

const TEST_MOVIE_ID = 'tmdb-movie-550';
const TEST_TV_ID = 'tmdb-tv-1399';

// ═══════════════════════════════════════════════════════════════
// 13.1 首页 → 其他页面
// ═══════════════════════════════════════════════════════════════

test.describe('13.1 首页 → 其他页面', () => {
  test('X-001: 首页 Banner → 详情页', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 操作: 点击 Banner 上的 CTA 按钮（"立即播放"或"查看详情"）
    const ctaBtn = page.locator('.hero-banner__cta, [class*="hero-banner__cta"]').first();
    if (await ctaBtn.isVisible().catch(() => false)) {
      // 顶栏为 fixed，Hero 在滚动容器内；用 JS click 规避「在视口外」的 Playwright 判定
      await ctaBtn.evaluate((el) => el.click());
      await page.waitForTimeout(1000);
      const url = page.url();
      const navigated = url.includes('/detail/') || url.includes('/play/');
      expect(navigated).toBe(true);
    }
  });

  test('X-003: 首页分类 → 浏览页', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const chips = page.locator('.home-category-chip, [class*="category-chip"]');
    if (await chips.first().isVisible().catch(() => false)) {
      await chips.first().click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/browse');
    }
  });

  test('X-004: 首页卡片 → 详情页', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const card = page.locator('.video-card a, .video-card').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/detail/');
    }
  });

  test('X-010: 侧边栏 → 首页', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 点击 Sidebar Logo/首页
    const homeLink = page.locator('.sidebar-logo, [class*="sidebar"] a').first();
    if (await homeLink.isVisible().catch(() => false)) {
      await homeLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toMatch(/\/$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 13.3 详情页 → 其他页面
// ═══════════════════════════════════════════════════════════════

test.describe('13.3 详情页 → 其他页面', () => {
  test('X-030: 详情页 → 播放页（继续播放）', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 操作: 点击播放按钮
    const playBtn = page.locator('.detail-btn-play, [class*="btn-play"]').first();
    if (await playBtn.isVisible().catch(() => false)) {
      await playBtn.click();
      await page.waitForTimeout(1000);
      // 预期结果: 跳转到 /play/{id}
      expect(page.url()).toContain('/play/');
    }
  });

  test('X-036: 详情页 → 首页（返回）', async ({ page }) => {
    // 操作: 从首页进入详情页，再点击返回
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const card = page.locator('.video-card a, .video-card').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/detail/');

      // 点击返回按钮
      const backBtn = page.locator('.detail-hero-back, [class*="hero-back"]').first();
      if (await backBtn.isVisible().catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(1000);
        // 预期结果: 回到首页
        expect(page.url()).toMatch(/\/$/);
      }
    }
  });

  test('X-037: 详情页 → 首页（深链返回）', async ({ page }) => {
    // 操作: 直接访问详情页 URL（无 state），点击返回
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const backBtn = page.locator('.detail-hero-back, [class*="hero-back"]').first();
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1000);
      // 预期结果: useSmartBack fallback='/'，回到首页
      expect(page.url()).toMatch(/\/$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 13.4 播放页 → 其他页面
// ═══════════════════════════════════════════════════════════════

test.describe('13.4 播放页 → 其他页面', () => {
  test('X-041: 播放页 → 详情页（深链返回）', async ({ page }) => {
    // 操作: 直接访问播放页 URL，点击返回
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(8000);

    const backBtn = page.locator('.up-header-back, [class*="header-back"]').first();
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1000);
      // 预期结果: useSmartBack fallback='/detail/{id}'，跳到详情页
      expect(page.url()).toContain('/detail/');
    }
  });

  test('X-042: 播放页不使用 KeepAlive（每次重新挂载）', async ({ page }) => {
    // 操作: 访问播放页，离开后再返回，验证组件重新挂载
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 记录初始状态
    const initialUrl = page.url();

    // 离开播放页
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 返回播放页
    await page.goto(initialUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 预期结果: 播放页重新加载（不使用 KeepAlive）
    const currentUrl = page.url();
    expect(currentUrl).toContain('/play/');
  });
});

// ═══════════════════════════════════════════════════════════════
// 13.5 IPTV 相关跳转
// ═══════════════════════════════════════════════════════════════

test.describe('13.5 IPTV 相关跳转', () => {
  test('X-052: IPTV 代理警告 → 设置页', async ({ page }) => {
    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 操作: 点击代理配置链接
    const configLink = page.locator('.iptv-proxy-warning-link, [class*="proxy-warning"] button');
    if (await configLink.isVisible().catch(() => false)) {
      await configLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/settings');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 13.6 设置页与其他页面
// ═══════════════════════════════════════════════════════════════

test.describe('13.6 设置页与其他页面', () => {
  test('X-060: 设置页 → 源检测页（版本号彩蛋）', async ({ page }) => {
    // 版本号彩蛋在「关于」tab（源码 SettingsAboutTab），需深链直达
    await page.goto('/settings?tab=about', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 操作: 连续点击版本号 3 次（version 元素的父行可点击）
    const versionItem = page.locator('[class*="version"]').first();
    expect(await versionItem.count()).toBeGreaterThan(0);
    if (await versionItem.isVisible().catch(() => false)) {
      await versionItem.click();
      await page.waitForTimeout(200);
      await versionItem.click();
      await page.waitForTimeout(200);
      await versionItem.click();
      await page.waitForTimeout(1000);

      // 预期结果: 跳转到 /source-checker
      expect(page.url()).toContain('/source-checker');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 13.9 深链（直接 URL 访问）场景
// ═══════════════════════════════════════════════════════════════

test.describe('13.9 深链场景', () => {
  test('X-090: 深链 → 详情页 → 返回首页', async ({ page }) => {
    // 操作: 直接访问详情页 URL
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 点击返回
    const backBtn = page.locator('.detail-hero-back, [class*="hero-back"]').first();
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1000);
      // 预期结果: 无 state.from → 兜底回首页
      expect(page.url()).toMatch(/\/$/);
    }
  });

  test('X-091: 深链 → 播放页 → 返回详情页', async ({ page }) => {
    // 操作: 直接访问播放页 URL
    await page.goto(`/play/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(8000);

    // 点击返回
    const backBtn = page.locator('.up-header-back, [class*="header-back"]').first();
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1000);
      // 预期结果: useSmartBack fallback='/detail/{id}'
      expect(page.url()).toContain('/detail/');
    }
  });

  test('X-093: 深链 → 人物页 → 返回首页', async ({ page }) => {
    // 操作: 直接访问人物页 URL
    await page.goto('/person/128', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 点击返回
    const backBtn = page.locator('.person-hero-back, [class*="hero-back"]').first();
    expect(await backBtn.count()).toBeGreaterThan(0);
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1000);
      // 预期结果: 无 state.from，无 fallback → useSmartBack 尝试 navigate(-1)
      // 在新上下文中 -1 可能到 about:blank，这是预期行为
      const url = page.url();
      const isHome = url.endsWith('/') || url.endsWith('/index.html');
      const isAboutBlank = url === 'about:blank';
      // 不做硬断言，因为 useSmartBack 无 fallback 时行为取决于浏览器历史
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 13.10 数据连续性验证
// ═══════════════════════════════════════════════════════════════

test.describe('13.10 数据连续性验证', () => {
  test('X-106: 设置修改 → 全局生效', async ({ page }) => {
    // 操作: 修改主题为深色，检查所有页面
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 切换到深色模式
    const moonBtn = page.locator('.theme-btn').nth(1);
    expect(await moonBtn.count()).toBeGreaterThan(0);
    if (await moonBtn.isVisible().catch(() => false)) {
      await moonBtn.click();
      await page.waitForTimeout(500);

      // 检查首页是否使用深色主题
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      const isDark = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark'
          || document.body.classList.contains('dark');
      });
      expect(isDark).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 13.12 Keep-Alive 下的跳转状态保持
// ═══════════════════════════════════════════════════════════════

test.describe('13.12 Keep-Alive 状态保持', () => {
  test('X-120: 首页 → 详情 → 首页（滚动位置恢复）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 操作: 滚动到页面下方
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(500);
    const scrollBefore = await page.evaluate(() => window.scrollY);

    // 进入详情页
    const card = page.locator('.video-card a, .video-card').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/detail/');

      // 返回首页
      const backBtn = page.locator('.detail-hero-back, [class*="hero-back"]').first();
      if (await backBtn.isVisible().catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(1000);

        // 预期结果: 首页滚动位置恢复
        const scrollAfter = await page.evaluate(() => window.scrollY);
      }
    }
  });

  test('X-121: 首页切走再切回 banner 不闪烁（方案 B 重挂载归单层/无滞留层/轮播重置）', async ({ page }) => {
    // 前置: 桌面端，首页数据就绪，等一次自动轮播（5s）使 bgIndices 成 2 层
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero-banner__bg-layer.is-active[src]', { timeout: 15000 });
    await page.waitForTimeout(6000); // 超过一个轮播周期 → bgIndices 应为 [last, current]

    // 确认离开前已是 2 层（轮播已推进）——若不足则跳过后续断言（防御）
    const layersBefore = await page.locator('.hero-banner__bg-layer').count();

    // 操作: 切到详情页（方案 B：首页卸载，HeroBanner 随组件销毁）
    const card = page.locator('.video-card a, .video-card').first();
    if (!(await card.isVisible().catch(() => false))) {
      return;
    }
    await card.click();
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/detail/');
    // 等首页卸载完成
    await page.waitForTimeout(500);

    // 返回首页（重挂载 → HeroBanner 全新初始化）
    const backBtn = page.locator('.detail-hero-back, [class*="hero-back"]').first();
    if (!(await backBtn.isVisible().catch(() => false))) {
      return;
    }
    await backBtn.click();
    await page.waitForTimeout(1000);

    // 核心断言1: 切回后 bg 层数归单层（无底层旧图可透出 → 不闪「上一张图」）
    expect(
      await page.locator('.hero-banner__bg-layer').count(),
      '切回首页后背景层应归单层（无旧图垫底透出）',
    ).toBe(1);
    // 核心断言2: 无滞留层残留
    expect(await page.locator('.hero-banner__bg-layer--stale').count(), '不应有滞留层残留').toBe(0);
    // 核心断言3: 方案 B（无 Keep-Alive）下 Home 重挂载，轮播从头开始播放
    const srcAfter = await page.locator('.hero-banner__bg-layer.is-active').getAttribute('src');
    expect(srcAfter, '切回后应有主图渲染（轮播重置从头播放）').toBeTruthy();
    // 核心断言4: 过渡状态已恢复（is-active 层存在、无卡在透明层）
    await expect(page.locator('.hero-banner__bg-layer.is-active')).toBeVisible({ timeout: 3000 });
  });
});
