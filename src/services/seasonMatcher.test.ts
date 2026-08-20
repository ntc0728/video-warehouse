import { describe, it, expect } from 'vitest';
import { extractSeasonNumber } from './seasonMatcher';

describe('extractSeasonNumber', () => {
  it('解析中文数字季号：第二季 → 2', () => {
    expect(extractSeasonNumber('超人前传第二季')).toBe(2);
  });

  it('解析中文数字季号：第五季 → 5', () => {
    expect(extractSeasonNumber('超人前传第五季')).toBe(5);
  });

  it('解析阿拉伯数字季号：第3季 → 3', () => {
    expect(extractSeasonNumber('某剧第3季')).toBe(3);
  });

  it('解析带前导零的阿拉伯数字季号：第03季 → 3', () => {
    expect(extractSeasonNumber('某剧第03季')).toBe(3);
  });

  it('解析英文季号：Season 2 → 2', () => {
    expect(extractSeasonNumber('Smallville Season 2')).toBe(2);
  });

  it('解析英文缩写季号：S02 → 2', () => {
    expect(extractSeasonNumber('Smallville S02')).toBe(2);
  });

  it('无季号时返回 undefined', () => {
    expect(extractSeasonNumber('超人前传')).toBeUndefined();
  });

  it('电影名不误匹配季号', () => {
    expect(extractSeasonNumber('黑客帝国')).toBeUndefined();
  });
});
