/**
 * iptvOrgService 单测（2026-09-08 方案 B：cn.m3u 主干 + channels.json 中文名后台增强）
 * 外部依赖全部 mock：database（IndexedDB）、iptvService（代理拼装）、epgService（normalizeName）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseCnM3U,
  groupTitleToZh,
  toIPTVChannelFromApi,
  buildOrgChannels,
  fetchIptvOrgChinaChannels,
  fetchCnDisplayNames,
  resetIptvOrgApiCacheInMemory,
  matchLogoForChannel,
} from './iptvOrgService';

// mock epgService 以隔离其模块副作用；normalizeName 保持真实简化行为（纯函数）
vi.mock('@/services/epgService', () => ({
  normalizeName: (name: string): string =>
    name
      .replace(/高清|HD|标清|SD|4K|UHD|超清|极致|极速/gi, '')
      .replace(/综合|频道|卫视|电视|台|HD|直播|轮播/gi, '')
      .replace(/[-\s]/g, '')
      .trim()
      .toLowerCase(),
}));

vi.mock('@/services/iptvService', () => ({
  buildSourceProxyUrl: (url: string, proxyUrl?: string) =>
    proxyUrl ? `http://proxy.test/?url=${encodeURIComponent(url)}` : url,
}));

vi.mock('@/services/database', () => ({
  getCachedIptvOrgChannels: vi.fn(async () => null),
  setCachedIptvOrgChannels: vi.fn(async () => {}),
  isIptvOrgCacheFresh: vi.fn(() => true),
  getCachedIptvOrgCnNames: vi.fn(async () => null),
  setCachedIptvOrgCnNames: vi.fn(async () => {}),
  isIptvOrgCnNamesFresh: vi.fn(() => false),
}));

const CN_M3U = [
  '#EXTM3U',
  '#EXTINF:-1 tvg-id="CCTV1.cn@HD" tvg-logo="http://logo/cctv1.png" group-title="General",CCTV-1 (1080p)',
  'http://stream/cctv1.m3u8',
  '#EXTINF:-1 tvg-id="AnhuiTV.cn" tvg-logo="http://logo/anhui.png" group-title="Undefined",Anhui TV',
  'http://stream/anhui.m3u8',
  '#EXTINF:-1 tvg-id="NoLogo.cn" group-title="News",No Logo TV',
  'http://stream/nologo.m3u8',
].join('\n');

const CHANNELS_JSON = JSON.stringify([
  { id: 'CCTV1.cn@HD', name: 'CCTV-1', alt_names: ['CCTV1 综合'], country: 'CN' },
  { id: 'AnhuiTV.cn', name: 'Anhui TV', alt_names: ['安徽卫视'], country: 'CN' },
  { id: 'NoZh.cn', name: 'NoZh TV', alt_names: [], country: 'CN' },
  { id: 'FoxNews.us', name: 'Fox News', alt_names: ['福克斯'], country: 'US' },
]);

/** 按 URL 匹配返回不同响应体的 fetch stub */
function mockFetch(responses: Array<{ match: RegExp; body: string }>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const hit = responses.find((r) => r.match.test(url));
      if (!hit) return new Response('not found', { status: 404 });
      return new Response(hit.body, { status: 200 });
    })
  );
}

beforeEach(() => {
  resetIptvOrgApiCacheInMemory();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseCnM3U', () => {
  it('解析 EXTINF 属性、画质后缀与 URL', () => {
    const entries = parseCnM3U(CN_M3U);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      id: 'CCTV1.cn@HD',
      name: 'CCTV-1',
      logo: 'http://logo/cctv1.png',
      group: 'General',
      quality: '1080p',
      url: 'http://stream/cctv1.m3u8',
    });
    expect(entries[1].group).toBe('Undefined');
    expect(entries[2].logo).toBeUndefined();
  });

  it('缺失 tvg-id 时用显示名兜底', () => {
    const entries = parseCnM3U(
      '#EXTINF:-1 tvg-logo="http://l.png",Some TV\nhttp://s.m3u8'
    );
    expect(entries[0].id).toBe('Some TV');
  });
});

describe('groupTitleToZh', () => {
  it('映射中文 / Undefined 与缺失 → 其他 / 未知保留原文', () => {
    expect(groupTitleToZh('News')).toBe('新闻');
    expect(groupTitleToZh('Undefined')).toBe('其他');
    expect(groupTitleToZh(undefined)).toBe('其他');
    expect(groupTitleToZh('Weird')).toBe('Weird');
  });
});

describe('toIPTVChannelFromApi', () => {
  it('id 加 iptvorg- 前缀且字段完整映射', () => {
    const ch = toIPTVChannelFromApi({
      id: 'CCTV1.cn@HD',
      name: 'CCTV-1',
      nameEn: 'CCTV-1',
      altNames: [],
      logo: 'http://logo/cctv1.png',
      url: 'http://stream/cctv1.m3u8',
      quality: '1080p',
      group: '综合',
    });
    expect(ch.id).toBe('iptvorg-CCTV1.cn@HD');
    expect(ch.tvgId).toBe('CCTV1.cn@HD');
    expect(ch.logo).toBe('http://logo/cctv1.png');
    expect(ch.group).toBe('综合');
    expect(ch.country).toBe('CN');
  });
});

describe('buildOrgChannels', () => {
  it('中文名缓存命中则显示中文，台标索引含中文名/英文名/tvgId 键', () => {
    const entries = parseCnM3U(CN_M3U);
    const { channels, nameIndex } = buildOrgChannels(entries, {
      'AnhuiTV.cn': '安徽卫视',
    });
    expect(channels[0].name).toBe('CCTV-1'); // 无中文名 → 英文
    expect(channels[1].name).toBe('安徽卫视'); // 有中文名 → 中文
    const norm = (s: string) =>
      s.replace(/综合|频道|卫视|电视|台|HD/gi, '').replace(/[-\s]/g, '').trim().toLowerCase();
    expect(nameIndex.get(norm('安徽卫视'))).toBe('http://logo/anhui.png');
    expect(nameIndex.get(norm('Anhui TV'))).toBe('http://logo/anhui.png');
    expect(nameIndex.get('AnhuiTV.cn')).toBe('http://logo/anhui.png');
  });
});

describe('fetchIptvOrgChinaChannels（网络路径）', () => {
  it('cn.m3u 拉取组装主干并写磁盘缓存（fire-and-forget）', async () => {
    const { setCachedIptvOrgChannels } = await import('@/services/database');
    mockFetch([{ match: /cn\.m3u$/, body: CN_M3U }]);
    const { channels } = await fetchIptvOrgChinaChannels();
    expect(channels).toHaveLength(3);
    expect(channels[0].id).toBe('iptvorg-CCTV1.cn@HD');
    expect(channels[0].quality).toBe('1080p');
    expect(channels[0].group).toBe('综合');
    expect(channels[1].group).toBe('其他');
    expect(channels[0].logo).toBe('http://logo/cctv1.png');
    expect(setCachedIptvOrgChannels).toHaveBeenCalledTimes(1);
  });

  it('同会话二次调用走内存缓存，不再发请求', async () => {
    const fetchSpy = vi.fn(async () => new Response(CN_M3U, { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await fetchIptvOrgChinaChannels();
    await fetchIptvOrgChinaChannels();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('cn.m3u 失败且无缓存 → 抛错（调用方回退本地主干）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })));
    await expect(fetchIptvOrgChinaChannels()).rejects.toThrow();
  });

  it('直连失败且配置代理 → 经代理重试一次', async () => {
    const fetchSpy = vi.fn(async (url: string) =>
      url.includes('proxy.test')
        ? new Response(CN_M3U, { status: 200 })
        : new Response('err', { status: 500 })
    );
    vi.stubGlobal('fetch', fetchSpy);
    const { channels } = await fetchIptvOrgChinaChannels('http://myproxy:8899');
    expect(channels).toHaveLength(3);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1][0])).toContain('proxy.test');
  });
});

describe('fetchCnDisplayNames（中文名后台增强）', () => {
  it('channels.json 提取 CN 中文名（非 CN / 无中文 alt 排除），主干 name 替换为中文', async () => {
    mockFetch([
      { match: /cn\.m3u$/, body: CN_M3U },
      { match: /channels\.json$/, body: CHANNELS_JSON },
    ]);
    await fetchIptvOrgChinaChannels();
    const { names, channels } = await fetchCnDisplayNames();
    expect(names).toEqual({ 'CCTV1.cn@HD': 'CCTV1 综合', 'AnhuiTV.cn': '安徽卫视' });
    const anhui = channels.find((c) => c.tvgId === 'AnhuiTV.cn');
    expect(anhui?.name).toBe('安徽卫视');
    const cctv = channels.find((c) => c.tvgId === 'CCTV1.cn@HD');
    expect(cctv?.name).toBe('CCTV1 综合');
  });

  it('中文名到达后台标名称索引可用中文名命中（matchLogoForChannel）', async () => {
    mockFetch([
      { match: /cn\.m3u$/, body: CN_M3U },
      { match: /channels\.json$/, body: CHANNELS_JSON },
    ]);
    await fetchIptvOrgChinaChannels();
    await fetchCnDisplayNames();
    // 中文名增强后同名频道的中文名键被补进索引（更多台匹配率提升）
    expect(matchLogoForChannel({ name: '安徽卫视', name_en: undefined, altNames: [] })).toBe(
      'http://logo/anhui.png'
    );
  });
});
