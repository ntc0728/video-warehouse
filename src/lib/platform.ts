/**
 * 平台检测工具
 * 用于在运行时区分 Web / Capacitor 原生环境
 * 所有 Android 适配逻辑通过此模块分支，确保 Web 端零影响
 */

let _isNative: boolean | null = null;

/**
 * 检测当前是否运行在 Capacitor 原生平台（Android / iOS）
 * 结果会被缓存，后续调用直接返回
 */
export function isNativePlatform(): boolean {
  if (_isNative !== null) return _isNative;

  try {
    // Capacitor 在原生平台注入 window.Capacitor
    _isNative = !!(window as unknown as Record<string, unknown>).Capacitor;
  } catch {
    _isNative = false;
  }

  return _isNative;
}

/**
 * 获取当前平台标识
 */
export function getPlatform(): 'android' | 'ios' | 'web' {
  if (!isNativePlatform()) return 'web';

  try {
    const capacitor = (window as unknown as Record<string, unknown>).Capacitor as {
      getPlatform?: () => string;
    };
    const platform = capacitor?.getPlatform?.() ?? 'web';
    if (platform === 'android') return 'android';
    if (platform === 'ios') return 'ios';
  } catch { /* ignore */ }

  return 'web';
}
