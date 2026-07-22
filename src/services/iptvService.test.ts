import { describe, it, expect, beforeAll } from 'vitest';

// 动态导入避免 useIPTVStore 初始化时 PlaylistSourceType 未定义
let detectSourceType: (content: string) => { type: string; channelCount: number; rawContent: string };
let shouldProxy: (url: string, proxyUrl?: string, pattern?: string) => boolean;
let buildProxyUrl: (url: string, proxyUrl: string) => string;
let unwrapProxy: (url: string, ownProxyUrl?: string) => string;
let detectVideoSourceType: (url: string) => string;
let detectTimeshiftSupport: (url: string, type: string) => boolean;

beforeAll(async () => {
  const mod = await import('./iptvService');
  detectSourceType = mod.detectSourceType;
  shouldProxy = mod.shouldProxy;
  buildProxyUrl = mod.buildProxyUrl;
  unwrapProxy = mod.unwrapProxy;
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
  it('m3u8 走 /m3u8-proxy', () => {
    const result = buildProxyUrl('http://example.com/video.m3u8', 'http://proxy.com');
    expect(result).toBe('http://proxy.com/m3u8-proxy?url=http%3A%2F%2Fexample.com%2Fvideo.m3u8');
  });

  it('mp4 等非 m3u8 单文件流走 /file-proxy', () => {
    const result = buildProxyUrl('http://example.com/video.mp4', 'http://proxy.com');
    expect(result).toBe('http://proxy.com/file-proxy?url=http%3A%2F%2Fexample.com%2Fvideo.mp4');
  });

  it('dash 流走 /dash-proxy（重写清单内部 URL）', () => {
    const result = buildProxyUrl('http://example.com/video.mpd', 'http://proxy.com');
    expect(result).toBe('http://proxy.com/dash-proxy?url=http%3A%2F%2Fexample.com%2Fvideo.mpd');
  });
});

describe('shouldProxy 防双重代理', () => {
  it('已包含 /file-proxy?url= 时返回 false', () => {
    expect(shouldProxy('http://proxy.com/file-proxy?url=xxx', 'http://proxy.com')).toBe(false);
  });

  it('已包含 /dash-proxy?url= 时返回 false', () => {
    expect(shouldProxy('http://proxy.com/dash-proxy?url=xxx', 'http://proxy.com')).toBe(false);
  });

  it('已是本代理地址（同 origin）时返回 false', () => {
    expect(shouldProxy('http://proxy.com/m3u8-proxy?url=xxx', 'http://proxy.com')).toBe(false);
  });

  it('第三方代理预代理过的地址（不同 origin）应走本代理，不再误跳过重代理', () => {
    // 复现真实场景：IPTV 源的频道地址本身已被 gh-proxy.com 代理，
    // 不应因“含 /m3u8-proxy?url=”而被误判为双重代理而漏代理
    const ghProxied = 'https://gh-proxy.com/m3u8-proxy?url=http%3A%2F%2Fhlsal-ldvt.qing.mgtv.com%2Fnn_live%2Fa.m3u8';
    expect(shouldProxy(ghProxied, 'https://iptv.my-custom-domain.com')).toBe(true);
  });
});

describe('unwrapProxy 解包第三方代理前缀', () => {
  it('解包 gh-proxy 单层 /m3u8-proxy?url= 取出真实地址', () => {
    const wrapped = 'https://gh-proxy.com/m3u8-proxy?url=http%3A%2F%2Fhlsal-ldvt.qing.mgtv.com%2Fnn_live%2Fa.m3u8';
    expect(unwrapProxy(wrapped, 'https://iptv.my-custom-domain.com')).toBe(
      'http://hlsal-ldvt.qing.mgtv.com/nn_live/a.m3u8'
    );
  });

  it('包装者 origin 与 ownProxyUrl 一致时不动（防双重代理）', () => {
    const own = 'http://proxy.com/m3u8-proxy?url=http%3A%2F%2Fexample.com%2Fa.m3u8';
    expect(unwrapProxy(own, 'http://proxy.com')).toBe(own);
  });

  it('处理双重编码的代理参数', () => {
    // url 参数被编码两次：http%253A%252F%252F...
    const wrapped = 'https://gh-proxy.com/m3u8-proxy?url=http%253A%252F%252Fexample.com%252Fa.m3u8';
    expect(unwrapProxy(wrapped, 'https://other.proxy')).toBe('http://example.com/a.m3u8');
  });

  it('递归解包多层代理（a-proxy?url=<b-proxy?url=<源站>>）', () => {
    const inner = 'http://hlsal-ldvt.qing.mgtv.com/nn_live/a.m3u8';
    const b = 'https://b-proxy.com/m3u8-proxy?url=' + encodeURIComponent(inner);
    const a = 'https://a-proxy.com/m3u8-proxy?url=' + encodeURIComponent(b);
    expect(unwrapProxy(a, 'https://my.proxy')).toBe(inner);
  });

  it('非代理形态地址原样返回', () => {
    const plain = 'http://example.com/live.m3u8';
    expect(unwrapProxy(plain, 'https://my.proxy')).toBe(plain);
  });
});

describe('buildProxyUrl 与 unwrapProxy 协同', () => {
  it('gh-proxy 预包装地址经解包后直连真实源站（绕过失效中间代理）', () => {
    const ghProxied = 'https://gh-proxy.com/m3u8-proxy?url=http%3A%2F%2Fhlsal-ldvt.qing.mgtv.com%2Fnn_live%2Fa.m3u8';
    const result = buildProxyUrl(ghProxied, 'https://iptv.my-custom-domain.com');
    // 关键：URL 参数里是真实源站 mgtv，而【不是】gh-proxy.com，证明中间代理被绕开
    expect(result).toBe(
      'https://iptv.my-custom-domain.com/m3u8-proxy?url=http%3A%2F%2Fhlsal-ldvt.qing.mgtv.com%2Fnn_live%2Fa.m3u8'
    );
    expect(result).not.toContain('gh-proxy.com');
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

describe('worker 重写逻辑 (rewriteMPD / rewriteM3U8)', () => {
  let rewriteMPD: (content: string, mpdUrl: string, headers: object, workerUrl: string) => string;
  let rewriteM3U8: (content: string, baseUrl: string, headers: object, workerUrl: string) => string;

  beforeAll(async () => {
    // worker 模块与前端同仓库，Vitest 可直接导入其命名导出
    const worker = await import('../../worker/m3u8-proxy.js');
    rewriteMPD = worker.rewriteMPD;
    rewriteM3U8 = worker.rewriteM3U8;
  });

  const WORKER = 'https://worker.example.com/dash-proxy?url=x';

  it('rewriteMPD 将相对分片解析为绝对源站地址并包成 file-proxy（含占位符保留）', () => {
    const mpdUrl = 'https://origin.com/live/channel1/Manifest.mpd';
    const mpd = `<?xml version="1.0"?>
<MPD>
  <BaseURL>../</BaseURL>
  <Period>
    <AdaptationSet>
      <Representation>
        <SegmentTemplate initialization="init.mp4" media="segment-$Number$.m4s"/>
        <SegmentList>
          <SegmentURL media="seg1.m4s"/>
        </SegmentList>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;
    const out = rewriteMPD(mpd, mpdUrl, {}, WORKER);
    // BaseURL 相对 ../ 解析为 https://origin.com/live/ 后应被包成 file-proxy
    expect(out).toContain('worker.example.com/file-proxy?url=https%3A%2F%2Forigin.com%2Flive%2F');
    // 模板占位符必须保留
    expect(out).toContain('segment-%24Number%24.m4s');
    // 相对分片绝对化 + 代理化
    expect(out).toContain('worker.example.com/file-proxy?url=https%3A%2F%2Forigin.com%2Flive%2Finit.mp4');
    expect(out).toContain('worker.example.com/file-proxy?url=https%3A%2F%2Forigin.com%2Flive%2Fseg1.m4s');
    // 不应残留 origin.com/live/channel1 这一层（说明已正确上溯到 BaseURL 基准）
    expect(out).not.toContain('live/channel1/');
  });

  it('rewriteMPD 处理 SegmentBase 的 Initialization/RepresentationIndex sourceURL', () => {
    const mpdUrl = 'https://origin.com/vod/m.mpd';
    const mpd = `<MPD>
      <SegmentBase indexRange="0-100">
        <Initialization sourceURL="header.mp4" range="0-500"/>
        <RepresentationIndex sourceURL="index.sidx"/>
      </SegmentBase>
    </MPD>`;
    const out = rewriteMPD(mpd, mpdUrl, {}, WORKER);
    expect(out).toContain('worker.example.com/file-proxy?url=https%3A%2F%2Forigin.com%2Fvod%2Fheader.mp4');
    expect(out).toContain('worker.example.com/file-proxy?url=https%3A%2F%2Forigin.com%2Fvod%2Findex.sidx');
  });

  it('rewriteM3U8 将子项重写为指向 Worker 自身的 ts-proxy（非源站）', () => {
    const base = 'https://origin.com/live/playlist.m3u8';
    const m3u8 = `#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="https://origin.com/keys/key.bin"
segment0.ts
https://origin.com/live/segment1.ts`;
    const out = rewriteM3U8(m3u8, base, {}, WORKER);
    expect(out).toContain('worker.example.com/ts-proxy?url=');
    expect(out).toContain('worker.example.com/ts-proxy?url=https%3A%2F%2Forigin.com%2Fkeys%2Fkey.bin');
    // 不能用源站 origin 作为重写地址（这是"一直不通"的根因）
    expect(out).not.toContain('origin.com/ts-proxy');
  });
});
