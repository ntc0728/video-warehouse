import { describe, it, expect, afterEach } from 'vitest';
import { isWifiConnection, extractFirstSegmentUrl } from './useNextEpisodePreload';

describe('isWifiConnection（预加载仅 Wi-Fi）', () => {
  afterEach(() => {
    // 清理 mock 的 connection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).connection;
  });

  it('无 connection API（桌面/未知）→ 允许预加载', () => {
    expect(isWifiConnection()).toBe(true);
  });

  it('effectiveType=wifi → 允许预加载', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).connection = { effectiveType: 'wifi' };
    expect(isWifiConnection()).toBe(true);
  });

  it('effectiveType=4g（蜂窝）→ 禁止预加载', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).connection = { effectiveType: '4g' };
    expect(isWifiConnection()).toBe(false);
  });

  it('type=cellular → 禁止预加载', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).connection = { type: 'cellular' };
    expect(isWifiConnection()).toBe(false);
  });
});

describe('extractFirstSegmentUrl（首分片解析）', () => {
  const MANIFEST_URL = 'https://cdn.example.com/series/ep2/index.m3u8';

  it('相对分片 URL → 基于清单 URL 解析', () => {
    const m3u8 = '#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:4.0,\nseg0.ts\n#EXTINF:4.0,\nseg1.ts';
    expect(extractFirstSegmentUrl(m3u8, MANIFEST_URL)).toBe('https://cdn.example.com/series/ep2/seg0.ts');
  });

  it('绝对分片 URL → 原样返回', () => {
    const m3u8 = '#EXTM3U\n#EXTINF:4.0,\nhttps://cdn2.example.com/seg0.ts';
    expect(extractFirstSegmentUrl(m3u8, MANIFEST_URL)).toBe('https://cdn2.example.com/seg0.ts');
  });

  it('master 清单（无 #EXTINF 分片行）→ 返回 null', () => {
    const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=720x404\nv720/index.m3u8';
    expect(extractFirstSegmentUrl(master, MANIFEST_URL)).toBe(null);
  });

  it('空内容 → 返回 null', () => {
    expect(extractFirstSegmentUrl('', MANIFEST_URL)).toBe(null);
  });
});
