import { useState, useMemo } from 'react';
import type { VideoSource, Episode } from '@/types/video';
import { ListVideo, ChevronDown, Play, Loader2, ArrowUpDown } from 'lucide-react';

interface PlayerEpisodesPanelProps {
  episodes: Episode[];
  sources: VideoSource[];
  currentSrc: { url: string; type: VideoSource['type'] } | null;
  activeEpisodeId?: string;
  loading?: boolean;
  onPlayEpisode: (ep: Episode) => void;
  onPlaySource: (src: VideoSource) => void;
  expanded?: boolean;
  onToggle?: () => void;
  compact?: boolean;
}

const PAGE_SIZE = 12;

export function PlayerEpisodesPanel({
  episodes,
  sources,
  currentSrc,
  activeEpisodeId,
  loading = false,
  onPlayEpisode,
  onPlaySource,
  expanded = true,
  onToggle,
  compact = false,
}: PlayerEpisodesPanelProps) {
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const HeaderTag = compact ? 'div' : 'button';

  const sorted = useMemo(() => {
    const copy = [...episodes];
    copy.sort((a, b) => sortAsc ? a.number - b.number : b.number - a.number);
    return copy;
  }, [episodes, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const pageOptions = useMemo(() => {
    const opts: { label: string; value: number }[] = [];
    for (let i = 0; i < totalPages; i++) {
      const start = i * PAGE_SIZE + 1;
      const end = Math.min((i + 1) * PAGE_SIZE, sorted.length);
      opts.push({ label: `${start}-${end}`, value: i });
    }
    return opts;
  }, [sorted.length, totalPages]);

  const infoText = episodes.length > 0
    ? `第${(activeEpisodeId ? episodes.find(e => e.id === activeEpisodeId)?.number : episodes[0]?.number) || 1}集/共${episodes.length}集`
    : '第1集/共1集';

  return (
    <div className="player-panel player-panel--episodes">
      <HeaderTag
        className="player-panel-header"
        {...(!compact && onToggle ? { onClick: onToggle } : {})}
      >
        <span className="player-panel-icon"><ListVideo size={16} /></span>
        <span className="player-panel-title">{episodes.length > 0 ? '选集' : '线路'}</span>
        <span className="player-panel-info">{infoText}</span>
        {!compact && (
          <span className={`player-panel-arrow ${expanded ? 'expanded' : ''}`}>
            <ChevronDown size={16} />
          </span>
        )}
      </HeaderTag>
      <div className={`player-panel-body${!compact && !expanded ? ' collapsed' : ''}`}>
        {loading && episodes.length === 0 && sources.length === 0 ? (
          <div className="player-panel-loading">
            <Loader2 size={16} className="spinning" />
            <span>加载中...</span>
          </div>
        ) : episodes.length > 0 ? (
          <>
            <div className="player-episode-controls">
              <button
                className="player-episode-sort-btn"
                onClick={() => { setSortAsc(!sortAsc); setPage(0); }}
                title={sortAsc ? '升序' : '降序'}
              >
                <ArrowUpDown size={14} />
                <span>{sortAsc ? '升序' : '降序'}</span>
              </button>
              <select
                className="player-episode-select"
                value={safePage}
                onChange={(e) => setPage(parseInt(e.target.value, 10))}
              >
                {pageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="player-episode-grid">
              {visible.map((ep) => (
                <button
                  key={ep.id}
                  className={`player-episode-btn ${ep.id === activeEpisodeId ? 'active' : ''}`}
                  onClick={() => onPlayEpisode(ep)}
                >
                  {ep.title}
                </button>
              ))}
            </div>
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
          <div className="player-panel-empty">暂无数据，请尝试切换其他 CMS 源</div>
        )}
      </div>
    </div>
  );
}
