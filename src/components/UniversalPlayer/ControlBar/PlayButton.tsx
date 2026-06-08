import { Play, Pause } from 'lucide-react';

interface PlayButtonProps {
  isPlaying: boolean;
  onClick: () => void;
}

export default function PlayButton({ isPlaying, onClick }: PlayButtonProps) {
  return (
    <button className="up-control-btn up-play-btn" onClick={onClick} title="播放/暂停 (Space)">
      {isPlaying ? <Pause size={22} /> : <Play size={22} />}
    </button>
  );
}
