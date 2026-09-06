/**
 * 热度榜页 (Chart) 测试用例
 * 路由: /chart?category=movie|tv|variety|anime|documentary|trend(&window=day|week)
 * 配置依赖: mock-tmdb fixture（TMDB API 拦截）+ storageState（token）
 *
 * 覆盖: CHART-001 ~ CHART-006
 *   - 001 直达渲染：6 tab + 默认电影 20 行 + top3 强调
 *   - 002 tab 切换：综艺（discover/tv）/ 趋势榜（今日/本周分段）
 *   - 003 无缝滚动：两页数据翻页合并（排名连续）+ 去重后到底提示
 *   - 004 行点击 → /detail/:id
 *   - 005 URL 直达参数生效（category + window）
 *   - 006 切 tab 刷新态：旧行降沉 + 「加载中」胶囊可见 + 完成移除 + 缓存命中零遮罩
 */
import { test, expect } from './fixtures/mock-tmdb';
import type { Page } from '@playwright/test';

/** 构造 TMDB 分页响应（与 mock-tmdb 的 makePage 同构） */
function makePage(results: unknown[], page: number, totalResults = 100) {
  return {
    page,
    results,
    total_pages: Math.max(1, Math.ceil(totalResults / 20)),
    total_results: totalResults,
  };
}

/** 生成 20 条不重复的 discover 结果（popularity 由高到低） */
function makeDiscoverItems(idBase: number, popTop: number) {
  return Array.from({ length: 20 }, (_, i) => ({
    id: idBase + i,
    title: `热度榜测试片 ${idBase}-${i}`,
    overview: `测试简介 ${idBase}-${i}`,
    popularity: popTop - i * 5,
    vote_average: 7 + (i % 3),
    vote_count: 500 + i,
    release_date: `202${idBase % 10}-0${(i % 9) + 1}-15`,
    genre_ids: [idBase === 100 ? 28 : 16],
    backdrop_path: `/backdrop-${idBase}-${i}.jpg`,
    poster_path: `/poster-${idBase}-${i}.jpg`,
    media_type: 'movie',
  }));
}

/**
 * 测试级自定义路由：discover/movie 返回两页不同数据（覆盖 fixture 的通用 mock，
 * Playwright 多 route 匹配为后注册者优先）。返回请求计数器供断言。
 */
async function routeTwoPageDiscover(page: Page) {
  const counters = { p1: 0, p2: 0 };
  const page1 = makeDiscoverItems(100, 1000);
  const page2 = makeDiscoverItems(200, 990);
  await page.route('**/api.tmdb.org/3/discover/movie**', async (route) => {
    const url = new URL(route.request().url());
    const p = Number(url.searchParams.get('page') ?? '1');
    if (p <= 1) {
      counters.p1++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePage(page1, 1)) });
    } else if (p === 2) {
      counters.p2++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePage(page2, 2)) });
    } else {
      // 第 3 页：返回与第 2 页相同数据（模拟无新内容 → 去重后到底）
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePage(page2, p)) });
    }
  });
  return counters;
}

test.describe('CHART 热度榜页', () => {
  test('CHART-001: 直达 /chart——6 分类 tab、默认电影 20 行、top3 排名强调', async ({ page }) => {
    await page.goto('/chart', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.chart-card', { timeout: 15000 });
    await page.waitForSelector('.chart-row', { timeout: 15000 });
    await page.waitForTimeout(500);

    expect(await page.locator('.chart-tabs__tab').count()).toBe(6);
    expect(await page.locator('.chart-row').count()).toBe(20);
    // top3 排名强调 + 热度值 + 评分 + 封面（mock 1x1 像素走 LazyImage）
    expect(await page.locator('.chart-row--top').count()).toBe(3);
    expect(await page.locator('.chart-row__heat .n').count()).toBe(20);
    expect(await page.locator('.chart-row .chart-row__cover').count()).toBe(20);
    // 口径 tooltip 存在
    expect(await page.locator('.chart-info-tip').count()).toBe(1);
  });

  test('CHART-002: tab 切换——综艺走 discover/tv；趋势榜含今日/本周分段', async ({ page }) => {
    await page.goto('/chart', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.chart-row', { timeout: 15000 });

    // 综艺 → discover/tv（fixture mock 命中）
    await page.locator('.chart-tabs__tab', { hasText: '综艺' }).click();
    await page.waitForTimeout(800);
    expect(new URL(page.url()).searchParams.get('category')).toBe('variety');
    await expect(page.locator('.chart-row').first()).toBeVisible();

    // 趋势榜 → 今日/本周分段出现，切本周 URL 带 window=week
    await page.locator('.chart-tabs__tab', { hasText: '趋势榜' }).click();
    await page.waitForSelector('.chart-tabs__window', { timeout: 15000 });
    await page.locator('.chart-tabs__window button', { hasText: '本周' }).click();
    await page.waitForTimeout(800);
    expect(new URL(page.url()).searchParams.get('window')).toBe('week');
    await expect(page.locator('.chart-row').first()).toBeVisible();
  });

  test('CHART-003: 无缝滚动——两页合并 40 行、排名连续、无新数据后显示到底', async ({ page }) => {
    await routeTwoPageDiscover(page);
    await page.goto('/chart', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.chart-row', { timeout: 15000 });
    expect(await page.locator('.chart-row').count()).toBe(20);

    // 滚到底触发第 2 页加载（哨兵 + useInfiniteScroll）
    await page.locator('.chart-sentinel').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    expect(await page.locator('.chart-row').count()).toBe(40);

    // 排名跨页连续（合并重排后仍为 1..40）
    const ranks = await page.locator('.chart-row__rank').allTextContents();
    expect(ranks.map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));

    // 第 3 页返回重复数据 → 去重后 0 新增 → 到底提示（不无限请求）
    await page.locator('.chart-sentinel').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    expect(await page.locator('.chart-row').count()).toBe(40);
    await expect(page.locator('.chart-list__end')).toHaveText(/已加载全部 40 条/);
  });

  test('CHART-004: 行点击跳详情 /detail/:id', async ({ page }) => {
    await page.goto('/chart', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.chart-row', { timeout: 15000 });

    await page.locator('.chart-row').first().click();
    await page.waitForTimeout(1000);
    expect(page.url()).toMatch(/\/detail\/tmdb-movie-\d+/);
  });

  test('CHART-005: URL 直达参数生效——category=variety 选中综艺、trend+window=week 选中本周', async ({ page }) => {
    await page.goto('/chart?category=variety', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.chart-row', { timeout: 15000 });
    await expect(page.locator('.chart-tabs__tab--on')).toHaveText(/综艺/);

    await page.goto('/chart?category=trend&window=week', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.chart-tabs__window', { timeout: 15000 });
    await expect(page.locator('.chart-tabs__tab--on')).toHaveText(/趋势榜/);
    await expect(page.locator('.chart-tabs__window-btn--on')).toHaveText('本周');
    await page.waitForSelector('.chart-row', { timeout: 15000 });
  });

  test('CHART-006: 切 tab 刷新态——旧行降沉 + 居中「加载中」胶囊，完成后移除；缓存命中零遮罩', async ({ page }) => {
    await page.goto('/chart', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.chart-row', { timeout: 15000 });

    // discover/tv（综艺）延迟 800ms 后 fallback 到 fixture mock：观察刷新中间态
    await page.route('**/api.tmdb.org/3/discover/tv**', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.fallback();
    });

    await page.locator('.chart-tabs__tab', { hasText: '综艺' }).click();
    await page.waitForSelector('.chart-list--refreshing', { timeout: 5000 });
    // 旧行降沉（opacity 0.45）且不可交互
    await expect(page.locator('.chart-list--refreshing .chart-row').first()).toHaveCSS('opacity', '0.45');
    // 「加载中」胶囊可见（小电视 + 文案，sticky 于视口中部）——不能是旧文案「更新中」
    const pill = page.locator('.chart-refresh-sticky .chart-list__refresh');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('加载中…');

    // 刷新完成：遮罩与胶囊移除，新榜单渲染
    await page.waitForSelector('.chart-list:not(.chart-list--refreshing)', { timeout: 15000 });
    await expect(page.locator('.chart-refresh-sticky')).toHaveCount(0);
    await expect(page.locator('.chart-row').first()).toBeVisible();

    // 切回电影（已缓存）：零遮罩直接显示
    await page.locator('.chart-tabs__tab', { hasText: '电影' }).first().click();
    await page.waitForTimeout(400);
    expect(await page.locator('.chart-list--refreshing').count()).toBe(0);
    await expect(page.locator('.chart-row').first()).toBeVisible();
  });
});
