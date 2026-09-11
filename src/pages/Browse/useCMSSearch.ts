/**
 * CMS 直链搜索 Hook
 * 管理多源并行搜索、源状态追踪、**替换式分页**
 *
 * 分页模型（2026-09-12 用户拍板：右栏由无限滚动改为分页切换）：
 * - 旧实现是「追加式」：loadMore 让每个源各自 page+1 后 push 进 results，
 *   于是第 N 页显示的是 1~N 页的累积 —— 语义上是无限滚动不是分页，且无法回退。
 * - 现改为「替换式」：goToPage(query, n) 并发拉所有源的 pg=n，聚合后整体替换
 *   results。MacCMS 的 `?ac=videolist&wd=..&pg=n` 天然支持任意页码，所以「上一页」
 *   不需要快照栈，直接重新拉即可（代价是回退要重新请求，可接受）。
 * - 总页数不可知：接口返回体只有 `total`（该源该关键词总条数），没有 `limit` /
 *   `pagecount`，无法换算 totalPages → 只能做「上一页 / 下一页 + 第 N 页」，
 *   做不出数字页码条。hasMore 退化为「本页有内容，故下一页可能还有」。
 */
import { useState, useCallback, useRef } from 'react';
import { searchAllFromCMSSource } from '@/services/videoService';
import type { Video } from '@/types/video';

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
  /** 当前页码（1 起）。替换式分页下 = 所有源共同的页码。 */
  page: number;
}

const EMPTY_STATE: CMSSearchState = {
  results: [],
  loading: false,
  error: null,
  hasMore: false,
  failedSources: [],
  totalSources: 0,
  completedSources: 0,
  succeededSources: 0,
  sourcesDone: true,
  page: 1,
};

export function useCMSSearch() {
  const [state, setState] = useState<CMSSearchState>(EMPTY_STATE);

  /** 每个源的当前页码追踪（替换式分页下所有源同页码，保留 Map 以兼容多源异步完成） */
  const sourcePagesRef = useRef<Map<number, number>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  /** 获取所有选中的源索引（按 settings 启用的源 ID 解析，读取时实时派生） */
  const getSourceIndices = useCallback(async (): Promise<number[]> => {
    const { getEnabledVideoSourceIndices } = await import('@/services/sourceService');
    return getEnabledVideoSourceIndices();
  }, []);

  /**
   * 跳到第 page 页（替换式）：清空当前结果 → 并发拉所有源 pg=page → 整体替换。
   * 首个源响应即收起 loading（保留原有的渐进反馈），其余源在后台继续追加到本页。
   */
  const goToPage = useCallback(
    async (query: string, page: number) => {
      if (!query.trim()) {
        setState(EMPTY_STATE);
        return;
      }
      if (!Number.isFinite(page) || page < 1) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const sourceIndices = await getSourceIndices();
      sourcePagesRef.current.clear();
      sourceIndices.forEach((idx) => sourcePagesRef.current.set(idx, page));

      setState({
        results: [],
        loading: true,
        error: null,
        hasMore: false,
        failedSources: [],
        totalSources: sourceIndices.length,
        completedSources: 0,
        succeededSources: 0,
        sourcesDone: false,
        page,
      });

      // 按 sourceIndices 顺序预置槽位：并发响应顺序不定，落位固定 → 源间顺序稳定
      const slots: (CMSResultItem[] | null)[] = sourceIndices.map(() => null);
      const failed: string[] = [];
      let firstResponded = false;

      const flush = () => {
        setState((prev) => ({
          ...prev,
          results: slots.filter(Boolean).flat() as CMSResultItem[],
        }));
      };

      const searchSource = async (sourceIdx: number, slot: number) => {
        try {
          const result = await searchAllFromCMSSource(sourceIdx, query, page, {
            signal: ctrl.signal,
          });
          if (ctrl.signal.aborted) return;
          if (result.error) {
            failed.push(result.sourceName);
          } else if (result.items.length > 0) {
            slots[slot] = result.items.map((v) => ({
              ...v,
              cmsSourceName: result.sourceName,
              sourceIndex: result.sourceIndex,
            }));
            setState((prev) => ({ ...prev, succeededSources: prev.succeededSources + 1 }));
            flush();
          }
          if (!firstResponded) {
            firstResponded = true;
            setState((prev) => ({ ...prev, loading: false }));
          }
          setState((prev) => ({ ...prev, completedSources: prev.completedSources + 1 }));
        } catch {
          if (!ctrl.signal.aborted) {
            const sources = await import('@/services/sourceService').then((m) => m.getVideoSources());
            failed.push(sources[sourceIdx]?.name ?? `源${sourceIdx}`);
            setState((prev) => ({ ...prev, completedSources: prev.completedSources + 1 }));
          }
        }
      };

      await Promise.allSettled(sourceIndices.map((idx, i) => searchSource(idx, i)));

      if (!ctrl.signal.aborted) {
        const merged = slots.filter(Boolean).flat() as CMSResultItem[];
        setState((prev) => ({
          ...prev,
          loading: false,
          failedSources: failed,
          sourcesDone: true,
          // 兜底：全部 settled 后与总数对齐，避免个别异常路径漏计数
          completedSources: sourceIndices.length,
          // 本页有内容 → 下一页大概率还有（无 totalPages 可用，只能探测式）
          hasMore: merged.length > 0,
          error: failed.length === sourceIndices.length ? '所有源搜索失败' : null,
        }));
      }
    },
    [getSourceIndices],
  );

  /** 搜索指定关键词（= 跳到第 1 页） */
  const search = useCallback(
    (query: string) => goToPage(query, 1),
    [goToPage],
  );

  /** 重置搜索状态 */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    sourcePagesRef.current.clear();
    setState(EMPTY_STATE);
  }, []);

  return {
    ...state,
    search,
    goToPage,
    reset,
    /** 上一页是否可用（替换式分页下页码即真相，无需快照栈） */
    canGoBack: state.page > 1,
  };
}
