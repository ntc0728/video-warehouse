/**
 * 用户数据状态管理
 * 管理视频收藏、观看历史记录
 * 观看历史按视频+剧集维度去重，重复观看会更新进度而非新增记录
 *
 * [数据存储] 使用 IndexedDB 持久化，Zustand 仅管理内存状态
 * [数据迁移] 首次加载时从 localStorage `user-store` 迁移到 IndexedDB
 */
import { create } from 'zustand';
import type { CollectionRecord, HistoryRecord } from '@/types/store';
import type { VideoType } from '@/types/video';
import {
  getCollections,
  addCollectionRecord,
  removeCollectionByVideoId,
  clearCollections as clearCollectionsDB,
  getHistory,
  upsertHistoryRecord,
  removeHistoryRecord,
  clearHistory as clearHistoryDB,
} from '@/services/database';

interface UserState {
  collections: CollectionRecord[];
  history: HistoryRecord[];
  _initialized: boolean;
  _loading: boolean;

  addCollection: (videoId: string, meta?: { title?: string; cover?: string; type?: VideoType; year?: number; rating?: number; sourceIndex?: number }) => void;
  removeCollection: (videoId: string) => void;
  clearCollections: () => void;
  isCollected: (videoId: string) => boolean;

  addHistory: (record: Omit<HistoryRecord, 'id' | 'updatedAt'>) => void;
  updateHistoryProgress: (params: {
    videoId: string;
    progress: number;
    duration: number;
    title?: string;
    cover?: string;
    backdrop?: string;
    cmsSourceId?: string;
    cmsSourceName?: string;
    episodeLabel?: string;
    vodId?: string;
    episodeUrl?: string;
    seasonNumber?: number;
    rating?: number;
  }) => void;
  getHistoryByVideo: (videoId: string) => HistoryRecord | undefined;
  removeHistory: (historyId: string) => void;
  /** 立即落库所有待写入的历史记录（节流 flush 的即时版） */
  flushHistoryNow: () => void;
  /** 删除指定视频的全部历史记录（含电影多线路 / 剧集多季多集的所有记录） */
  removeHistoryByVideo: (videoId: string) => void;
  clearHistory: () => void;

  _loadFromDB: () => Promise<void>;
}

/**
 * 一次性清理历史遗留记录（电影线路独立去重键 + D4 剧集误写电影键的脏记录）：
 *   - id === `hist-{videoId}`（无线路后缀的电影形态）且 seasonNumber != null
 *     → 历史 bug 产生的污染记录（剧集进度误写入电影键），无内容身份，删除
 *   - id === `hist-{videoId}`（老电影记录）且同 videoId 已存在 `hist-{videoId}-` 前缀的新记录
 *     → 老记录已被新的线路独立记录取代，删除
 * 仅当同 videoId 存在新形态记录时才删老电影记录，避免误删仍在使用（从未播放新线路）的老数据。
 */
async function cleanupLegacyHistoryRecords(): Promise<void> {
  try {
    const records = await getHistory();
    if (records.length === 0) return;

    const newIds = new Set<string>();
    for (const r of records) {
      if (r.id && r.videoId && r.id.startsWith(`hist-${r.videoId}-`)) newIds.add(r.videoId);
    }

    const toRemove = records.filter((r) => {
      if (!r.id || !r.videoId) return false;
      if (r.id !== `hist-${r.videoId}`) return false; // 仅无线路后缀的电影形态
      if (r.seasonNumber != null) return true;        // D4 脏记录（剧集误写电影键）
      return newIds.has(r.videoId);                    // 老电影记录，已被新线路记录取代
    });

    if (toRemove.length === 0) return;

    for (const r of toRemove) {
      await removeHistoryRecord(r.id!);
    }
    // 同步清理内存态，避免当前会话仍展示脏记录
    const ids = new Set(toRemove.map((r) => r.id!));
    useUserStore.setState((state) => ({ history: state.history.filter((h) => !ids.has(h.id)) }));
  } catch {
    // 清理失败不影响主流程
  }
}

// ── 历史记录节流落库（P4 优化）──────────────────────────────
// 播放进度 timeupdate 事件高频触发（约 250ms~1s 一次），若每次都写 IndexedDB
// 会产生大量事务。改为「内存更新 + 节流批量落库」：
//   - addHistory 只更新内存态，并把该记录标记为「脏」，调度 3s 节流定时器；
//   - 定时器触发（或页面退场/隐藏）时，把脏记录一次性批量 upsert；
//   - 退场兜底：pagehide / visibilitychange(hidden) 时立即 flush，避免丢失。
const HISTORY_FLUSH_MS = 3000;
/** 脏记录集合：dedupId → HistoryRecord（upsert 幂等，可安全覆盖旧值） */
let historyDirtyRecords = new Map<string, HistoryRecord>();
let historyFlushTimer: ReturnType<typeof setTimeout> | null = null;

/** 批量落库：把脏记录一次性写入 IndexedDB（独立于 store，供 flush 调用） */
function flushHistoryRecords(): void {
  if (historyFlushTimer) {
    clearTimeout(historyFlushTimer);
    historyFlushTimer = null;
  }
  if (historyDirtyRecords.size === 0) return;
  const records = Array.from(historyDirtyRecords.values());
  historyDirtyRecords = new Map();
  // 批量写入，任一条失败不阻塞其余记录；失败静默（下次进度更新会再次标记脏）
  records.forEach((r) => { upsertHistoryRecord(r).catch(() => { historyDirtyRecords.set(r.id!, r); }); });
}

function scheduleHistoryFlush(): void {
  if (historyFlushTimer) return;
  historyFlushTimer = setTimeout(flushHistoryRecords, HISTORY_FLUSH_MS);
}

/** 立即落库（供 Player 退场 / 页面隐藏兜底调用） */
function flushHistoryNow(): void {
  flushHistoryRecords();
}

if (typeof window !== 'undefined') {
  const onPageHide = () => flushHistoryNow();
  const onVisibilityHidden = () => { if (document.visibilityState === 'hidden') flushHistoryNow(); };
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibilityHidden);
}

/** 从 localStorage 迁移旧数据到 IndexedDB */
async function migrateFromLocalStorage(): Promise<void> {
  try {
    const raw = localStorage.getItem('user-store');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    if (!state) return;

    // 迁移收藏
    if (Array.isArray(state.collections)) {
      for (const col of state.collections) {
        await addCollectionRecord(col);
      }
    }

    // 迁移历史
    if (Array.isArray(state.history)) {
      for (const hist of state.history) {
        await upsertHistoryRecord(hist);
      }
    }

    // 迁移完成后删除旧数据
    localStorage.removeItem('user-store');
  } catch {
    // migration failed, ignore
  }
}

export const useUserStore = create<UserState>()((set, get) => ({
  collections: [],
  history: [],
  _initialized: false,
  _loading: true,

  /** 从 IndexedDB 加载所有数据 */
  _loadFromDB: async () => {
    if (get()._initialized) return;

    try {
      await migrateFromLocalStorage();

      const [collections, history] = await Promise.all([
        getCollections(),
        getHistory(),
      ]);

      set({ collections, history, _initialized: true, _loading: false });

      // 后台异步清理历史遗留记录（不阻塞初始化）
      cleanupLegacyHistoryRecords();
    } catch (err) {
      console.error('Failed to load user data from IndexedDB:', err);
      // 允许重试：不清除 _initialized 标记
      set({ _loading: false });
    }
  },

  /**
   * 添加视频到收藏，已收藏的视频不会重复添加
   */
  addCollection: (videoId, meta) => {
    const existing = get().collections.find((c) => c.videoId === videoId);
    if (existing) return;

    const newCollection: CollectionRecord = {
      id: `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      videoId,
      addedAt: Date.now(),
      title: meta?.title,
      cover: meta?.cover,
      type: meta?.type,
      year: meta?.year,
      rating: meta?.rating,
      sourceIndex: meta?.sourceIndex,
    };

    // 写入内存
    set((state) => ({
      collections: [...state.collections, newCollection],
    }));

    // 异步写入 IndexedDB
    addCollectionRecord(newCollection).catch(console.error);
  },

  removeCollection: (videoId) => {
    set((state) => ({
      collections: state.collections.filter((c) => c.videoId !== videoId),
    }));
    removeCollectionByVideoId(videoId).catch(console.error);
  },

  clearCollections: () => {
    set({ collections: [] });
    clearCollectionsDB().catch(console.error);
  },

  isCollected: (videoId) =>
    get().collections.some((c) => c.videoId === videoId),

  /**
   * 添加或更新观看历史
   * 同一内容身份的记录会更新进度和时间，而非重复创建；「最后播放」覆盖旧进度。
   * 去重（内容身份）策略：
   *   - 电影：按 videoId + 线路 URL 去重 —— 每条线路各自独立维护进度
   *   - 剧集：按 videoId + 季号 + 集标题 去重 —— 不同 CMS 源下相同选季/选集共享同一条进度
   * 源相关字段（cmsSourceId / episodeUrl / vodId）仍记录「最后播放的那次」，仅用于续播定位。
   */
  addHistory: (record) => {
    // 去重键（同时作为持久化 id）：
    //   电影：按 videoId + 线路 URL —— 每条线路独立进度记录，互不覆盖
    //   剧集：按 videoId + 季号 + 集标题 —— 相同选季/选集在不同 CMS 源之间共享同一条进度记录
    // 区分电影/剧集的依据是 seasonNumber：电影无剧集概念（undefined），剧集必有季号。
    // （注意：电影写入时 episodeLabel 实际被置为线路名称，不能用作区分判据。）
    // 这样「最后播放的进度」始终覆盖同一条记录，满足全局规则：
    //   - 相同电影的不同线路各自独立进度
    //   - 相同剧集/相同选季/相同选集，不同源进度保持一致
    // 注意：cmsSourceId / vodId 等「源相关」字段仍会被最后播放的那次覆盖，
    // 仅用于在该源上续播，不改变进度归属的内容身份。
    const isEpisodic = record.seasonNumber != null && !!record.episodeLabel;
    const dedupId = isEpisodic
      ? `hist-${record.videoId}-s${record.seasonNumber}-${record.episodeLabel}`
      : `hist-${record.videoId}-${record.episodeUrl ?? ''}`;

    const existingIndex = get().history.findIndex((h) => h.id === dedupId);

    if (existingIndex >= 0) {
      const updated = { ...get().history[existingIndex] };
      updated.progress = record.progress;
      updated.duration = record.duration;
      updated.title = record.title || updated.title;
      updated.cover = record.cover || updated.cover;
      updated.backdrop = record.backdrop || updated.backdrop;
      updated.cmsSourceId = record.cmsSourceId || updated.cmsSourceId;
      updated.cmsSourceName = record.cmsSourceName || updated.cmsSourceName;
      updated.episodeLabel = record.episodeLabel || updated.episodeLabel;
      updated.vodId = record.vodId || updated.vodId;
      updated.episodeUrl = record.episodeUrl || updated.episodeUrl;
      updated.seasonNumber = record.seasonNumber ?? updated.seasonNumber;
      updated.currentSeasonId = record.currentSeasonId || updated.currentSeasonId;
      updated.rating = record.rating ?? updated.rating;
      updated.updatedAt = Date.now();

      set((state) => ({
        history: state.history.map((h, i) => i === existingIndex ? updated : h),
      }));
      // P4 节流落库：标记脏并调度批量写入（替代每次直接 upsert）
      historyDirtyRecords.set(dedupId, updated);
      scheduleHistoryFlush();
    } else {
      const newHistory: HistoryRecord = {
        ...record,
        id: dedupId,
        updatedAt: Date.now(),
      };
      set((state) => ({
        history: [...state.history, newHistory],
      }));
      historyDirtyRecords.set(dedupId, newHistory);
      scheduleHistoryFlush();
    }
  },

  updateHistoryProgress: (params) => {
    get().addHistory(params);
  },

  getHistoryByVideo: (videoId) => {
    // 内存态 history 不保证按 updatedAt 排序（新记录 append、更新原地修改），
    // 这里按 updatedAt 倒序取「最近一次播放」的记录，确保选集/线路回显最新进度。
    const records = get().history.filter((h) => h.videoId === videoId);
    if (records.length === 0) return undefined;
    return records.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  },

  removeHistory: (historyId) => {
    set((state) => ({
      history: state.history.filter((h) => h.id !== historyId),
    }));
    // 同步清除节流脏记录，避免 flush 把已删除记录重新写回
    historyDirtyRecords.delete(historyId);
    removeHistoryRecord(historyId).catch(console.error);
  },

  removeHistoryByVideo: (videoId) => {
    const removed = get().history.filter((h) => h.videoId === videoId);
    set((state) => ({
      history: state.history.filter((h) => h.videoId !== videoId),
    }));
    removed.forEach((h) => {
      historyDirtyRecords.delete(h.id!);
      removeHistoryRecord(h.id).catch(console.error);
    });
  },

  clearHistory: () => {
    set({ history: [] });
    // 清空脏记录集合，避免 flush 重新写回
    historyDirtyRecords = new Map();
    clearHistoryDB().catch(console.error);
  },

  /** 立即落库所有待写入的历史记录（Player 退场 / 页面隐藏已由全局监听兜底） */
  flushHistoryNow: () => {
    flushHistoryNow();
  },
}));
