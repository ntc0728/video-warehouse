/**
 * Store 统一导出模块
 * 汇总所有 Zustand 状态管理 store，供外部统一引用
 *
 * Store 数量：10 → 8（批次3合并）
 * - useRatingStore 已合并到 useUserStore
 * - useSubtitleStore 已拆分到 usePlayerStore（字幕设置）和 useSettingsStore（翻译 API）
 * - 保留：useVideoStore, usePlayerStore, useUserStore, useIPTVStore, useSettingsStore,
 *         useRecommendStore, useTMDBStore, useNavStore
 */
export { useVideoStore } from './useVideoStore';
export { usePlayerStore } from './usePlayerStore';
export { useUserStore } from './useUserStore';
export { useIPTVStore } from './useIPTVStore';
export { useSettingsStore } from './useSettingsStore';
export { useRecommendStore } from './useRecommendStore';
export { useTMDBStore } from './useTMDBStore';
export { useNavStore } from './useNavStore';
