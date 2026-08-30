import type { PullPhase } from './PullToRefreshContext';
import { TvMascot } from '@/components/ui/TvMascot/TvMascot';

export interface PullIndicatorProps {
  /** 当前阶段 */
  phase: PullPhase;
  /** 拖拽进度 0..1（pull / threshold） */
  progress: number;
  /** 视觉变体：default=顶部导航栏下方居中；settings=页面中间位移刷新按钮 */
  variant?: 'default' | 'settings';
  /** 下拉中（未达阈值）文案 */
  pullingText?: string;
  /** 达到阈值（可松手）文案 */
  readyText?: string;
  /** 刷新中文案 */
  refreshingText?: string;
  /** 成功文案 */
  successText?: string;
  /** 记录的页面参数（如「搜索: marvel」），作为次级弱文本展示，证明刷新保留了状态 */
  meta?: string;
}

/**
 * 下拉刷新指示器（受控视觉组件）—— 复刻 B 站「小电视」同款
 *
 * - 图标为主、文本为辅；图标为 B 站小电视角色（TV 身 + 双天线耳朵 + 笑脸），
 *   严禁下拉箭头 / 通用环形刷新图标。
 * - pulling：耳朵随进度从耷拉竖起到直立；armed：头顶冒出电波；refreshing：眨眼；
 *   success：维持笑脸。
 * - 文案为 B 站情绪化三段式：再拉就刷新 / 够啦松开人家嘛 / 更新中 / 更新啦。
 * - variant=settings 时整体渲染为页面中间的圆形刷新按钮（内嵌小电视）。
 */
export function PullIndicator({
  phase,
  progress,
  variant = 'default',
  pullingText = '再拉，再拉就刷新给你看',
  readyText = '够啦，松开人家嘛',
  refreshingText = '更新中…',
  successText = '更新啦',
  meta,
}: PullIndicatorProps) {
  const isRefreshing = phase === 'refreshing';
  const isSuccess = phase === 'success';
  const armed = phase === 'armed' || isRefreshing || isSuccess;

  // 耳朵竖起进度交给 TvMascot 计算（0 → 耷拉、1 → 直立）
  const p = Math.min(Math.max(progress, 0), 1);
  // 下拉时整体轻微放大，增强跟手感
  const pullScale = 1 + p * 0.06;

  let label = pullingText;
  if (armed && !isRefreshing && !isSuccess) label = readyText;
  else if (isRefreshing) label = refreshingText;
  else if (isSuccess) label = successText;

  const mascot = (
    <TvMascot
      armed={armed}
      blink={isRefreshing || isSuccess}
      earProgress={p}
      className={isRefreshing ? 'is-shaking' : ''}
    />
  );

  return (
    <div className={`ptr-indicator ptr-indicator--${variant}`} data-phase={phase}>
      {variant === 'settings' ? (
        <span className="ptr-indicator__btn" aria-hidden="true">
          {mascot}
        </span>
      ) : (
        <span
          className="ptr-indicator__icon"
          aria-hidden="true"
          style={{ transform: `scale(${pullScale})` }}
        >
          {mascot}
        </span>
      )}
      <span className="ptr-indicator__text">{label}</span>
      {meta && <span className="ptr-indicator__meta">{meta}</span>}
    </div>
  );
}

export default PullIndicator;
