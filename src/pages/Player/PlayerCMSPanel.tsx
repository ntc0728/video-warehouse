import { type VideoSource } from '@/types/video';
import type { VideoDetailResult } from '@/services/videoService';
import { RefreshCw, Server, ChevronDown } from 'lucide-react';

interface PlayerCMSPanelProps {
  cmsResults: VideoDetailResult[];
  cmsLoading: boolean;
  currentSrc: { url: string; type: VideoSource['type'] } | null;
  onRefresh: () => void;
  onPlaySource: (result: VideoDetailResult) => void;
  expanded?: boolean;
  onToggle?: () => void;
  compact?: boolean;
}

export function PlayerCMSPanel({
  cmsResults,
  cmsLoading,
  currentSrc,
  onRefresh,
  onPlaySource,
  expanded = true,
  onToggle,
  compact = false,
}: PlayerCMSPanelProps) {
  const HeaderTag = compact ? 'div' : 'button';

  return (
    <div className="player-panel">
      <HeaderTag
        className="player-panel-header"
        {...(!compact && onToggle ? { onClick: onToggle } : {})}
      >
        <span className="player-panel-icon"><Server size={16} /></span>
        <span className="player-panel-title">CMS源</span>
        {!compact && (
          <span className={`player-panel-arrow ${expanded ? 'expanded' : ''}`}>
            <ChevronDown size={16} />
          </span>
        )}
      </HeaderTag>
      <div className={`player-panel-body${!compact && !expanded ? ' collapsed' : ''}`}>
        {cmsLoading ? (
          <div className="player-panel-loading"><RefreshCw size={18} className="spinning" /><span>加载中…</span></div>
        ) : cmsResults.length > 0 ? (
          <div className="player-cms-list">
            {cmsResults.map((result) => (
              <button
                key={result.sourceIndex}
                className={`player-cms-item ${result.video ? '' : 'disabled'} ${currentSrc && result.video && (result.video.sources?.some(s => s.url === currentSrc.url) || result.video.episodes?.some(ep => ep.sources.some(s => s.url === currentSrc.url))) ? 'active' : ''}`}
                onClick={() => result.video && onPlaySource(result)}
                disabled={!result.video}
              >
                <span className="player-cms-name">{result.sourceName}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="player-panel-empty">暂无数据源</div>
        )}
        <button className="player-panel-refresh" onClick={onRefresh} disabled={cmsLoading}>
          <RefreshCw size={12} className={cmsLoading ? 'spinning' : ''} /> 刷新源
        </button>
      </div>
    </div>
  );
}
