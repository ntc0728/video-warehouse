import { useMediaQuery, useIsTV } from './useMediaQuery';

/**
 * 宽屏桌面检测（>1440px 且非 TV）。
 *
 * 用于首页 Hero B 站风分支（HeroBili）：视口 >1440px 渲染 HeroBili，
 * ≤1440px 走原 HeroBanner 渲染路径。TV 端恒不启用（红线：不影响 TV）——
 * TV UA / TV 模式开关命中时恒为 false，保持原 hero-banner__card 结构。
 * 2026-09-07 断点 1280 → 1440（与全站大屏起点统一，播放页除外后续整改）。
 */
export function useIsWideDesktop(): boolean {
  const isWide = useMediaQuery('(min-width: 1441px)');
  const isTV = useIsTV();
  return isWide && !isTV;
}
