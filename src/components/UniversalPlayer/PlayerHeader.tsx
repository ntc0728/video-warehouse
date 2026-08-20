import { ArrowLeft } from 'lucide-react';
import type { PlayerMode } from '@/types/player';
import FullscreenButton from './ControlBar/FullscreenButton';
import { Icon } from "@/components/ui/Icon";

interface PlayerHeaderProps {
  mode: PlayerMode;
  title: string;
  episodeLabel?: string;
  channelName?: string;
  visible: boolean;
  showFullscreenButton?: boolean;
  /** 播放错误态：透传给 FullscreenButton，错误时禁用全屏（C4 守卫一致） */
  hasError?: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onBack: () => void;
  onActivity?: () => void;
  /** 右上角操作组（移动端/App 端点播页：画中画 · 投屏 · 更多设置） */
  actions?: React.ReactNode;
}

export default function PlayerHeader({
  mode,
  title,
  episodeLabel,
  channelName,
  visible,
  showFullscreenButton = true,
  hasError = false,
  containerRef,
  onBack,
  onActivity,
  actions,
}: PlayerHeaderProps) {
  const displayTitle = mode === 'iptv' ? (channelName || title) : title;

  return (
    <div
      className={`up-player-header ${visible ? 'up-player-header-visible' : 'up-player-header-hidden'}`}
      onMouseMove={onActivity}
    >
      <button className="up-header-back" onClick={(e) => { e.stopPropagation(); onBack(); }}>
        <Icon icon={ArrowLeft} size="sm" />
        <span>返回</span>
      </button>
      <span className="up-header-title">
        {displayTitle}
        {episodeLabel && <span className="up-header-episode-badge">{episodeLabel}</span>}
      </span>
      {actions}
      {showFullscreenButton && <FullscreenButton containerRef={containerRef} hasError={hasError} />}
    </div>
  );
}
