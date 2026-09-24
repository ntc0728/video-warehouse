import { useSettingsStore } from '@/stores';

/**
 * 是否已配置 TMDB Access Token。
 * 统一各页面「token 未配置 → 跳过请求 / 展示 TokenRequired」的判定入口。
 */
export function useHasTmdbToken(): boolean {
  return useSettingsStore((s) => (s.tmdbAccessToken || '').trim().length > 0);
}
