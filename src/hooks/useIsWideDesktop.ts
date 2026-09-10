import { useMediaQuery, useIsTV } from './useMediaQuery';

/**
 * 宽屏桌面检测（≥1024px 且非 TV）。
 *
 * 同时服务两类首页宽屏特性：
 *  · HeroBili 分支（HeroBanner）：≥1024px 渲染 B 站风 HeroBili，<1024px 走 HeroBannerClassic；
 *  · 分类导航宽屏特性（CQA Nav/Panel/HeatRow）：≥1024px 分类 chips 上移进 header / mega 面板 / 热度榜；
 *  · 首页两栏（Home .home-two-col）：≥1024px 左栏「今日趋势」榜 + 右列 Hero/内容行。
 * TV 端恒不启用（红线：不影响 TV）——TV UA / TV 模式开关命中时恒为 false，
 * 保持原 hero-banner__card 结构。
 * 2026-09-07 曾右移 1280 → 1440（全站大屏起点统一），同日二次修正回退 1440 → 1280。
 * 2026-09-10 用户要求「视口 ≥1280 就显示新 UI 布局」：断点由 1281 → 1280（含端点）。
 * 2026-09-10 二次修正：用户要求「首页视口 ≥1024 就显示新的 UI 布局」，
 *   断点再次左移 1280 → 1024（本文件是唯一 JS 真源）；
 *   CSS 侧全部消费方同步为 @media (width >= 1024px)（Home / CategoryQuickAccess /
 *   HeroBili / HeroBanner / StickyHeader / SearchBox 六处），否则 JS 已切分支而样式未生效。
 *   ⚠️ 与既有 hook 的边界：useIsMobile=1023 / useIsMobileLayout=767 取的是「上界」语义，
 *   本 hook 的 1024 恰好与 useIsMobile(1023) 互补无缝；1024–1279 段由本 hook 接管。
 */
export function useIsWideDesktop(): boolean {
  const isWide = useMediaQuery('(min-width: 1024px)');
  const isTV = useIsTV();
  return isWide && !isTV;
}
