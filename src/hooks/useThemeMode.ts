/**
 * 主题感知 Hook
 * 返回当前实际生效的主题模式（Light / Dark）
 */
import { useSettingsStore } from '@/stores/useSettingsStore';

/** 获取当前实际生效的主题模式，支持跟随系统或手动切换 */
export function useThemeMode(): 'light' | 'dark' {
  return useSettingsStore((s) => {
    const theme = s.theme;
    if (theme === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    }
    return theme as 'light' | 'dark';
  });
}
