import { describe, it, expect } from 'vitest';
import { findEpisodeByNumber } from './videoService';
import type { Episode } from '@/types/video';

const makeEp = (number: number, title?: string): Episode => ({
  id: `ep-${number}`,
  title: title ?? `第${number}集`,
  number,
  sources: [{ id: 's1', name: '默认', url: `https://example.com/e${number}.m3u8`, type: 'm3u8' }],
});

describe('findEpisodeByNumber', () => {
  it('按集号精确匹配', () => {
    const episodes = [makeEp(1), makeEp(2), makeEp(3)];
    const result = findEpisodeByNumber(episodes, 2);
    expect(result?.number).toBe(2);
    expect(result?.id).toBe('ep-2');
  });

  it('集号不存在时返回 undefined', () => {
    const episodes = [makeEp(1), makeEp(2), makeEp(3)];
    const result = findEpisodeByNumber(episodes, 10);
    expect(result).toBeUndefined();
  });

  it('空列表返回 undefined', () => {
    expect(findEpisodeByNumber([], 1)).toBeUndefined();
  });

  it('集号为 0 时返回 undefined（集号从 1 开始）', () => {
    const episodes = [makeEp(1), makeEp(2)];
    expect(findEpisodeByNumber(episodes, 0)).toBeUndefined();
  });

  it('多个同号集返回第一个', () => {
    const episodes = [makeEp(5, 'A'), makeEp(5, 'B')];
    const result = findEpisodeByNumber(episodes, 5);
    expect(result?.title).toBe('A');
  });
});
