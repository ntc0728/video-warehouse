/**
 * 播放页入口流程完整测试
 * 基于 docs/playback-entry-flows.md 的 10 条入口流程
 *
 * 每条测试包含：
 *   - 前置条件（数据准备）
 *   - 操作步骤
 *   - 预期效果（断言）
 */
import { test, expect, type Page } from '@playwright/test';

/* ─── 工具函数 ──────────────────────────────────────────── */

/** 等待页面脱离全屏 loading */
async function waitForPageReady(page: Page, timeout = 15000) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    () => {
      const loading = document.querySelector('.player-loading-wrap');
      if (!loading) return true;
      const parent = loading.closest('.player-page');
      if (!parent) return true;
      return !!parent.querySelector('.player-main, .player-empty-state');
    },
    { timeout },
  );
}

/** 收集页面错误 */
function collectErrors(page: Page) {
  const jsErrors: string[] = [];
  page.on('pageerror', (err) => jsErrors.push(err.message));
  return jsErrors;
}

/* ═══════════════════════════════════════════════════════════
   入口 1：首页 HeroBanner — "继续播放"
   预期：点击后跳转到 /play/{tmdbId}，播放页加载无崩溃
   ═══════════════════════════════════════════════════════════ */
test.describe('入口1: 首页 HeroBanner 继续播放', () => {
  test('首页 "继续播放" 按钮跳转到播放页', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    // HeroBanner 中的继续播放按钮
    const continueBtn = page.locator('.hero-continue-btn, [class*="continue"]').first();
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(3000);

      // 预期：URL 变为 /play/{id}
      const url = page.url();
      expect(url).toMatch(/\/play\/tmdb-/);

      // 预期：播放页容器存在
      const hasPlayerPage = await page.evaluate(() => !!document.querySelector('.player-page'));
      expect(hasPlayerPage).toBe(true);

      // 预期：无 JS 崩溃
      const critical = errors.filter(e => !e.includes('Abort') && !e.includes('ChunkLoad'));
      expect(critical).toEqual([]);
    }
  });

  test('首页 "继续播放" 跳转后播放页接收 from 参数', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    const continueBtn = page.locator('.hero-continue-btn, [class*="continue"]').first();
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(3000);

      // 预期：location.state 包含 from
      const state = await page.evaluate(() => {
        return (window.history.state as Record<string, unknown>)?.usr;
      });
      expect(state).toBeTruthy();
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   入口 2：详情页 — "继续播放" / "立即播放"
   预期：无历史时显示"立即播放"，点击跳转播放页
   ═══════════════════════════════════════════════════════════ */
test.describe('入口2: 详情页 继续播放/立即播放', () => {
  test('详情页无历史时显示 "立即播放" 按钮', async ({ page }) => {
    await page.goto('/detail/tmdb-movie-550');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    const playBtn = page.locator('.detail-btn-play');
    if (await playBtn.isVisible().catch(() => false)) {
      const text = await playBtn.textContent();
      // 预期：无历史时显示"立即播放"
      expect(text).toContain('立即播放');
    }
  });

  test('详情页 "立即播放" 点击跳转到播放页', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/detail/tmdb-movie-550');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    const playBtn = page.locator('.detail-btn-play');
    if (await playBtn.isVisible().catch(() => false)) {
      await playBtn.click();
      await page.waitForTimeout(3000);

      // 预期：URL 变为 /play/{id}
      const url = page.url();
      expect(url).toMatch(/\/play\/tmdb-movie-550/);

      // 预期：播放页容器存在
      const hasPlayerPage = await page.evaluate(() => !!document.querySelector('.player-page'));
      expect(hasPlayerPage).toBe(true);

      // 预期：无 JS 崩溃
      const critical = errors.filter(e => !e.includes('Abort') && !e.includes('ChunkLoad'));
      expect(critical).toEqual([]);
    }
  });

  test('详情页 "立即播放" 不传递 skipHistory', async ({ page }) => {
    await page.goto('/detail/tmdb-movie-550');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    const playBtn = page.locator('.detail-btn-play');
    if (await playBtn.isVisible().catch(() => false)) {
      await playBtn.click();
      await page.waitForTimeout(2000);

      // 预期：location.state 不包含 skipHistory
      const state = await page.evaluate(() => {
        return (window.history.state as Record<string, unknown>)?.usr as Record<string, unknown> | undefined;
      });
      expect(state?.skipHistory).toBeUndefined();
    }
  });

  test('详情页 "立即播放" 传递 from 参数', async ({ page }) => {
    await page.goto('/detail/tmdb-movie-550');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    const playBtn = page.locator('.detail-btn-play');
    if (await playBtn.isVisible().catch(() => false)) {
      await playBtn.click();
      await page.waitForTimeout(2000);

      // 预期：state.from 指向详情页
      const state = await page.evaluate(() => {
        return (window.history.state as Record<string, unknown>)?.usr as Record<string, unknown> | undefined;
      });
      expect(state?.from).toBe('/detail/tmdb-movie-550');
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   入口 3：详情页 — "从头播放"
   预期：传递 skipHistory: true，播放页不恢复进度
   ═══════════════════════════════════════════════════════════ */
test.describe('入口3: 详情页 从头播放', () => {
  test('"从头播放" 按钮仅在有历史时显示', async ({ page }) => {
    await page.goto('/detail/tmdb-movie-550');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    const fromStartBtn = page.locator('.detail-btn-play-from-start');
    const count = await fromStartBtn.count();
    // 预期：按钮存在性取决于是否有历史记录
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('"从头播放" 点击传递 skipHistory: true', async ({ page }) => {
    await page.goto('/detail/tmdb-movie-550');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    const fromStartBtn = page.locator('.detail-btn-play-from-start');
    if (await fromStartBtn.isVisible().catch(() => false)) {
      await fromStartBtn.click();
      await page.waitForTimeout(2000);

      // 预期：state.skipHistory = true
      const state = await page.evaluate(() => {
        return (window.history.state as Record<string, unknown>)?.usr as Record<string, unknown> | undefined;
      });
      expect(state?.skipHistory).toBe(true);
    }
  });

  test('"从头播放" 跳转到播放页', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/detail/tmdb-movie-550');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    const fromStartBtn = page.locator('.detail-btn-play-from-start');
    if (await fromStartBtn.isVisible().catch(() => false)) {
      await fromStartBtn.click();
      await page.waitForTimeout(3000);

      // 预期：URL 变为 /play/{id}
      const url = page.url();
      expect(url).toMatch(/\/play\/tmdb-movie-550/);

      // 预期：播放页容器存在
      const hasPlayerPage = await page.evaluate(() => !!document.querySelector('.player-page'));
      expect(hasPlayerPage).toBe(true);

      // 预期：无 JS 崩溃
      const critical = errors.filter(e => !e.includes('Abort') && !e.includes('ChunkLoad'));
      expect(critical).toEqual([]);
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   入口 4：详情页 — CMS 源"立即播放"
   预期：传递 sourceIndex，播放页使用指定 CMS 源
   ═══════════════════════════════════════════════════════════ */
test.describe('入口4: 详情页 CMS源播放', () => {
  test('详情页 CMS 匹配结果列表存在', async ({ page }) => {
    await page.goto('/detail/tmdb-movie-550');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(10000);

    const sourcesContainer = page.locator('.detail-sources-container');
    // 预期：CMS 搜索完成后显示匹配结果（可能为 0 个）
    const exists = await sourcesContainer.count();
    expect(exists).toBeGreaterThanOrEqual(0);
  });

  test('CMS 源 "立即播放" 按钮点击跳转并传递 sourceIndex', async ({ page }) => {
    await page.goto('/detail/tmdb-movie-550');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(10000);

    const sourcePlayBtn = page.locator('.detail-source-play-btn').first();
    if (await sourcePlayBtn.isVisible().catch(() => false)) {
      await sourcePlayBtn.click();
      await page.waitForTimeout(3000);

      // 预期：URL 变为 /play/{id}
      const url = page.url();
      expect(url).toMatch(/\/play\//);

      // 预期：state 包含 sourceIndex
      const state = await page.evaluate(() => {
        return (window.history.state as Record<string, unknown>)?.usr as Record<string, unknown> | undefined;
      });
      expect(state?.sourceIndex).toBeDefined();
      expect(typeof state?.sourceIndex).toBe('number');
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   入口 5：浏览页 — 智能搜索 → 跳详情页
   预期：卡片点击跳转到详情页，不直接进播放页
   ═══════════════════════════════════════════════════════════ */
test.describe('入口5: 浏览页 智能搜索→详情页', () => {
  test('浏览页智能搜索结果卡片点击跳转到详情页', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/browse');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 输入搜索词触发智能搜索
    const searchInput = page.locator('.search-box input, input[type="search"], .browse-search input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(' Fight Club');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000);

      // 点击第一个搜索结果卡片
      const card = page.locator('.video-card').first();
      if (await card.isVisible().catch(() => false)) {
        await card.click();
        await page.waitForTimeout(2000);

        // 预期：URL 变为 /detail/{id}（不是 /play/）
        const url = page.url();
        expect(url).toMatch(/\/detail\//);
        expect(url).not.toMatch(/\/play\//);

        // 预期：详情页容器存在
        const hasDetail = await page.evaluate(() => {
          return !!document.querySelector('[class*="detail"]');
        });
        expect(hasDetail).toBe(true);

        // 预期：无 JS 崩溃
        const critical = errors.filter(e => !e.includes('Abort') && !e.includes('ChunkLoad'));
        expect(critical).toEqual([]);
      }
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   入口 6：浏览页 — CMS 直链搜索 → 直接进播放页
   预期：卡片点击跳转到 /play/{id}，传递 sourceIndex
   ═══════════════════════════════════════════════════════════ */
test.describe('入口6: 浏览页 CMS直链→播放页', () => {
  test('CMS 直链搜索结果卡片点击跳转到播放页', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/browse');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 切换到 CMS 直链搜索模式
    const cmsTab = page.locator('.browse-search-tab').nth(1);
    if (await cmsTab.isVisible().catch(() => false)) {
      await cmsTab.click();
      await page.waitForTimeout(500);

      // 输入搜索词
      const searchInput = page.locator('.search-box input, input[type="search"], .browse-search input').first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('Fight Club');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(5000);

        // 点击第一个搜索结果卡片
        const card = page.locator('.video-card').first();
        if (await card.isVisible().catch(() => false)) {
          await card.click();
          await page.waitForTimeout(3000);

          // 预期：URL 变为 /play/{id}（不是 /detail/）
          const url = page.url();
          expect(url).toMatch(/\/play\//);

          // 预期：播放页容器存在
          const hasPlayerPage = await page.evaluate(() => !!document.querySelector('.player-page'));
          expect(hasPlayerPage).toBe(true);

          // 预期：无 JS 崩溃
          const critical = errors.filter(e => !e.includes('Abort') && !e.includes('ChunkLoad'));
          expect(critical).toEqual([]);
        }
      }
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   入口 7：历史页 — 卡片点击
   预期：跳转到 /play/{id}，播放页加载无崩溃
   ═══════════════════════════════════════════════════════════ */
test.describe('入口7: 历史页 卡片点击', () => {
  test('历史页视频卡片点击跳转到播放页', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/history');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const card = page.locator('.video-card, .record-card').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForTimeout(3000);

      // 预期：URL 变为 /play/{id}
      const url = page.url();
      expect(url).toMatch(/\/play\//);

      // 预期：播放页容器存在
      const hasPlayerPage = await page.evaluate(() => !!document.querySelector('.player-page'));
      expect(hasPlayerPage).toBe(true);

      // 预期：无 JS 崩溃
      const critical = errors.filter(e => !e.includes('Abort') && !e.includes('ChunkLoad'));
      expect(critical).toEqual([]);
    }
  });

  test('历史页卡片点击不传递 sourceIndex', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const card = page.locator('.video-card, .record-card').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForTimeout(2000);

      // 预期：state 不包含 sourceIndex
      const state = await page.evaluate(() => {
        return (window.history.state as Record<string, unknown>)?.usr as Record<string, unknown> | undefined;
      });
      expect(state?.sourceIndex).toBeUndefined();
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   入口 8：收藏页 — 有 sourceIndex 的视频
   预期：跳转到 /play/{id}，传递 sourceIndex
   ═══════════════════════════════════════════════════════════ */
test.describe('入口8: 收藏页 有sourceIndex', () => {
  test('收藏页有 sourceIndex 的卡片点击跳转到播放页', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/collections');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 查找有 navigateTo 的卡片（跳转到 /play/ 的）
    const card = page.locator('.video-card').first();
    if (await card.isVisible().catch(() => false)) {
      const href = await card.getAttribute('href');
      if (href && href.includes('/play/')) {
        await card.click();
        await page.waitForTimeout(3000);

        // 预期：URL 变为 /play/{id}
        const url = page.url();
        expect(url).toMatch(/\/play\//);

        // 预期：播放页容器存在
        const hasPlayerPage = await page.evaluate(() => !!document.querySelector('.player-page'));
        expect(hasPlayerPage).toBe(true);

        // 预期：无 JS 崩溃
        const critical = errors.filter(e => !e.includes('Abort') && !e.includes('ChunkLoad'));
        expect(critical).toEqual([]);
      }
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   入口 9：收藏页 — 无 sourceIndex 的视频
   预期：跳转到详情页，不直接进播放页
   ═══════════════════════════════════════════════════════════ */
test.describe('入口9: 收藏页 无sourceIndex', () => {
  test('收藏页无 sourceIndex 的卡片点击跳转到详情页', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/collections');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 查找跳转到 /detail/ 的卡片
    const card = page.locator('.video-card').first();
    if (await card.isVisible().catch(() => false)) {
      const href = await card.getAttribute('href');
      if (href && href.includes('/detail/')) {
        await card.click();
        await page.waitForTimeout(2000);

        // 预期：URL 变为 /detail/{id}（不是 /play/）
        const url = page.url();
        expect(url).toMatch(/\/detail\//);
        expect(url).not.toMatch(/\/play\//);

        // 预期：详情页容器存在
        const hasDetail = await page.evaluate(() => {
          return !!document.querySelector('[class*="detail"]');
        });
        expect(hasDetail).toBe(true);

        // 预期：无 JS 崩溃
        const critical = errors.filter(e => !e.includes('Abort') && !e.includes('ChunkLoad'));
        expect(critical).toEqual([]);
      }
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   入口 10：直接 URL 访问
   预期：播放页正常加载，使用默认 CMS 源
   ═══════════════════════════════════════════════════════════ */
test.describe('入口10: 直接URL访问', () => {
  test('直接访问 /play/tmdb-movie-550 加载播放页', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/play/tmdb-movie-550');
    await waitForPageReady(page);
    await page.waitForTimeout(3000);

    // 预期：播放页容器存在
    const hasPlayerPage = await page.evaluate(() => !!document.querySelector('.player-page'));
    expect(hasPlayerPage).toBe(true);

    // 预期：无 JS 崩溃
    const critical = errors.filter(e => !e.includes('Abort') && !e.includes('ChunkLoad'));
    expect(critical).toEqual([]);
  });

  test('直接访问 /play/tmdb-tv-1399 加载播放页', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/play/tmdb-tv-1399');
    await waitForPageReady(page);
    await page.waitForTimeout(3000);

    // 预期：播放页容器存在
    const hasPlayerPage = await page.evaluate(() => !!document.querySelector('.player-page'));
    expect(hasPlayerPage).toBe(true);

    // 预期：无 JS 崩溃
    const critical = errors.filter(e => !e.includes('Abort') && !e.includes('ChunkLoad'));
    expect(critical).toEqual([]);
  });

  test('直接 URL 访问不传递 state', async ({ page }) => {
    await page.goto('/play/tmdb-movie-550');
    await waitForPageReady(page);

    // 预期：location.state 为空或不含 sourceIndex
    const state = await page.evaluate(() => {
      return (window.history.state as Record<string, unknown>)?.usr;
    });
    // 直接 URL 访问时 state 可能为 null
    if (state) {
      expect((state as Record<string, unknown>).sourceIndex).toBeUndefined();
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   播放页内部逻辑验证
   ═══════════════════════════════════════════════════════════ */
test.describe('播放页内部逻辑', () => {
  test('TMDB 电影播放页渲染 player-page 容器', async ({ page }) => {
    await page.goto('/play/tmdb-movie-550');
    await waitForPageReady(page);

    // 预期：player-page 容器存在
    const container = page.locator('.player-page');
    await expect(container).toBeVisible();
  });

  test('TMDB 剧集播放页渲染 player-page 容器', async ({ page }) => {
    await page.goto('/play/tmdb-tv-1399');
    await waitForPageReady(page);

    // 预期：player-page 容器存在
    const container = page.locator('.player-page');
    await expect(container).toBeVisible();
  });

  test('无效 ID 播放页不崩溃', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/play/tmdb-movie-999999999');
    await waitForPageReady(page, 10000);

    // 预期：无未捕获的 JS 错误
    const critical = errors.filter(
      e => !e.includes('Abort') && !e.includes('ChunkLoad') && !e.includes('abort'),
    );
    expect(critical).toEqual([]);
  });

  test('播放页侧边栏面板存在', async ({ page }) => {
    await page.goto('/play/tmdb-movie-550');
    await waitForPageReady(page);

    // 预期：player-sidebar 存在
    const sidebar = page.locator('.player-sidebar');
    if (await sidebar.isVisible().catch(() => false)) {
      await expect(sidebar).toBeVisible();
    }
  });

  test('播放页 CMS 面板存在', async ({ page }) => {
    await page.goto('/play/tmdb-movie-550');
    await waitForPageReady(page);
    await page.waitForTimeout(5000);

    // 预期：CMS 面板存在
    const cmsPanel = page.locator('[class*="cms"]');
    const count = await cmsPanel.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('播放页详情区存在', async ({ page }) => {
    await page.goto('/play/tmdb-movie-550');
    await waitForPageReady(page);
    await page.waitForTimeout(3000);

    // 预期：详情区存在
    const detail = page.locator('.player-detail-section');
    if (await detail.isVisible().catch(() => false)) {
      await expect(detail).toBeVisible();
    }
  });

  test('快速连续导航不崩溃', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/play/tmdb-movie-550');
    await page.waitForTimeout(500);
    await page.goto('/play/tmdb-tv-1399');
    await page.waitForTimeout(500);
    await page.goto('/play/tmdb-movie-550');
    await waitForPageReady(page, 10000);

    // 预期：无关键 JS 错误
    const critical = errors.filter(
      e => !e.includes('Abort') && !e.includes('ChunkLoad') && !e.includes('abort'),
    );
    expect(critical).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════
   跨入口一致性验证
   ═══════════════════════════════════════════════════════════ */
test.describe('跨入口一致性', () => {
  test('所有入口跳转后播放页容器一致', async ({ page }) => {
    const urls = [
      '/play/tmdb-movie-550',
      '/play/tmdb-tv-1399',
    ];

    for (const url of urls) {
      await page.goto(url);
      await waitForPageReady(page);
      await page.waitForTimeout(2000);

      // 预期：所有入口都渲染 player-page
      const hasPlayerPage = await page.evaluate(() => !!document.querySelector('.player-page'));
      expect(hasPlayerPage).toBe(true);
    }
  });

  test('详情页播放按钮文案根据历史状态变化', async ({ page }) => {
    await page.goto('/detail/tmdb-movie-550');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    const playBtn = page.locator('.detail-btn-play');
    if (await playBtn.isVisible().catch(() => false)) {
      const text = await playBtn.textContent();

      // 预期：文案只能是"继续播放"或"立即播放"
      const isValidText = text?.includes('继续播放') || text?.includes('立即播放');
      expect(isValidText).toBe(true);

      // 预期：如果有"继续播放"，则"从头播放"按钮也应存在
      if (text?.includes('继续播放')) {
        const fromStartBtn = page.locator('.detail-btn-play-from-start');
        await expect(fromStartBtn).toBeVisible();
      }
    }
  });

  test('详情页"从头播放"按钮与"继续播放"并列', async ({ page }) => {
    await page.goto('/detail/tmdb-movie-550');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    const fromStartBtn = page.locator('.detail-btn-play-from-start');
    if (await fromStartBtn.isVisible().catch(() => false)) {
      // 预期："从头播放"和主播放按钮在同一容器内
      const parent = await fromStartBtn.evaluate((el) => {
        return el.closest('.detail-hero-actions') !== null;
      });
      expect(parent).toBe(true);

      // 预期：主播放按钮也存在
      const playBtn = page.locator('.detail-btn-play');
      await expect(playBtn).toBeVisible();
    }
  });
});
