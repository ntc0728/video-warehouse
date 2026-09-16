/**
 * useBackdropLoader — 历史页 backdrop 自动补全 hook
 *
 * 对历史记录中 videoId 以 "tmdb-" 开头且无 backdrop 的条目：
 * 1. 先从 useTMDBStore 内存中查找 backdropPath
 * 2. 找到 → 构建完整 URL 并回写到 useUserStore 的 history
 * 3. 未找到 → 异步调用 TMDB 详情 API 获取，成功后回写
 * 4. 去重 + 防重复请求，批量限制并发数
 *
 * [2026-08-13] 批量提交：原先每条成功都调一次 useUserStore.setState（全量 map history
 * + 写 IndexedDB），20 条陆续返回 = 最多 20 次连锁重渲染（历史页所有卡片重渲染）→
 * 进入历史页明显卡顿。改为收集 pending，全部完成后一次性 setState + 批量写库。
 *
 * [2026-09-16] 消除 N+1 与重复重试（评审 P1「History 背景图 N+1」）：
 * 1. **按 videoId 去重后再取前 20 个名额**——同一影片会有多条记录（多集/多线路），
 *    原实现未去重，一部 10 集的剧能吃掉 10 个名额，实际只补到几部片子。
 * 2. **新增跨挂载结果缓存**（`backdropCache`，含「查过但没有」的负结果）——
 *    原 `processedRef` 是 per-mount 的，每次回到历史页都会对同一批影片重发请求；
 *    负结果还会因 `processedRef.delete` 被无限重试。缓存后同一次会话内零重复请求。
 */
import { useEffect, useRef, useCallback } from 'react';
import { useUserStore } from '@/stores';
import { useTMDBStore } from '@/stores/useTMDBStore';
import { fetchMovieBasic, fetchTVBasic, buildImageUrl } from '@/services/tmdbService';
import type { HistoryRecord } from '@/types/store';

/**
 * backdrop 查询结果缓存：`videoId → url | null`。
 * - `url` 为 null 表示「已查过、TMDB 确实没有 backdrop」——负结果同样要缓存，
 *   否则每次进入历史页都会对这批无图影片重发一轮请求（原实现的真实行为）。
 * - TTL 6h：TMDB 的图不会频繁变，但保留过期重查的口子。
 * - 与 `processedRef` 的分工：processedRef 管「本次挂载内不重复排队」，
 *   本缓存管「跨挂载不重复请求」。
 */
const BACKDROP_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const backdropCache = new Map<string, { url: string | null; at: number }>();

function readBackdropCache(videoId: string): { hit: boolean; url: string | null } {
  const entry = backdropCache.get(videoId);
  if (!entry) return { hit: false, url: null };
  if (Date.now() - entry.at > BACKDROP_CACHE_TTL_MS) {
    backdropCache.delete(videoId);
    return { hit: false, url: null };
  }
  return { hit: true, url: entry.url };
}

function writeBackdropCache(videoId: string, url: string | null) {
  backdropCache.set(videoId, { url, at: Date.now() });
}

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
  /** [2026-08-13] 本次补全收集到的 { videoId, backdrop }（避免逐条 setState） */
  const pendingRef = useRef<{ videoId: string; backdrop: string }[]>([]);

  const backfillBackdrop = useCallback(async (record: HistoryRecord) => {
    const { videoId } = record;
    if (processedRef.current.has(videoId)) return;

    // 0. 跨挂载缓存（含负结果）：命中直接出结果，零请求
    const cached = readBackdropCache(videoId);
    if (cached.hit) {
      processedRef.current.add(videoId);
      if (cached.url) pendingRef.current.push({ videoId, backdrop: cached.url });
      return;
    }

    // 1. 尝试从内存查找
    const backdropFromStore = findBackdropInStore(videoId);
    if (backdropFromStore) {
      processedRef.current.add(videoId);
      pendingRef.current.push({ videoId, backdrop: backdropFromStore });
      writeBackdropCache(videoId, backdropFromStore);
      return;
    }

    // 2. 解析 tmdbId，调 API
    const parsed = parseTmdbId(videoId);
    if (!parsed) return;

    processedRef.current.add(videoId);
    try {
      const detail = parsed.mediaType === 'tv'
        ? await fetchTVBasic(parsed.tmdbId)
        : await fetchMovieBasic(parsed.tmdbId);

      const backdropUrl = detail.backdrop_path
        ? buildImageUrl(detail.backdrop_path, 'w780') || null
        : null;

      // 负结果也缓存：该片 TMDB 确实没有 backdrop，避免每次进页重查
      writeBackdropCache(videoId, backdropUrl);
      if (backdropUrl) {
        pendingRef.current.push({ videoId, backdrop: backdropUrl });
      }
    } catch {
      // API 失败不影响主流程；**不写缓存**，下次进入页面会重试
      processedRef.current.delete(videoId);
    }
  }, []);

  /** [2026-08-13] 批量提交：pending 全部就绪后一次性 setState + 批量写库。
   * 同一 videoId 可能有多条记录（电影多线路 / 剧集多集），历史页展示的是
   * updatedAt 最新的那条，补全目标必须是「最新」记录而非数组第一条。 */
  const commitPending = useCallback(async () => {
    const pending = pendingRef.current;
    pendingRef.current = [];
    if (pending.length === 0) return;

    const { upsertHistoryRecord } = await import('@/services/database');
    const storeHistory = useUserStore.getState().history;

    // 每个 videoId 找到最新一条的索引
    const targetIdxByVideoId = new Map<string, number>();
    const latestAtByVideoId = new Map<string, number>();
    storeHistory.forEach((h, i) => {
      const cur = latestAtByVideoId.get(h.videoId);
      if (cur === undefined || (h.updatedAt ?? 0) > cur) {
        latestAtByVideoId.set(h.videoId, h.updatedAt ?? 0);
        targetIdxByVideoId.set(h.videoId, i);
      }
    });

    const updates: HistoryRecord[] = [];
    const pendingById = new Map<string, string>();
    for (const p of pending) pendingById.set(p.videoId, p.backdrop);

    const next = storeHistory.map((h, i) => {
      const idx = targetIdxByVideoId.get(h.videoId);
      if (idx !== i) return h;
      const backdrop = pendingById.get(h.videoId);
      if (!backdrop) return h;
      const updated = { ...h, backdrop };
      updates.push(updated);
      return updated;
    });

    if (updates.length > 0) {
      // 一次性同步内存（单次 setState，替代原先逐条 20 次连锁重渲染）
      useUserStore.setState({ history: next });
      // 批量异步写 IndexedDB（不阻塞渲染）
      await Promise.allSettled(updates.map((u) => upsertHistoryRecord(u)));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // 筛选需要补全的记录。
    // ⚠️ 必须**按 videoId 去重**后再取前 20：同一部影片会存在多条记录
    // （剧集每集一条、电影每条线路一条），不去重的话一部 10 集的剧就吃掉 10 个名额，
    // 20 个名额可能只覆盖 2~3 部片子（2026-09-16 评审 P1）。
    const seenVideoIds = new Set<string>();
    const needsBackdrop = historyRecords.filter((r) => {
      if (!r.videoId.startsWith('tmdb-')) return false;
      if (r.backdrop) return false;
      if (processedRef.current.has(r.videoId)) return false;
      if (seenVideoIds.has(r.videoId)) return false;
      seenVideoIds.add(r.videoId);
      return true;
    });

    if (needsBackdrop.length === 0) return;

    // 限制最多补全 20 条，避免大量并发请求
    const batch = needsBackdrop.slice(0, 20);
    const tasks = batch.map((r) => () => backfillBackdrop(r));
    pendingRef.current = [];
    void asyncPool(tasks, 3).then(() => commitPending());
  }, [historyRecords, enabled, backfillBackdrop, commitPending]);
}
