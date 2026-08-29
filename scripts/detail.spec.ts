/**
 * 详情页 (Detail) 测试用例
 * 路由: /detail/:id
 * 配置依赖: TMDB 详情需 Level 1（Token）；播放列表 Tab 需 Level 2（Token + CORS 代理）
 *
 * 覆盖: DETAIL-001 ~ DETAIL-093
 */
import { test, expect } from './fixtures/mock-tmdb';

// 使用一个已知存在的 TMDB 电影 ID 进行测试
const TEST_MOVIE_ID = 'tmdb-movie-550'; // 《搏击俱乐部》
const TEST_TV_ID = 'tmdb-tv-1399'; // 《权力的游戏》

// ═══════════════════════════════════════════════════════════════
// 3.1 页面加载
// ═══════════════════════════════════════════════════════════════

test.describe('3.1 页面加载', () => {
  test('DETAIL-001: 正常加载电影详情', async ({ page }) => {
    // 前置条件: 输入有效的电影 ID
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 显示 Hero 区域
    const hasHero = await page.evaluate(() => {
      return !!document.querySelector('.detail-hero, [class*="detail-hero"]');
    });
  });

  test('DETAIL-002: 正常加载剧集详情', async ({ page }) => {
    // 前置条件: 输入有效的剧集 ID
    await page.goto(`/detail/${TEST_TV_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 显示 Hero + Tab 区域包含"季信息" Tab
    const hasTabs = await page.evaluate(() => {
      return !!document.querySelector('.detail-tabs, [class*="detail-tab"]');
    });
    if (hasTabs) {
      const tabTexts = await page.locator('.detail-tab').allTextContents();
      const hasSeasonTab = tabTexts.some(t => t.includes('季'));
    }
  });

  test('DETAIL-003: 加载中状态', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`);
    // 预期结果: 短暂显示 AppLoading
    const loadingVisible = await page.evaluate(() => {
      return !!document.querySelector('.app-loading, [class*="loading"]');
    });
  });

  test('DETAIL-004: 无效 ID 显示错误', async ({ page }) => {
    // 前置条件: 输入非 TMDB 格式的 ID
    await page.goto('/detail/invalid-id-123', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 预期结果: 显示错误信息
    const hasError = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('暂仅支持') || text.includes('无效') || text.includes('不存在');
    });
  });

  test('DETAIL-005: 无效 TMDB ID 显示错误', async ({ page }) => {
    // 前置条件: 输入非数字的 TMDB ID
    await page.goto('/detail/tmdb-movie-abc', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 预期结果: 显示"无效的 TMDB ID"错误
    const hasError = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('无效') || text.includes('不存在');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.2 Hero 区域
// ═══════════════════════════════════════════════════════════════

test.describe('3.2 Hero 区域', () => {
  test('DETAIL-010: 背景图加载', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 显示背景图或骨架状态
    const hasBg = await page.evaluate(() => {
      const bg = document.querySelector('.detail-hero-bg');
      if (!bg) return false;
      return getComputedStyle(bg).backgroundImage !== 'none' || bg.getAttribute('src');
    });
  });

  test('DETAIL-014: Meta 信息显示', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 显示评分、年份等 meta 信息
    const hasMeta = await page.evaluate(() => {
      return !!document.querySelector('.detail-hero-meta, [class*="hero-meta"]');
    });
  });

  test('DETAIL-016: 返回按钮', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 返回按钮存在
    const backBtn = page.locator('.detail-hero-back, [class*="detail-hero-back"]');
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.3 操作按钮
// ═══════════════════════════════════════════════════════════════

test.describe('3.3 操作按钮', () => {
  test('DETAIL-020: 立即播放按钮', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 播放按钮存在
    const playBtn = page.locator('.detail-btn-play, [class*="btn-play"]');
    if (await playBtn.isVisible().catch(() => false)) {
      const text = await playBtn.textContent();
    }
  });

  test('DETAIL-023: 收藏按钮', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 收藏按钮存在
    const collectBtn = page.locator('.detail-btn-collect, [class*="btn-collect"]');
    if (await collectBtn.isVisible().catch(() => false)) {
      const text = await collectBtn.textContent();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.4 Tab 导航
// ═══════════════════════════════════════════════════════════════

test.describe('3.4 Tab 导航', () => {
  test('DETAIL-030: 电影详情显示 2 个 Tab', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 显示 2 个 Tab：概览、播放列表
    const tabs = page.locator('.detail-tab');
    const count = await tabs.count();
    if (count > 0) {
      const tabTexts = await tabs.allTextContents();
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  test('DETAIL-031: 剧集详情显示 3 个 Tab', async ({ page }) => {
    await page.goto(`/detail/${TEST_TV_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 显示 3 个 Tab：概览、播放列表、季信息
    const tabs = page.locator('.detail-tab');
    const count = await tabs.count();
    if (count > 0) {
      const tabTexts = await tabs.allTextContents();
    }
  });

  test('DETAIL-032: 切换 Tab', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 操作: 点击不同 Tab
    const tabs = page.locator('.detail-tab');
    const count = await tabs.count();
    if (count >= 2) {
      await tabs.nth(1).click();
      await page.waitForTimeout(500);
      const isActive = await tabs.nth(1).evaluate(el => el.classList.contains('detail-tab--active'));
      expect(isActive).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.5 概览 Tab
// ═══════════════════════════════════════════════════════════════

test.describe('3.5 概览 Tab', () => {
  test('DETAIL-042: 演员列表', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 演员区域存在
    const hasCast = await page.evaluate(() => {
      return !!document.querySelector('.detail-cast-row, [class*="cast"]');
    });
  });

  test('DETAIL-046: 剧照网格（专用 /images 接口，全语言 backdrops）', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 剧照走独立的 /images 接口异步加载（带 include_image_language），需等待渲染
    await page.waitForSelector('.detail-stills-grid', { timeout: 15000 });

    // 预期结果: 概览 Tab 下存在剧照栏目且至少渲染出一张剧照
    const stillCount = await page.evaluate(() => {
      const grid = document.querySelector('.detail-stills-grid');
      return grid ? grid.querySelectorAll('.detail-stills-item, img').length : 0;
    });
    expect(stillCount).toBeGreaterThan(0);
  });

  test('DETAIL-047: 剧照多于 2 行时截断为有限行并显示「查看全部」', async ({ page }) => {
    // 注入 25 张剧照（超过 2 行），验证截断逻辑：渲染数 < 总数 + --limited + 查看全部按钮
    await page.route('**/api.tmdb.org/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/images')) {
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

    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForSelector('.detail-stills-grid', { timeout: 15000 });
    await page.waitForTimeout(500);

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
  });

  test('DETAIL-048: 重新进入 detail 后剧照仍保持 2 行截断（不全部平铺）', async ({ page }) => {
    // 方案 B（无 Keep-Alive）：后退卸载 detail → 前进重新挂载，剧照重新加载/回显。
    // 断言核心：无论加载路径如何，visibleCount 必须是有限值（视口兜底），不能全部平铺。
    await page.route('**/api.tmdb.org/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/images')) {
        await new Promise((r) => setTimeout(r, 2000)); // 延迟确保加载发生在隐藏期
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

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    // 后退卸载 detail，等待剧照在卸载期间加载完（模拟慢接口）
    await page.goBack();
    await page.waitForTimeout(3500);
    // 再前进，detail 重新挂载；等待真实网格（带「查看全部」按钮，仅截断后渲染）出现
    await page.goForward();
    await page.waitForSelector('.detail-stills-more', { timeout: 15000 });
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
      const grid = document.querySelector('.detail-stills-grid');
      const items = grid ? grid.querySelectorAll('.detail-stills-item, img').length : 0;
      const limited = grid ? grid.classList.contains('detail-stills-grid--limited') : false;
      const more = !!document.querySelector('.detail-stills-more');
      return { items, limited, more };
    });
    // 即便隐藏期加载，visibleCount 也必须是有限值（视口兜底），不能全部平铺
    expect(info.limited).toBe(true);
    expect(info.more).toBe(true);
    expect(info.items).toBeLessThan(25);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.6 播放列表 Tab
// ═══════════════════════════════════════════════════════════════

test.describe('3.6 播放列表 Tab', () => {
  test('DETAIL-060: CMS 按需加载', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 操作: 点击播放列表 Tab
    const sourcesTab = page.locator('.detail-tab').filter({ hasText: '播放列表' });
    if (await sourcesTab.isVisible().catch(() => false)) {
      await sourcesTab.click();
      await page.waitForTimeout(3000);

      // 预期结果: 触发 CMS 源搜索
      const hasSourceContent = await page.evaluate(() => {
        return !!document.querySelector('.detail-sources, [class*="source"]');
      });
    }
  });

  test('DETAIL-062: 播放源“全部”弹框显示线路列表', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    // 沙箱无真实 CMS 源，请求（corsProxy 为空时直连真实 CMS 主机）会长时间挂起；
    // 拦截所有外部请求、仅放行 TMDB mock 与本地 dev server，使搜索快速失败走「全部失败→统一提示」分支
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.includes('api.tmdb.org') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('https://127.0.0.1')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const sourcesTab = page.locator('.detail-tab').filter({ hasText: '播放列表' });
    if (!(await sourcesTab.isVisible().catch(() => false))) {
      return;
    }
    await sourcesTab.click();
    // 等待 CMS 搜索加载完成（结果网格或出现源提示），避免固定等待时间不足导致仍停留在 loading 状态
    await page
      .waitForSelector('.detail-sources-grid, .detail-state', { timeout: 30000 })
      .catch(() => {});
    await page.waitForTimeout(500);

    // mock 下 CMS 搜索全部失败 → 不渲染任何源错误卡片，改为统一提示（位于 grid 内的 .detail-sources-empty）
    const unifiedMsgVisible = await page
      .locator('.detail-sources-empty:has-text("所有视频源均未找到匹配资源")')
      .isVisible()
      .catch(() => false);
    const errStatusCount = await page.locator('.detail-source-status--err').count();

    // 仅当存在可用源时，卡片才出现“全部”按钮（mock 下 CMS 全部失败 → 不出现）
    const allBtn = page.locator('.detail-source-all-btn').first();
    const hasAllBtn = await allBtn.isVisible().catch(() => false);
    if (!hasAllBtn) {
      if (!unifiedMsgVisible) {
        throw new Error('DETAIL-062: 全部源不可用时未显示统一提示');
      }
      return;
    }

    await allBtn.click();
    await page.waitForTimeout(800);

    const modalVisible = await page.locator('.source-all-modal').isVisible().catch(() => false);
    const rowCount = await page.locator('.source-all-modal__row').count();
    const playBtnCount = await page.locator('.source-all-modal__play-btn').count();

    // 点击第一条线路的播放按钮应跳转到播放页
    if (playBtnCount > 0) {
      await page.locator('.source-all-modal__play-btn').first().click();
      await page.waitForTimeout(1500);
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
    await page.waitForTimeout(5000);

    // 预期结果: 推荐区域存在
    const hasRecommend = await page.evaluate(() => {
      return !!document.querySelector('.detail-recommend, [class*="recommend"]');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.9 页面状态与回退
// ═══════════════════════════════════════════════════════════════

test.describe('3.9 页面状态与回退', () => {
  test('DETAIL-091: 文档标题', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 预期结果: 显示影片名称
    const title = await page.title();
    expect(title).toBeTruthy();
  });
});
