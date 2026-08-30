import { Tv } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';

interface PlayerTVLoaderProps {
  /** 加载提示文案，默认「加载中」 */
  label?: string;
  /** 图标尺寸 token，默认 3xl（播放器占位与缓冲遮罩都偏大的场景） */
  size?: '2xl' | '3xl';
}

/**
 * 播放页统一加载指示：小电视图标 + 三点跳动。
 * 用于：① 入场 stage 占位（未调接口 / 接口未响应）；② 覆盖在 UniversalPlayer 缓冲遮罩之上。
 * 取代原「刷新 loading 图标」（.player-loading-spinner），与品牌 kinoTv 视觉一致。
 */
export function PlayerTVLoader({ label = '加载中', size = '3xl' }: PlayerTVLoaderProps) {
  return (
    <div className="player-tv-loader" role="status" aria-live="polite">
      <Icon icon={Tv} size={size} className="player-tv-loader__icon" />
      <span className="player-tv-loader__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {label && <span className="player-tv-loader__label">{label}</span>}
    </div>
  );
}
