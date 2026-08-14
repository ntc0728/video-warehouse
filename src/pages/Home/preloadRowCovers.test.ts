/**
 * preloadRowCovers 单元测试
 *
 * 覆盖：首屏可见范围估算（行数/列数）、URL 收集（w342 src + w185 srcSet 候选、去重、上限）、
 *      预加载超时兜底与 session 缓存写入。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectRowCoverUrls, preloadRowCovers, ROW_COVER_PRELOAD_TIMEOUT, MAX_PRELOAD_URLS } from './preloadRowCovers';

vi.mock('@/components/LazyImage/imageCache', () => ({
  markImageLoaded: vi.fn(),
  isImageLoaded: vi.fn(() => false),
  clearImageCache: vi.fn(),
}));
import { markImageLoaded } from '@/components/LazyImage/imageCache';

function rowItem(id: number, posterPath?: string | null) {
  return {
    tmdbId: id,
    id: `tmdb-movie-${id}`,
    title: `影片${id}`,
    cover: posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : '',
    type: 'movie' as const,
    tags: [],
    voteAverage: 0,
    voteCount: 0,
    mediaType: 'movie' as const,
    posterPath,
    popularity: 0,
    genreIds: [],
  };
}

describe('collectRowCoverUrls', () => {
  it('桌面视口：只收集首屏可见行 × 可见卡数 + 2 缓冲（不越界）', () => {
    const rows = Array.from({ length: 7 }, (_, r) => ({
      items: Array.from({ length: 20 }, (_, c) => rowItem(r * 100 + c, `/p${r}_${c}.jpg`)),
    }));
    // 桌面 1440×900：卡宽 ~12vw=173px → 可见 1440/173≈8 + 2 缓冲 = 11 列；行高 ~320px → 可见 900/320≈2.8 → 3 行
    const urls = collectRowCoverUrls(rows, { width: 1440, height: 900 });
    // 每行 11 列 × 2 尺寸 = 22 URL，3 行 = 66，但总上限 48
    expect(urls.length).toBeLessThanOrEqual(MAX_PRELOAD_URLS);
    // 每行前 N 个 poster 都应出现（w342 + w185）
    expect(urls).toContain('https://image.tmdb.org/t/p/w342/p0_0.jpg');
    expect(urls).toContain('https://image.tmdb.org/t/p/w185/p0_0.jpg');
    // 超出可见列的 index 11（第 12 个）不应出现
    expect(urls).not.toContain('https://image.tmdb.org/t/p/w342/p0_11.jpg');
  });

  it('移动视口：33vw 卡宽 → 更少列、更少行', () => {
    const rows = Array.from({ length: 7 }, (_, r) => ({
      items: Array.from({ length: 20 }, (_, c) => rowItem(r * 100 + c, `/p${r}_${c}.jpg`)),
    }));
    // 移动 390×844：卡宽 33vw=129px → 可见 390/129≈3 + 2 缓冲 = 5~6 列；行高 ~238px → 可见 844/238≈3.5 → 4 行
    const urls = collectRowCoverUrls(rows, { width: 390, height: 844 });
    expect(urls.length).toBeLessThanOrEqual(MAX_PRELOAD_URLS);
    expect(urls).toContain('https://image.tmdb.org/t/p/w342/p0_0.jpg');
    // 缓冲之外的第 7 列（index 6）不出现
    expect(urls).not.toContain('https://image.tmdb.org/t/p/w342/p0_6.jpg');
  });

  it('posterPath 为 null / 空的行项被跳过', () => {
    const rows = [{ items: [rowItem(1, null), rowItem(2, ''), rowItem(3, '/p3.jpg')] }];
    const urls = collectRowCoverUrls(rows, { width: 1440, height: 900 });
    expect(urls).toHaveLength(2); // 仅 p3 的 w342 + w185
  });

  it('空行 / 空数组返回 []', () => {
    expect(collectRowCoverUrls([], { width: 1440, height: 900 })).toEqual([]);
    expect(collectRowCoverUrls([{ items: [] }], { width: 1440, height: 900 })).toEqual([]);
  });

  it('同一 posterPath 去重（不重复收集）', () => {
    const rows = [{ items: [rowItem(1, '/dup.jpg'), rowItem(2, '/dup.jpg')] }];
    const urls = collectRowCoverUrls(rows, { width: 1440, height: 900 });
    expect(urls.filter((u) => u.endsWith('w342/dup.jpg'))).toHaveLength(1);
    expect(urls.filter((u) => u.endsWith('w185/dup.jpg'))).toHaveLength(1);
  });
});

describe('preloadRowCovers', () => {
  const realImage = globalThis.Image;

  beforeEach(() => {
    // mock Image：src 赋值后立即触发 onload（同步完成，无需真实网络）
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(v: string) {
        this._src = v;
        queueMicrotask(() => this.onload?.());
      }
      get src(): string {
        return this._src;
      }
    }
    // @ts-expect-error test mock
    globalThis.Image = MockImage;
  });

  afterEach(() => {
    globalThis.Image = realImage;
    vi.restoreAllMocks();
  });

  it('全部加载成功 → 写入 session 缓存 → resolve', async () => {
    vi.mocked(markImageLoaded).mockClear();
    const rows = [{ items: [rowItem(1, '/a.jpg'), rowItem(2, '/b.jpg')] }];
    await preloadRowCovers(rows, { width: 1440, height: 900 });
    expect(markImageLoaded).toHaveBeenCalledWith('https://image.tmdb.org/t/p/w342/a.jpg');
    expect(markImageLoaded).toHaveBeenCalledWith('https://image.tmdb.org/t/p/w185/a.jpg');
    expect(markImageLoaded).toHaveBeenCalledWith('https://image.tmdb.org/t/p/w342/b.jpg');
  });

  it('空行立即 resolve，不写缓存', async () => {
    vi.mocked(markImageLoaded).mockClear();
    await preloadRowCovers([], { width: 1440, height: 900 });
    expect(markImageLoaded).not.toHaveBeenCalled();
  });

  it('超时兜底：挂起图片（无 onload/onerror）在 ROW_COVER_PRELOAD_TIMEOUT 后 resolve', async () => {
    vi.useFakeTimers();
    class HangingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';
    }
    // @ts-expect-error test mock
    globalThis.Image = HangingImage;
    const rows = [{ items: [rowItem(1, '/hang.jpg')] }];
    const p = preloadRowCovers(rows, { width: 1440, height: 900 }, ROW_COVER_PRELOAD_TIMEOUT);
    let resolved = false;
    p.then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(ROW_COVER_PRELOAD_TIMEOUT + 10);
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });
});
