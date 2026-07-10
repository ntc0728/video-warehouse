import { describe, it, expect } from 'vitest';
import { buildCmsSeasons } from './videoService';
import type { Video } from '@/types/video';

const makeVideo = (title: string, episodeCount: number): Video => ({
  id: `v-${title}`,
  title,
  cover: '',
  type: 'tv',
  tags: [],
  actors: [],
  sources: [],
  episodes: Array.from({ length: episodeCount }, (_, i) => ({
    id: `ep-${i + 1}`,
    vodId: `vod-${i + 1}`,
    url: `https://example.com/e${i + 1}.m3u8`,
    title: `第${i + 1}集`,
    number: i + 1,
    sources: [],
  })),
  createdAt: 0,
  updatedAt: 0,
});

describe('buildCmsSeasons', () => {
  it('将 seasonMap 转换为 PlayerSeasonPanel 格式', () => {
    const seasonMap = new Map([
      [1, makeVideo('第一季', 20)],
      [2, makeVideo('第二季', 24)],
    ]);
    const result = buildCmsSeasons(seasonMap);
    expect(result).toEqual([
      { season_number: 1, name: '第1季', episode_count: 20 },
      { season_number: 2, name: '第2季', episode_count: 24 },
    ]);
  });

  it('空 map 返回空数组', () => {
    expect(buildCmsSeasons(new Map())).toEqual([]);
  });

  it('单季返回单元素数组', () => {
    const seasonMap = new Map([[3, makeVideo('第三季', 12)]]);
    const result = buildCmsSeasons(seasonMap);
    expect(result).toHaveLength(1);
    expect(result[0].season_number).toBe(3);
  });
});
