import { ArrowLeft } from 'lucide-react';
import type { PlayerMode } from '@/types/player';

interface PlayerHeaderProps {
  mode: PlayerMode;
  title: string;
  channelName?: string;
  visible: boolean;
  onBack: () => void;
  onActivity?: () => void;
}

export default function PlayerHeader({
  mode,
  title,
  channelName,
  visible,
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
        <ArrowLeft size={20} />
      </button>
      <span className="up-header-title">{displayTitle}</span>
    </div>
  );
}
