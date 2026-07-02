import { Layers, ChevronDown } from 'lucide-react';

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
}

export function PlayerSeasonPanel({
  seasons,
  activeSeason,
  onSelectSeason,
  expanded = true,
  onToggle,
  compact = false,
}: PlayerSeasonPanelProps) {
  const filtered = seasons.filter((s) => s.season_number > 0);
  if (filtered.length <= 1) return null;

  const HeaderTag = compact ? 'div' : 'button';

  return (
    <div className="player-panel player-panel--season">
      <HeaderTag
        className="player-panel-header"
        {...(!compact && onToggle ? { onClick: onToggle } : {})}
      >
        <span className="player-panel-icon"><Layers size={16} /></span>
        <span className="player-panel-title">选季</span>
        <span className="player-panel-info">{filtered.length}季</span>
        {!compact && (
          <span className={`player-panel-arrow ${expanded ? 'expanded' : ''}`}>
            <ChevronDown size={16} />
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
