/**
 * useScreenTier — 通用屏幕尺寸分级 Hook
 *
 * 基于视口宽度 + 高度综合判断屏幕尺寸等级，替代单一维度的宽度判断。
 *
 * 分级标准：
 * - 'mobile':   < 1024px 宽（手机/平板竖屏）
 * - 'compact':  ≥ 1024px 宽 且 < 900px 高（笔记本小屏、窗口缩小）
 * - 'regular':  ≥ 1024px 宽 且 ≥ 900px 高（标准笔记本/显示器）
 * - 'large':    ≥ 1440px 宽 且 ≥ 900px 高（大屏笔记本/24寸显示器）
 * - 'xlarge':   ≥ 1920px 宽 且 ≥ 1000px 高（27寸+显示器/4K）
 */
import { useMediaQuery } from './useMediaQuery';

export type ScreenTier = 'mobile' | 'compact' | 'regular' | 'large' | 'xlarge';

interface ScreenTierResult {
  tier: ScreenTier;
  isMobile: boolean;
  isCompact: boolean;
  isRegular: boolean;
  isLarge: boolean;
  isXLarge: boolean;
}

export function useScreenTier(): ScreenTierResult {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const isCompact = useMediaQuery('(min-width: 1024px) and (max-height: 899px)');
  const isLarge = useMediaQuery('(min-width: 1440px) and (min-height: 900px)');
  const isXLarge = useMediaQuery('(min-width: 1920px) and (min-height: 1000px)');

  let tier: ScreenTier;
  if (isXLarge) tier = 'xlarge';
  else if (isLarge) tier = 'large';
  else if (isMobile) tier = 'mobile';
  else if (isCompact) tier = 'compact';
  else tier = 'regular';

  return { tier, isMobile, isCompact, isRegular: !isMobile && !isCompact && !isLarge && !isXLarge, isLarge, isXLarge };
}
