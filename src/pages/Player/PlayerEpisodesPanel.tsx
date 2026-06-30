import { useState } from 'react';
import type { VideoSource, Episode } from '@/types/video';
import { ListVideo, ChevronDown, Play } from 'lucide-react';

interface PlayerEpisodesPanelProps {
  episodes: Episode[];
  sources: VideoSource[];
  currentSrc: { url: string; type: VideoSource['type'] } | null;
  activeEpisodeId?: string;
  onPlayEpisode: (ep: Episode) => void;
  onPlaySource: (src: VideoSource) => void;
  expanded?: boolean;
  onToggle?: () => void;
  compact?: boolean;
}

const EPISODE_PAGE_SIZE = 20;

export function PlayerEpisodesPanel({
  episodes,
  sources,
  currentSrc,
  activeEpisodeId,
  onPlayEpisode,
  onPlaySource,
  expanded = true,
  onToggle,
  compact = false,
}: PlayerEpisodesPanelProps) {
  const [episodePage, setEpisodePage] = useState(0);
  const HeaderTag = compact ? 'div' : 'button';

  return (
    <div className="player-panel">
      <HeaderTag
        className="player-panel-header"
        {...(!compact && onToggle ? { onClick: onToggle } : {})}
      >
        <span className="player-panel-icon"><ListVideo size={16} /></span>
        <span className="player-panel-title">选集</span>
        {!compact && (
          <span className={`player-panel-arrow ${expanded ? 'expanded' : ''}`}>
            <ChevronDown size={16} />
          </span>
        )}
      </HeaderTag>
      <div className={`player-panel-body${!compact && !expanded ? ' collapsed' : ''}`}>
        {episodes.length > 0 ? (
          <>
            <div className="player-episode-grid">
              {episodes.slice(episodePage * EPISODE_PAGE_SIZE, (episodePage + 1) * EPISODE_PAGE_SIZE).map((ep) => (
                <button
                  key={ep.id}
                  className={`player-episode-btn ${ep.id === activeEpisodeId ? 'active' : ''}`}
                  onClick={() => onPlayEpisode(ep)}
                >
                  {ep.title}
                </button>
              ))}
            </div>
            {episodes.length > EPISODE_PAGE_SIZE && (
              <div className="player-episode-pagination">
                <button
                  className="player-episode-page-btn"
                  disabled={episodePage === 0}
                  onClick={() => setEpisodePage(p => p - 1)}
                >
                  上一页
                </button>
                <span className="player-episode-page-info">
                  {episodePage + 1} / {Math.ceil(episodes.length / EPISODE_PAGE_SIZE)}
                </span>
                <button
                  className="player-episode-page-btn"
                  disabled={(episodePage + 1) * EPISODE_PAGE_SIZE >= episodes.length}
                  onClick={() => setEpisodePage(p => p + 1)}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        ) : sources.length > 0 ? (
          <div className="player-source-list">
            {sources.map((src) => (
              <button
                key={src.id}
                className={`player-source-item ${currentSrc?.url === src.url ? 'active' : ''}`}
                onClick={() => onPlaySource(src)}
              >
                <Play size={12} fill="currentColor" />
                <span>{src.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="player-panel-empty">暂无选集</div>
        )}
      </div>
    </div>
  );
}
