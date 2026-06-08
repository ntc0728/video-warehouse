/**
 * 视频库状态管理
 * 管理视频列表和多维度筛选逻辑，支持按类型、年份、地区、标签和关键词过滤
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Video, VideoFilter } from '@/types/video';

interface VideoState {
  videos: Video[];
  filter: VideoFilter;
  isLoading: boolean;
  error: string | null;
  currentSourceIndex: number;

  setVideos: (videos: Video[], sourceIndex?: number) => void;
  setFilter: (filter: Partial<VideoFilter>) => void;
  clearFilter: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  getFilteredVideos: () => Video[];
  clearVideos: () => void;
}

export const useVideoStore = create<VideoState>()(
  persist(
    (set, get) => ({
      videos: [],
      filter: {},
      isLoading: false,
      error: null,
      currentSourceIndex: -1,

      setVideos: (videos, sourceIndex) => set({ videos, currentSourceIndex: sourceIndex ?? get().currentSourceIndex }),

      setFilter: (filter) =>
        set((state) => ({ filter: { ...state.filter, ...filter } })),

      clearFilter: () => set({ filter: {} }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      clearVideos: () => set({ videos: [], currentSourceIndex: -1, error: null }),

      /**
       * 根据当前筛选条件过滤视频列表
       * 支持按类型、年份、地区、标签（全部匹配）和关键词（匹配标题/演员/导演）
       */
      getFilteredVideos: () => {
        const { videos, filter } = get();
        return videos.filter((video) => {
          if (filter.type && video.type !== filter.type) return false;
          if (filter.year && video.year !== filter.year) return false;
          if (filter.region && video.region !== filter.region) return false;
          if (filter.tags && filter.tags.length > 0) {
            const hasAllTags = filter.tags.every((tag) =>
              video.tags.includes(tag)
            );
            if (!hasAllTags) return false;
          }
          if (filter.keyword) {
            const keyword = filter.keyword.toLowerCase();
            const matchTitle = video.title.toLowerCase().includes(keyword);
            const matchActors = video.actors.some((actor) =>
              actor.toLowerCase().includes(keyword)
            );
            const matchDirector = video.director?.toLowerCase().includes(keyword);
            if (!matchTitle && !matchActors && !matchDirector) return false;
          }
          return true;
        });
      },
    }),
    {
      name: 'video-store',
      partialize: (state) => ({
        filter: state.filter,
      }),
    }
  )
);
