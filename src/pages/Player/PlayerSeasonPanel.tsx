import { Layers, ChevronDown, Loader2 } from 'lucide-react';
import { Icon } from "@/components/ui/Icon";
import { usePanelCollapse } from './hooks';

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
  /** 切换 CMS / 选季时为 true：列表区显示加载态而非旧季列表 */
  loading?: boolean;
}

export function PlayerSeasonPanel({
  seasons,
  activeSeason,
  onSelectSeason,
  expanded = true,
  onToggle,
  compact = false,
  currentSeasonName,
  loading = false,
}: PlayerSeasonPanelProps) {
  const filtered = seasons.filter((s) => s.season_number > 0);

  // App 端（compact）面板不可折叠 → collapsed 恒 false，不产生动画。
  // ⚠️ 必须在下方 return 分支之前调用，保证 Hook 顺序稳定。
  const collapsed = !compact && !expanded;
  const collapseRef = usePanelCollapse<HTMLDivElement>(collapsed);

  // 多季模式：可切换
  if (filtered.length > 1) {
    const HeaderTag = compact ? 'div' : 'button';
    return (
      <div ref={collapseRef} className={`player-panel player-panel--season${collapsed ? ' collapsed' : ''}`}>
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
        <div className={`player-panel-body${collapsed ? ' collapsed' : ''}`}>
          {loading ? (
            <div className="player-panel-loading">
              <Icon icon={Loader2} size="sm" className="spinning" />
              <span>加载中...</span>
            </div>
          ) : (
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
          )}
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
