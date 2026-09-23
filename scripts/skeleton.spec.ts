/**
 * 骨架体系测试 — 覆盖 2026-09-18 骨架整改后的三条硬契约：
 *
 *   A. **色源唯一**：--color-skeleton / --color-skeleton-shine 是
 *      --color-placeholder-shimmer-a/b 的别名（variables.css）。任何主题下两者计算值
 *      必须相等 —— 此前两套灰（#e8e8e8↔#f5f5f5 vs #f0f0f0↔#e6e6e6）会在同屏出现。
 *      → SKEL-001 / 002
 *
 *   B. **列数同源**：页级骨架与真实网格共读同一 :root token，逐断点断言
 *      「token 值 == 真实网格实际列数 == 骨架网格实际列数」。
 *      Person 作品网格 768–1023 曾是「真实 5 列 / 骨架 4 列」的硬伤（P0），本组守住。
 *      → SKEL-003 ~ 008
 *
 *   C. **结构同构 + 视口填充**（2026-09-18 用户要求「每页骨架 == 真实页元素结构」）：
 *      · 区块**数量**取自真实真源（tabs 2 / 演员 12 / 剧照 6 / 推荐区 2 / Browse 类型 7、
 *        排序 3 / Collections 分区数随 tab），断言骨架把这些块都渲染出来；
 *      · 行数**不固定** —— useFillRows 按滚动容器可视高度实测推导，故「视口变高 →
 *        骨架卡更多且为列数整数倍」，不再出现「固定 4 行 + 下方一片空白」。
 *      → SKEL-009 ~ 015
 *
 * 两种撑开 loading 窗口的手法（骨架只在数据未到时存在，不撑开就断言不到）：
 *   · **延迟 TMDB**（holdTmdb）：mock 照常应答，只是晚到 —— 用于 Person/Chart/Detail/Browse；
 *   · **挂起 IndexedDB 读**（holdIndexedDB）：open 照常成功、读永不返回 → `_loading` 恒 true ——
 *     用于 History/Collections（细节与两个坑见该函数注释）。
 *     这两个页的骨架曾因「App 层 gate 把等待吃掉」而无可见窗口（旧编号 SKEL-010 上挂的
 *     test.skip），2026-09-18 gate 下沉到页面级后窗口才真正存在，skip 随之删除。
 *
 * 另有一套**注入法探针**（契约 B 专用）：把「真实网格」与「骨架网格」两段最小 DOM 按真实
 * 类名注入页面 body，于是不依赖页面数据（History/Collections 的数据在 IndexedDB，E2E 里
 * 常为空）、不依赖 loading 时序，一次注入可在多个视口下反复读数。
 */
import { test, expect } from './fixtures/mock-tmdb';
import type { Page } from '@playwright/test';

const PROBE_ID = '__skeleton_probe';
const PROBE = `#${PROBE_ID}`;

/** 逐断点读数用的视口（覆盖 断点宪法 的移动/平板/小桌面/大屏四档） */
const VIEWPORTS = [
  { w: 375, h: 800, label: '375 移动' },
  { w: 768, h: 900, label: '768 平板' },
  { w: 900, h: 900, label: '900 平板-Person例外档' },
  { w: 1024, h: 900, label: '1024 左栏起点' },
  { w: 1440, h: 900, label: '1440 大屏起点' },
];

/** 真实网格 ↔ 骨架网格 ↔ token 三方对照定义 */
interface GridPair {
  /** 承载该页 CSS 的路由（Vite 按路由懒加载 chunk，CSS 只在对应页面存在） */
  url: string;
  label: string;
  realHtml: string;
  real: string;
  skelHtml: string;
  skel: string;
  token: string;
}

const PAIRS: GridPair[] = [
  {
    url: '/person/128',
    label: 'Person 作品网格',
    realHtml: '<div class="person-work-grid"></div>',
    real: `${PROBE} .person-work-grid`,
    skelHtml: '<div class="person-skeleton"><div class="person-skeleton__work-grid"></div></div>',
    skel: `${PROBE} .person-skeleton__work-grid`,
    token: '--person-work-cols',
  },
  {
    url: '/history',
    label: 'History 记录网格',
    realHtml: '<div class="history-content"><div class="history-group-body"><div class="history-grid"></div></div></div>',
    real: `${PROBE} .history-content .history-group-body .history-grid`,
    /* 探针必须复刻完整祖先链：History.css 的规则写作
       `.history-content .history-group-body .history-grid`，少一层就只剩 display:block，
       读列数得到 -1（首版就栽在这——骨架根类名本身叫 history-content，容易漏） */
    skelHtml:
      '<div class="history-content history-skeleton"><div class="history-groups"><div class="history-group-body"><div class="history-grid"></div></div></div></div>',
    /* 注意这里的含义：探针宿主 div 在 body 上，`.history-skeleton` 是**骨架根**（它自己也带
       .history-content），故骨架侧从 .history-skeleton 往下走一级即可 —— 写成
       `.history-skeleton .history-content ...` 会要求嵌套两层，永远匹配不到（首版错法）。 */
    skel: `${PROBE} .history-skeleton .history-group-body .history-grid`,
    token: '--history-cols',
  },
  {
    url: '/chart',
    label: 'Chart 榜单',
    realHtml: '<div class="chart-list"></div>',
    real: `${PROBE} .chart-list`,
    skelHtml: '<div class="chart-list chart-skeleton"></div>',
    skel: `${PROBE} .chart-skeleton`,
    token: '--chart-cols',
  },
  {
    url: '/browse',
    label: 'Browse 海报网格',
    realHtml: '<div class="video-card-grid"></div>',
    real: `${PROBE} .video-card-grid`,
    skelHtml: '<div class="browse-skeleton"><div class="browse-skeleton__grid"></div></div>',
    skel: `${PROBE} .browse-skeleton__grid`,
    token: '--card-cols',
  },
  {
    url: '/iptv',
    label: 'IPTV 频道网格',
    realHtml: '<div class="iptv-page"><div class="iptv-channel-grid"></div></div>',
    real: `${PROBE} .iptv-page .iptv-channel-grid`,
    skelHtml: '<div class="iptv-skeleton"><div class="iptv-skeleton__channel-grid"></div></div>',
    skel: `${PROBE} .iptv-skeleton__channel-grid`,
    token: '--iptv-page-cols',
  },
  {
    url: '/collections',
    label: 'Collections 影视网格',
    realHtml: '<div class="video-card-grid"></div>',
    real: `${PROBE} .video-card-grid`,
    skelHtml: '<div class="collections-skeleton"><div class="collections-skeleton__video-grid"></div></div>',
    skel: `${PROBE} .collections-skeleton__video-grid`,
    token: '--card-cols',
  },
];

/** 打开页面（等 CSS chunk 就位）并注入探针 DOM */
async function gotoAndProbe(page: Page, pair: GridPair) {
  await page.goto(pair.url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 10000 });
  await page.evaluate(
    ({ id, html }) => {
      document.getElementById(id)?.remove();
      const host = document.createElement('div');
      host.id = id;
      host.setAttribute('aria-hidden', 'true');
      // 探针不参与布局语义，但必须是 grid 的真实父链，故照常插入 body 末尾
      host.innerHTML = html;
      document.body.appendChild(host);
    },
    { id: PROBE_ID, html: pair.realHtml + pair.skelHtml },
  );
}

/** 读 computed 列数：grid-template-columns 展开后按列值个数计（none → -1） */
async function readCols(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return -2; // 节点不存在
    const raw = getComputedStyle(el).gridTemplateColumns.trim();
    if (!raw || raw === 'none') return -1; // grid 未生效
    return raw.split(/\s+/).filter(Boolean).length;
  }, selector);
}

/** 读 :root 上数字 token 的计算值 */
async function readToken(page: Page, token: string): Promise<number> {
  return page.evaluate((t) => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(t).trim();
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : NaN;
  }, token);
}

/**
 * 撑开 TMDB loading 窗口：延迟后 `fallback()` 交棒给 mock fixture（不是 `continue()`
 * 直连网络），于是延迟结束页面仍能正常拿到 mock 数据落地。
 * 必须在 test body 内调用 —— Playwright 路由**后注册者优先**，才会先命中本处理器。
 */
async function holdTmdb(page: Page, ms = 10000) {
  await page.route('**/api.tmdb.org/**', async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.fallback();
  });
}

/**
 * 撑开本地库 loading 窗口：**让 `open` 照常成功**，只把「读」挂起。
 *
 * 两个必须记住的坑（2026-09-18 实测）：
 *
 *  ① **不能挂 `open`**：database.ts 有 `DB_OPEN_TIMEOUT = 6000`，挂 open 只能换来 6s 窗口；
 *     而 `getCollections / getHistory` 这一层没有超时 → 挂「读」= **窗口无限长**，
 *     断言不再受 6s 限制（SKEL-011/012 因此稳定）。
 *
 *  ② **替身必须自带 then/catch/finally**：idb 的 `wrap()` 只对 `instanceof IDBRequest`
 *     的值走 promisify，其它值**原样返回**，紧接着调用方 `.then(...)`。
 *     首版就是漏了这一点 → `TypeError: d.then is not a function` 从 idb 内部抛出，
 *     `_loadFromDB` 立刻落 catch → 页面渲染「读取失败」错误态而不是骨架。
 *     当时断言失败信息只是「骨架节点不存在」，极易误判成「gate 没下沉」。
 *
 *   读法：`db.getAll()` / `store.index().getAll()` 在 idb 里都经由 `wrap(store.getAll(...))`，
 *   替身原样返回后 await 永不落地 → `useUserStore._loading` 恒 true → 骨架常驻。
 */
async function holdIndexedDB(page: Page) {
  await page.addInitScript(() => {
    const make = () => {
      const never = new Promise(() => {});
      return {
        onsuccess: null,
        onerror: null,
        readyState: 'pending',
        result: undefined,
        error: null,
        source: null,
        transaction: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
        then: () => never,
        catch: () => never,
        finally: () => never,
      };
    };
    try {
      const READ_METHODS = ['getAll', 'getAllKeys', 'get', 'count', 'openCursor', 'openKeyCursor'];
      const protos = [IDBObjectStore.prototype, IDBIndex.prototype] as unknown[];
      for (const proto of protos) {
        const rec = proto as Record<string, unknown>;
        for (const name of READ_METHODS) {
          if (typeof rec[name] !== 'function') continue;
          Object.defineProperty(rec, name, {
            configurable: true,
            writable: true,
            value: () => make(),
          });
        }
      }
    } catch {
      /* 隐私模式等环境下 IndexedDB 不可用，忽略 */
    }
  });
}

test.describe('骨架契约 A：色源唯一', () => {
  test('SKEL-001: 浅色下 --color-skeleton 与 --color-placeholder-shimmer-* 同值', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    const v = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const g = (n: string) => cs.getPropertyValue(n).trim();
      return {
        skeleton: g('--color-skeleton'),
        shine: g('--color-skeleton-shine'),
        shimmerA: g('--color-placeholder-shimmer-a'),
        shimmerB: g('--color-placeholder-shimmer-b'),
      };
    });
    expect(v.skeleton).toBe(v.shimmerA);
    expect(v.shine).toBe(v.shimmerB);
  });

  test('SKEL-002: 深色下同样同值（别名在主题块内也成立）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    const v = await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      const cs = getComputedStyle(document.documentElement);
      const g = (n: string) => cs.getPropertyValue(n).trim();
      return {
        skeleton: g('--color-skeleton'),
        shine: g('--color-skeleton-shine'),
        shimmerA: g('--color-placeholder-shimmer-a'),
        shimmerB: g('--color-placeholder-shimmer-b'),
      };
    });
    expect(v.skeleton).toBe(v.shimmerA);
    expect(v.shine).toBe(v.shimmerB);
  });
});

test.describe('骨架契约 B：骨架列数 == 真实网格列数 == token（逐断点）', () => {
  PAIRS.forEach((pair, i) => {
    test(`SKEL-${String(i + 3).padStart(3, '0')}: ${pair.label}`, async ({ page }) => {
      await gotoAndProbe(page, pair);

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        const token = await readToken(page, pair.token);
        const real = await readCols(page, pair.real);
        const skel = await readCols(page, pair.skel);

        const ctx = `${pair.label} @ ${vp.label}（token ${pair.token}=${token}，真实=${real}，骨架=${skel}）`;
        expect(Number.isFinite(token), `token 未定义：${ctx}`).toBe(true);
        expect(real, `真实网格列数读取失败：${ctx}`).toBeGreaterThan(0);
        expect(skel, `骨架网格列数读取失败：${ctx}`).toBeGreaterThan(0);
        // 核心契约：三方一致。任一档漂移（如 Person 768–1023 的 4/5 列错位）即失败。
        expect(real, `真实网格与 token 不一致：${ctx}`).toBe(token);
        expect(skel, `骨架与真实网格不一致：${ctx}`).toBe(real);
      }
    });
  });
});

test.describe('骨架契约 C：骨架可见性 + 结构同构', () => {
  test('SKEL-009: Person 骨架可见，网格列数读 --person-work-cols', async ({ page }) => {
    await holdTmdb(page);
    await page.goto('/person/128', { waitUntil: 'domcontentloaded' });

    const skeleton = page.locator('.person-skeleton');
    await expect(skeleton).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.person-skeleton__work-grid')).toBeVisible();

    // 结构块：返回键 + 头像 + 名称 + tabs + 作品网格（与真实 Person 页同构）
    await expect(page.locator('.person-skeleton__back')).toHaveCount(1);
    await expect(page.locator('.person-skeleton__avatar')).toHaveCount(1);
    await expect(page.locator('.person-skeleton__tab')).toHaveCount(2);

    // 骨架自己的网格按 --person-work-cols 出列（不是 --card-cols）
    const cols = await readCols(page, '.person-skeleton__work-grid');
    expect(cols).toBe(await readToken(page, '--person-work-cols'));
  });

  test('SKEL-010: Chart 首屏骨架可见，列数读 --chart-cols', async ({ page }) => {
    await holdTmdb(page);
    await page.goto('/chart', { waitUntil: 'domcontentloaded' });

    const skeleton = page.locator('.chart-skeleton');
    await expect(skeleton).toBeVisible({ timeout: 10000 });
    const cols = await readCols(page, '.chart-skeleton');
    expect(cols).toBe(await readToken(page, '--chart-cols'));
  });

  test('SKEL-011: History 骨架可见（gate 下沉后才有窗口），结构 == 真实内容区', async ({ page }) => {
    await holdIndexedDB(page);
    await page.goto('/history', { waitUntil: 'domcontentloaded' });

    const skeleton = page.locator('.history-skeleton');
    await expect(skeleton).toBeVisible({ timeout: 10000 });

    /* 结构块（真实页同构）：算珠时间轴 / 分组节点列 / 分组体 / 记录卡网格。
       时间轴在移动与 app 档被 History.css 收起，故只断言存在、不要求可见。 */
    await expect(page.locator('.history-skeleton .history-timeline')).toHaveCount(1);
    await expect(page.locator('.history-skeleton .history-node-col')).toHaveCount(1);
    await expect(page.locator('.history-skeleton .history-group-body .history-grid')).toHaveCount(1);

    const cols = await readCols(page, '.history-skeleton .history-group-body .history-grid');
    expect(cols).toBe(await readToken(page, '--history-cols'));

    // 卡片数 = 列数 × 行数（整数行，末行完整）；至少 2 行（minRows）
    const cards = await page.locator('.history-skeleton .record-card').count();
    expect(cards % cols, `History 骨架卡数 ${cards} 不是列数 ${cols} 的整数倍`).toBe(0);
    expect(cards).toBeGreaterThanOrEqual(cols * 2);

    // 卡片内部结构与真实 RecordCard 同构：媒体区 + 标题 + 元信息
    await expect(page.locator('.history-skeleton .record-card__media').first()).toHaveCount(1);
    await expect(page.locator('.history-skeleton__title').first()).toHaveCount(1);
  });

  test('SKEL-012: Collections 骨架可见（gate 下沉后才有窗口），双分区与真实同判定', async ({ page }) => {
    await holdIndexedDB(page);
    await page.goto('/collections', { waitUntil: 'domcontentloaded' });

    const skeleton = page.locator('.collections-skeleton');
    await expect(skeleton).toBeVisible({ timeout: 10000 });

    // 默认 tab=all / status=all → 影视 + 直播两个分区（与真实页同判定，不是恒 2）
    await expect(page.locator('.collections-skeleton .collection-section')).toHaveCount(2);
    await expect(page.locator('.collections-skeleton .collection-section-head')).toHaveCount(2);

    // 影视网格 → --card-cols；直播网格 → --iptv-cols
    const videoCols = await readCols(page, '.collections-skeleton__video-grid');
    expect(videoCols).toBe(await readToken(page, '--card-cols'));
    const iptvCols = await readCols(page, '.collections-skeleton__iptv-grid');
    expect(iptvCols).toBe(await readToken(page, '--iptv-cols'));

    // 首屏的影视网格填满可视高度（整数行）；直播区在首屏之下按 2–3 行
    const videoCards = await page.locator('.collections-skeleton__video-grid .collections-skeleton__card').count();
    expect(videoCards % videoCols).toBe(0);
    expect(videoCards).toBeGreaterThanOrEqual(videoCols * 2);
    const iptvCards = await page.locator('.collections-skeleton__iptv-grid .collections-skeleton__card').count();
    expect(iptvCards).toBeGreaterThanOrEqual(iptvCols * 2);
    expect(iptvCards).toBeLessThanOrEqual(iptvCols * 3);
  });

  test('SKEL-013: Detail 骨架区块齐备（tabs/演员/简介/剧照/推荐区全在）', async ({ page }) => {
    await holdTmdb(page);
    /* id 格式是 `tmdb-<mediaType>-<tmdbId>`（Detail/index.tsx:381 拆 parts，parts[0] 必须是
       movie/tv，其余拼成数字 id）。两种错法各自的表现不同，都是白跑一轮：
         · `/detail/550`（无前缀）→ 落 `暂仅支持 TMDB 影片`，不请求 TMDB → 永无 loading 窗口；
         · `/detail/tmdb-550`（缺 mediaType）→ parts[0]='550' → parseInt('') = NaN →
           落 `无效的 TMDB ID`，同样不请求。 */
    await page.goto('/detail/tmdb-movie-550', { waitUntil: 'domcontentloaded' });

    const skeleton = page.locator('.detail-skeleton');
    await expect(skeleton).toBeVisible({ timeout: 10000 });

    // hero + 右栏信息卡（≥1024 两栏；窄屏右栏隐藏，故只断言存在）
    await expect(page.locator('.detail-skeleton__hero')).toHaveCount(1);
    await expect(page.locator('.detail-skeleton__side')).toHaveCount(1);
    await expect(page.locator('.detail-skeleton__chip')).toHaveCount(4);
    // grid 内 7 卡（评分已改全宽行）+ 3 条 side-line（评分/国家/发行）
    await expect(page.locator('.detail-skeleton__info-card')).toHaveCount(7);
    await expect(page.locator('.detail-skeleton__side .detail-skeleton__side-line')).toHaveCount(3);

    // tab 条复用真实 .tab-underline / .detail-tab（行盒与真实一致）
    await expect(page.locator('.detail-skeleton .tab-underline.detail-tab')).toHaveCount(2);

    // 概览内容：演员行（12 卡槽，复用真实 .detail-cast-item）/ 简介 3 行 / 剧照 6 张
    await expect(page.locator('.detail-cast-item.detail-skeleton__cast-item')).toHaveCount(12);
    await expect(page.locator('.detail-stills-grid .detail-stills-skeleton')).toHaveCount(6);
    await expect(page.locator('.detail-skeleton__overview')).toHaveCount(3);

    // 两个推荐区（相关推荐 / 你可能还喜欢），推荐卡复用真实 .video-card 壳
    await expect(page.locator('.detail-recommend.detail-skeleton__recommend')).toHaveCount(2);
    expect(await page.locator('.detail-skeleton__rec-card.video-card').count()).toBeGreaterThan(0);
    await expect(page.locator('.detail-skeleton__rec-card .video-card-cover')).toHaveCount(
      await page.locator('.detail-skeleton__rec-card.video-card').count(),
    );
  });

  test('SKEL-014: Browse 首屏 chrome 骨架（左栏/顶栏）+ 结果网格骨架', async ({ page }) => {
    await holdTmdb(page);
    await page.goto('/browse', { waitUntil: 'domcontentloaded' });

    /* 2026-09-23 用户需求：首次进入、接口未响应前，左栏筛选 + 顶栏排序条
       渲染 chrome 骨架（BrowseChromeSkeleton），真实筛选项不渲染；
       模式 tab（智能检索/直链搜索）不属筛选项，恒真实。 */
    await expect(page.locator('.browse-search-tab')).toHaveCount(2);

    const filterChrome = page.locator('.browse-chrome-skeleton--filters');
    const sortChrome = page.locator('.browse-chrome-skeleton--sort');
    await expect(filterChrome).toBeVisible({ timeout: 10000 });
    await expect(sortChrome).toBeVisible();

    // 真实筛选项在 chrome 骨架期不渲染（防「骨架 + 真实项」叠现回归）
    await expect(page.locator('.browse-sort-bar__type')).toHaveCount(0);
    await expect(page.locator('.browse-sort-bar__tab')).toHaveCount(0);
    await expect(page.locator('button.filter-bar__chip')).toHaveCount(0);

    // chrome 骨架 pill 数仍取同一份常量真源：CATEGORY_CONFIG = 7、SORT_OPTIONS = 3
    await expect(sortChrome.locator('.browse-chrome-skeleton__pill--type')).toHaveCount(7);
    await expect(sortChrome.locator('.browse-chrome-skeleton__pill--tab')).toHaveCount(3);
    await expect(sortChrome.locator('.browse-sort-bar__count')).toHaveCount(1);
    await expect(filterChrome.locator('.browse-chrome-skeleton__chip')).toHaveCount(6 + 8 + 8);
    // 旧镜像类不得复活
    await expect(page.locator('.browse-skeleton__type, .browse-skeleton__sort, .browse-skeleton__count')).toHaveCount(0);

    // 结果网格骨架与 chrome 骨架同帧并存（不同 grid-area）
    const skeleton = page.locator('.browse-skeleton');
    await expect(skeleton).toBeVisible({ timeout: 10000 });

    // 卡壳复用真实 .video-card：封面 + 四角标 + 标题行
    const cards = await page.locator('.browse-skeleton__card.video-card').count();
    expect(cards).toBeGreaterThan(0);
    await expect(page.locator('.browse-skeleton__card .video-card-cover')).toHaveCount(cards);
    await expect(page.locator('.browse-skeleton__badge')).toHaveCount(cards * 4);
    await expect(page.locator('.browse-skeleton__card .video-card-title-wrap')).toHaveCount(cards);

    // 列数 == --card-cols；卡片数 = 列数 × 行数
    const cols = await readCols(page, '.browse-skeleton__grid');
    expect(cols).toBe(await readToken(page, '--card-cols'));
    expect(cards % cols).toBe(0);
  });

  test('SKEL-015: 骨架行数随视口高度增长（填满可视容器，不写死行数）', async ({ page }) => {
    /* 窗口需覆盖「读卡数 → 改视口 → 轮询」全程，故给足 12s（断言本身 <2s） */
    await holdTmdb(page, 12000);
    await page.setViewportSize({ width: 1440, height: 720 });
    await page.goto('/person/128', { waitUntil: 'domcontentloaded' });

    const grid = page.locator('.person-skeleton__work-grid');
    await expect(grid).toBeVisible({ timeout: 10000 });
    const cols = await readCols(page, '.person-skeleton__work-grid');
    expect(cols).toBeGreaterThan(0);

    const shortCards = await page.locator('.person-skeleton__work').count();
    expect(shortCards % cols, `720 高时卡数 ${shortCards} 不是列数 ${cols} 的整数倍`).toBe(0);

    // 视口拉高 → 骨架必须多填几行（旧实现固定行数时这里恒等 → 失败）
    await page.setViewportSize({ width: 1440, height: 1440 });
    await expect
      .poll(() => page.locator('.person-skeleton__work').count(), { timeout: 8000 })
      .toBeGreaterThan(shortCards);

    const tallCards = await page.locator('.person-skeleton__work').count();
    expect(tallCards % cols, `1440 高时卡数 ${tallCards} 不是列数 ${cols} 的整数倍`).toBe(0);
  });
});

test.describe('启动骨架：播放页 shape（2026-09-18 新增）', () => {
  /** 主入口延迟放行，让 #boot-splash 稳定可见（手法同 boot-splash.spec.ts） */
  async function holdSplash(page: Page, path: string) {
    for (const pattern of ['**/src/main.tsx*', '**/assets/index-*.js']) {
      await page.route(pattern, async (route) => {
        await new Promise((r) => setTimeout(r, 2500));
        await route.continue();
      });
    }
    await page.goto(path, { waitUntil: 'commit' });
    /* 两段式启动骨架（2026-09-22）：第一段 plain 启动页是静态 HTML，readyState 离开
       'loading' 时第二段（延迟 PLAIN_MS 换形）尚未发生，读到的是 data-shape="plain" ——
       SKEL-016~018 曾靠「经典脚本同步执行」的时序假绿，现改等 [data-shape-ready]（第二段
       换形/构建/填充全完成才挂）；主模块被拦 ≥2.5s，覆盖 400ms 换形窗口无竞态。 */
    await page.waitForSelector('#boot-splash[data-shape-ready]', { state: 'attached' });
  }

  const playerPaths = ['/play', '/player', '/play/tmdb-550'];

  for (const [i, path] of playerPaths.entries()) {
    test(`SKEL-0${16 + i}: ${path} → shape=player（此前落 plain：无顶栏无内容）`, async ({ page }) => {
      await holdSplash(page, path);
      const m = await page.evaluate(() => {
        const splash = document.getElementById('boot-splash');
        return {
          shape: splash?.getAttribute('data-shape') ?? null,
          // 播放页有顶栏（在 AppLayout 内），且主播放区是 16:9 黑场
          hasHeader: !!splash?.querySelector('.bs-header'),
          hasStage: !!splash?.querySelector('.bs-player__stage'),
          tip: document.getElementById('bs-tip')?.textContent ?? '',
        };
      });
      expect(m.shape).toBe('player');
      expect(m.hasHeader).toBe(true);
      expect(m.hasStage).toBe(true);
      expect(m.tip).toBe('正在加载影片…');
    });
  }
});
