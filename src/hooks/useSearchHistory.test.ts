import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchHistory, type SearchHistoryItem } from './useSearchHistory';

const KEY = 'search-history-test-scope';

describe('useSearchHistory（历史项带类型/年份元数据）', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
  });

  it('纯字符串入参归一化为无元数据历史项', () => {
    const { result } = renderHook(() => useSearchHistory('test-scope'));
    act(() => result.current.addHistory('神秘博士'));
    expect(result.current.history).toEqual([{ query: '神秘博士' }]);
  });

  it('带元数据入参完整保留 mediaType/year', () => {
    const { result } = renderHook(() => useSearchHistory('test-scope'));
    act(() => result.current.addHistory({ query: '神秘博士', mediaType: 'tv', year: 2005 }));
    expect(result.current.history).toEqual([{ query: '神秘博士', mediaType: 'tv', year: 2005 }]);
  });

  it('增量去重：同词不同类型/年份各自保留（互不覆盖）', () => {
    const { result } = renderHook(() => useSearchHistory('test-scope'));
    act(() => result.current.addHistory({ query: '神秘博士', mediaType: 'tv', year: 2005 }));
    act(() => result.current.addHistory({ query: '神秘博士', mediaType: 'movie', year: 2023 }));
    expect(result.current.history).toHaveLength(2);
    // 新项在最前
    expect(result.current.history[0]).toEqual({ query: '神秘博士', mediaType: 'movie', year: 2023 });
    expect(result.current.history[1]).toEqual({ query: '神秘博士', mediaType: 'tv', year: 2005 });
  });

  it('完全相同项（三元组一致）去重并移到最前', () => {
    const { result } = renderHook(() => useSearchHistory('test-scope'));
    act(() => result.current.addHistory({ query: 'A', mediaType: 'tv', year: 2001 }));
    act(() => result.current.addHistory({ query: 'B' }));
    act(() => result.current.addHistory({ query: 'A', mediaType: 'tv', year: 2001 }));
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0].query).toBe('A');
    expect(result.current.history[1].query).toBe('B');
  });

  it('同词同类型但年份不同视为不同条目', () => {
    const { result } = renderHook(() => useSearchHistory('test-scope'));
    act(() => result.current.addHistory({ query: 'A', mediaType: 'tv', year: 2005 }));
    act(() => result.current.addHistory({ query: 'A', mediaType: 'tv', year: 2023 }));
    expect(result.current.history).toHaveLength(2);
  });

  it('兼容旧格式：localStorage 中的纯字符串数组加载后归一化，混合格式共存', () => {
    localStorage.setItem(KEY, JSON.stringify(['旧词条', { query: '新词条', mediaType: 'movie', year: 2023 }]));
    const { result } = renderHook(() => useSearchHistory('test-scope'));
    expect(result.current.history).toEqual([
      { query: '旧词条' },
      { query: '新词条', mediaType: 'movie', year: 2023 },
    ]);
  });

  it('removeHistory 按三元组精确删除，同词其他元数据条目保留', () => {
    const { result } = renderHook(() => useSearchHistory('test-scope'));
    const tv: SearchHistoryItem = { query: '神秘博士', mediaType: 'tv', year: 2005 };
    const movie: SearchHistoryItem = { query: '神秘博士', mediaType: 'movie', year: 2023 };
    act(() => result.current.addHistory(tv));
    act(() => result.current.addHistory(movie));
    act(() => result.current.removeHistory(tv));
    expect(result.current.history).toEqual([movie]);
  });

  it('超上限 MAX 条时最旧的被挤出', () => {
    const { result } = renderHook(() => useSearchHistory('test-scope'));
    for (let i = 0; i < 12; i++) {
      act(() => result.current.addHistory(`词${i}`));
    }
    expect(result.current.history).toHaveLength(10);
    expect(result.current.history[0].query).toBe('词11');
    expect(result.current.history[9].query).toBe('词2');
  });

  it('持久化到 localStorage（新格式对象数组）', () => {
    const { result } = renderHook(() => useSearchHistory('test-scope'));
    act(() => result.current.addHistory({ query: '神秘博士', mediaType: 'tv', year: 2005 }));
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    expect(raw).toEqual([{ query: '神秘博士', mediaType: 'tv', year: 2005 }]);
  });
});
