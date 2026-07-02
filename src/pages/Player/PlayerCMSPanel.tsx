import { type VideoSource } from '@/types/video';
import type { VideoDetailResult } from '@/services/videoService';
import { Server, ChevronDown } from 'lucide-react';

interface PlayerCMSPanelProps {
  selectedSourceNames: string[];
  cmsResults: VideoDetailResult[];
  currentSrc: { url: string; type: VideoSource['type'] } | null;
  activeSourceName?: string;
  onPlaySource: (result: VideoDetailResult) => void;
  onFetchSource: (sourceName: string) => void;
  expanded?: boolean;
  onToggle?: () => void;
  compact?: boolean;
}

export function PlayerCMSPanel({
  selectedSourceNames,
  cmsResults,
  currentSrc,
  activeSourceName,
  onPlaySource,
  onFetchSource,
  expanded = true,
  onToggle,
  compact = false,
}: PlayerCMSPanelProps) {
  const HeaderTag = compact ? 'div' : 'button';

  // sourceName → VideoDetailResult 映射
  const resultMap = new Map(cmsResults.map(r => [r.sourceName, r]));

  // 判断某个源是否正在播放中
  const isActiveSource = (name: string) => {
    // 有明确的活跃源时，只高亮那个
    if (activeSourceName !== undefined) return activeSourceName === name;
    // 否则按当前播放 URL 匹配
    if (!currentSrc) return false;
    const result = resultMap.get(name);
    if (!result?.video) return false;
    return (
      result.video.sources?.some(s => s.url === currentSrc.url) ||
      result.video.episodes?.some(ep => ep.sources.some(s => s.url === currentSrc.url))
    );
  };

  return (
    <div className="player-panel player-panel--cms">
      <HeaderTag
        className="player-panel-header"
        {...(!compact && onToggle ? { onClick: onToggle } : {})}
      >
        <span className="player-panel-icon"><Server size={16} /></span>
        <span className="player-panel-title">CMS源</span>
        <span className="player-panel-info">{selectedSourceNames.length}个源</span>
        {!compact && (
          <span className={`player-panel-arrow ${expanded ? 'expanded' : ''}`}>
            <ChevronDown size={16} />
          </span>
        )}
      </HeaderTag>
      <div className={`player-panel-body${!compact && !expanded ? ' collapsed' : ''}`}>
        {selectedSourceNames.length > 0 ? (
          <div className="player-cms-list">
            {selectedSourceNames.map((name) => {
              const result = resultMap.get(name);
              const active = isActiveSource(name);
              return (
                <button
                  key={name}
                  className={`player-cms-item ${active ? 'active' : ''}`}
                  onClick={() => {
                    if (result?.video) {
                      onPlaySource(result);
                    } else {
                      onFetchSource(name);
                    }
                  }}
                >
                  <span className="player-cms-name">{name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="player-panel-empty">暂无数据源</div>
        )}
      </div>
    </div>
  );
}
