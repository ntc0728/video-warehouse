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
import { searchVideoFromMultipleSources } from './videoService';

const SOURCE = { name: '量子资源', api: 'http://example.com/api.php' } as never;

function cmsItem(id: number, name: string, year?: string) {
  return {
    vod_id: id,
    vod_name: name,
    vod_year: year,
    type_id: 1,
    vod_play_from: 'dytt',
    vod_play_url: `第01集$https://example.com/${id}.mp4`,
  };
}

describe('searchVideoFromMultipleSources 标题打分匹配', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoSources).mockResolvedValue([SOURCE]);
  });

  it('查询 URL 不再携带 year 硬过滤参数', async () => {
    vi.mocked(getJSON).mockResolvedValue({ list: [cmsItem(1, '测试影片', '2020')] } as never);

    await searchVideoFromMultipleSources([0], '测试影片', 2023);

    const url = String(vi.mocked(getJSON).mock.calls[0][0]);
    expect(url).toContain('wd=');
    expect(url).not.toContain('year=');
  });

  it('CMS vod_year 与传入年份不一致时仍命中精确标题（年份只作加分，不作硬过滤）', async () => {
    vi.mocked(getJSON).mockResolvedValue({ list: [cmsItem(1, '测试影片', '2020')] } as never);

    const results = await searchVideoFromMultipleSources([0], '测试影片', 2023);

    expect(results[0].video?.title).toBe('测试影片');
    expect(results[0].error).toBeUndefined();
  });

  it('精确标题 + 年份一致优先于靠前的包含关系条目', async () => {
    vi.mocked(getJSON).mockResolvedValue({
      // 包含关系条目在前；精确 + 年份一致的条目在后，应胜出
      list: [
        cmsItem(1, '测试影片番外篇', '2023'),
        cmsItem(2, '测试影片', '2023'),
      ],
    } as never);

    const results = await searchVideoFromMultipleSources([0], '测试影片', 2023);

    expect(results[0].video?.id).toBe('2');
  });

  it('全部条目无标题关联时不再兜底 list[0]，返回未找到', async () => {
    vi.mocked(getJSON).mockResolvedValue({
      list: [cmsItem(1, '完全无关的名字'), cmsItem(2, '另一个无关名')],
    } as never);

    const results = await searchVideoFromMultipleSources([0], '测试影片', 2023);

    expect(results[0].video).toBeNull();
    expect(results[0].error).toBe('未找到匹配资源');
  });
});
