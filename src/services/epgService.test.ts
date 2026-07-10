import { describe, it, expect } from 'vitest';
import {
  matchEPGChannel,
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
