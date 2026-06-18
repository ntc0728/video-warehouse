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

/**
 * Android 原生平台字体缩放
 *
 * 问题：CSS 1px = 1/96 inch，Android 1dp = 1/160 inch
 *       1px CSS = 1.66dp，导致高密度屏幕上字体/图标过大
 *
 * 方案：动态设置根字体大小，将 CSS 值缩放到接近 dp 的效果
 *       scale = 1/1.66 ≈ 0.6，但直接缩小 40% 会太小
 *       采用 0.75 作为折中值（缩小 25%）
 */
export function adjustFontSizeForNative(): void {
  if (!isNativePlatform()) return;

  try {
    const dpr = window.devicePixelRatio || 1;
    // 基准根字体 16px，高密度屏幕时缩小
    // scale = 1 / sqrt(dpr)，限制在 0.65~1.0 范围
    const rawScale = 1 / Math.sqrt(dpr);
    const scale = Math.max(0.65, Math.min(1.0, rawScale));
    const rootFontSize = Math.round(16 * scale);

    document.documentElement.style.fontSize = `${rootFontSize}px`;

    console.log(`[Platform] Android font scale: ${scale.toFixed(2)}, root font: ${rootFontSize}px`);
  } catch { /* ignore */ }
}
