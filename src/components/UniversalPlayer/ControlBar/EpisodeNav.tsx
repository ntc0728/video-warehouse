import { SkipBack, SkipForward } from 'lucide-react';

interface EpisodeNavProps {
  hasNextEpisode: boolean;
  hasPrevEpisode: boolean;
  onNextEpisode: () => void;
  onPrevEpisode: () => void;
}

export function EpisodeNav({ hasNextEpisode, hasPrevEpisode, onNextEpisode, onPrevEpisode }: EpisodeNavProps) {
  return (
    <>
      <button
        className="up-control-btn"
        disabled={!hasPrevEpisode}
        onClick={onPrevEpisode}
        title="上一集"
      >
        <SkipBack size={20} />
      </button>
      <button
        className="up-control-btn"
        disabled={!hasNextEpisode}
        onClick={onNextEpisode}
        title="下一集"
      >
        <SkipForward size={20} />
      </button>
    </>
  );
}
