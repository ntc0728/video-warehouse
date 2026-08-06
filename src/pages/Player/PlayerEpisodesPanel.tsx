import { useState, useMemo, useEffect } from 'react';
import type { VideoSource, Episode } from '@/types/video';
import { ListVideo, ChevronDown, Play, Loader2, ArrowUpDown } from 'lucide-react';
import { Icon } from "@/components/ui/Icon";

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
  /** 是否为剧集类型视频（tv/anime），用于决定标题显示"选集"还是"线路" */
  isTV?: boolean;
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
  isTV = false,
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

  // 播放有历史记录的剧集时：自动将分页定位到当前播放集所在页，
  // 保证 player-episode-select 展示的是包含当前集的页码 option（而非固定第 1 页）。
  useEffect(() => {
    if (!activeEpisodeId || episodes.length === 0) return;
    const idx = sorted.findIndex((e) => e.id === activeEpisodeId);
    if (idx < 0) return;
    const targetPage = Math.floor(idx / PAGE_SIZE);
    if (targetPage !== safePage) {
      setPage(targetPage);
    }
    // 依赖 sorted（含 sortAsc）与 episodes：排序变化时也要重新定位
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEpisodeId, sorted, safePage]);

  const infoText = episodes.length > 0
    ? `第${(activeEpisodeId ? episodes.find(e => e.id === activeEpisodeId)?.number : episodes[0]?.number) || 1}集/共${episodes.length}集`
    : sources.length > 0
      ? `共${sources.length}条线路`
      : '';

  return (
    <div className="player-panel player-panel--episodes">
      <HeaderTag
        className="player-panel-header"
        {...(!compact && onToggle ? { onClick: onToggle } : {})}
      >
        <span className="player-panel-icon"><Icon icon={ListVideo} size="sm" /></span>
        <span className="player-panel-title">{isTV || episodes.length > 0 ? '选集' : '线路'}</span>
        <span className="player-panel-info">{infoText}</span>
        {!compact && (
          <span className={`player-panel-arrow ${expanded ? 'expanded' : ''}`}>
            <Icon icon={ChevronDown} size="sm" />
          </span>
        )}
      </HeaderTag>
      <div className={`player-panel-body${!compact && !expanded ? ' collapsed' : ''}`}>
        {loading && episodes.length === 0 && sources.length === 0 ? (
          <div className="player-panel-loading">
            <Icon icon={Loader2} size="sm" className="spinning" />
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
                <Icon icon={ArrowUpDown} size="xs" />
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
          <>
            <div className="player-source-list">
              {sources.map((src) => (
                <button
                  key={src.id}
                  className={`player-source-item ${currentSrc?.url === src.url ? 'active' : ''}`}
                  onClick={() => onPlaySource(src)}
                >
                  <Icon icon={Play} size="xs" fill="currentColor" />
                  <span>{src.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="player-panel-empty">暂无数据</div>
        )}
      </div>
    </div>
  );
}
