import { type VideoSource } from '@/types/video';
import type { VideoDetailResult } from '@/services/videoService';
import { Server, ChevronDown } from 'lucide-react';
import { Icon } from "@/components/ui/Icon";

interface PlayerCMSPanelProps {
  selectedSourceIds: string[];
  sourceNameMap: Map<string, string>;
  cmsResults: VideoDetailResult[];
  currentSrc: { url: string; type: VideoSource['type'] } | null;
  activeSourceId?: string;
  onPlaySource: (result: VideoDetailResult) => void;
  onFetchSource: (sourceId: string) => void;
  expanded?: boolean;
  onToggle?: () => void;
  compact?: boolean;
  /** 只读模式：源默认选中，点击无操作（直链搜索场景） */
  readOnly?: boolean;
}

export function PlayerCMSPanel({
  selectedSourceIds,
  sourceNameMap = new Map(),
  cmsResults,
  currentSrc,
  activeSourceId,
  onPlaySource,
  onFetchSource,
  expanded = true,
  onToggle,
  compact = false,
  readOnly = false,
}: PlayerCMSPanelProps) {
  const HeaderTag = compact ? 'div' : 'button';

  // sourceId → VideoDetailResult 映射
  const resultMap = new Map(cmsResults.map(r => [r.sourceId, r]));

  // 判断某个源是否正在播放中
  const isActiveSource = (sourceId: string) => {
    if (readOnly) return true;
    if (activeSourceId !== undefined) return activeSourceId === sourceId;
    if (!currentSrc) return false;
    const result = resultMap.get(sourceId);
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
        <span className="player-panel-icon"><Icon icon={Server} size="sm" /></span>
        <span className="player-panel-title">CMS源</span>
        <span className="player-panel-info">{selectedSourceIds.length}个源</span>
        {!compact && (
          <span className={`player-panel-arrow ${expanded ? 'expanded' : ''}`}>
            <Icon icon={ChevronDown} size="sm" />
          </span>
        )}
      </HeaderTag>
      <div className={`player-panel-body${!compact && !expanded ? ' collapsed' : ''}`}>
        {selectedSourceIds.length > 0 ? (
          <div className="player-cms-list">
            {selectedSourceIds.map((sourceId) => {
              const result = resultMap.get(sourceId);
              const displayName = sourceNameMap.get(sourceId) ?? sourceId;
              const active = isActiveSource(sourceId);
              return (
                <button
                  key={sourceId}
                  className={`player-cms-item ${active ? 'active' : ''}`}
                  onClick={readOnly ? undefined : () => {
                    if (result?.video) {
                      onPlaySource(result);
                    } else {
                      onFetchSource(sourceId);
                    }
                  }}
                >
                  <span className="player-cms-name">{displayName}</span>
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
