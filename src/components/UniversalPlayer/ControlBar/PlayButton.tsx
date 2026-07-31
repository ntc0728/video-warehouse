import { Play, Pause } from 'lucide-react';
import { Icon } from "@/components/ui/Icon";

interface PlayButtonProps {
  isPlaying: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export default function PlayButton({ isPlaying, disabled, onClick }: PlayButtonProps) {
  return (
    <button
      className="up-play-btn"
      onClick={onClick}
      disabled={disabled}
      title="播放/暂停 (Space)"
      aria-label={isPlaying ? '暂停' : '播放'}
      aria-pressed={isPlaying}
    >
      {isPlaying ? <Icon icon={Pause} size="md" /> : <Icon icon={Play} size="md" />}
    </button>
  );
}
