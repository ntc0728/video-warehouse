import { Layers, ChevronDown } from 'lucide-react';
import { Icon } from "@/components/ui/Icon";

interface SeasonInfo {
  season_number: number;
  name: string;
  episode_count: number;
}

interface PlayerSeasonPanelProps {
  seasons: SeasonInfo[];
  activeSeason: number;
  onSelectSeason: (seasonNumber: number) => void;
  expanded?: boolean;
  onToggle?: () => void;
  compact?: boolean;
  /** 非 TMDB 视频：从 video.title 提取的当前季名称，纯展示 */
  currentSeasonName?: string;
}

export function PlayerSeasonPanel({
  seasons,
  activeSeason,
  onSelectSeason,
  expanded = true,
  onToggle,
  compact = false,
  currentSeasonName,
}: PlayerSeasonPanelProps) {
  const filtered = seasons.filter((s) => s.season_number > 0);

  // 多季模式：可切换
  if (filtered.length > 1) {
    const HeaderTag = compact ? 'div' : 'button';
    return (
      <div className="player-panel player-panel--season">
        <HeaderTag
          className="player-panel-header"
          {...(!compact && onToggle ? { onClick: onToggle } : {})}
        >
          <span className="player-panel-icon"><Icon icon={Layers} size="sm" /></span>
          <span className="player-panel-title">选季</span>
          <span className="player-panel-info">{filtered.length}季</span>
          {!compact && (
            <span className={`player-panel-arrow ${expanded ? 'expanded' : ''}`}>
              <Icon icon={ChevronDown} size="sm" />
            </span>
          )}
        </HeaderTag>
        <div className={`player-panel-body${!compact && !expanded ? ' collapsed' : ''}`}>
          <div className="player-season-list">
            {filtered.map((s) => (
              <button
                key={s.season_number}
                className={`player-season-item ${s.season_number === activeSeason ? 'active' : ''}`}
                onClick={() => onSelectSeason(s.season_number)}
              >
                <span className="player-season-name">{s.name} · {s.episode_count}集</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 单季或无季模式：仅展示当前季名称
  if (currentSeasonName) {
    return (
      <div className="player-panel player-panel--season">
        <div className="player-panel-header">
          <span className="player-panel-icon"><Icon icon={Layers} size="sm" /></span>
          <span className="player-panel-title">选季</span>
          <span className="player-panel-info">{currentSeasonName}</span>
        </div>
      </div>
    );
  }

  return null;
}
