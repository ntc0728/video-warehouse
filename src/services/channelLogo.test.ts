/**
 * channelLogo 台标解析器单元测试
 * 台标来源定稿（2026-09-08）：iptv-org logos.json 单一来源（channel.logo），
 * 本地 M3U tvg-logo / EPG icon / 在线台标库均已退出；本文件覆盖单一候选链 + 失败/成功记忆。
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  resolveChannelLogoCandidates,
  markLogoFailed,
  isLogoFailed,
  markLogoSucceeded,
  resetLogoCacheInMemory,
} from './channelLogo';
import type { IPTVChannel } from '@/types/iptv';

function mkChannel(partial: Partial<IPTVChannel> = {}): IPTVChannel {
  return {
    id: 'ch-1',
    name: 'CCTV-1 综合',
    url: 'http://example.com/1.m3u8',
    ...partial,
  };
}

afterEach(() => {
  resetLogoCacheInMemory();
});

describe('resolveChannelLogoCandidates', () => {
  it('有 logo 时返回单元素候选数组', () => {
    const out = resolveChannelLogoCandidates(mkChannel({ logo: 'https://example.com/cctv1.png' }));
    expect(out).toEqual(['https://example.com/cctv1.png']);
  });

  it('无 logo 返回空数组（字母占位）', () => {
    expect(resolveChannelLogoCandidates(mkChannel())).toEqual([]);
  });

  it('非 http(s) URL 一律拒绝', () => {
    expect(resolveChannelLogoCandidates(mkChannel({ logo: 'data:image/png;base64,xxx' }))).toEqual([]);
    expect(resolveChannelLogoCandidates(mkChannel({ logo: 'ftp://example.com/a.png' }))).toEqual([]);
  });

  it('http 台标原样直连（不走代理）', () => {
    const out = resolveChannelLogoCandidates(mkChannel({ logo: 'http://example.com/a.png' }));
    expect(out).toEqual(['http://example.com/a.png']);
  });

  it('失败记忆：已失败 URL 不再进入候选链', () => {
    const url = 'https://example.com/dead.png';
    markLogoFailed(url);
    expect(isLogoFailed(url)).toBe(true);
    expect(resolveChannelLogoCandidates(mkChannel({ logo: url }))).toEqual([]);
  });
});

describe('跨会话成功记忆', () => {
  it('markLogoSucceeded 清除失败记忆，URL 恢复候选资格', () => {
    const url = 'https://example.com/revive.png';
    markLogoFailed(url);
    expect(resolveChannelLogoCandidates(mkChannel({ logo: url }))).toEqual([]);
    markLogoSucceeded(url);
    expect(resolveChannelLogoCandidates(mkChannel({ logo: url }))).toEqual([url]);
  });
});
