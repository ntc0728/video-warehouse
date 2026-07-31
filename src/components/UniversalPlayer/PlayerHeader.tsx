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
  containerRef: React.RefObject<HTMLElement | null>;
  onBack: () => void;
  onActivity?: () => void;
}

export default function PlayerHeader({
  mode,
  title,
  episodeLabel,
  channelName,
  visible,
  showFullscreenButton = true,
  containerRef,
  onBack,
  onActivity,
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
      {showFullscreenButton && <FullscreenButton containerRef={containerRef} />}
    </div>
  );
}
