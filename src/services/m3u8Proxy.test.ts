/**
 * worker/m3u8-proxy.js 的 rewriteM3U8 单元测试（放 src 下以满足 vitest include）
 *
 * 覆盖 B1 智能路由：
 * 1. 默认（无 directSegments）行为不变：分片走 ts-proxy
 * 2. directSegments=true：分片保持源站直连，子播放列表/key 仍走代理
 * 3. #EXT-X-MEDIA 分离音轨 URI 重写
 * 4. #EXT-X-KEY 密钥重写
 */
import { describe, it, expect } from 'vitest';
import { rewriteM3U8, isM3U8Content } from '../../worker/m3u8-proxy.js';

const WORKER = 'https://iptv.example.com/';
const BASE = 'http://cdn.example.com/live/index.m3u8';

const SAMPLE = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="国语",URI="audio/zh.m3u8"
#EXT-X-KEY:METHOD=AES-128,URI="https://key.example.com/key.bin"
#EXTINF:4.0,
seg0.ts
#EXTINF:4.0,
https://cdn.example.com/live/seg1.ts
#EXT-X-ENDLIST`;

describe('rewriteM3U8 默认模式（分片走代理，行为不变）', () => {
  it('分片重写为 ts-proxy', () => {
    const result = rewriteM3U8(SAMPLE, BASE, {}, WORKER);
    expect(result).toContain('/ts-proxy?url=');
    // 分片地址必须是 worker origin
    expect(result).toContain('https://iptv.example.com/ts-proxy');
    // 不包含源站分片直连
    expect(result).not.toContain('https://cdn.example.com/live/seg1.ts\n');
  });

  it('#EXT-X-MEDIA 分离音轨 URI 被重写为 m3u8-proxy', () => {
    const result = rewriteM3U8(SAMPLE, BASE, {}, WORKER);
    expect(result).toContain('m3u8-proxy');
    expect(result).not.toContain('URI="audio/zh.m3u8"');
  });

  it('#EXT-X-KEY 密钥走代理', () => {
    const result = rewriteM3U8(SAMPLE, BASE, {}, WORKER);
    expect(result).toContain('/ts-proxy?url=');
    expect(result).not.toContain('https://key.example.com/key.bin"');
  });
});

describe('isM3U8Content（D1 裸流识别）', () => {
  it('#EXTM3U 开头返回 true', () => {
    expect(isM3U8Content('#EXTM3U\n#EXT-X-TARGETDURATION:4\nseg.ts')).toBe(true);
  });

  it('UTF-8 BOM + #EXTM3U 返回 true（兼容 BOM 清单）', () => {
    expect(isM3U8Content('\uFEFF#EXTM3U\n#EXTINF:4.0,\nseg.ts')).toBe(true);
  });

  it('裸 TS/FLV 二进制文本（非 #EXTM3U）返回 false', () => {
    // 0x47 = 'G'，MPEG-TS 同步字节；FLV 魔数 'FLV' 开头
    expect(isM3U8Content('G@\u0000\u0010\u0002\u0001\u0000')).toBe(false);
    expect(isM3U8Content('FLV\u0001\u0005\u0000\u0000\u0000\u0009')).toBe(false);
  });

  it('空字符串 / 非字符串返回 false', () => {
    expect(isM3U8Content('')).toBe(false);
    expect(isM3U8Content(null as unknown as string)).toBe(false);
  });
});

describe('rewriteM3U8 directSegments=true（B1 直连模式）', () => {
  it('分片保持源站直连，子列表/key 仍代理', () => {
    const result = rewriteM3U8(SAMPLE, BASE, {}, WORKER, { directSegments: true });
    // 分片直连源站（保留源站地址）
    expect(result).toContain('http://cdn.example.com/live/seg0.ts');
    expect(result).toContain('https://cdn.example.com/live/seg1.ts');
    // 但 #EXT-X-MEDIA 音轨（子播放列表）仍走代理（避免直连被 CORS 拦）
    expect(result).toContain('m3u8-proxy');
    // 密钥仍代理
    expect(result).toContain('/ts-proxy?url=');
    // 分片不应再出现在 ts-proxy 中
    const tsProxyLines = result.split('\n').filter((l) => l.includes('/ts-proxy'));
    expect(tsProxyLines.every((l) => !l.includes('seg'))).toBe(true);
  });
});
