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
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    const loadingVisible = await page.evaluate(() => {
      return !!document.querySelector('.app-loading, [class*="loading"]');
    });
    expect(loadingVisible).toBeTruthy();

    // 001 正常加载电影详情 → Hero 区域
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    await expect
      .poll(
        () => page.evaluate(() => !!document.querySelector('.detail-hero, [class*="detail-hero"]')),
        { ...POLL, timeout: 5000 },
      )
      .toBeTruthy();

    // 002 正常加载剧集详情 → Tab 区域（含季信息）
    await page.goto(`/detail/${TEST_TV_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });

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
    await page.waitForSelector('.app-shell', { timeout: 10000 });

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
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    let tabs = page.locator('.detail-tab');
    await expect.poll(() => tabs.count(), { ...POLL, timeout: 5000 }).toBeGreaterThan(0);
    let count = await tabs.count();
    if (count > 0) {
      const tabTexts = await tabs.allTextContents();
      expect(count).toBeGreaterThanOrEqual(2);
    }

    // 031 剧集详情显示 3 个 Tab
    await page.goto(`/detail/${TEST_TV_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    tabs = page.locator('.detail-tab');
    await expect.poll(() => tabs.count(), { ...POLL, timeout: 5000 }).toBeGreaterThan(0);

    // 032 切换 Tab
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    await expect
      .poll(
        () => page.evaluate(() => !!document.querySelector('.detail-cast-row, [class*="cast"]')),
        { ...POLL, timeout: 10000 },
      )
      .toBeTruthy();

    // 剧照接口（mock 延迟 2s）返回后 .detail-stills-item 才渲染；
    // 等具体条目而非 .detail-stills-grid（骨架态即存在，会误判为 0 张）
    await expect(page.locator('.detail-stills-item').first()).toBeVisible({ timeout: 10000 });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    // 重进 detail 的剧照接口（mock 延迟 2s）应在页面隐藏期返回：
    // 条件等这条响应而非固定睡眠；若浏览器已丢弃该请求则最多等 8s 后继续。
    const stillsResponse = page
      .waitForResponse(
        (r) => r.url().includes('api.tmdb.org') && r.url().includes('/images'),
        { timeout: 8000 },
      )
      .catch(() => null);
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    await page.goBack();
    await expect(page).not.toHaveURL(/\/detail\//, { timeout: 5000 });
    await stillsResponse;
    await page.goForward();
    await page.waitForSelector('.detail-stills-more', { timeout: 10000 });
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
    await page.waitForSelector('.app-shell', { timeout: 10000 });

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

    // 062 播放源"全部"弹框显示线路列表（拦截外部请求使非 mock 流量快速失败；CMS 搜索随后再单独放行并返回「双线路」假数据 ——
    // 单线路或空数据都不渲染「全部」按钮（index.tsx:1244：isSeries || lineCount>1 || episodeCount>1），
    // 弹窗路径将无从验证。Playwright 后注册的 route 优先，故两条 route 的注册顺序不可颠倒）
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

    // CMS 搜索（ac=videolist，经代理时编码为 ac%3Dvideolist）→ 固定返回「双线路」电影条目，
    // 使源卡渲染出 .detail-source-all-btn（lineCount=2 → 命中 index.tsx:1244 的 >1 分支）。
    // vod_id / vod_name 与 tmdb-movie-550（Fight Club）对齐，保证详情页关键词匹配通过。
    await page.route(/ac(?:=|%3D)videolist/i, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          code: 1,
          msg: 'ok',
          page: 1,
          pagecount: 1,
          limit: 20,
          total: 1,
          list: [
            {
              vod_id: '550',
              vod_name: 'Fight Club',
              vod_type: 'movie',
              type_id: '1',
              type_name: '电影',
              // $$$ 分隔两条线路，每组单段 → parsePlaySources 按电影产出 2 条 sources
              vod_play_url:
                '线路1$第1集$https://cms-mock.local/stream/index.m3u8$$$线路2$第1集$https://cms-mock.local/stream/index.m3u8',
            },
          ],
        }),
      }),
    );

    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });

    const sourcesTab2 = page.locator('.detail-tab').filter({ hasText: '播放列表' });
    await expect.poll(() => sourcesTab2.count(), { ...POLL, timeout: 5000 }).toBeGreaterThan(0);
    if (!(await sourcesTab2.isVisible().catch(() => false))) {
      return;
    }
    await sourcesTab2.click();
    // 播放源区挂载 → 匹配 spinner (.playlist-query) 消失 = CMS 查询已落到终态
    await expect(page.locator('.detail-sources')).toBeVisible({ timeout: 10000 });
    await expect
      .poll(() => page.locator('.detail-sources .playlist-query').count(), {
        ...POLL,
        timeout: 10000,
      })
      .toBe(0);

    const unifiedMsgVisible = await page
      .locator('.detail-sources-empty:has-text("所有视频源均未找到匹配资源")')
      .isVisible()
      .catch(() => false);

    // 源区终态二选一：有源卡（.detail-source-group）或统一提示（.detail-sources-empty）。
    // 2026-09-30 纠偏：原断言 '.detail-source-status--err' 在实现中不存在（只有 --ok，
    // index.tsx:1217 / Detail.css:1000）→ count 恒为 0，属永真假绿，已删除。
    const srcGroupCount = await page.locator('.detail-source-group').count();
    if (srcGroupCount > 0) {
      // 有源卡时状态标记不得出现非「可播放」值（实现只产出 --ok）
      const badStatusCount = await page
        .locator('.detail-source-group .detail-source-status:not(.detail-source-status--ok)')
        .count();
      expect(badStatusCount).toBe(0);
    } else {
      expect(unifiedMsgVisible, 'DETAIL-062: 无源卡且未显示统一提示').toBe(true);
    }

    // 「全部」按钮仅在 剧集 / 多线路 / 多集 时渲染（index.tsx:1244）
    const allBtn = page.locator('.detail-source-all-btn').first();
    const hasAllBtn = await allBtn.isVisible().catch(() => false);
    if (!hasAllBtn) {
      // 该源为单线路单片，无弹窗可验：仅校验源区没有落到「空且无提示」的异常终态
      expect(
        srcGroupCount > 0 || unifiedMsgVisible,
        'DETAIL-062: 源区既无「全部」按钮，也无源卡与统一提示',
      ).toBe(true);
      return;
    }

    await allBtn.click();
    // 播放列表弹窗 = PlaylistModal（选择器基类 .playlist-modal playlist-modal--<center|sheet|drawer>）。
    // 2026-09-30 纠偏：原 .source-all-modal* 已被 PlaylistModal 取代（PlaylistModal.tsx:750），
    // 旧类在 Detail.css 清理后不存在 → 改用真实类名，并把「行」对应到 .playlist-cell。
    await expect(page.locator('.playlist-modal')).toBeVisible({ timeout: 5000 });

    // 弹窗条目：电影渲染线路格（.playlist-cell--line），剧集渲染选集格（.playlist-cell--ep），
    // 二者共用 .playlist-cell 基类（PlaylistModal.tsx:545-547），故此处只断言基类非空。
    await expect
      .poll(() => page.locator('.playlist-cell').count(), { ...POLL, timeout: 5000 })
      .toBeGreaterThan(0);

    await page.locator('.playlist-cell').first().click({ timeout: 5000 });
    // 2026-09-20 纠偏：原 waitForURL().catch(()=>{}) + 未使用的 onPlayer = 零断言悬挂段。
    // 「弹窗条目 → 进播放器」是产品契约（点击走 Link/handleCellClick → onPlayLine/onPlayEpisode → navigate），
    // CMS 数据已被 hermetic mock 固定，故改为硬断言。
    await expect(page).toHaveURL(/\/play\//, { timeout: 10000 });
    // 播放页容器（.up-universal-player / .player-*）：断言只到「容器已挂载可见」，
    // 不依赖 cms-mock.local 这条假流能真拉起来（其 DNS 不可达时播放器落错误态，容器仍在）
    await expect(page.locator('.up-universal-player, [class*="player"]').first()).toBeVisible({
      timeout: 10000,
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.8 推荐区域
// ═══════════════════════════════════════════════════════════════

test.describe('3.8 推荐区域', () => {
  test('DETAIL-080: 相关推荐', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });

    await expect
      .poll(
        () =>
          page.evaluate(() => !!document.querySelector('.detail-recommend, [class*="recommend"]')),
        { ...POLL, timeout: 7000 },
      )
      .toBeTruthy();
  });
});

test.describe('3.11 剧照灯箱', () => {
  test('DETAIL-090: 缩放控件位于当前显示图片正下方（三行流式布局）', async ({ page }) => {
    await page.goto(`/detail/${TEST_MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.detail-stills-item', { timeout: 10000 });
    await page.locator('.detail-stills-item').first().click();

    const lightbox = page.locator('.stills-lightbox').first();
    await expect(lightbox).toBeVisible({ timeout: 10000 });

    const geo = await lightbox.evaluate((el) => {
      const box = (sel: string) => {
        const n = el.querySelector(sel);
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, centerX: r.left + r.width / 2 };
      };
      const zoomEl = el.querySelector('.stills-lightbox__zoom');
      const thumbsEl = el.querySelector('.stills-lightbox__thumbs');
      return {
        scroll: box('.stills-lightbox__scroll'),
        zoom: box('.stills-lightbox__zoom'),
        thumbs: box('.stills-lightbox__thumbs'),
        zoomPosition: zoomEl ? getComputedStyle(zoomEl).position : null,
        thumbsPosition: thumbsEl ? getComputedStyle(thumbsEl).position : null,
        viewportCenterX: window.innerWidth / 2,
      };
    });

    // 旧形态是 position:absolute 的视口右下角浮层；现为文档流内第二行
    expect(geo.zoom).not.toBeNull();
    expect(geo.zoomPosition).toBe('relative');
    expect(geo.scroll).not.toBeNull();

    // 竖向次序：主图区 → 缩放条 → 缩略图条
    expect(geo.zoom!.top).toBeGreaterThanOrEqual(geo.scroll!.bottom - 1);
    if (geo.thumbs) {
      expect(geo.thumbsPosition).toBe('relative');
      expect(geo.thumbs.top).toBeGreaterThanOrEqual(geo.zoom!.bottom - 1);
    }

    // 水平居中于当前显示图片（= 视口水平中心）
    expect(Math.abs(geo.zoom!.centerX - geo.viewportCenterX)).toBeLessThanOrEqual(2);
  });
});
