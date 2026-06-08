/**
 * 评分状态管理
 * 管理视频的评分记录，支持评分的增删改查和平均分计算
 * 评分范围限定为 1-5 的整数
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RatingRecord {
  videoId: string;
  rating: number;
  ratedAt: number;
}

interface RatingState {
  ratings: RatingRecord[];
  setRating: (videoId: string, rating: number) => void;
  getRating: (videoId: string) => number;
  removeRating: (videoId: string) => void;
  getAverageRating: () => number;
}

export const useRatingStore = create<RatingState>()(
  persist(
    (set, get) => ({
      ratings: [],

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
      name: 'rating-store',
    }
  )
);
