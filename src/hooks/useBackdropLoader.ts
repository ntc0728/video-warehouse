/**
 * useBackdropLoader — 历史页 backdrop 自动补全 hook
 *
 * 对历史记录中 videoId 以 "tmdb-" 开头且无 backdrop 的条目：
 * 1. 先从 useTMDBStore 内存中查找 backdropPath
 * 2. 找到 → 构建完整 URL 并回写到 useUserStore 的 history
 * 3. 未找到 → 异步调用 TMDB 详情 API 获取，成功后回写
 * 4. 去重 + 防重复请求，批量限制并发数
 */
import { useEffect, useRef, useCallback } from 'react';
import { useUserStore } from '@/stores';
import { useTMDBStore } from '@/stores/useTMDBStore';
import { fetchMovieDetail, fetchTVDetail, buildImageUrl } from '@/services/tmdbService';
import type { HistoryRecord } from '@/types/store';

/** TMDB store 中所有 TMDBVideoItem 的 section key */
const TMDB_SECTION_KEYS = [
  'trending',
  'nowPlaying',
  'popularMovies',
  'topRatedMovies',
  'upcomingMovies',
  'popularTv',
  'topRatedTv',
  'airingTodayTv',
  'discoverResults',
] as const;

/** 从 TMDB store 内存中查找 backdropPath */
function findBackdropInStore(videoId: string): string | null {
  const state = useTMDBStore.getState();
  for (const key of TMDB_SECTION_KEYS) {
    const section = state[key] as unknown as { id: string; backdropPath: string | null }[] | undefined;
    if (!section) continue;
    const item = section.find((s) => s.id === videoId);
    if (item?.backdropPath) {
      return buildImageUrl(item.backdropPath, 'w780');
    }
  }
  return null;
}

/** 解析 tmdb videoId 为 mediaType + tmdbId */
function parseTmdbId(videoId: string): { mediaType: 'movie' | 'tv'; tmdbId: number } | null {
  if (!videoId.startsWith('tmdb-')) return null;
  const parts = videoId.replace('tmdb-', '').split('-');
  const mt = parts[0] as 'movie' | 'tv';
  if (mt !== 'movie' && mt !== 'tv') return null;
  const tid = parseInt(parts.slice(1).join('-'), 10);
  if (isNaN(tid)) return null;
  return { mediaType: mt, tmdbId: tid };
}

/** 并发限制：并发执行 async 任务，返回 Promise.all */
function asyncPool(
  tasks: (() => Promise<void>)[],
  concurrency: number,
): Promise<void> {
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      try {
        await tasks[i]();
      } catch {
        // 单个任务失败不影响其他
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => runNext());
  return Promise.all(workers).then(() => {});
}

/**
 * 自动补全历史记录中缺失的 backdrop
 * @param historyRecords 当前展示的历史记录列表
 * @param enabled 是否启用（仅在 video tab 时启用）
 */
export function useBackdropLoader(
  historyRecords: HistoryRecord[],
  enabled: boolean,
): void {
  const processedRef = useRef(new Set<string>());

  const backfillBackdrop = useCallback(async (record: HistoryRecord) => {
    const { videoId } = record;
    if (processedRef.current.has(videoId)) return;

    // 1. 尝试从内存查找
    const backdropFromStore = findBackdropInStore(videoId);
    if (backdropFromStore) {
      processedRef.current.add(videoId);
      useUserStore.getState().addHistory({
        ...record,
        backdrop: backdropFromStore,
      });
      return;
    }

    // 2. 解析 tmdbId，调 API
    const parsed = parseTmdbId(videoId);
    if (!parsed) return;

    processedRef.current.add(videoId);
    try {
      const detail = parsed.mediaType === 'tv'
        ? await fetchTVDetail(parsed.tmdbId)
        : await fetchMovieDetail(parsed.tmdbId);

      const backdropUrl = detail.backdrop_path
        ? buildImageUrl(detail.backdrop_path, 'w780') || undefined
        : undefined;

      if (backdropUrl) {
        useUserStore.getState().addHistory({
          ...record,
          backdrop: backdropUrl,
        });
      }
    } catch {
      // API 失败不影响主流程，下次进入页面会重试
      processedRef.current.delete(videoId);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // 筛选需要补全的记录
    const needsBackdrop = historyRecords.filter(
      (r) => r.videoId.startsWith('tmdb-') && !r.backdrop && !processedRef.current.has(r.videoId),
    );

    if (needsBackdrop.length === 0) return;

    // 限制最多补全 20 条，避免大量并发请求
    const batch = needsBackdrop.slice(0, 20);
    const tasks = batch.map((r) => () => backfillBackdrop(r));
    asyncPool(tasks, 3);
  }, [historyRecords, enabled, backfillBackdrop]);
}
