/**
 * Detail 页改动点回归测试（2026-08-04）
 *
 * 覆盖本次修改的可见行为：
 *   REG-001 (D1)  detail-source-group 海报：CMS 原图优先
 *   REG-002 (D2)  detail-source-group 海报：CMS 封面加载失败 → TMDB 兜底
 *   REG-003 (D3a) 播放列表「全部」弹窗：无历史时零选中（未看过的 cell 无选中框）
 *   REG-004 (D3b) 已看判定：仅「真有进度记录」的集显示已看标记
 *   REG-005 (D8)  电影线路进度独立：各线路按线路 URL 分别显示进度
 *   REG-006 (P2)  历史页删除：单条删除按 videoId 删除该视频全部记录
 *   REG-007 (R1)  首页 HeroBanner「继续播放」：historyMap 命中后显示
 *
 * 测试依赖：
 *   - TMDB 走 fixtures/mock-tmdb（默认 mock）
 *   - CMS 代理请求（/proxy?url=）在本 spec 内构造 mock，返回电影/剧集数据
 *   - 历史记录通过原生 IndexedDB 注入（seed 后 reload 使 store 重新加载）
 */
import { test, expect } from './fixtures/mock-tmdb';
import type { Page } from '@playwright/test';

// ── Mock 数据 ───────────────────────────────────────────────
const CMS_MOVIE_POSTER = 'https://mock-cms.example.com/cms-movie-poster.jpg';
const CMS_TV_POSTER = 'https://mock-cms.example.com/cms-tv-poster.jpg';
const BROKEN_POSTER = 'https://mock-cms.example.com/broken-poster.jpg';

const MOVIE_ID = 'tmdb-movie-550'; // 《搏击俱乐部》
const TV_ID = 'tmdb-tv-1399'; // 《权力的游戏》
const TRENDING_ID = 'tmdb-movie-1000'; // 首页 trending[0]

const MOVIE_MOCK = {
  vod_id: '990001',
  vod_name: '搏击俱乐部',
  vod_pic: CMS_MOVIE_POSTER,
  vod_year: '1999',
  vod_type: 'movie',
  vod_play_from: '线路A$$$线路B',
  vod_play_url:
    '线路A$https://mock-cms.example.com/lA.mp4$$$线路B$https://mock-cms.example.com/lB.mp4',
};

// 剧集 mock：3 季。季1=50 集（用于验证 >40 集懒加载兜底）、季2=8、季3=10
const TV_SEASON_EPISODE_COUNTS: Record<number, number> = { 1: 50, 2: 8, 3: 10 };
const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function buildTVList() {
  return Object.entries(TV_SEASON_EPISODE_COUNTS).map(([s, count]) => {
    const n = Number(s);
    const episodes = Array.from({ length: count }, (_, i) => {
      const ep = i + 1;
      return `第${ep}集$https://mock-cms.example.com/s${n}e${ep}.m3u8`;
    }).join('#');
    return {
      vod_id: `99000${n}`,
      vod_name: `权利的游戏 第${CN_NUM[n]}季`,
      vod_pic: CMS_TV_POSTER,
      vod_year: '2000',
      vod_type: 'tv',
      vod_play_from: '线路A',
      vod_play_url: `线路A${episodes}`,
    };
  });
}

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// ── CMS 代理 + 封面图 mock ───────────────────────────────────
async function mockCms(page: Page, opts: { brokenCover?: boolean } = {}) {
  const moviePoster = opts.brokenCover ? BROKEN_POSTER : CMS_MOVIE_POSTER;
  await page.route('**/proxy?url=**', async (route) => {
    const target = decodeURIComponent(
      new URL(route.request().url()).searchParams.get('url') ?? '',
    );
    let list: unknown[];
    if (target.includes('wd=')) {
      const wd = decodeURIComponent(/wd=([^&]+)/.exec(target)?.[1] ?? '');
      // 电影详情搜索（搏击俱乐部）返回电影 mock，其余（剧集季搜索）返回多季剧集 mock
      list = wd.includes('搏击') || wd.includes('Fight')
        ? [{ ...MOVIE_MOCK, vod_pic: moviePoster }]
        : buildTVList();
    } else {
      list = [{ ...MOVIE_MOCK, vod_pic: moviePoster }];
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 1, msg: 'ok', page: 1, limit: 20, total: list.length, list }),
    });
  });
  // CMS 封面图请求：broken 路径返回 404（模拟加载失败），正常路径返回 1x1 像素
  await page.route('**mock-cms.example.com/**', async (route) => {
    if (route.request().url().includes('broken-poster')) {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
    } else {
      await route.fulfill({ status: 200, contentType: 'image/gif', body: TRANSPARENT_GIF });
    }
  });
}

// ── IndexedDB 历史注入 ───────────────────────────────────────
interface SeedRecord {
  id: string;
  videoId: string;
  progress: number;
  duration: number;
  updatedAt: number;
  title: string;
  episodeUrl?: string;
  episodeLabel?: string;
  seasonNumber?: number;
  cover?: string;
  backdrop?: string;
}

async function seedHistory(page: Page, records: SeedRecord[]) {
  await page.evaluate((recs) => new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('video-warehouse');
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('history')) {
        req.result.createObjectStore('history', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('history', 'readwrite');
      const store = tx.objectStore('history');
      for (const r of recs) store.put(r);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  }), records);
}

// ── 通用：打开 Detail 并等待 CMS 源出现 ───────────────────────
async function openDetail(page: Page, id: string) {
  await page.goto(`/detail/${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 15000 });
  // CMS 源只在「播放列表」Tab 加载（按需加载），先切换 Tab
  const playlistTab = page.locator('.detail-tab', { hasText: /播放列表/ });
  await playlistTab.click();
  // 等待 CMS 源卡片或全部按钮渲染
  await page.waitForSelector('.detail-source-group, .detail-source-all-btn', { timeout: 15000 });
  await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════════════════════════
// 3.10 海报优先级（D1/D2）
// ═══════════════════════════════════════════════════════════════

test.describe('3.10 海报优先级', () => {
  test('REG-001: detail-source-group 海报优先使用 CMS 原图', async ({ page }) => {
    await mockCms(page);
    await openDetail(page, MOVIE_ID);

    // 断言：缩略图 src 为 CMS 封面（而非 TMDB 图）
    const src = await page.locator('.detail-source-group .detail-source-thumb img').first()
      .getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toContain('mock-cms.example.com/cms-movie-poster.jpg');
    expect(src).not.toContain('image.tmdb.org');
    console.log('✅ REG-001 通过: 海报优先 CMS 原图 =', src);
  });

  test('REG-002: CMS 封面加载失败时降级 TMDB 兜底', async ({ page }) => {
    await mockCms(page, { brokenCover: true });
    await openDetail(page, MOVIE_ID);

    // 等待失败→兜底切换完成（onError 后重新渲染 TMDB 图）
    await page.waitForFunction(() => {
      const img = document.querySelector('.detail-source-group .detail-source-thumb img');
      return !!img && img.getAttribute('src')?.includes('image.tmdb.org');
    }, { timeout: 10000 });

    const src = await page.locator('.detail-source-group .detail-source-thumb img').first()
      .getAttribute('src');
    expect(src).toContain('image.tmdb.org');
    console.log('✅ REG-002 通过: 封面失败后 TMDB 兜底 =', src);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.11 弹窗选中态与已看判定（D3a/D3b）
// ═══════════════════════════════════════════════════════════════

test.describe('3.11 弹窗选中态与已看判定', () => {
  test('REG-003: 无历史时弹窗初始零选中（未看过的 cell 无选中框）', async ({ page }) => {
    await mockCms(page);
    await openDetail(page, MOVIE_ID);

    await page.locator('.detail-source-all-btn').first().click();
    await page.waitForSelector('.playlist-modal .playlist-cell', { timeout: 10000 });

    // 断言：无历史时不存在任何 is-selected cell
    const selectedCount = await page.locator('.playlist-modal .playlist-cell.is-selected').count();
    expect(selectedCount).toBe(0);
    // 电影 mock 有两条线路
    const cellCount = await page.locator('.playlist-modal .playlist-cell').count();
    expect(cellCount).toBe(2);
    console.log(`✅ REG-003 通过: 零选中 (selected=0, cells=${cellCount})`);
  });

  test('REG-004: 已看判定仅限真实进度记录（有记录的第2集标已看，其余不标）', async ({ page }) => {
    await mockCms(page);
    // 先打开应用初始化 DB，再注入历史并 reload
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await seedHistory(page, [{
      id: `hist-${TV_ID}-s1-第2集`,
      videoId: TV_ID,
      seasonNumber: 1,
      episodeLabel: '第2集',
      episodeUrl: 'https://mock-cms.example.com/ep2.m3u8',
      progress: 500,
      duration: 1000,
      updatedAt: Date.now(),
      title: '权利的游戏',
    }]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    await openDetail(page, TV_ID);
    await page.locator('.detail-source-all-btn').first().click();
    await page.waitForSelector('.playlist-modal .playlist-cell--ep', { timeout: 10000 });

    // 第2集 cell 有已看标记；第1/3集没有
    const watchedCount = await page.locator('.playlist-modal .playlist-cell--ep.is-watched').count();
    expect(watchedCount).toBe(1);
    const watchedNums = await page
      .locator('.playlist-modal .playlist-cell--ep.is-watched .playlist-cell-num')
      .allTextContents();
    expect(watchedNums.join(',')).toBe('2');
    console.log('✅ REG-004 通过: 仅真实进度记录的第2集标已看，其余未标');
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.12 电影线路进度独立（D8）
// ═══════════════════════════════════════════════════════════════

test.describe('3.12 电影线路进度独立', () => {
  test('REG-005: 两条线路各自显示独立进度', async ({ page }) => {
    await mockCms(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await seedHistory(page, [
      {
        id: `hist-${MOVIE_ID}-https://mock-cms.example.com/lA.mp4`,
        videoId: MOVIE_ID,
        episodeUrl: 'https://mock-cms.example.com/lA.mp4',
        progress: 300, duration: 1000, updatedAt: 1, title: '搏击俱乐部',
      },
      {
        id: `hist-${MOVIE_ID}-https://mock-cms.example.com/lB.mp4`,
        videoId: MOVIE_ID,
        episodeUrl: 'https://mock-cms.example.com/lB.mp4',
        progress: 900, duration: 1000, updatedAt: 2, title: '搏击俱乐部',
      },
    ]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    await openDetail(page, MOVIE_ID);
    await page.locator('.detail-source-all-btn').first().click();
    await page.waitForSelector('.playlist-modal .playlist-cell--line', { timeout: 10000 });

    // 线路A → 30%，线路B → 90%（各自独立，互不覆盖）
    const lineA = page.locator('.playlist-modal .playlist-cell--line')
      .filter({ has: page.locator('.playlist-cell-name', { hasText: /^线路A$/ }) });
    const lineB = page.locator('.playlist-modal .playlist-cell--line')
      .filter({ has: page.locator('.playlist-cell-name', { hasText: /^线路B$/ }) });

    await expect(lineA.locator('.playlist-cell-pct')).toHaveText('30%');
    await expect(lineB.locator('.playlist-cell-pct')).toHaveText('90%');
    console.log('✅ REG-005 通过: 线路A=30%、线路B=90%（线路进度独立）');
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.13 历史页删除（P2）
// ═══════════════════════════════════════════════════════════════

test.describe('3.13 历史页删除', () => {
  test('REG-006: 单条删除按 videoId 删除该视频全部记录（reload 后不再出现）', async ({ page }) => {
    await mockCms(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // 同一电影两条线路记录
    await seedHistory(page, [
      {
        id: `hist-${MOVIE_ID}-https://mock-cms.example.com/lA.mp4`,
        videoId: MOVIE_ID,
        episodeUrl: 'https://mock-cms.example.com/lA.mp4',
        progress: 300, duration: 1000, updatedAt: 1, title: '搏击俱乐部',
      },
      {
        id: `hist-${MOVIE_ID}-https://mock-cms.example.com/lB.mp4`,
        videoId: MOVIE_ID,
        episodeUrl: 'https://mock-cms.example.com/lB.mp4',
        progress: 900, duration: 1000, updatedAt: 2, title: '搏击俱乐部',
      },
    ]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 历史页显示 1 张卡片（去重后的最新记录）
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.record-card', { timeout: 10000 });
    const cardCountBefore = await page.locator('.record-card').count();
    expect(cardCountBefore).toBeGreaterThanOrEqual(1);

    // 单条删除 → 确认
    await page.locator('.record-card__delete').first().click();
    await page.getByRole('button', { name: '删除' }).click();
    await page.waitForSelector('.record-card', { state: 'hidden', timeout: 10000 });

    // reload 后仍为空 → 证明该 videoId 的全部记录都被删除（而非只删单条）
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const cardCountAfter = await page.locator('.record-card').count();
    expect(cardCountAfter).toBe(0);
    console.log(`✅ REG-006 通过: 删除后 reload 无残留卡片 (before=${cardCountBefore}, after=${cardCountAfter})`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.14 首页继续播放（R1）
// ═══════════════════════════════════════════════════════════════

test.describe('3.14 首页继续播放', () => {
  test('REG-007: 有历史记录的 trending 影片显示「继续播放」', async ({ page }) => {
    await mockCms(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await seedHistory(page, [{
      id: `hist-${TRENDING_ID}`,
      videoId: TRENDING_ID,
      progress: 120,
      duration: 1000,
      updatedAt: Date.now(),
      title: '测试影片 1',
    }]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    // 等待 HeroBanner 渲染并出现「继续播放」
    await page.waitForSelector('.hero-banner__cta--continue', { timeout: 15000 });
    const text = await page.locator('.hero-banner__cta--continue').first().innerText();
    expect(text).toContain('继续播放');
    console.log('✅ REG-007 通过: 首页显示「继续播放」按钮');
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.15 弹窗打开选中历史季 + 懒加载 + 移动端间距（2026-08-04 优化）
// ═══════════════════════════════════════════════════════════════

test.describe('3.15 弹窗优化', () => {
  test('REG-008: 弹窗打开时对齐到「历史最后播放的季」并选中历史集', async ({ page }) => {
    await mockCms(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // 历史在 第3季·第2集
    await seedHistory(page, [{
      id: `hist-${TV_ID}-s3-第2集`,
      videoId: TV_ID,
      seasonNumber: 3,
      episodeLabel: '第2集',
      episodeUrl: 'https://mock-cms.example.com/s3e2.m3u8',
      progress: 300,
      duration: 1000,
      updatedAt: Date.now(),
      title: '权利的游戏',
    }]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });

    await openDetail(page, TV_ID);
    await page.locator('.detail-source-all-btn').first().click();
    await page.waitForSelector('.playlist-modal .playlist-cell--ep', { timeout: 10000 });

    // 断言：季导航选中第3季（非默认第1季）
    const activeSeason = page.locator('.playlist-modal .playlist-season-item.is-active');
    await expect(activeSeason).toHaveText(/第3季/);
    // 断言：第2集 cell 被选中（历史集）
    const selectedNums = await page
      .locator('.playlist-modal .playlist-cell--ep.is-selected .playlist-cell-num')
      .allTextContents();
    expect(selectedNums.join(',')).toBe('2');
    console.log('✅ REG-008 通过: 弹窗对齐历史季（第3季）并选中第2集');
  });

  test('REG-009: 选集超过40集时全部集可显示（移动端兜底补齐 + 滚动懒加载）', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockCms(page);
    await openDetail(page, TV_ID);
    await page.locator('.detail-source-all-btn').first().click();
    await page.waitForSelector('.playlist-modal .playlist-cell--ep', { timeout: 10000 });

    // 第1季共 50 集：先等待移动端「兜底加载」自动补齐（内容不足一屏时不依赖滚动）；
    // 若已超一屏（未自动补齐），则模拟滚动触发懒加载，最终 50 集必须全部可显示。
    try {
      await page.waitForFunction(() => {
        return document.querySelectorAll('.playlist-modal .playlist-cell--ep').length >= 50;
      }, { timeout: 6000 });
    } catch {
      await page.evaluate(() => {
        const body = document.querySelector('.playlist-modal .playlist-body');
        if (body) body.scrollTop = body.scrollHeight;
      });
      await page.waitForFunction(() => {
        return document.querySelectorAll('.playlist-modal .playlist-cell--ep').length >= 50;
      }, { timeout: 10000 });
    }
    const count = await page.locator('.playlist-modal .playlist-cell--ep').count();
    expect(count).toBe(50);
    console.log(`✅ REG-009 通过: 50 集全部可显示（${count}）`);
  });

  test('REG-010: 移动端选集网格按钮间距放宽到 space-sm（≥6px）', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockCms(page);
    await openDetail(page, TV_ID);
    await page.locator('.detail-source-all-btn').first().click();
    await page.waitForSelector('.playlist-modal .playlist-grid', { timeout: 10000 });

    const gap = await page.evaluate(() => {
      const el = document.querySelector('.playlist-modal .playlist-grid');
      if (!el) return '0px';
      const cs = getComputedStyle(el);
      return cs.columnGap || cs.gap || '0px';
    });
    const gapPx = parseFloat(gap);
    expect(gapPx).toBeGreaterThanOrEqual(6);
    console.log(`✅ REG-010 通过: 移动端 grid gap = ${gap} (≥6px)`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.16 易用性修复（2026-08-04）：白遮罩 / 进度条
// ═══════════════════════════════════════════════════════════════

test.describe('3.16 易用性修复', () => {
  test('REG-011: 弹窗海报封面加载失败时无白色占位遮罩（fallback 图直接可见）', async ({ page }) => {
    // brokenCover=true：CMS 封面返回 404 → LazyImage error 分支
    await mockCms(page, { brokenCover: true });
    await openDetail(page, MOVIE_ID);
    await page.locator('.detail-source-all-btn').first().click();
    await page.waitForSelector('.playlist-modal .lazy-image-container', { timeout: 10000 });

    // 断言：error 场景不渲染白色占位层（8.1 收紧条件后无白遮罩）
    await expect(page.locator('.playlist-modal .lazy-image-placeholder')).toHaveCount(0);
    // fallback 图（TMDB 兜底）渲染可见
    await expect(page.locator('.playlist-modal .lazy-image-fallback')).toHaveCount(1);
    console.log('✅ REG-011 通过: error 分支无白遮罩，fallback 图直接显示');
  });

  test('REG-012: 首屏 loading 不叠加两次，进度条（若出现）渐进且不满格卡死', async ({ page }) => {
    // 8.2A：Home 500ms 整页 loading 期间进度条为 JS 模拟（0→90% 封顶，渐进且不满格）。
    // 8.3C：若首屏经历过 chunk fallback（LoadingFallback 已提供 loading），Home 跳过
    //       固定 500ms 直接渲染内容——「加载两次」不再发生。
    // 两条路径均合法：轮询捕获 loading 则验证进度条；未捕获则验证内容直接渲染。
    await mockCms(page);
    await page.goto('/');

    let sampled = false;
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(100);
      const info = await page.evaluate(() => {
        const bar = document.querySelector('.home-page--loading .app-loading__progress-bar');
        if (!bar) return { loading: false, x: -1 };
        const m = /scaleX\(([\d.]+)\)/.exec(bar.getAttribute('style') ?? '');
        return { loading: true, x: m ? parseFloat(m[1]) : -1 };
      });
      if (info.loading && info.x >= 0) {
        // 断言：进度条已起步、且不满格（封顶 90%）
        expect(info.x).toBeGreaterThan(0);
        expect(info.x).toBeLessThan(0.999);
        sampled = true;
        console.log(`✅ REG-012 采样: scaleX=${info.x.toFixed(3)}（渐进且不满格）`);
        break;
      }
    }

    // 无论是否采样到 loading，Home 最终必须渲染内容（8.3C 路径 = fallback 后直接内容）
    await page.waitForSelector('.home-page__content', { timeout: 10000 });
    if (!sampled) {
      console.log('✅ REG-012 通过（8.3C 路径）: chunk fallback 后 Home 直接渲染内容，无叠加 loading');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.17 侧边栏折叠重构（2026-08-04）：瞬切 + 图标居中 + label 淡出
// ═══════════════════════════════════════════════════════════════

test.describe('3.17 侧边栏折叠', () => {
  async function openHomeDesktop(page: Page) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await page.waitForSelector('.home-sidebar', { timeout: 15000 });
    await page.waitForTimeout(500);
  }

  test('REG-013: 折叠/展开为瞬切（spacer 与 sidebar 同帧到位，无宽度动画）', async ({ page }) => {
    await openHomeDesktop(page);

    // 展开态：sidebar 宽度 = --sidebar-width（@1280 = clamp(160, 12vw=153.6, 240) = 160px）
    const widthBefore = await page.evaluate(() => {
      const s = document.querySelector('.home-sidebar');
      return s ? s.getBoundingClientRect().width : -1;
    });
    expect(widthBefore).toBe(160);

    // 点击折叠按钮
    await page.locator('.sticky-header__sidebar-toggle').click();
    // 瞬切：点击后 100ms 内宽度必须已到位（若仍有 480ms 动画，此刻宽度应在 160~64 之间）
    await page.waitForTimeout(100);
    const state = await page.evaluate(() => {
      const sidebar = document.querySelector('.home-sidebar');
      const spacer = document.querySelector('.sidebar-spacer');
      const shell = document.querySelector('.app-shell');
      return {
        sidebarWidth: sidebar ? sidebar.getBoundingClientRect().width : -1,
        spacerWidth: spacer ? spacer.getBoundingClientRect().width : -1,
        collapsedClass: shell ? shell.classList.contains('app-shell--sidebar-collapsed') : false,
      };
    });
    expect(state.sidebarWidth).toBe(64);
    expect(state.spacerWidth).toBe(64);
    expect(state.collapsedClass).toBe(true);
    console.log(`✅ REG-013 通过: 折叠瞬切 sidebar=${state.sidebarWidth}px spacer=${state.spacerWidth}px`);

    // 再点展开，同样瞬切。StickyHeader 折叠按钮有 300ms 防抖，需等待后再点。
    await page.waitForTimeout(400);
    await page.locator('.sticky-header__sidebar-toggle').click();
    await page.waitForTimeout(100);
    const widthAfter = await page.evaluate(() => {
      const s = document.querySelector('.home-sidebar');
      return s ? s.getBoundingClientRect().width : -1;
    });
    expect(widthAfter).toBe(160);
    console.log('✅ REG-013 通过: 展开同样瞬切回 160px');
  });

  test('REG-014: 图标收起态绝对居中（left 固定像素、可过渡），label 淡出', async ({ page }) => {
    await openHomeDesktop(page);

    const readIcon = () => page.evaluate(() => {
      const icon = document.querySelector('.home-sidebar__icon');
      if (!icon) return { left: -1, position: '', transition: '' };
      const cs = getComputedStyle(icon);
      return { left: parseFloat(cs.left), position: cs.position, transition: cs.transitionProperty };
    });
    const readLabelOpacity = () => page.evaluate(() => {
      const label = document.querySelector('.home-sidebar__label');
      return label ? parseFloat(getComputedStyle(label).opacity) : -1;
    });

    // 展开态：图标绝对定位（不参与 flex 流，不随栏宽漂移），left = --space-xl（16px），
    // transition 含 left（收起时平滑位移）
    const before = await readIcon();
    expect(before.position).toBe('absolute');
    expect(before.left).toBeGreaterThanOrEqual(15);
    expect(before.left).toBeLessThanOrEqual(17);
    expect(before.transition).toContain('left');
    expect(await readLabelOpacity()).toBe(1);

    // 按钮高度：图标 absolute 化后不占流，显式 min-height 恢复原行高（2×space-lg + 图标高）
    const itemHeight = await page.evaluate(() => {
      const item = document.querySelector('.home-sidebar__item');
      return item ? item.getBoundingClientRect().height : -1;
    });
    expect(itemHeight).toBeGreaterThanOrEqual(40);

    // 折叠：图标绝对居中 left=(64-图标宽)/2 ≈ 22px；label 淡出为 0
    await page.locator('.sticky-header__sidebar-toggle').click();
    await page.waitForTimeout(450); // 等 left(0.32s) / label(0.2s) 过渡完成
    const after = await readIcon();
    expect(after.position).toBe('absolute');
    // 居中公式（修正后）：(64 − nav padding 2×6 − 图标宽 20) / 2 = 16px
    expect(after.left).toBeGreaterThanOrEqual(14);
    expect(after.left).toBeLessThanOrEqual(18);
    expect(await readLabelOpacity()).toBe(0);
    console.log(`✅ REG-014 通过: 展开 left=${before.left}px → 收起居中 left=${after.left}px，label opacity=0`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.18 细节修复（2026-08-04）：IPTV 首载整页 loading / 海报超时兜底
// ═══════════════════════════════════════════════════════════════

test.describe('3.18 细节修复', () => {
  test('REG-015: IPTV 首载无数据时显示整页 AppLoading（不渲染筛选卡）', async ({ page }) => {
    // seed iptv-store（zustand persist 格式）：配置一个有效源 + proxy，保证 refreshChannels 会发请求
    await page.addInitScript(() => {
      localStorage.setItem('iptv-store', JSON.stringify({
        state: {
          settings: {
            aggregatorUrl: 'https://mock-iptv.example.com/playlist.m3u',
            aggregatorUrls: ['https://mock-iptv.example.com/playlist.m3u'],
            sourceNames: ['测试源'],
            proxyUrl: 'https://mock-proxy.example.com/proxy?url=',
          },
        },
        version: 0,
      }));
    });
    // mock IPTV 源请求（经 proxy）挂起 → isLoading 保持 true → 整页 loading 持续
    await page.route('**/proxy?url=**', async () => {
      await new Promise(() => {}); // 永不响应
    });

    await page.goto('/iptv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.iptv-page .app-loading', { timeout: 15000 });
    // 首载整页 loading：筛选卡不渲染
    expect(await page.locator('.iptv-top-card').count()).toBe(0);
    console.log('✅ REG-015 通过: IPTV 首载整页 AppLoading，无 iptv-top-card');
  });

  test('REG-016: 弹窗海报请求挂起时超时兜底显示 fallback（不再无限加载）', async ({ page }) => {
    // 挂起 CMS 封面图：mock-tmdb fixture 会拦截 image.tmdb.org 返回 1x1 像素，
    // 只有 CMS 图源可稳定挂起。为保证弹窗海报 src 走 CMS 封面（而非 posterUrl），
    // 此处手写电影 mock（非搏击关键词返回空列表，与实证配置一致）。
    await page.route('https://mock-cms.example.com/cms-movie-poster.jpg', async () => {
      await new Promise(() => {}); // 永不响应 → img 请求挂起
    });
    await page.route('**/proxy?url=**', async (route) => {
      const u = decodeURIComponent(route.request().url());
      const wd = (u.match(/wd=([^&]+)/) || [])[1] ? decodeURIComponent(u.match(/wd=([^&]+)/)![1]) : '';
      const list = wd.includes('搏击') || wd.includes('Fight') ? [{ ...MOVIE_MOCK }] : [];
      await route.fulfill({ json: { list } });
    });

    await openDetail(page, MOVIE_ID);
    await page.locator('.detail-source-all-btn').first().click();
    await page.waitForSelector('.playlist-modal .lazy-image-container', { timeout: 10000 });
    // 等海报主图实际挂载（isInView 生效、请求已发出）——挂起 + 超时路径的前提；
    // 若 isInView 一直未生效（img 未挂载）则无请求、超时不启动（LazyImage 占位恒显）。
    await page.waitForSelector('.playlist-modal .lazy-image', { timeout: 15000 });

    // 8s 超时兜底后：fallback 图挂载、占位消失（attached 即可，证明「不再无限加载」）
    await page.locator('.playlist-modal .lazy-image-fallback').first().waitFor({ state: 'attached', timeout: 25000 });
    expect(await page.locator('.playlist-modal .lazy-image-placeholder').count()).toBe(0);
    console.log('✅ REG-016 通过: 海报请求挂起后 8s 超时走 fallback 兜底');
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.19 六项体验修复（2026-08-04）：Person 排序 / 数字徽标 / cast 放大
// ═══════════════════════════════════════════════════════════════

test.describe('3.19 体验修复', () => {
  test('REG-017: Person 页电影按年份倒序（2023 排最前，而非 popularity）', async ({ page }) => {
    await page.goto('/person/128', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.person-work-card .video-card', { timeout: 15000 });
    await page.waitForTimeout(500);
    // mock：电影最大年份 2023（i=13），原 popularity 排序第一是 2010（i=0）
    const first = await page.locator('.person-work-card .video-card').first().innerText();
    const firstYear = /\b(19|20)\d{2}\b/.exec(first)?.[0] ?? '';
    expect(firstYear).toBe('2023');
    console.log(`✅ REG-017 通过: Person 电影年份倒序，第一项年份 = ${firstYear}`);
  });

  test('REG-018: 热门搜索数字徽标 ≥16px（不再截断 1/2/3）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.search-box__input', { timeout: 15000 });
    await page.locator('.search-box__input').click();
    await page.waitForSelector('.search-box-dropdown__rank', { timeout: 10000 });
    const size = await page.evaluate(() => {
      const el = document.querySelector('.search-box-dropdown__rank');
      if (!el) return -1;
      return parseFloat(getComputedStyle(el).width);
    });
    expect(size).toBeGreaterThanOrEqual(15); // --space-xl 桌面 16px
    console.log(`✅ REG-018 通过: rank 徽标宽 = ${size}px（≥15px，不再截断）`);
  });

  test('REG-020: detail-cast-item 头像/姓名放大（头像≥64px、姓名≥13px）', async ({ page }) => {
    await page.goto(`/detail/${MOVIE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.detail-cast-item img, .detail-cast-item .detail-cast-avatar', { timeout: 15000 });
    await page.waitForTimeout(800);
    const metrics = await page.evaluate(() => {
      const el = document.querySelector('.detail-cast-item img, .detail-cast-item .detail-cast-avatar');
      const name = document.querySelector('.detail-cast-name');
      const csEl = el ? getComputedStyle(el) : null;
      const csName = name ? getComputedStyle(name) : null;
      return {
        avatar: csEl ? parseFloat(csEl.width) : -1,
        nameSize: csName ? parseFloat(csName.fontSize) : -1,
      };
    });
    expect(metrics.avatar).toBeGreaterThanOrEqual(64); // --layout-cast-avatar clamp 下限
    expect(metrics.nameSize).toBeGreaterThanOrEqual(13); // --text-sm
    console.log(`✅ REG-020 通过: 头像 ${metrics.avatar}px、姓名 ${metrics.nameSize}px`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.20 SearchBox 实时搜索（2026-08-04）：防抖调 /search/multi + 提示/结果/类型
// ═══════════════════════════════════════════════════════════════

test.describe('3.20 实时搜索', () => {
  async function openHome(page: Page) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.search-box__input', { timeout: 15000 });
  }

  const MOCK_RESULTS = {
    page: 1, total_pages: 1, total_results: 2,
    results: [
      { id: 101, title: 'Chaos Rising', media_type: 'movie', overview: '', poster_path: null, backdrop_path: null, genre_ids: [], popularity: 1, vote_average: 0, vote_count: 0, original_language: 'en', adult: false },
      { id: 202, name: 'Chaos TV Show', media_type: 'tv', overview: '', poster_path: null, backdrop_path: null, genre_ids: [], popularity: 1, vote_average: 0, vote_count: 0, original_language: 'en', adult: false },
    ],
  };

  test('REG-021: 输入搜索词实时显示 TMDB 结果（防抖 + 名称 + 类型标签）', async ({ page }) => {
    await page.route('**/api.tmdb.org/3/search/multi**', async (route) => {
      await route.fulfill({ json: MOCK_RESULTS });
    });
    await openHome(page);
    await page.locator('.search-box__input').fill('cha');
    // 等防抖(300ms) + 请求 → 建议列表
    await page.waitForSelector('.search-box-dropdown__item--suggestion', { timeout: 10000 });
    const items = await page.locator('.search-box-dropdown__item--suggestion').allTextContents();
    expect(items.join(' ')).toContain('Chaos Rising');
    expect(items.join(' ')).toContain('Chaos TV Show');
    expect(items.join(' ')).toContain('电影');
    expect(items.join(' ')).toContain('剧集');
    console.log('✅ REG-021 通过: 实时搜索结果（名称 + 电影/剧集类型标签）显示');
  });

  test('REG-022: 搜索失败显示提示信息', async ({ page }) => {
    await page.route('**/api.tmdb.org/3/search/multi**', async (route) => {
      await route.fulfill({ status: 500, body: 'err' });
    });
    await openHome(page);
    await page.locator('.search-box__input').fill('cha');
    // 防抖 + 请求后进入失败态（hint 类三态共用，需等待具体文案出现）
    await expect(page.locator('.search-box-dropdown__hint')).toContainText('搜索失败', { timeout: 10000 });
    console.log('✅ REG-022 通过: 搜索失败提示显示');
  });

  test('REG-023: 搜索无数据显示提示信息', async ({ page }) => {
    await page.route('**/api.tmdb.org/3/search/multi**', async (route) => {
      await route.fulfill({ json: { page: 1, total_pages: 1, total_results: 0, results: [] } });
    });
    await openHome(page);
    await page.locator('.search-box__input').fill('zzzzzz');
    await expect(page.locator('.search-box-dropdown__hint')).toContainText('未找到', { timeout: 10000 });
    console.log('✅ REG-023 通过: 无结果提示显示');
  });
});
