import type { PullPhase } from './PullToRefreshContext';

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

  // 耳朵角度：进度 0 → 耷拉 -18°，进度 1 → 直立 0°
  const p = Math.min(Math.max(progress, 0), 1);
  const earRot = -18 * (1 - p);
  // 下拉时整体轻微放大，增强跟手感
  const pullScale = 1 + p * 0.06;

  let label = pullingText;
  if (armed && !isRefreshing && !isSuccess) label = readyText;
  else if (isRefreshing) label = refreshingText;
  else if (isSuccess) label = successText;

  const mascot = (
    <svg
      className={`ptr-tv${isRefreshing ? ' is-shaking' : ''}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      {/* 达标/刷新时头顶电波（坐标已收进 viewBox 0..64，不依赖 overflow 兜底） */}
      {armed && (
        <g className="ptr-tv__wave">
          <path d="M22 13 a13 13 0 0 1 20 0" />
          <path d="M18 12 a17 17 0 0 1 28 0" />
        </g>
      )}
      {/* 天线耳朵（绕底部基点旋转） */}
      <g className="ptr-tv__ear" transform={`rotate(${earRot} 24 20)`}>
        <line x1="24" y1="20" x2="15" y2="6" />
        <circle cx="15" cy="6" r="3" />
      </g>
      <g className="ptr-tv__ear" transform={`rotate(${-earRot} 40 20)`}>
        <line x1="40" y1="20" x2="49" y2="6" />
        <circle cx="49" cy="6" r="3" />
      </g>
      {/* 电视机身 */}
      <rect className="ptr-tv__body" x="10" y="20" width="44" height="32" rx="10" />
      {/* 腮红 */}
      <circle className="ptr-tv__cheek" cx="20" cy="40" r="3.4" />
      <circle className="ptr-tv__cheek" cx="44" cy="40" r="3.4" />
      {/* 眼睛（刷新/成功时眨眼） */}
      <g className={`ptr-tv__eyes${isRefreshing || isSuccess ? ' is-blink' : ''}`}>
        <circle cx="26" cy="34" r="3" />
        <circle cx="38" cy="34" r="3" />
      </g>
      {/* 嘴 */}
      <path className="ptr-tv__mouth" d="M26 41 Q32 47 38 41" />
    </svg>
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
