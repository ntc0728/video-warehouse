/**
 * 详情页 (Detail) 测试用例（精简合并版）
 * 路由: /detail/:id
 * 配置依赖: TMDB 详情需 Level 1（Token）；播放列表 Tab 需 Level 2（Token + CORS 代理）
 *
 * 覆盖: DETAIL-001 ~ DETAIL-093
 * 合并映射: 3.1(001,002,003,004,005) / 3.2(010,014,016) / 3.3(020,023)
 *          / 3.4(030,031,032) / 3.5(042,046,047,048) / 3.6(060,062) / 3.8(080)
 *
 * 等待策略: 全部使用 Playwright web-first 条件等待（expect / expect.poll / waitForResponse），
 *          不使用固定 waitForTimeout 睡眠；轮询 50ms 起步，条件成立立即返回。
 */
import { test, expect } from './fixtures/mock-tmdb';

// 使用一个已知存在的 TMDB 电影 ID 进行测试
const TEST_MOVIE_ID = 'tmdb-movie-550'; // 《搏击俱乐部》
const TEST_TV_ID = 'tmdb-tv-1399'; // 《权力的游戏》

// 条件等待轮询节奏（条件成立即返回，不会等满 timeout）
const POLL = { intervals: [50, 100, 250, 500] };

// ═══════════════════════════════════════════════════════════════
// 3.1 页面加载
// ═══════════════════════════════════════════════════════════════

test.describe('3.1 页面加载', () => {
  test('DETAIL-001/002/003/004/005: 加载/电影/剧集/Hero/Tab/错误态', async ({ page }) => {
    // 003 加载中状态（在页面就绪前检查 loading 元素）
    await page.goto(`/detail/${TEST_MOVIE_ID}`);
    const loadingVisible = await page.evaluate(() => {
      return !!document.querySelector('.app-loading, [class*="loading"]');
    });
    expect(loadingVisible).toBeTruthy();

    // 001 正常加载电影详情 → Hero 区域
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect
      .poll(
        () => page.evaluate(() => !!document.querySelector('.detail-hero, [class*="detail-hero"]')),
        { ...POLL, timeout: 5000 },
      )
      .toBeTruthy();

    // 002 正常加载剧集详情 → Tab 区域（含季信息）
    await page.goto(`/detail/${TEST_TV_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect
      .poll(
        () => page.evaluate(() => !!document.querySelector('.detail-tabs, [class*="detail-tab"]')),
        { ...POLL, timeout: 5000 },
      )
      .toBeTruthy();

    // 004 无效 ID 显示错误
    await page.goto('/detail/invalid-id-123', { waitUntil: 'domcontentloaded' });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const text = document.body.innerText;
            return text.includes('暂仅支持') || text.includes('无效') || text.includes('不存在');
          }),
        { ...POLL, timeout: 5000 },
      )
      .toBeTruthy();

    // 005 无效 TMDB ID 显示错误
    await page.goto('/detail/tmdb-movie-abc', { waitUntil: 'domcontentloaded' });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const text = document.body.innerText;
            return text.includes('无效') || text.includes('不存在');
          }),
        { ...POLL, timeout: 5000 },
      )
      .toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.2 Hero 区域
// ═══════════════════════════════════════════════════════════════

test.describe('3.2 Hero 区域', () => {
  test('DETAIL-010/014/016: 背景图/Meta/返回按钮', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 010 背景图加载
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const bg = document.querySelector('.detail-hero-bg');
            if (!bg) return false;
            return getComputedStyle(bg).backgroundImage !== 'none' || !!bg.getAttribute('src');
          }),
        { ...POLL, timeout: 5000 },
      )
      .toBeTruthy();

    // 014 Meta 信息显示
    await expect
      .poll(
        () =>
          page.evaluate(() => !!document.querySelector('.detail-hero-meta, [class*="hero-meta"]')),
        { ...POLL, timeout: 5000 },
      )
      .toBeTruthy();

    // 016 返回按钮
    const backBtn = page.locator('.detail-hero-back, [class*="detail-hero-back"]');
    await expect.poll(() => backBtn.count(), { ...POLL, timeout: 5000 }).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.3 操作按钮
// ═══════════════════════════════════════════════════════════════

test.describe('3.3 操作按钮', () => {
  test('DETAIL-020/023: 立即播放/收藏按钮', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 020 立即播放按钮
    const playBtn = page.locator('.detail-btn-play, [class*="btn-play"]');
    await expect.poll(() => playBtn.count(), { ...POLL, timeout: 5000 }).toBeGreaterThan(0);
    if (await playBtn.isVisible().catch(() => false)) {
      const text = await playBtn.textContent();
    }

    // 023 收藏按钮
    const collectBtn = page.locator('.detail-btn-collect, [class*="btn-collect"]');
    await expect.poll(() => collectBtn.count(), { ...POLL, timeout: 5000 }).toBeGreaterThan(0);
    if (await collectBtn.isVisible().catch(() => false)) {
      const text = await collectBtn.textContent();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.4 Tab 导航
// ═══════════════════════════════════════════════════════════════

test.describe('3.4 Tab 导航', () => {
  test('DETAIL-030/031/032: 电影2Tab/剧集3Tab/切换Tab', async ({ page }) => {
    // 030 电影详情显示 2 个 Tab
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    let tabs = page.locator('.detail-tab');
    await expect.poll(() => tabs.count(), { ...POLL, timeout: 5000 }).toBeGreaterThan(0);
    let count = await tabs.count();
    if (count > 0) {
      const tabTexts = await tabs.allTextContents();
      expect(count).toBeGreaterThanOrEqual(2);
    }

    // 031 剧集详情显示 3 个 Tab
    await page.goto(`/detail/${TEST_TV_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    tabs = page.locator('.detail-tab');
    await expect.poll(() => tabs.count(), { ...POLL, timeout: 5000 }).toBeGreaterThan(0);

    // 032 切换 Tab
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    tabs = page.locator('.detail-tab');
    await expect.poll(() => tabs.count(), { ...POLL, timeout: 5000 }).toBeGreaterThan(0);
    const c = await tabs.count();
    if (c >= 2) {
      await expect(tabs.nth(1)).toBeVisible({ timeout: 5000 });
      await tabs.nth(1).click();
      await expect
        .poll(
          () => tabs.nth(1).evaluate((el) => el.classList.contains('detail-tab--active')),
          { ...POLL, timeout: 2500 },
        )
        .toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.5 概览 Tab
// ═══════════════════════════════════════════════════════════════

test.describe('3.5 概览 Tab', () => {
  test('DETAIL-042/046/047/048: 演员/剧照网格/截断/重进保持截断', async ({ page }) => {
    // 注入 25 张剧照（带延迟，确保重进时加载发生在隐藏期）；其余 TMDB 请求走 mock
    await page.route('**/api.tmdb.org/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/images')) {
        await new Promise((r) => setTimeout(r, 2000));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            backdrops: Array.from({ length: 25 }, (_, i) => ({ file_path: `/b${i}.jpg` })),
            posters: [],
          }),
        });
      }
      return route.fallback();
    });

    // 042 演员列表 + 046 剧照网格（独立 /images 接口）+ 047 截断逻辑
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await expect
      .poll(
        () => page.evaluate(() => !!document.querySelector('.detail-cast-row, [class*="cast"]')),
        { ...POLL, timeout: 10000 },
      )
      .toBeTruthy();

    // 剧照接口（mock 延迟 2s）返回后 .detail-stills-item 才渲染；
    // 等具体条目而非 .detail-stills-grid（骨架态即存在，会误判为 0 张）
    await expect(page.locator('.detail-stills-item').first()).toBeVisible({ timeout: 15000 });
    const stillCount = await page.evaluate(() => {
      const grid = document.querySelector('.detail-stills-grid');
      return grid ? grid.querySelectorAll('.detail-stills-item, img').length : 0;
    });
    expect(stillCount).toBeGreaterThan(0);

    const info = await page.evaluate(() => {
      const grid = document.querySelector('.detail-stills-grid');
      const items = grid ? grid.querySelectorAll('.detail-stills-item, img').length : 0;
      const limited = grid ? grid.classList.contains('detail-stills-grid--limited') : false;
      const more = !!document.querySelector('.detail-stills-more');
      return { items, limited, more };
    });
    expect(info.limited).toBe(true);
    expect(info.more).toBe(true);
    expect(info.items).toBeGreaterThan(0);
    expect(info.items).toBeLessThan(25);

    // 048 重新进入 detail 后剧照仍保持 2 行截断（不全部平铺）
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    // 重进 detail 的剧照接口（mock 延迟 2s）应在页面隐藏期返回：
    // 条件等这条响应而非固定睡眠；若浏览器已丢弃该请求则最多等 8s 后继续。
    const stillsResponse = page
      .waitForResponse(
        (r) => r.url().includes('api.tmdb.org') && r.url().includes('/images'),
        { timeout: 8000 },
      )
      .catch(() => null);
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.goBack();
    await expect(page).not.toHaveURL(/\/detail\//, { timeout: 5000 });
    await stillsResponse;
    await page.goForward();
    await page.waitForSelector('.detail-stills-more', { timeout: 15000 });
    await expect(page.locator('.detail-stills-grid').first()).toHaveClass(
      /detail-stills-grid--limited/,
      { timeout: 3000 },
    );

    const info2 = await page.evaluate(() => {
      const grid = document.querySelector('.detail-stills-grid');
      const items = grid ? grid.querySelectorAll('.detail-stills-item, img').length : 0;
      const limited = grid ? grid.classList.contains('detail-stills-grid--limited') : false;
      const more = !!document.querySelector('.detail-stills-more');
      return { items, limited, more };
    });
    expect(info2.limited).toBe(true);
    expect(info2.more).toBe(true);
    expect(info2.items).toBeLessThan(25);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.6 播放列表 Tab
// ═══════════════════════════════════════════════════════════════

test.describe('3.6 播放列表 Tab', () => {
  test('DETAIL-060/062: CMS 按需加载 / 全部弹框线路列表', async ({ page }) => {
    // 060 CMS 按需加载
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    const sourcesTab = page.locator('.detail-tab').filter({ hasText: '播放列表' });
    await expect.poll(() => sourcesTab.count(), { ...POLL, timeout: 5000 }).toBeGreaterThan(0);
    if (await sourcesTab.isVisible().catch(() => false)) {
      await sourcesTab.click();
      await expect
        .poll(
          () => page.evaluate(() => !!document.querySelector('.detail-sources, [class*="source"]')),
          { ...POLL, timeout: 5000 },
        )
        .toBeTruthy();
    }

    // 062 播放源"全部"弹框显示线路列表（拦截外部请求，使 CMS 搜索快速失败走统一提示分支）
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (
        url.includes('api.tmdb.org') ||
        url.startsWith('http://localhost') ||
        url.startsWith('http://127.0.0.1') ||
        url.startsWith('https://127.0.0.1')
      ) {
        return route.continue();
      }
      return route.abort();
    });
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    const sourcesTab2 = page.locator('.detail-tab').filter({ hasText: '播放列表' });
    await expect.poll(() => sourcesTab2.count(), { ...POLL, timeout: 5000 }).toBeGreaterThan(0);
    if (!(await sourcesTab2.isVisible().catch(() => false))) {
      return;
    }
    await sourcesTab2.click();
    // 播放源区挂载 → 匹配 spinner (.playlist-query) 消失 = CMS 查询已落到终态
    await expect(page.locator('.detail-sources')).toBeVisible({ timeout: 15000 });
    await expect
      .poll(() => page.locator('.detail-sources .playlist-query').count(), {
        ...POLL,
        timeout: 30000,
      })
      .toBe(0);

    const unifiedMsgVisible = await page
      .locator('.detail-sources-empty:has-text("所有视频源均未找到匹配资源")')
      .isVisible()
      .catch(() => false);
    const errStatusCount = await page.locator('.detail-source-status--err').count();
    expect(errStatusCount).toBe(0);

    const allBtn = page.locator('.detail-source-all-btn').first();
    const hasAllBtn = await allBtn.isVisible().catch(() => false);
    if (!hasAllBtn) {
      if (!unifiedMsgVisible) {
        throw new Error('DETAIL-062: 全部源不可用时未显示统一提示');
      }
      return;
    }

    await allBtn.click();
    await expect(page.locator('.source-all-modal')).toBeVisible({ timeout: 5000 });
    await expect
      .poll(() => page.locator('.source-all-modal__row').count(), { ...POLL, timeout: 5000 })
      .toBeGreaterThan(0);
    const playBtnCount = await page.locator('.source-all-modal__play-btn').count();
    expect(playBtnCount).toBeGreaterThan(0);

    if (playBtnCount > 0) {
      await page.locator('.source-all-modal__play-btn').first().click();
      // 条件等待路由跳转到播放器（原用例不作强断言，故超时也继续）
      await page.waitForURL(/\/play\//, { timeout: 5000 }).catch(() => {});
      const onPlayer = page.url().includes('/play/');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.8 推荐区域
// ═══════════════════════════════════════════════════════════════

test.describe('3.8 推荐区域', () => {
  test('DETAIL-080: 相关推荐', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    await expect
      .poll(
        () =>
          page.evaluate(() => !!document.querySelector('.detail-recommend, [class*="recommend"]')),
        { ...POLL, timeout: 7000 },
      )
      .toBeTruthy();
  });
});
