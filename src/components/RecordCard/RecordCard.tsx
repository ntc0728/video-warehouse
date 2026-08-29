/**
 * RecordCard — 历史页统一横版记录卡（视频 / IPTV 同尺寸）
 * 左媒体（视频海报 / IPTV 台标充满容器）+ 右 3 行正文（标题 / 类型·来源·集数 / 状态·时间）
 * 复用全局 .record-card 选中边框 / 批量勾选 / 删除按钮类名，独立实现布局，不依赖 VideoCard/IPTVChannelCard。
 */
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Square, Trash2 } from 'lucide-react';
import LazyImage from '@/components/LazyImage/LazyImage';
import { Icon } from '@/components/ui/Icon';
import './RecordCard.css';

export type RecordCardKind = 'video' | 'iptv';

export interface RecordCardItem {
  id: string;
  kind: RecordCardKind;
  title: string;
  /** 视频：backdrop/poster 封面；IPTV：台标候选链首项 */
  media?: string;
  /** IPTV 台标候选链（media 失败后依次尝试） */
  logoCandidates?: string[];
  /** 视频：CMS 源名；IPTV：频道分组 */
  source?: string;
  /** 视频：集数标签（如「第12集」「第2季 第3集」） */
  episode?: string;
  /** 视频观看状态（IPTV 不携带） */
  status?: 'finished' | 'unfinished';
  timeText: string;
  timeTitle?: string;
  /** 播放进度（秒） */
  progress?: number;
  /** 总时长（秒） */
  duration?: number;
  navigateTo: string;
  /** 导航时写入 history state */
  navState?: Record<string, unknown>;
}

interface RecordCardProps {
  item: RecordCardItem;
  batchMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const RecordCard = memo(function RecordCard({
  item,
  batchMode,
  selected,
  onToggleSelect,
  onDelete,
}: RecordCardProps) {
  const isVideo = item.kind === 'video';
  const isFinished = item.status === 'finished';
  const hasProgress =
    isVideo &&
    item.duration !== undefined &&
    item.duration > 0 &&
    item.progress !== undefined;
  const pct = hasProgress
    ? Math.min(100, Math.round((item.progress! / item.duration!) * 100))
    : 0;
  const progressLabel = hasProgress
    ? pct >= 90
      ? '已看完'
      : `${formatClock(item.progress!)}/${formatClock(item.duration!)}`
    : '';

  const checkIcon = selected ? CheckSquare : Square;

  const content = (
    <>
      {batchMode && (
        <button
          type="button"
          className="record-card__check"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          aria-label={selected ? '取消选择' : '选择'}
          aria-pressed={selected}
        >
          <Icon icon={checkIcon} size="sm" />
        </button>
      )}
      <button
        type="button"
        className="record-card__delete"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(e); }}
        aria-label="删除"
      >
        <Icon icon={Trash2} size="xs" />
      </button>

      <div
        className={`record-card__media ${isVideo ? 'record-card__media--video' : 'record-card__media--logo'}`}
      >
        {isVideo ? (
          <LazyImage
            src={item.media || ''}
            alt={item.title}
            className="record-card__media-img"
            // 视频失败：默认 'image' → lucide MonitorPlay 图标 + kinoTV（与 VideoCard 统一）
          />
        ) : (
          <LazyImage
            src={item.media || ''}
            srcCandidates={item.logoCandidates}
            alt={item.title}
            className="record-card__media-img record-card__media-img--logo"
            fallbackVariant="tv"
          />
        )}
        {!isVideo && <span className="record-card__live-badge">LIVE</span>}
        {hasProgress && (
          <div className="record-card__progress-overlay">
            <div className="record-card__progress-bar-wrap">
              <div className="record-card__progress-bar" style={{ width: `${pct}%` }} />
            </div>
            <span className="record-card__progress-text">{progressLabel}</span>
          </div>
        )}
      </div>

      <div className="record-card__body">
        <p className="record-card__title" title={item.title}>{item.title}</p>
        <div className="record-card__line">
          <span className={`record-card__badge-type ${isVideo ? 'record-card__badge-type--video' : 'record-card__badge-type--live'}`}>
            {isVideo ? '视频' : '直播'}
          </span>
          {item.source && <span className="record-card__badge-source">{item.source}</span>}
          {isVideo && item.episode && <span className="record-card__episode">{item.episode}</span>}
        </div>
        <div className="record-card__line">
          {isVideo ? (
            <span className={isFinished ? 'record-card__status--finished' : 'record-card__status--unfinished'}>
              {isFinished ? '已看完' : '未看完'}
            </span>
          ) : (
            <span className="record-card__live">直播</span>
          )}
          <span className="record-card__time-text" title={item.timeTitle}>{item.timeText}</span>
        </div>
      </div>
    </>
  );

  const cardClass = `record-card record-card--${item.kind}${selected ? ' record-card--selected' : ''}`;

  // 始终渲染同一根元素（Link），批量模式拦截导航改为切换选中——
  // 避免「非批量 Link / 批量 div」根元素类型切换触发 React 卸载重建所有卡片，
  // 进而 LazyImage 重载淡入、整页卡片闪烁（2026-08-27 修复）。
  const handleCardClick = (e: React.MouseEvent) => {
    if (batchMode) {
      e.preventDefault();
      onToggleSelect();
    }
  };

  return (
    <Link
      to={item.navigateTo}
      state={item.navState}
      className={cardClass}
      aria-label={item.title}
      onClick={handleCardClick}
    >
      {content}
    </Link>
  );
});

export default RecordCard;

/** 秒 → "MM:SS" / "H:MM:SS"（与横版 VideoCard 进度文本一致） */
function formatClock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}