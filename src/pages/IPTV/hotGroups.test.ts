import { describe, it, expect } from 'vitest';
import { resolveHotGroups } from './hotGroups';

describe('resolveHotGroups', () => {
  const makeGroups = (names: string[]) =>
    names.map((name, i) => ({
      name,
      count: 100 - i,
      channels: [],
    }));

  it('空输入返回空数组', () => {
    expect(resolveHotGroups([])).toEqual([]);
  });

  it('匹配 CCTV 关键词', () => {
    const groups = makeGroups(['CCTV1', 'CCTV5', '体育频道']);
    const result = resolveHotGroups(groups);
    expect(result).toContain('CCTV1');
  });

  it('匹配卫视关键词', () => {
    const groups = makeGroups(['湖南卫视', '浙江卫视', '电影频道']);
    const result = resolveHotGroups(groups);
    expect(result).toContain('湖南卫视');
  });

  it('匹配体育关键词', () => {
    const groups = makeGroups(['体育频道', 'ESPN', '电影']);
    const result = resolveHotGroups(groups);
    expect(result).toContain('体育频道');
  });

  it('匹配少儿关键词', () => {
    const groups = makeGroups(['少儿频道', '卡通', '电影']);
    const result = resolveHotGroups(groups);
    expect(result).toContain('少儿频道');
  });

  it('匹配新闻关键词', () => {
    const groups = makeGroups(['新闻频道', '电影', '综艺']);
    const result = resolveHotGroups(groups);
    expect(result).toContain('新闻频道');
  });

  it('匹配港澳台关键词', () => {
    const groups = makeGroups(['港澳台', '凤凰', '电影']);
    const result = resolveHotGroups(groups);
    expect(result).toContain('港澳台');
  });

  it('最多返回 2 个热门分组', () => {
    const groups = makeGroups([
      'CCTV1', 'CCTV5', '湖南卫视', '浙江卫视',
      '体育频道', '少儿频道', '新闻频道',
    ]);
    const result = resolveHotGroups(groups);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('不足 2 个关键词匹配时按数量填充', () => {
    const groups = makeGroups(['未知分组A', '未知分组B', '未知分组C']);
    const result = resolveHotGroups(groups);
    expect(result.length).toBe(2);
    expect(result).toContain('未知分组A');
    expect(result).toContain('未知分组B');
  });

  it('大小写不敏感匹配', () => {
    const groups = makeGroups(['cctv1', 'cctv5']);
    const result = resolveHotGroups(groups);
    expect(result).toContain('cctv1');
  });

  it('去重：同一分组不重复出现', () => {
    // CCTV1 同时匹配 CCTV 和可能的其他关键词
    const groups = makeGroups(['CCTV1']);
    const result = resolveHotGroups(groups);
    expect(result.filter(g => g === 'CCTV1').length).toBe(1);
  });
});
