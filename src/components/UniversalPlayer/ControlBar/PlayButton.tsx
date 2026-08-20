import { Play, Pause, PlayCircle, PauseCircle } from 'lucide-react';
import { DuoIcon } from '@/components/ui/DuoIcon';

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
      {isPlaying ? (
        <DuoIcon primary={Pause} secondary={PauseCircle} size="md" />
      ) : (
        <DuoIcon primary={Play} secondary={PlayCircle} size="md" />
      )}
    </button>
  );
}
