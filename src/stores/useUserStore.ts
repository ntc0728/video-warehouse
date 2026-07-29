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
  }) => void;
  getHistoryByVideo: (videoId: string) => HistoryRecord | undefined;
  removeHistory: (historyId: string) => void;
  clearHistory: () => void;

  _loadFromDB: () => Promise<void>;
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
   * 同一集的记录会更新进度和时间，而非重复创建
   * 去重策略：
   *   - 电影：按 videoId 去重
   *   - 剧集：按 videoId + episodeUrl 去重（同一集换源才替换，不同集新增）
   */
  addHistory: (record) => {
    // 按 videoId + episodeUrl 去重
    // 电影无 episodeUrl，只按 videoId 匹配
    // 剧集有 episodeUrl，需要同时匹配 videoId 和 episodeUrl
    const existingIndex = record.episodeUrl
      ? get().history.findIndex((h) => h.videoId === record.videoId && h.episodeUrl === record.episodeUrl)
      : get().history.findIndex((h) => h.videoId === record.videoId && !h.episodeUrl);

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
      updated.updatedAt = Date.now();

      set((state) => ({
        history: state.history.map((h, i) => i === existingIndex ? updated : h),
      }));
      upsertHistoryRecord(updated).catch(console.error);
    } else {
      const newHistory: HistoryRecord = {
        ...record,
        id: `hist-${Date.now()}-${Math.random().toString(36).substr(9, 9)}`,
        updatedAt: Date.now(),
      };
      set((state) => ({
        history: [...state.history, newHistory],
      }));
      upsertHistoryRecord(newHistory).catch(console.error);
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
    removeHistoryRecord(historyId).catch(console.error);
  },

  clearHistory: () => {
    set({ history: [] });
    clearHistoryDB().catch(console.error);
  },
}));
