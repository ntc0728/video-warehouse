import type { CSSProperties } from 'react';
import './TvMascot.css';

export interface TvMascotProps {
  /** 附加 class，通常传动画类 `is-shaking` 或播放器黑场修饰 `ptr-tv--on-dark` */
  className?: string;
  /** 达标/刷新时头顶电波（下拉刷新语义；播放器加载默不作态不显示） */
  armed?: boolean;
  /** 眼睛眨眼动画（loading 时开启） */
  blink?: boolean;
  /** 耳朵竖起进度 0..1：0=耷拉、1=直立（下拉刷新跟手用，播放器默认 1） */
  earProgress?: number;
  /** 尺寸（宽高），不传则跟随父容器 font-size / 行高 */
  size?: number | string;
  style?: CSSProperties;
}

/**
 * 共享「小电视」mascot —— 复刻 B 站同款（TV 身 + 双天线耳朵 + 笑脸）。
 * 下拉刷新与播放器加载态统一复用这一份 SVG + 样式，避免各画各的线稿电视。
 * 配色跟随主题（--color-surface 机身 / --color-text 描边）；
 * 播放器黑场叠加 `.ptr-tv--on-dark` 即转白底，保证可见且不突兀。
 */
export function TvMascot({
  className = '',
  armed = false,
  blink = false,
  earProgress = 1,
  size,
  style,
}: TvMascotProps) {
  const p = Math.min(Math.max(earProgress, 0), 1);
  const earRot = -18 * (1 - p);

  const dims: CSSProperties = {
    ...(size != null ? { width: size, height: size } : {}),
    ...style,
  };

  return (
    <svg
      className={`ptr-tv${className ? ` ${className}` : ''}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={dims}
    >
      {armed && (
        <g className="ptr-tv__wave">
          <path d="M22 13 a13 13 0 0 1 20 0" />
          <path d="M18 12 a17 17 0 0 1 28 0" />
        </g>
      )}
      <g className="ptr-tv__ear" transform={`rotate(${earRot} 24 20)`}>
        <line x1="24" y1="20" x2="15" y2="6" />
        <circle cx="15" cy="6" r="3" />
      </g>
      <g className="ptr-tv__ear" transform={`rotate(${-earRot} 40 20)`}>
        <line x1="40" y1="20" x2="49" y2="6" />
        <circle cx="49" cy="6" r="3" />
      </g>
      <rect className="ptr-tv__body" x="10" y="20" width="44" height="32" rx="10" />
      <circle className="ptr-tv__cheek" cx="20" cy="40" r="3.4" />
      <circle className="ptr-tv__cheek" cx="44" cy="40" r="3.4" />
      <g className={`ptr-tv__eyes${blink ? ' is-blink' : ''}`}>
        <circle cx="26" cy="34" r="3" />
        <circle cx="38" cy="34" r="3" />
      </g>
      <path className="ptr-tv__mouth" d="M26 41 Q32 47 38 41" />
    </svg>
  );
}

export default TvMascot;
