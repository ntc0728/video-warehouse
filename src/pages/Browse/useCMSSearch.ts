/**
 * CMS 直链搜索 Hook
 * 管理多源并行搜索、逐源加载、滚动分页、源状态追踪
 */
import { useState, useCallback, useRef } from 'react';
import { searchAllFromCMSSource } from '@/services/videoService';
import type { Video } from '@/types/video';
import { useSettingsStore } from '@/stores';

export interface CMSResultItem extends Video {
  cmsSourceName: string;
  sourceIndex: number;
}

interface CMSSearchState {
  results: CMSResultItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  failedSources: string[];
  /** 源状态追踪 */
  totalSources: number;
  completedSources: number;
  succeededSources: number;
  /** 所有源是否都已完成 */
  sourcesDone: boolean;
}

export function useCMSSearch() {
  const { videoSourceIndex, videoSourceIndices } = useSettingsStore();
  const [state, setState] = useState<CMSSearchState>({
    results: [],
    loading: false,
    error: null,
    hasMore: false,
    failedSources: [],
    totalSources: 0,
    completedSources: 0,
    succeededSources: 0,
    sourcesDone: true,
  });

  // 每个源的当前页码追踪
  const sourcePagesRef = useRef<Map<number, number>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  /** 获取所有选中的源索引 */
  const getSourceIndices = useCallback(() => {
    return videoSourceIndices && videoSourceIndices.length > 0
      ? videoSourceIndices
      : [videoSourceIndex];
  }, [videoSourceIndex, videoSourceIndices]);

  /** 搜索指定关键词（重置状态） */
  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setState({
        results: [], loading: false, error: null, hasMore: false, failedSources: [],
        totalSources: 0, completedSources: 0, succeededSources: 0, sourcesDone: true,
      });
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const sourceIndices = getSourceIndices();
    sourcePagesRef.current.clear();
    sourceIndices.forEach(idx => sourcePagesRef.current.set(idx, 1));

    setState({
      results: [], loading: true, error: null, hasMore: false, failedSources: [],
      totalSources: sourceIndices.length, completedSources: 0, succeededSources: 0, sourcesDone: false,
    });

    const failed: string[] = [];
    let firstSourceResponded = false;

    const searchSource = async (sourceIdx: number) => {
      try {
        const result = await searchAllFromCMSSource(sourceIdx, query, 1, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        if (result.error) {
          failed.push(result.sourceName);
        } else if (result.items.length > 0) {
          const items = result.items.map(v => ({ ...v, cmsSourceName: result.sourceName, sourceIndex: result.sourceIndex }));
          // 第一个源响应后关闭 loading
          if (!firstSourceResponded) {
            firstSourceResponded = true;
            setState(prev => ({
              ...prev,
              results: [...prev.results, ...items],
              loading: false,
              hasMore: result.total > result.items.length,
              completedSources: prev.completedSources + 1,
              succeededSources: prev.succeededSources + 1,
            }));
          } else {
            setState(prev => ({
              ...prev,
              results: [...prev.results, ...items],
              hasMore: result.total > result.items.length,
              completedSources: prev.completedSources + 1,
              succeededSources: prev.succeededSources + 1,
            }));
          }
        } else {
          // 有响应但无结果，也算完成
          setState(prev => ({
            ...prev,
            completedSources: prev.completedSources + 1,
          }));
        }
      } catch {
        if (!ctrl.signal.aborted) {
          const sources = await import('@/services/sourceService').then(m => m.getVideoSources());
          failed.push(sources[sourceIdx]?.name ?? `源${sourceIdx}`);
          setState(prev => ({
            ...prev,
            completedSources: prev.completedSources + 1,
          }));
        }
      }
    };

    await Promise.allSettled(sourceIndices.map(searchSource));

    if (!ctrl.signal.aborted) {
      setState(prev => ({
        ...prev,
        loading: false,
        failedSources: failed,
        sourcesDone: true,
        error: failed.length === sourceIndices.length ? '所有源搜索失败' : null,
      }));
    }
  }, [getSourceIndices]);

  /** 加载更多（当前源优先，其余源后台追加） */
  const loadMore = useCallback(async (query: string) => {
    if (!query.trim() || state.loading) return;

    // 取消之前的 loadMore 请求
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const sourceIndices = getSourceIndices();
    const loadingSources = sourceIndices.filter(idx => {
      const currentPage = sourcePagesRef.current.get(idx) ?? 1;
      return currentPage >= 1;
    });

    if (loadingSources.length === 0) {
      setState(prev => ({ ...prev, hasMore: false }));
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    const newResults: CMSResultItem[] = [];

    // 先加载第一个源的下一页（用户可见）
    const firstIdx = loadingSources[0];
    const firstPage = (sourcePagesRef.current.get(firstIdx) ?? 1) + 1;
    try {
      const result = await searchAllFromCMSSource(firstIdx, query, firstPage, { signal: ctrl.signal });
      if (!ctrl.signal.aborted && result.items.length > 0) {
        sourcePagesRef.current.set(firstIdx, firstPage);
        newResults.push(...result.items.map(v => ({ ...v, cmsSourceName: result.sourceName, sourceIndex: result.sourceIndex })));
      }
    } catch { /* ignore */ }

    if (ctrl.signal.aborted) return;

    // 其余源在后台加载
    const restIndices = loadingSources.slice(1);
    await Promise.allSettled(restIndices.map(async idx => {
      const nextPage = (sourcePagesRef.current.get(idx) ?? 1) + 1;
      try {
        const result = await searchAllFromCMSSource(idx, query, nextPage, { signal: ctrl.signal });
        if (!ctrl.signal.aborted && result.items.length > 0) {
          sourcePagesRef.current.set(idx, nextPage);
          newResults.push(...result.items.map(v => ({ ...v, cmsSourceName: result.sourceName, sourceIndex: result.sourceIndex })));
        }
      } catch { /* ignore */ }
    }));

    if (!ctrl.signal.aborted) {
      if (newResults.length > 0) {
        setState(prev => ({
          ...prev,
          results: [...prev.results, ...newResults],
          loading: false,
        }));
      } else {
        setState(prev => ({ ...prev, loading: false, hasMore: false }));
      }
    }
  }, [state.loading, getSourceIndices]);

  /** 重置搜索状态 */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    sourcePagesRef.current.clear();
    setState({
      results: [], loading: false, error: null, hasMore: false, failedSources: [],
      totalSources: 0, completedSources: 0, succeededSources: 0, sourcesDone: true,
    });
  }, []);

  return { ...state, search, loadMore, reset };
}
