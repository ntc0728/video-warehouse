/**
 * Store 统一导出模块
 * 汇总所有 Zustand 状态管理 store，供外部统一引用
 *
 * Store 数量：10 → 7（useVideoStore 双轨遗留收敛删除；useRatingStore 合并入 useUserStore；
 * useRecommendStore 因 DailyPicks 删除而移除；useSubtitleStore 拆分）
 * - 保留：usePlayerStore, useUserStore, useIPTVStore, useSettingsStore,
 *         useTMDBStore, useNavStore, useKeepAliveStore
 */
export { usePlayerStore } from './usePlayerStore';
export { useUserStore } from './useUserStore';
export { useIPTVStore } from './useIPTVStore';
export { useSettingsStore } from './useSettingsStore';
export { useTMDBStore } from './useTMDBStore';
export { useNavStore } from './useNavStore';
export { useKeepAliveStore } from './useKeepAliveStore';
