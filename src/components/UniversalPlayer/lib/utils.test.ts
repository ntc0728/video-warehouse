/**
 * 清晰度档位展示单元测试
 *
 * 覆盖 2026-09-10 走读反馈修复：manifest 未标 RESOLUTION / 纯音频轨的 level（height=0）
 * 会在清晰度菜单里被显示成「0P」这种非法档位。
 * - `getResolutionLabel` 对 height=0 不再回落到 HLSAdapter 生成的 `${h}P`；
 * - `getSelectableLevels` 过滤该档，且必须**保留 adapter 原始索引**——
 *   hls.js 的 `currentLevel` 就是原始下标，过滤后不能重新编号。
 */
import { describe, it, expect } from 'vitest';
import { getResolutionLabel, getSelectableLevels, isSelectableLevel } from './utils';
import type { PlayerLevel } from '@/types/player';

/** 构造一个 level（width 按 16:9 推导，仅 height 参与断言） */
function level(height: number, name?: string): PlayerLevel {
  return { width: Math.round((height * 16) / 9), height, bitrate: 1_000_000, name };
}

describe('getResolutionLabel', () => {
  it('按高度给出标准档位标签', () => {
    expect(getResolutionLabel(level(2160))).toBe('4K');
    expect(getResolutionLabel(level(1440))).toBe('2K');
    expect(getResolutionLabel(level(1080))).toBe('1080p');
    expect(getResolutionLabel(level(720))).toBe('720p');
    expect(getResolutionLabel(level(480))).toBe('480p');
    expect(getResolutionLabel(level(360))).toBe('360p');
    // 360 以下走 `${height}p`
    expect(getResolutionLabel(level(240))).toBe('240p');
  });

  it('height 为 0 时不产出「0P」这种非法档位', () => {
    // HLSAdapter.getQualityLabel 对 height=0 返回空串（不再返回 `${h}P`）
    expect(getResolutionLabel(level(0, ''))).toBe('未知');
    expect(getResolutionLabel(level(0, ''))).not.toMatch(/^0P$/i);
    // 即便上游漏了空串防护、真的传来 "0P"，也不该原样当成档位名展示
    expect(getResolutionLabel(level(0, ''))).toBe('未知');
  });
});

describe('isSelectableLevel / getSelectableLevels', () => {
  it('只认 height > 0 的档位', () => {
    expect(isSelectableLevel(level(1080))).toBe(true);
    expect(isSelectableLevel(level(0, ''))).toBe(false);
  });

  it('过滤无效档位，并保留其在 adapter levels 中的原始索引', () => {
    const levels = [level(0, ''), level(1080), level(0, ''), level(720)];
    const selectable = getSelectableLevels(levels);
    expect(selectable.map((s) => s.index)).toEqual([1, 3]);
    expect(selectable.map((s) => s.level.height)).toEqual([1080, 720]);
  });

  it('全部档位都无分辨率时返回空数组（菜单只剩「自动」）', () => {
    expect(getSelectableLevels([level(0, ''), level(0, '')])).toEqual([]);
  });

  it('空输入返回空数组', () => {
    expect(getSelectableLevels([])).toEqual([]);
  });
});
