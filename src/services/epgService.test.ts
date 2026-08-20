import { describe, it, expect } from 'vitest';
import {
  matchEPGChannel,
  matchEPGChannelIndexed,
  buildEPGChannelIndex,
  formatTimeHHmm,
} from './epgService';

// ─── matchEPGChannel ─────────────────────────────

describe('matchEPGChannel', () => {
  const epgChannels = [
    { id: 'cctv1', name: 'CCTV-1 综合' },
    { id: 'hunan', name: '湖南卫视' },
    { id: 'hntv', name: '湖南电视台' },
  ];

  it('tvg-id 精确匹配', () => {
    const result = matchEPGChannel('任意名称', 'cctv1', epgChannels);
    expect(result?.id).toBe('cctv1');
  });

  it('归一化名称匹配', () => {
    // "湖南卫视高清" 应归一化为匹配 "湖南卫视"
    const result = matchEPGChannel('湖南卫视高清', '', epgChannels);
    expect(result?.id).toBe('hunan');
  });

  it('精确字符串匹配', () => {
    const result = matchEPGChannel('湖南卫视', '', epgChannels);
    expect(result?.id).toBe('hunan');
  });

  it('模糊包含匹配', () => {
    const result = matchEPGChannel('CCTV-1 综合频道', '', epgChannels);
    expect(result?.id).toBe('cctv1');
  });

  it('无匹配返回 null', () => {
    const result = matchEPGChannel('未知频道', '', epgChannels);
    expect(result).toBeNull();
  });

  it('空 epgChannels 返回 null', () => {
    const result = matchEPGChannel('CCTV1', '', []);
    expect(result).toBeNull();
  });
});

// ─── buildEPGChannelIndex / matchEPGChannelIndexed（预索引）──────

describe('EPG 频道预索引', () => {
  const epgChannels = [
    { id: 'cctv1', name: 'CCTV-1 综合', icon: 'https://epg.com/cctv1.png' },
    { id: 'hunan', name: '湖南卫视', icon: 'https://epg.com/hunan.png' },
    { id: 'hntv', name: '湖南电视台' },
  ];

  it('与 matchEPGChannel 结果一致（tvg-id / 规范化 / 原始名）', () => {
    const index = buildEPGChannelIndex(epgChannels);
    expect(matchEPGChannelIndexed('任意名称', 'cctv1', index)?.id).toBe('cctv1');
    expect(matchEPGChannelIndexed('湖南卫视高清', '', index)?.id).toBe('hunan');
    expect(matchEPGChannelIndexed('湖南卫视', '', index)?.id).toBe('hunan');
    expect(matchEPGChannelIndexed('未知频道', '', index)).toBeNull();
  });

  it('重复键保留首个（tvg-id 与规范化名重复）', () => {
    const dup = [
      { id: 'cctv1', name: 'CCTV-1 综合', icon: 'https://a.com/1.png' },
      { id: 'cctv1', name: 'CCTV-1 综合', icon: 'https://b.com/1.png' },
      { id: 'cctv2', name: 'CCTV-2 财经', icon: 'https://b.com/2.png' },
    ];
    const index = buildEPGChannelIndex(dup);
    expect(index.byId.get('cctv1')?.icon).toBe('https://a.com/1.png');
    expect(index.byNormalizedName.get('cctv2财经')?.icon).toBe('https://b.com/2.png');
  });

  it('空数组索引匹配返回 null', () => {
    const index = buildEPGChannelIndex([]);
    expect(matchEPGChannelIndexed('CCTV1', '', index)).toBeNull();
  });

  it('空名不进入规范化索引（避免空串误匹配）', () => {
    const index = buildEPGChannelIndex([{ id: 'empty', name: '频道' }]);
    // '频道' 经 normalizeName 为空 → 不占 byNormalizedName；且空名查询不命中
    expect(index.byNormalizedName.has('')).toBe(false);
    expect(matchEPGChannelIndexed('', '', index)).toBeNull();
  });
});

// ─── formatTimeHHmm ──────────────────────────────

describe('formatTimeHHmm', () => {
  it('格式化为 HH:MM', () => {
    const date = new Date(2026, 0, 15, 9, 30);
    expect(formatTimeHHmm(date)).toBe('09:30');
  });

  it('零点', () => {
    const date = new Date(2026, 0, 1, 0, 0);
    expect(formatTimeHHmm(date)).toBe('00:00');
  });

  it('23:59', () => {
    const date = new Date(2026, 0, 1, 23, 59);
    expect(formatTimeHHmm(date)).toBe('23:59');
  });
});
