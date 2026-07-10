import { describe, it, expect, beforeAll } from 'vitest';

// 动态导入避免 useIPTVStore 初始化时 PlaylistSourceType 未定义
let detectSourceType: (content: string) => { type: string; channelCount: number; rawContent: string };
let shouldProxy: (url: string, proxyUrl?: string, pattern?: string) => boolean;
let buildProxyUrl: (url: string, proxyUrl: string) => string;
let detectVideoSourceType: (url: string) => string;
let detectTimeshiftSupport: (url: string, type: string) => boolean;

beforeAll(async () => {
  const mod = await import('./iptvService');
  detectSourceType = mod.detectSourceType;
  shouldProxy = mod.shouldProxy;
  buildProxyUrl = mod.buildProxyUrl;
  detectVideoSourceType = mod.detectVideoSourceType;
  detectTimeshiftSupport = mod.detectTimeshiftSupport;
});

describe('detectSourceType', () => {
  it('空内容返回 SINGLE_STREAM', () => {
    expect(detectSourceType('').type).toBe('single');
  });

  it('多 EXTINF 标记返回 MULTI_CHANNEL', () => {
    const content = `#EXTM3U
#EXTINF:-1 group-title="CCTV",CCTV1
http://example.com/cctv1.m3u8
#EXTINF:-1 group-title="CCTV",CCTV5
http://example.com/cctv5.m3u8`;
    expect(detectSourceType(content).type).toBe('multi');
  });

  it('master playlist 返回 SINGLE_STREAM', () => {
    const content = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000000
http://example.com/low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000
http://example.com/high.m3u8`;
    expect(detectSourceType(content).type).toBe('single');
  });

  it('单 EXTINF 返回 MULTI_CHANNEL', () => {
    const content = `#EXTM3U
#EXTINF:-1,Channel 1
http://example.com/live.m3u8`;
    expect(detectSourceType(content).type).toBe('multi');
  });

  it('无 EXTINF 的 M3U 返回 MULTI_CHANNEL', () => {
    const content = `#EXTM3U
http://example.com/live.m3u8`;
    expect(detectSourceType(content).type).toBe('multi');
  });
});

describe('shouldProxy', () => {
  it('无代理 URL 时返回 false', () => {
    expect(shouldProxy('http://example.com/video.m3u8', '')).toBe(false);
  });

  it('已包含代理前缀时返回 false（防止双重代理）', () => {
    expect(shouldProxy('http://proxy.com/m3u8-proxy?url=xxx', 'http://proxy.com')).toBe(false);
  });

  it('匹配代理规则正则时返回 false（pattern 匹配的 URL 不走代理）', () => {
    expect(shouldProxy('http://example.com/video.m3u8', 'http://proxy.com', '\\.m3u8$')).toBe(false);
  });

  it('不匹配代理规则正则时返回 true（pattern 不匹配的 URL 走代理）', () => {
    expect(shouldProxy('http://example.com/video.mp4', 'http://proxy.com', '\\.m3u8$')).toBe(true);
  });

  it('无效正则不抛异常', () => {
    expect(() => shouldProxy('http://example.com/video.m3u8', 'http://proxy.com', '[invalid')).not.toThrow();
  });

  it('有代理 URL 且无规则时返回 true', () => {
    expect(shouldProxy('http://example.com/video.m3u8', 'http://proxy.com')).toBe(true);
  });
});

describe('buildProxyUrl', () => {
  it('构建代理 URL', () => {
    const result = buildProxyUrl('http://example.com/video.m3u8', 'http://proxy.com');
    expect(result).toBe('http://proxy.com/m3u8-proxy?url=http%3A%2F%2Fexample.com%2Fvideo.m3u8');
  });
});

describe('detectVideoSourceType', () => {
  it('m3u8 URL 返回 m3u8', () => {
    expect(detectVideoSourceType('http://example.com/live.m3u8')).toBe('m3u8');
  });

  it('mp4 URL 返回 mp4', () => {
    expect(detectVideoSourceType('http://example.com/video.mp4')).toBe('mp4');
  });

  it('mpd URL 返回 dash', () => {
    expect(detectVideoSourceType('http://example.com/video.mpd')).toBe('dash');
  });

  it('包含 /dash/ 路径返回 dash', () => {
    expect(detectVideoSourceType('http://example.com/dash/live')).toBe('dash');
  });

  it('包含 pan. 的 URL 返回 pan', () => {
    expect(detectVideoSourceType('http://pan.example.com/video')).toBe('pan');
  });

  it('未知类型返回 m3u8', () => {
    expect(detectVideoSourceType('http://example.com/live')).toBe('m3u8');
  });
});

describe('detectTimeshiftSupport', () => {
  it('m3u8 URL 包含 dvr 返回 true', () => {
    expect(detectTimeshiftSupport('http://example.com/live.m3u8?dvr=true', 'm3u8')).toBe(true);
  });

  it('m3u8 URL 包含 timeshift 返回 true', () => {
    expect(detectTimeshiftSupport('http://example.com/timeshift/live.m3u8', 'm3u8')).toBe(true);
  });

  it('m3u8 URL 包含 replay 返回 true', () => {
    expect(detectTimeshiftSupport('http://example.com/replay/live.m3u8', 'm3u8')).toBe(true);
  });

  it('m3u8 URL 包含 catchup 返回 true', () => {
    expect(detectTimeshiftSupport('http://example.com/catchup/live.m3u8', 'm3u8')).toBe(true);
  });

  it('普通 m3u8 URL 返回 true（默认假设支持时移）', () => {
    expect(detectTimeshiftSupport('http://example.com/live.m3u8', 'm3u8')).toBe(true);
  });

  it('非 m3u8 类型返回 false', () => {
    expect(detectTimeshiftSupport('http://example.com/live.mp4', 'mp4')).toBe(false);
  });

  it('m3u8 URL 包含 archive 返回 true', () => {
    expect(detectTimeshiftSupport('http://example.com/archive/live.m3u8', 'm3u8')).toBe(true);
  });

  it('m3u8 URL 包含 record 返回 true', () => {
    expect(detectTimeshiftSupport('http://example.com/record/live.m3u8', 'm3u8')).toBe(true);
  });
});
