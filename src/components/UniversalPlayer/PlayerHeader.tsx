import { ArrowLeft } from 'lucide-react';
import type { PlayerMode } from '@/types/player';
import FullscreenButton from './ControlBar/FullscreenButton';

interface PlayerHeaderProps {
  mode: PlayerMode;
  title: string;
  channelName?: string;
  visible: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onBack: () => void;
  onActivity?: () => void;
}

export default function PlayerHeader({
  mode,
  title,
  channelName,
  visible,
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
        <ArrowLeft size={18} />
        <span>返回</span>
      </button>
      <span className="up-header-title">{displayTitle}</span>
      <FullscreenButton containerRef={containerRef} />
    </div>
  );
}
