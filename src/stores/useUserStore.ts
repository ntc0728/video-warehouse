/**
 * 用户数据状态管理
 * 管理视频收藏、观看历史记录和评分记录
 * 观看历史按视频+剧集维度去重，重复观看会更新进度而非新增记录
 * 评分范围限定为 1-5 的整数
 *
 * [数据存储] 使用 IndexedDB 持久化，Zustand 仅管理内存状态
 * [数据迁移] 首次加载时从 localStorage `user-store` 迁移到 IndexedDB
 */
import { create } from 'zustand';
import type { CollectionRecord, HistoryRecord } from '@/types/store';
import type { VideoType } from '@/types/video';
import type { RatingRecord } from '@/services/database';
import {
  getCollections,
  addCollectionRecord,
  removeCollectionByVideoId,
  clearCollections as clearCollectionsDB,
  getHistory,
  upsertHistoryRecord,
  removeHistoryRecord,
  clearHistory as clearHistoryDB,
  getRatings,
  setRatingRecord,
  removeRatingRecord,
} from '@/services/database';

interface UserState {
  collections: CollectionRecord[];
  history: HistoryRecord[];
  ratings: RatingRecord[];
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
  }) => void;
  getHistoryByVideo: (videoId: string) => HistoryRecord | undefined;
  removeHistory: (historyId: string) => void;
  clearHistory: () => void;

  setRating: (videoId: string, rating: number) => void;
  getRating: (videoId: string) => number;
  removeRating: (videoId: string) => void;
  getAverageRating: () => number;

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

    // 迁移评分
    if (Array.isArray(state.ratings)) {
      for (const rating of state.ratings) {
        await setRatingRecord(rating);
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
  ratings: [],
  _initialized: false,
  _loading: true,

  /** 从 IndexedDB 加载所有数据 */
  _loadFromDB: async () => {
    if (get()._initialized) return;

    try {
      await migrateFromLocalStorage();

      const [collections, history, ratings] = await Promise.all([
        getCollections(),
        getHistory(),
        getRatings(),
      ]);

      set({ collections, history, ratings, _initialized: true, _loading: false });
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
   * 同一视频的记录会更新进度和时间，而非重复创建
   * 去重策略：vodId → videoId（兜底）
   */
  addHistory: (record) => {
    // 1. 优先匹配：vodId
    let existingIndex = record.vodId
      ? get().history.findIndex((h) => h.vodId === record.vodId)
      : -1;

    // 2. 兜底匹配：仅 videoId
    if (existingIndex < 0) {
      existingIndex = get().history.findIndex(
        (h) => h.videoId === record.videoId
      );
    }

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

  getHistoryByVideo: (videoId) =>
    get().history.find((h) => h.videoId === videoId),

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

  /**
   * 设置视频评分
   * 评分值会被限制在 1-5 范围内并四舍五入为整数
   */
  setRating: (videoId, rating) => {
    const clamped = Math.min(5, Math.max(1, Math.round(rating)));
    const existingIndex = get().ratings.findIndex((r) => r.videoId === videoId);

    if (existingIndex >= 0) {
      set((state) => ({
        ratings: state.ratings.map((r, i) =>
          i === existingIndex ? { ...r, rating: clamped, ratedAt: Date.now() } : r
        ),
      }));
    } else {
      set((state) => ({
        ratings: [...state.ratings, { videoId, rating: clamped, ratedAt: Date.now() }],
      }));
    }
    setRatingRecord({ videoId, rating: clamped, ratedAt: Date.now() }).catch(console.error);
  },

  getRating: (videoId) => {
    const record = get().ratings.find((r) => r.videoId === videoId);
    return record ? record.rating : 0;
  },

  removeRating: (videoId) => {
    set((state) => ({
      ratings: state.ratings.filter((r) => r.videoId !== videoId),
    }));
    removeRatingRecord(videoId).catch(console.error);
  },

  getAverageRating: () => {
    const { ratings } = get();
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return sum / ratings.length;
  },
}));
