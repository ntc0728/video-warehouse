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
import {
  searchVideoFromSingleSource,
  searchVideoSeasonsFromSingleSource,
  isSourceSearchUnsupported,
} from './videoService';

/** 构造一条 CMS 条目（带可直接解析的播放地址，避免额外的详情接口请求） */
function item(id: number | string, name: string) {
  return {
    vod_id: id,
    vod_name: name,
    vod_play_url: '第01集$https://example.com/e1.mp4',
  };
}

describe('CMS 关键词搜索能力识别', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('业务码 1002（禁止关键词搜索）→ unsupported，并在会话内记住该源不再发请求', async () => {
    vi.mocked(getVideoSources).mockResolvedValue([
      { id: 'src-1002', name: '茅台资源', api: 'http://example.com/api.php' } as never,
    ]);
    vi.mocked(getJSON).mockResolvedValue({ code: 1002, msg: 'Current API forbids keyword search.' } as never);

    const first = await searchVideoFromSingleSource(0, '指环王：力量之戒');
    expect(first.video).toBeNull();
    expect(first.errorKind).toBe('unsupported');
    expect(isSourceSearchUnsupported('src-1002')).toBe(true);

    // 第二次（含其它页面/下一次进入）不再打网络：这是「跳过注定失败的源」的契约
    const callsAfterFirst = vi.mocked(getJSON).mock.calls.length;
    const second = await searchVideoFromSingleSource(0, '指环王：力量之戒');
    expect(second.errorKind).toBe('unsupported');
    expect(vi.mocked(getJSON).mock.calls.length).toBe(callsAfterFirst);
  });

  it('首屏无标题关联且 total 远超单页容量（忽略 wd）→ unsupported，且不翻页', async () => {
    vi.mocked(getVideoSources).mockResolvedValue([
      { id: 'src-ignored', name: '最大资源', api: 'http://example.com/api.php' } as never,
    ]);
    // 真实返回形态：wd 被忽略，回的是全量目录（total=12 万），首屏与本片毫无关系
    vi.mocked(getJSON).mockResolvedValue({
      code: 1,
      total: 125941,
      limit: 20,
      list: [item(1, '我推的歌.2026'), item(2, '花儿与少年 第八季')],
    } as never);

    const result = await searchVideoSeasonsFromSingleSource(0, '指环王：力量之戒');

    expect(result.errorKind).toBe('unsupported');
    expect(result.seasons.size).toBe(0);
    // 只发了首屏一次（判定忽略后不再补拉 pg=2..4，省掉串行 RTT）
    expect(vi.mocked(getJSON)).toHaveBeenCalledTimes(1);
    expect(isSourceSearchUnsupported('src-ignored')).toBe(true);
  });

  it('标题无关联但 total 正常 → no-match（源里没有这部片，不是源坏了）', async () => {
    vi.mocked(getVideoSources).mockResolvedValue([
      { id: 'src-nomatch', name: '电影天堂', api: 'http://example.com/api.php' } as never,
    ]);
    vi.mocked(getJSON).mockResolvedValue({
      code: 1,
      total: 1,
      limit: 20,
      list: [item(1, '毫不相干的片名')],
    } as never);

    const result = await searchVideoFromSingleSource(0, '指环王：力量之戒');

    expect(result.errorKind).toBe('no-match');
    expect(isSourceSearchUnsupported('src-nomatch')).toBe(false);
  });

  it('网络/超时类失败 → network（与「源里没有这部片」区分开）', async () => {
    vi.mocked(getVideoSources).mockResolvedValue([
      { id: 'src-network', name: '豆瓣资源', api: 'http://example.com/api.php' } as never,
    ]);
    vi.mocked(getJSON).mockRejectedValue(new Error('网络连接失败，请检查网络或代理设置'));

    const result = await searchVideoFromSingleSource(0, '指环王：力量之戒');

    expect(result.errorKind).toBe('network');
    expect(isSourceSearchUnsupported('src-network')).toBe(false);
  });

  it('total 超过单页容量时分页补拉改为并发发起', async () => {
    vi.mocked(getVideoSources).mockResolvedValue([
      { id: 'src-paging', name: '暴风资源', api: 'http://example.com/api.php' } as never,
    ]);
    const page1 = Array.from({ length: 20 }, (_, i) => item(i + 1, `测试剧第${i + 1}季`));
    const page2 = Array.from({ length: 5 }, (_, i) => item(100 + i, `测试剧第${21 + i}季`));
    vi.mocked(getJSON).mockImplementation((async (url: string) => (
      String(url).includes('pg=2')
        ? { code: 1, total: 25, limit: 20, list: page2 }
        : { code: 1, total: 25, limit: 20, list: page1 }
    )) as never);

    const result = await searchVideoSeasonsFromSingleSource(0, '测试剧');

    expect(vi.mocked(getJSON)).toHaveBeenCalledTimes(2);
    // 两页按季号合并，去重后共 25 季
    expect(result.seasons.size).toBe(25);
    expect(result.seasons.has(21)).toBe(true);
  });
});
