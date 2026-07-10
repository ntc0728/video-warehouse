import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 系统边界：HTTP 客户端和源配置
vi.mock('./httpClient', () => ({
  getJSON: vi.fn(),
}));

vi.mock('./sourceService', () => ({
  getVideoSources: vi.fn(),
}));

import { getJSON } from './httpClient';
import { getVideoSources } from './sourceService';
import { searchVideoSeasonsFromSingleSource } from './videoService';

describe('searchVideoSeasonsFromSingleSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CMS 返回多个季的 vod 条目时，返回按季映射的结果', async () => {
    // 模拟 CMS 返回多季数据
    vi.mocked(getVideoSources).mockResolvedValue([
      { name: '量子资源', api: 'http://example.com/api.php' } as never,
    ]);
    vi.mocked(getJSON).mockResolvedValue({
      list: [
        {
          vod_id: 10740,
          vod_name: '超人前传第一季',
          type_id: 16,
          type_id_1: 2,
          vod_play_from: 'dytt$$$dyttm3u8',
          vod_play_url: '第01集$https://example.com/s1e1.mp4#第02集$https://example.com/s1e2.mp4',
        },
        {
          vod_id: 10741,
          vod_name: '超人前传第二季',
          type_id: 16,
          type_id_1: 2,
          vod_play_from: 'dytt$$$dyttm3u8',
          vod_play_url: '第01集$https://example.com/s2e1.mp4#第02集$https://example.com/s2e2.mp4',
        },
      ],
    } as never);

    const result = await searchVideoSeasonsFromSingleSource(0, '超人前传');

    expect(result.sourceName).toBe('量子资源');
    expect(result.seasons.size).toBe(2);
    expect(result.seasons.get(1)?.title).toBe('超人前传第一季');
    expect(result.seasons.get(1)?.episodes).toHaveLength(2);
    expect(result.seasons.get(2)?.title).toBe('超人前传第二季');
    expect(result.seasons.get(2)?.episodes).toHaveLength(2);
  });

  it('无季号的 vod 条目不映射到任何季', async () => {
    vi.mocked(getVideoSources).mockResolvedValue([
      { name: '量子资源', api: 'http://example.com/api.php' } as never,
    ]);
    vi.mocked(getJSON).mockResolvedValue({
      list: [
        {
          vod_id: 100,
          vod_name: '超人前传',
          type_id: 16,
          type_id_1: 2,
          vod_play_from: 'dytt',
          vod_play_url: '第01集$https://example.com/e1.mp4',
        },
      ],
    } as never);

    const result = await searchVideoSeasonsFromSingleSource(0, '超人前传');

    expect(result.seasons.size).toBe(0);
  });

  it('CMS 返回空结果时返回空映射和错误信息', async () => {
    vi.mocked(getVideoSources).mockResolvedValue([
      { name: '量子资源', api: 'http://example.com/api.php' } as never,
    ]);
    vi.mocked(getJSON).mockResolvedValue({
      list: [],
    } as never);

    const result = await searchVideoSeasonsFromSingleSource(0, '不存在的剧');

    expect(result.seasons.size).toBe(0);
    expect(result.error).toBeDefined();
  });
});
