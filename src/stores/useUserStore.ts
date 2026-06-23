/**
 * 用户数据状态管理
 * 管理视频收藏、观看历史记录和评分记录
 * 观看历史按视频+剧集维度去重，重复观看会更新进度而非新增记录
 * 评分范围限定为 1-5 的整数
 *
 * [批次3合并] 原 useRatingStore 的 ratings 功能已合并到此 store
 * [数据迁移] 旧 localStorage key `rating-store` 的数据会在首次加载时自动迁移到 `user-store`
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CollectionRecord, HistoryRecord } from '@/types/store';
import type { VideoType } from '@/types/video';

interface RatingRecord {
  videoId: string;
  rating: number;
  ratedAt: number;
}

interface UserState {
  collections: CollectionRecord[];
  history: HistoryRecord[];
  ratings: RatingRecord[];

  addCollection: (videoId: string, meta?: { title?: string; cover?: string; type?: VideoType; year?: number; rating?: number }) => void;
  removeCollection: (videoId: string) => void;
  clearCollections: () => void;
  isCollected: (videoId: string) => boolean;

  addHistory: (record: Omit<HistoryRecord, 'id' | 'updatedAt'>) => void;
  updateHistoryProgress: (videoId: string, episodeId: string | undefined, progress: number, duration: number, title?: string, cover?: string) => void;
  getHistoryByVideo: (videoId: string) => HistoryRecord | undefined;
  removeHistory: (historyId: string) => void;
  clearHistory: () => void;

  setRating: (videoId: string, rating: number) => void;
  getRating: (videoId: string) => number;
  removeRating: (videoId: string) => void;
  getAverageRating: () => number;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      collections: [],
      history: [],
      ratings: [],

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
        };
        set((state) => ({
          collections: [...state.collections, newCollection],
        }));
      },

      removeCollection: (videoId) =>
        set((state) => ({
          collections: state.collections.filter((c) => c.videoId !== videoId),
        })),

      clearCollections: () => set({ collections: [] }),

      isCollected: (videoId) =>
        get().collections.some((c) => c.videoId === videoId),

      /**
       * 添加或更新观看历史
       * 同一视频+同一剧集的记录会更新进度和时间，而非重复创建
       */
      addHistory: (record) => {
        const existingIndex = get().history.findIndex(
          (h) => h.videoId === record.videoId && h.episodeId === record.episodeId
        );

        if (existingIndex >= 0) {
          set((state) => ({
            history: state.history.map((h, i) =>
              i === existingIndex
                ? { ...h, progress: record.progress, duration: record.duration, title: record.title || h.title, cover: record.cover || h.cover, updatedAt: Date.now() }
                : h
            ),
          }));
        } else {
          const newHistory: HistoryRecord = {
            ...record,
            id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            updatedAt: Date.now(),
          };
          set((state) => ({
            history: [...state.history, newHistory],
          }));
        }
      },

      updateHistoryProgress: (videoId, episodeId, progress, duration, title, cover) => {
        get().addHistory({ videoId, episodeId, progress, duration, title, cover });
      },

      getHistoryByVideo: (videoId) =>
        get().history.find((h) => h.videoId === videoId),

      removeHistory: (historyId) =>
        set((state) => ({
          history: state.history.filter((h) => h.id !== historyId),
        })),

      clearHistory: () => set({ history: [] }),

      /**
       * 设置视频评分
       * 评分值会被限制在 1-5 范围内并四舍五入为整数
       * 若已有评分则更新，否则新增记录
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
      },

      getRating: (videoId) => {
        const record = get().ratings.find((r) => r.videoId === videoId);
        return record ? record.rating : 0;
      },

      removeRating: (videoId) =>
        set((state) => ({
          ratings: state.ratings.filter((r) => r.videoId !== videoId),
        })),

      getAverageRating: () => {
        const { ratings } = get();
        if (ratings.length === 0) return 0;
        const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
        return sum / ratings.length;
      },
    }),
    {
      name: 'user-store',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Record<string, unknown>;
        // Migrate old rating-store data if exists
        let migratedRatings: RatingRecord[] = [];
        try {
          const oldRatingData = localStorage.getItem('rating-store');
          if (oldRatingData) {
            const parsed = JSON.parse(oldRatingData);
            if (parsed.state?.ratings) {
              migratedRatings = parsed.state.ratings;
            }
            localStorage.removeItem('rating-store');
          }
        } catch { /* ignore */ }

        return {
          ...currentState,
          ...persisted,
          ratings: migratedRatings.length > 0
            ? migratedRatings
            : ((persisted?.ratings as RatingRecord[]) || (currentState as { ratings: RatingRecord[] }).ratings),
        } as UserState;
      },
    }
  )
);
