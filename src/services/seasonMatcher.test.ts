import { describe, it, expect } from 'vitest';
import { extractSeasonNumber, isSpecialEntryTitle } from './seasonMatcher';

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

describe('isSpecialEntryTitle', () => {
  it.each([
    ['神秘博士60周年特别篇'],
    ['神秘博士元旦特辑：戴立克的革命'],
    ['命中注定我爱你番外篇'],
    ['海贼王剧场版：红发歌姬'],
    ['某动漫 OVA'],
    ['某动漫OAD合集'],
    ['名侦探柯南SP'],
    ['Doctor Who Specials'],
    ['某剧 第0季'],
    ['某剧 Season 0'],
    ['某剧 S00'],
    ['某剧总集篇'],
    ['某动漫總集編'],
  ])('特别篇标记：%s', (name) => {
    expect(isSpecialEntryTitle(name)).toBe(true);
  });

  it.each([
    ['超人前传'],
    ['超人前传第一季'],
    ['Smallville S02'],
    // SPY 不含独立 SP（词边界）
    ['SPY×FAMILY'],
    // 无任何标记的外传型命名：关键词无法覆盖，归入第 1 季回退候选判定
    ['神秘博士：海魔传说'],
  ])('非特别篇：%s', (name) => {
    expect(isSpecialEntryTitle(name)).toBe(false);
  });

  it('正季条目带特别篇字样时，季号解析优先（调用方先走 extractSeasonNumber）', () => {
    // 约定：isSpecialEntryTitle 仅在 extractSeasonNumber 未命中时调用
    expect(extractSeasonNumber('某剧第一季特别篇合集')).toBe(1);
  });
});
