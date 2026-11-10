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

  it('无季号的 vod 条目（单条目全集/裸剧名）回退为第 1 季', async () => {
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
          vod_play_url: '第01集$https://example.com/e1.mp4#第02集$https://example.com/e2.mp4',
        },
      ],
    } as never);

    const result = await searchVideoSeasonsFromSingleSource(0, '超人前传');

    expect(result.seasons.size).toBe(1);
    expect(result.seasons.get(1)?.title).toBe('超人前传');
    expect(result.seasons.get(1)?.episodes).toHaveLength(2);
  });

  it('已有显式第 1 季时，无季号条目不覆盖', async () => {
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
          vod_play_url: '第01集$https://example.com/all-e1.mp4',
        },
        {
          vod_id: 101,
          vod_name: '超人前传第一季',
          type_id: 16,
          type_id_1: 2,
          vod_play_from: 'dytt',
          vod_play_url: '第01集$https://example.com/s1e1.mp4#第02集$https://example.com/s1e2.mp4',
        },
      ],
    } as never);

    const result = await searchVideoSeasonsFromSingleSource(0, '超人前传');

    expect(result.seasons.size).toBe(1);
    expect(result.seasons.get(1)?.title).toBe('超人前传第一季');
    expect(result.seasons.get(1)?.episodes).toHaveLength(2);
  });

  it('特别篇条目合并进季 0 桶：集列表拼接、集号连续重排、多条时标题加前缀', async () => {
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
          vod_play_from: 'dytt',
          vod_play_url: '第01集$https://example.com/s1e1.mp4#第02集$https://example.com/s1e2.mp4',
        },
        {
          vod_id: 40015,
          vod_name: '超人前传60周年特别篇',
          type_id: 16,
          type_id_1: 2,
          vod_play_from: 'dytt',
          vod_play_url: '第01集$https://example.com/sp1e1.mp4#第02集$https://example.com/sp1e2.mp4',
        },
        {
          vod_id: 40016,
          vod_name: '超人前传：圣诞特辑',
          type_id: 16,
          type_id_1: 2,
          vod_play_from: 'dytt',
          vod_play_url: '第01集$https://example.com/sp2e1.mp4',
        },
      ],
    } as never);

    const result = await searchVideoSeasonsFromSingleSource(0, '超人前传');

    const special = result.seasons.get(0);
    expect(special).toBeDefined();
    // 两条特别篇共 3 集，合并为一个桶
    expect(special?.episodes).toHaveLength(3);
    // 集号在桶内连续重排（各篇都从第01集起，按标题解析会撞号）
    expect(special?.episodes?.map((e) => e.number)).toEqual([1, 2, 3]);
    // 多条时标题加特别篇名前缀区分
    expect(special?.episodes?.[0].title).toBe('60周年特别篇·第01集');
    expect(special?.episodes?.[2].title).toBe('圣诞特辑·第01集');
    // 标题保持基础剧名（面板「特别篇」标签由季号 0 统一渲染）
    expect(special?.title).toBe('超人前传');
  });

  it('无季号且非特别篇标记、名称不一致的条目不再被错标为第 1 季', async () => {
    vi.mocked(getVideoSources).mockResolvedValue([
      { name: '量子资源', api: 'http://example.com/api.php' } as never,
    ]);
    vi.mocked(getJSON).mockResolvedValue({
      list: [
        {
          vod_id: 75509,
          vod_name: '神秘博士元旦特辑：戴立克的革命',
          type_id: 16,
          type_id_1: 2,
          vod_play_from: 'dytt',
          vod_play_url: '第01集$https://example.com/sp-e1.mp4',
        },
        {
          vod_id: 19155,
          vod_name: '神秘博士第十二季',
          type_id: 16,
          type_id_1: 2,
          vod_play_from: 'dytt',
          vod_play_url: '第01集$https://example.com/s12e1.mp4',
        },
      ],
    } as never);

    const result = await searchVideoSeasonsFromSingleSource(0, '神秘博士');

    // 源无第 1 季时，特辑不再以第 1 季身份入表（错标修复）
    expect(result.seasons.has(1)).toBe(false);
    expect(result.seasons.get(12)?.title).toBe('神秘博士第十二季');
  });

  it('仅有特别篇条目时也返回季 0 桶（数据不被静默丢弃）', async () => {
    vi.mocked(getVideoSources).mockResolvedValue([
      { name: '量子资源', api: 'http://example.com/api.php' } as never,
    ]);
    vi.mocked(getJSON).mockResolvedValue({
      list: [
        {
          vod_id: 40015,
          vod_name: '神秘博士60周年特别篇',
          type_id: 16,
          type_id_1: 2,
          vod_play_from: 'dytt',
          vod_play_url: '第01集$https://example.com/spe1.mp4#第02集$https://example.com/spe2.mp4',
        },
      ],
    } as never);

    const result = await searchVideoSeasonsFromSingleSource(0, '神秘博士');

    expect(result.seasons.size).toBe(1);
    expect(result.seasons.get(0)?.episodes).toHaveLength(2);
    // 单条特别篇：标题不加前缀
    expect(result.seasons.get(0)?.episodes?.[0].title).toBe('第01集');
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

  it('total 超过单页容量时补拉后续页，聚合跨页的季条目', async () => {
    vi.mocked(getVideoSources).mockResolvedValue([
      { name: '量子资源', api: 'http://example.com/api.php' } as never,
    ]);
    // 第 1 页只有第 1/2 季，total=3 → 应补拉 pg=2 拿到第 3 季
    vi.mocked(getJSON).mockImplementation(async (url: string) => {
      if (url.includes('pg=2')) {
        return {
          list: [
            {
              vod_id: 10742,
              vod_name: '超人前传第三季',
              type_id: 16,
              type_id_1: 2,
              vod_play_from: 'dytt',
              vod_play_url: '第01集$https://example.com/s3e1.mp4#第02集$https://example.com/s3e2.mp4',
            },
          ],
        } as never;
      }
      return {
        list: [
          {
            vod_id: 10740,
            vod_name: '超人前传第一季',
            type_id: 16,
            type_id_1: 2,
            vod_play_from: 'dytt',
            vod_play_url: '第01集$https://example.com/s1e1.mp4',
          },
          {
            vod_id: 10741,
            vod_name: '超人前传第二季',
            type_id: 16,
            type_id_1: 2,
            vod_play_from: 'dytt',
            vod_play_url: '第01集$https://example.com/s2e1.mp4',
          },
        ],
        total: 3,
      } as never;
    });

    const result = await searchVideoSeasonsFromSingleSource(0, '超人前传');

    expect(result.seasons.size).toBe(3);
    expect(result.seasons.get(3)?.title).toBe('超人前传第三季');
    // 请求顺序：首页无 pg，随后带 pg=2
    const urls = vi.mocked(getJSON).mock.calls.map((c) => String(c[0]));
    expect(urls[0]).not.toContain('pg=');
    expect(urls[1]).toContain('pg=2');
  });

  it('页间 vod_id 重叠时按 id 去重，不产生重复季', async () => {
    vi.mocked(getVideoSources).mockResolvedValue([
      { name: '量子资源', api: 'http://example.com/api.php' } as never,
    ]);
    const seasonItem = {
      vod_id: 10740,
      vod_name: '超人前传第一季',
      type_id: 16,
      type_id_1: 2,
      vod_play_from: 'dytt',
      vod_play_url: '第01集$https://example.com/s1e1.mp4',
    };
    vi.mocked(getJSON).mockImplementation(async (url: string) => {
      if (url.includes('pg=2')) return { list: [{ ...seasonItem, vod_name: '超人前传第一季' }] } as never;
      return { list: [seasonItem], total: 99 } as never;
    });

    const result = await searchVideoSeasonsFromSingleSource(0, '超人前传');

    expect(result.seasons.size).toBe(1);
    expect(result.seasons.get(1)?.episodes).toHaveLength(1);
  });

  it('无 total 字段时不补拉（保持单页行为）', async () => {
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
          vod_play_from: 'dytt',
          vod_play_url: '第01集$https://example.com/s1e1.mp4',
        },
      ],
    } as never);

    const result = await searchVideoSeasonsFromSingleSource(0, '超人前传');

    expect(result.seasons.size).toBe(1);
    expect(vi.mocked(getJSON).mock.calls).toHaveLength(1);
  });
});
