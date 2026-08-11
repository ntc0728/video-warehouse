/**
 * channelLogo 台标解析器单元测试
 * 覆盖：toLogoName 名称规范化、在线台标库 URL 构造、三级回退链、失败记忆、http 代理转写
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  toLogoName,
  buildLogoUrlCandidates,
  resolveChannelLogoCandidates,
  markLogoFailed,
  isLogoFailed,
  markLogoSucceeded,
  __setLogoLibraryForTest,
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

describe('toLogoName', () => {
  it('去空格/连字符与尾部定位词', () => {
    expect(toLogoName('CCTV-1 综合')).toBe('CCTV1');
  });

  it('去除括号注释与清晰度标记', () => {
    expect(toLogoName('CCTV-1 综合[蓝光]')).toBe('CCTV1');
    expect(toLogoName('湖南卫视高清')).toBe('湖南卫视');
  });

  it('保留卫视等品牌词', () => {
    expect(toLogoName('湖南卫视')).toBe('湖南卫视');
    expect(toLogoName('凤凰卫视')).toBe('凤凰卫视');
  });

  it('保留 + 号（CCTV5+）', () => {
    expect(toLogoName('CCTV-5+ 体育')).toBe('CCTV5+');
  });

  it('组合定位词循环剥离（国防军事）', () => {
    expect(toLogoName('CCTV-7 国防军事')).toBe('CCTV7');
  });

  it('保留 4K 品牌名（CCTV-4K）', () => {
    expect(toLogoName('CCTV-4K')).toBe('CCTV4K');
  });

  it('空串返回空', () => {
    expect(toLogoName('')).toBe('');
  });
});

describe('buildLogoUrlCandidates', () => {
  // 每个用例后恢复「未预判」状态，避免污染其他用例
  afterEach(() => {
    __setLogoLibraryForTest(null);
  });

  it('返回在线台标库候选（fanmingming + wanglindl）', () => {
    const urls = buildLogoUrlCandidates('CCTV-1 综合');
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe('https://live.fanmingming.cn/tv/CCTV1.png');
    expect(urls[1]).toBe('https://raw.githubusercontent.com/wanglindl/TVlogo/main/img/CCTV1.png');
  });

  it('空名返回空数组', () => {
    expect(buildLogoUrlCandidates('')).toEqual([]);
  });

  it('库清单预判：两库都命中时仍返回两个候选', () => {
    __setLogoLibraryForTest({ fanmingming: new Set(['CCTV1']), wanglindl: new Set(['CCTV1']) });
    expect(buildLogoUrlCandidates('CCTV-1 综合')).toHaveLength(2);
  });

  it('库清单预判：单库命中时只返回该库候选', () => {
    __setLogoLibraryForTest({ fanmingming: new Set(['CCTV1']), wanglindl: new Set() });
    const urls = buildLogoUrlCandidates('CCTV-1 综合');
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('live.fanmingming.cn');
  });

  it('库清单预判：库外频道不返回任何候选（零无效请求）', () => {
    __setLogoLibraryForTest({ fanmingming: new Set(['CCTV1']), wanglindl: new Set(['CCTV1']) });
    expect(buildLogoUrlCandidates('某某小台')).toEqual([]);
  });
});

describe('resolveChannelLogoCandidates', () => {
  it('三级回退顺序：M3U logo → EPG icon → 在线库', () => {
    const ch = mkChannel({ logo: 'https://a.com/logo.png', tvgId: 'cctv1' });
    const epgChannels = [{ id: 'cctv1', name: 'CCTV-1 综合', icon: 'https://epg.com/icon.png' }];
    const candidates = resolveChannelLogoCandidates(ch, epgChannels);
    expect(candidates[0]).toBe('https://a.com/logo.png');
    expect(candidates[1]).toBe('https://epg.com/icon.png');
    expect(candidates[2]).toContain('live.fanmingming.cn');
  });

  it('无 M3U logo 时 EPG icon 优先于在线库', () => {
    const ch = mkChannel({ logo: undefined, tvgId: 'cctv1' });
    const epgChannels = [{ id: 'cctv1', name: 'CCTV-1 综合', icon: 'https://epg.com/icon.png' }];
    const candidates = resolveChannelLogoCandidates(ch, epgChannels);
    expect(candidates[0]).toBe('https://epg.com/icon.png');
  });

  it('重复 URL 去重（M3U logo 与在线库同名候选）', () => {
    const ch = mkChannel({ logo: 'https://live.fanmingming.cn/tv/CCTV1.png' });
    const candidates = resolveChannelLogoCandidates(ch);
    expect(candidates.filter(u => u.includes('live.fanmingming.cn'))).toHaveLength(1);
  });

  it('失败记忆：已失败 URL 不再进入候选链', () => {
    const ch = mkChannel({ name: '湖南卫视', logo: undefined });
    const first = resolveChannelLogoCandidates(ch);
    expect(first.length).toBeGreaterThan(0);
    markLogoFailed(first[0]);
    const second = resolveChannelLogoCandidates(ch);
    expect(second).not.toContain(first[0]);
    expect(isLogoFailed(first[0])).toBe(true);
  });

  it('http 台标：无代理时丢弃，有代理时经 file-proxy 转 https', () => {
    const ch = mkChannel({ logo: 'http://epg.51zmt.top:8000/tb1/CCTV/CCTV1.png' });
    const noProxy = resolveChannelLogoCandidates(ch);
    expect(noProxy).not.toContain('http://epg.51zmt.top');

    const proxied = resolveChannelLogoCandidates(ch, undefined, 'https://proxy.example.com');
    expect(proxied[0]).toBe(
      `https://proxy.example.com/file-proxy?url=${encodeURIComponent('http://epg.51zmt.top:8000/tb1/CCTV/CCTV1.png')}`
    );
  });

  it('全部无来源时返回空数组', () => {
    const ch = mkChannel({ name: '', logo: undefined });
    expect(resolveChannelLogoCandidates(ch)).toEqual([]);
  });
});

describe('跨会话成功记忆', () => {
  it('成功记忆：加载成功的 URL 优先复用于候选链首', () => {
    // onLoad 上报的是候选链内（已 encodeURIComponent）的库 URL
    const okUrl = 'https://live.fanmingming.cn/tv/%E6%B9%96%E5%8D%97%E5%8D%AB%E8%A7%86.png';
    markLogoSucceeded(okUrl);
    const ch = mkChannel({ name: '湖南卫视', logo: undefined });
    const candidates = resolveChannelLogoCandidates(ch);
    expect(candidates[0]).toBe(okUrl);
  });

  it('成功记忆可撤销：标记失败后不再进入候选链', () => {
    const okUrl = 'https://live.fanmingming.cn/tv/%E6%B9%96%E5%8D%97%E5%8D%AB%E8%A7%86.png';
    markLogoSucceeded(okUrl);
    markLogoFailed(okUrl);
    const ch = mkChannel({ name: '湖南卫视', logo: undefined });
    expect(resolveChannelLogoCandidates(ch)).not.toContain(okUrl);
  });

  it('markLogoSucceeded 从失败记忆中移除 URL', () => {
    const url = 'https://a.com/logo.png';
    markLogoFailed(url);
    expect(isLogoFailed(url)).toBe(true);
    markLogoSucceeded(url);
    expect(isLogoFailed(url)).toBe(false);
  });

  it('串台回归：其他频道成功记忆的 URL 绝不进入本频道候选链', () => {
    // 频道 A（湖南卫视）台标加载成功 → onLoad 上报编码后的候选 URL 写入全局成功记忆
    const aUrl = 'https://live.fanmingming.cn/tv/%E6%B9%96%E5%8D%97%E5%8D%AB%E8%A7%86.png';
    markLogoSucceeded(aUrl);
    // 频道 B（CCTV-1 综合）解析候选：候选链绝不能出现 A 的台标 URL（旧实现全局遍历导致串台）
    const chB = mkChannel({ name: 'CCTV-1 综合', logo: undefined });
    const candidates = resolveChannelLogoCandidates(chB);
    expect(candidates).not.toContain(aUrl);
    // 且 B 的候选链首仍是 B 自己的在线库候选
    expect(candidates[0]).toBe('https://live.fanmingming.cn/tv/CCTV1.png');
  });
});
