/**
 * continueItems 单元测试（H-1「继续观看」数据构建）
 *
 * 覆盖：进度过滤（≤0 / ≥90% 已看完）、同 videoId 取最新、
 *      排序（updatedAt 倒序）、数量上限、overlayLabel 拼接。
 */
import { describe, it, expect } from 'vitest';
import { buildContinueItems, latestByVideoId } from './continueItems';

function rec(partial: Partial<Parameters<typeof buildContinueItems>[0][number]> & { id: string; progress: number; duration: number; updatedAt: number }) {
  return {
    videoId: `tmdb-movie-${partial.id}`,
    title: `影片${partial.id}`,
    cover: `http://img/${partial.id}.jpg`,
    ...partial,
  };
}

describe('latestByVideoId', () => {
  it('同 videoId 多条记录只保留 updatedAt 最新一条', () => {
    const list = [
      rec({ id: 'a', progress: 10, duration: 100, updatedAt: 100 }),
      rec({ id: 'a', progress: 50, duration: 100, updatedAt: 300 }),
      rec({ id: 'a', progress: 80, duration: 100, updatedAt: 200 }),
    ];
    const map = latestByVideoId(list);
    expect(map.get('tmdb-movie-a')?.progress).toBe(50);
  });

  it('progress <= 0 的记录不进入 map', () => {
    const list = [rec({ id: 'a', progress: 0, duration: 100, updatedAt: 100 })];
    expect(latestByVideoId(list).size).toBe(0);
  });
});

describe('buildContinueItems', () => {
  it('已看完（≥90%）与无进度记录被排除', () => {
    const list = [
      rec({ id: 'done', progress: 95, duration: 100, updatedAt: 100 }), // 95% → 排除
      rec({ id: 'no-progress', progress: 0, duration: 100, updatedAt: 200 }), // 0 → 排除
      rec({ id: 'ok', progress: 30, duration: 100, updatedAt: 300 }), // 30% → 保留
    ];
    const items = buildContinueItems(list);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('tmdb-movie-ok');
  });

  it('按 updatedAt 倒序排序', () => {
    const list = [
      rec({ id: 'old', progress: 10, duration: 100, updatedAt: 100 }),
      rec({ id: 'new', progress: 20, duration: 100, updatedAt: 500 }),
      rec({ id: 'mid', progress: 30, duration: 100, updatedAt: 300 }),
    ];
    const items = buildContinueItems(list);
    expect(items.map((i) => i.id)).toEqual(['tmdb-movie-new', 'tmdb-movie-mid', 'tmdb-movie-old']);
  });

  it('同 videoId 多条只取最新（不重复）', () => {
    // 两条记录同 videoId 但 id 不同（真实历史：同剧多条按 videoId 去重取最新）
    const list = [
      { ...rec({ id: 'a', progress: 10, duration: 100, updatedAt: 100 }), id: 'hist-old', videoId: 'tmdb-movie-a' },
      { ...rec({ id: 'a', progress: 50, duration: 100, updatedAt: 300 }), id: 'hist-new', videoId: 'tmdb-movie-a' },
    ];
    const items = buildContinueItems(list);
    expect(items).toHaveLength(1);
    expect(items[0].progress).toBe(50);
  });

  it('数量上限 max', () => {
    const list = Array.from({ length: 20 }).map((_, i) =>
      rec({ id: `v${i}`, progress: 10, duration: 100, updatedAt: i }),
    );
    const items = buildContinueItems(list, 12);
    expect(items).toHaveLength(12);
  });

  it('overlayLabel 拼接 CMS 源名 + 季集', () => {
    const list = [
      rec({
        id: 'a', progress: 10, duration: 100, updatedAt: 1,
        cmsSourceName: '量子资源', seasonNumber: 2, episodeLabel: '第5集',
      }),
    ];
    const items = buildContinueItems(list);
    expect(items[0].overlayLabel).toBe('量子资源 · 2季第5集');
  });

  it('无 cmsSourceName 时 overlayLabel 仅季集', () => {
    const list = [rec({ id: 'a', progress: 10, duration: 100, updatedAt: 1, seasonNumber: 1, episodeLabel: '第3集' })];
    const items = buildContinueItems(list);
    expect(items[0].overlayLabel).toBe('1季第3集');
  });

  it('backdrop 缺省时回退 cover', () => {
    const list = [rec({ id: 'a', progress: 10, duration: 100, updatedAt: 1 })];
    const items = buildContinueItems(list);
    expect(items[0].backdrop).toBe(`http://img/a.jpg`);
  });

  it('tv 类型推断（videoId 含 -tv-）', () => {
    const tv = buildContinueItems([
      { id: 'tmdb-tv-9', videoId: 'tmdb-tv-9', progress: 10, duration: 100, updatedAt: 1, title: '剧', cover: 'c', backdrop: 'b' },
    ]);
    expect(tv[0].type).toBe('tv');
    const movie = buildContinueItems([
      { id: 'tmdb-movie-9', videoId: 'tmdb-movie-9', progress: 10, duration: 100, updatedAt: 1, title: '影', cover: 'c', backdrop: 'b' },
    ]);
    expect(movie[0].type).toBe('movie');
  });
});
