import { TvMascot } from '@/components/ui/TvMascot/TvMascot';

interface PlayerTVLoaderProps {
  /** 加载提示文案，默认「加载中」 */
  label?: string;
}

/**
 * 播放页统一加载指示：B 站小电视 mascot（复用下拉刷新同款 SVG）+ 三点跳动。
 * 用于：① 入场 stage 占位（未调接口 / 接口未响应）；② 覆盖在 UniversalPlayer 缓冲遮罩之上。
 * 取代原「刷新 loading 图标」（.player-loading-spinner），与下拉刷新视觉统一、黑场可见。
 */
export function PlayerTVLoader({ label = '加载中' }: PlayerTVLoaderProps) {
  return (
    <div className="player-tv-loader" role="status" aria-live="polite">
      <TvMascot className="player-tv-loader__icon ptr-tv--on-dark" blink is-shaking />
      <span className="player-tv-loader__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {label && <span className="player-tv-loader__label">{label}</span>}
    </div>
  );
}
