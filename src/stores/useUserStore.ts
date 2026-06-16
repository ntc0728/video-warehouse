/**
 * 用户数据状态管理
 * 管理视频收藏和观看历史记录，支持收藏的增删查和历史记录的更新
 * 观看历史按视频+剧集维度去重，重复观看会更新进度而非新增记录
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CollectionRecord, HistoryRecord } from '@/types/store';
import type { VideoType } from '@/types/video';

interface UserState {
  collections: CollectionRecord[];
  history: HistoryRecord[];

  addCollection: (videoId: string, meta?: { title?: string; cover?: string; type?: VideoType; year?: number; rating?: number }) => void;
  removeCollection: (videoId: string) => void;
  clearCollections: () => void;
  isCollected: (videoId: string) => boolean;

  addHistory: (record: Omit<HistoryRecord, 'id' | 'updatedAt'>) => void;
  updateHistoryProgress: (videoId: string, episodeId: string | undefined, progress: number, duration: number, title?: string, cover?: string) => void;
  getHistoryByVideo: (videoId: string) => HistoryRecord | undefined;
  removeHistory: (historyId: string) => void;
  clearHistory: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      collections: [],
      history: [],

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
    }),
    {
      name: 'user-store',
    }
  )
);
