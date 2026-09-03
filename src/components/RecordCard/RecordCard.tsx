/**
 * RecordCard — 历史页统一记录卡（视频 / IPTV 同尺寸）
 * 默认竖版（≥480px）：上媒体（16:9 封面宽=卡宽）+ 下 2 行文字：
 *   标题独占一行(溢出无缝跑马灯) / 类型·来源·集数(左成链) + 观看时间(行尾右对齐)
 * 窄屏（<480px，1 列）自动切横版：封面左固定 124px + 右侧信息逐行排布
 *   （标题 / 类型 / 来源 / 集数 各占一行，集数+时间同行两端对齐，见 meta-col）。
 * 复用全局 .record-card 选中边框 / 批量勾选 / 删除按钮类名，独立实现布局，不依赖 VideoCard/IPTVChannelCard。
 */
import { memo, useEffect, useRef, useState } from 'react';
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
  /** 跳转前拦截：返回 false 时阻止导航（如 CMS 源未启用） */
  onBeforeNavigate?: () => boolean;
  /** IPTV 可看性（来自缓存）：true=可看 / false=无法观看 / undefined=未检测（默认按可看展示 LIVE） */
  available?: boolean;
}

interface RecordCardProps {
  item: RecordCardItem;
  batchMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  /** 跳转前拦截：返回 false 时阻止 Link 导航（如 CMS 源未启用） */
  onBeforeNavigate?: () => boolean;
}

const RecordCard = memo(function RecordCard({
  item,
  batchMode,
  selected,
  onToggleSelect,
  onDelete,
  onBeforeNavigate,
}: RecordCardProps) {
  const isVideo = item.kind === 'video';
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

  // 标题溢出检测：溢出时悬停滚动（避免整页跑马灯抖动）
  const titleRef = useRef<HTMLParagraphElement>(null);
  const [titleOverflow, setTitleOverflow] = useState(false);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const check = () => setTitleOverflow(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [item.title]);

  // 进入视口标记：移动端无 hover，改用"进入视口即播放"跑马灯；离开视口即停
  const cardRef = useRef<HTMLAnchorElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // live 角标：可看=绿(LIVE) / 无法观看=红(无法观看)
  const liveBadgeClass =
    'record-card__live-badge ' +
    (item.available === false ? 'is-unavailable' : 'is-available');
  const liveBadgeText = item.available === false ? '无法观看' : 'LIVE';

  const content = (
    <>
      <button
        type="button"
        className="record-card__delete"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete?.(e);
        }}
        aria-label="删除"
      >
        <Icon icon={Trash2} size="xs" />
      </button>

      <div
        className={`record-card__media ${isVideo ? 'record-card__media--video' : 'record-card__media--logo'}`}
      >
        {/* 批量勾选：悬浮在封面左上角（仅在批量模式出现，避免遮挡 LIVE 角标） */}
        {batchMode && (
          <button
            type="button"
            className="record-card__check"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            aria-label={selected ? '取消选择' : '选择'}
            aria-pressed={selected}
          >
            <Icon icon={checkIcon} size="sm" />
          </button>
        )}
        {isVideo ? (
          <LazyImage
            src={item.media || ''}
            alt={item.title}
            className="record-card__media-img"
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
        {!isVideo && <span className={liveBadgeClass}>{liveBadgeText}</span>}
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
        {/* 第 1 行：标题独占整行（宽=正文区宽），溢出时无缝跑马灯 */}
        <p
          ref={titleRef}
          className={`record-card__title${titleOverflow ? ' is-overflow' : ''}`}
          title={item.title}
        >
        {titleOverflow ? (
          <span className="record-card__title-track">
            <span className="record-card__title-text">{item.title}</span>
            <span className="record-card__title-text" aria-hidden="true">
              {item.title}
            </span>
          </span>
        ) : (
          <span className="record-card__title-text">{item.title}</span>
        )}
        </p>

        {/* 第 2 行：类型徽标 + 来源·集数 靠左成链；观看时间贴行尾右对齐（两端对齐，时间绝不压缩） */}
        <div className="record-card__meta-row">
          <span
            className={`record-card__badge-type ${
              isVideo ? 'record-card__badge-type--video' : 'record-card__badge-type--live'
            }`}
          >
            {isVideo ? '视频' : '直播'}
          </span>
          {item.source && <span className="record-card__badge-source">{item.source}</span>}
          {isVideo && item.episode && <span className="record-card__episode">{item.episode}</span>}
          <span className="record-card__time-text" title={item.timeTitle}>
            {item.timeText}
          </span>
        </div>

        {/* 窄屏(<480px) 横版信息列：类型 / 来源 各占一行；集数 + 时间同行两端对齐。
           与上方 meta-row 二选一显隐（meta-col 默认 none，<480px 时 meta-row 隐藏、col 显示），
           不重复内容、不依赖 JS 断点。IPTV 无集数 → bottom 行只剩时间、贴右。 */}
        <div className="record-card__meta-col">
          <span
            className={`record-card__badge-type ${
              isVideo ? 'record-card__badge-type--video' : 'record-card__badge-type--live'
            }`}
          >
            {isVideo ? '视频' : '直播'}
          </span>
          {item.source && <span className="record-card__badge-source">{item.source}</span>}
          <div className="record-card__meta-bottom">
            {isVideo && item.episode && <span className="record-card__episode">{item.episode}</span>}
            <span className="record-card__time-text" title={item.timeTitle}>
              {item.timeText}
            </span>
          </div>
        </div>
      </div>
    </>
  );

  const cardClass = `record-card record-card--${item.kind}${selected ? ' record-card--selected' : ''}${inView ? ' is-in-view' : ''}`;

  // 始终渲染同一根元素（Link），批量模式拦截导航改为切换选中——
  // 避免「非批量 Link / 批量 div」根元素类型切换触发 React 卸载重建所有卡片，
  // 进而 LazyImage 重载淡入、整页卡片闪烁（2026-08-27 修复）。
  const handleCardClick = (e: React.MouseEvent) => {
    if (batchMode) {
      e.preventDefault();
      onToggleSelect();
      return;
    }
    if (onBeforeNavigate && !onBeforeNavigate()) {
      e.preventDefault();
    }
  };

  return (
    <Link
      to={item.navigateTo}
      state={item.navState}
      className={cardClass}
      aria-label={item.title}
      onClick={handleCardClick}
      ref={cardRef}
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
