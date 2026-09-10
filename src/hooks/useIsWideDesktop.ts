import { useMediaQuery, useIsTV } from './useMediaQuery';

/**
 * 宽屏桌面检测（≥1280px 且非 TV）。
 *
 * 同时服务两类首页宽屏特性：
 *  · HeroBili 分支（HeroBanner）：≥1280px 渲染 B 站风 HeroBili，<1280px 走 HeroBannerClassic；
 *  · 分类导航宽屏特性（CQA Nav/Panel/HeatRow）：≥1280px 分类 chips 上移进 header / mega 面板 / 热度榜；
 *  · 首页两栏（Home .home-two-col）：≥1280px 左栏热度榜 + 右列 Hero/内容行。
 * TV 端恒不启用（红线：不影响 TV）——TV UA / TV 模式开关命中时恒为 false，
 * 保持原 hero-banner__card 结构。
 * 2026-09-07 曾右移 1280 → 1440（全站大屏起点统一），同日二次修正回退 1440 → 1280。
 * 2026-09-10 用户要求「视口 ≥1280 就显示新 UI 布局」：断点由 1281 改为 1280（含端点），
 *   CSS 侧四处 @media 同步为 (width >= 1280px)，与 JS 判断严格一致。
 */
export function useIsWideDesktop(): boolean {
  const isWide = useMediaQuery('(min-width: 1280px)');
  const isTV = useIsTV();
  return isWide && !isTV;
}
