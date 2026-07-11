/**
 * 视频卡片组件（多客户端适配）
 *
 * 竖版海报布局（2:3）
 * 评分左上 / 收藏右上 / 年份左下 / 类型右下 / 标题溢出跑马灯
 */
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';
import { useUserStore } from '@/stores';
import { useIsTV } from '@/hooks/useMediaQuery';
import { useHighlightedText } from '@/lib/highlight';
import type { Video } from '@/types/video';
import LazyImage from '../LazyImage/LazyImage';
import { isImageLoaded } from '../LazyImage/imageCache';
import './VideoCard.css';

interface VideoCardProps {
  video: Video;
  index?: number;
  rating?: number;
  hideFavorite?: boolean;
  batchMode?: boolean;
  /** 响应式图片 srcSet */
  srcSet?: string;
  /** 响应式图片 sizes */
  sizes?: string;
  /** 搜索关键词，用于标题高亮 */
  highlightQuery?: string;
  /** 卡片变体：'portrait'（竖版 2:3）或 'landscape'（横版 16:9） */
  variant?: 'portrait' | 'landscape';
  /** 横版卡片专用的背景图（backdrop），优先级高于 video.cover */
  backdropSrc?: string;
  /** 横版卡片信息区内联显示的时间文本 */
  timeLabel?: string;
  /** 横版封面左上角标签（如 "源1 · 第3集"） */
  overlayLabel?: string;
  /** 播放进度（秒），配合 duration 计算百分比 */
  progress?: number;
  /** 总时长（秒） */
  duration?: number;
  /** 自定义导航路径，覆盖默认的 /detail/:id */
  navigateTo?: string;
  /** 自定义导航 state，与 navigateTo 配合使用 */
  navigateState?: Record<string, unknown>;
}

const typeLabels: Record<string, string> = {
  movie: '电影',
  tv: '剧集',
  variety: '综艺',
  anime: '动漫',
};

const VideoCard = memo(function VideoCard({
  video,
  rating,
  hideFavorite = false,
  batchMode = false,
  srcSet,
  sizes,
  highlightQuery,
  variant = 'portrait',
  backdropSrc,
  timeLabel,
  overlayLabel,
  progress,
  duration,
  navigateTo,
  navigateState,
}: VideoCardProps) {
  const location = useLocation();
  const { addCollection, removeCollection } = useUserStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isOverflow, setIsOverflow] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const isTV = useIsTV();
  const displayTitle = video.title.length > 20 ? video.title.slice(0, 20) + '…' : video.title;
  const highlightedTitle = useHighlightedText(displayTitle, highlightQuery ?? '');

  const isCollected = useUserStore(
    (s) => s.collections.some((c) => c.videoId === video.id),
  );
  const [imageLoaded, setImageLoaded] = useState(() => isImageLoaded(video.cover));

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    let cancelled = false;
    let rafId = 0;

    const check = () => {
      if (cancelled) return;
      const textEl = el.querySelector('.video-card-title-text') as HTMLElement | null;
      const trackEl = el.querySelector('.video-card-title-track') as HTMLElement | null;
      if (!textEl || !trackEl) return;

      const overflow = textEl.scrollWidth > el.clientWidth;
      setIsOverflow(overflow);

      // 停止之前的动画
      cancelAnimationFrame(rafId);
      trackEl.style.transform = '';

      if (!overflow) return;

      const distance = textEl.scrollWidth;
      const speed = 20; // px/s
      const pauseMs = 1500;

      let startTime = 0;
      let phase: 'scroll' | 'pause-end' | 'pause-start' = 'scroll';

      const animate = (now: DOMHighResTimeStamp) => {
        if (cancelled) return;
        if (!startTime) startTime = now;
        const elapsed = now - startTime;

        if (phase === 'scroll') {
          const d = Math.min(elapsed / 1000 * speed, distance);
          trackEl.style.transform = `translateX(${-d}px)`;
          if (d >= distance) {
            phase = 'pause-end';
            startTime = now;
          }
        } else if (phase === 'pause-end') {
          if (elapsed >= pauseMs) {
            trackEl.style.transform = '';
            phase = 'pause-start';
            startTime = now;
          }
        } else if (phase === 'pause-start') {
          if (elapsed >= pauseMs) {
            phase = 'scroll';
            startTime = now;
          }
        }

        rafId = requestAnimationFrame(animate);
      };

      rafId = requestAnimationFrame(animate);
    };

    const initRaf = requestAnimationFrame(() => requestAnimationFrame(check));
    const ro = new ResizeObserver(check);
    ro.observe(el);

    return () => {
      cancelled = true;
      cancelAnimationFrame(initRaf);
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [video.title]);

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsAnimating(true);
      if (isCollected) removeCollection(video.id);
      else addCollection(video.id, { title: video.title, cover: video.cover, type: video.type, year: video.year, rating, sourceIndex: navigateState?.sourceIndex as number | undefined });
      setTimeout(() => setIsAnimating(false), 450);
    },
    [isCollected, addCollection, removeCollection, video.id, video.title, video.cover, video.type, video.year, rating, navigateState],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && batchMode) {
      e.preventDefault();
    }
  }, [batchMode]);

  // 固定入场延迟：所有卡片共享同一个 delay,消除"靠后批次 index 累加导致
  // 末尾卡片等数百毫秒才淡入"的问题。Browse 页一次性列表更大,累加效应更
  // 明显,改为固定后整批几乎同时淡入。
  const stagger = { animationDelay: '0.012s' };

  // 横版卡片使用 backdrop 图，竖版使用 cover
  const coverSrc = variant === 'landscape' && backdropSrc ? backdropSrc : video.cover;

  return (
    <Link
      to={navigateTo || `/detail/${video.id}`}
      className={`video-card ${variant === 'landscape' ? 'video-card--landscape' : ''} animate-card-enter ${batchMode ? 'video-card--batch' : ''}`}
      style={stagger}
      state={{ from: location.pathname + location.search, ...navigateState }}
      tabIndex={isTV ? 0 : undefined}
      onKeyDown={isTV ? handleKeyDown : undefined}
      aria-label={video.title}
      onClick={batchMode ? (e) => { e.preventDefault(); } : undefined}
    >
      <div className="video-card-cover">
        <LazyImage
          src={coverSrc}
          srcSet={variant === 'portrait' ? srcSet : undefined}
          sizes={variant === 'portrait' ? sizes : undefined}
          alt={video.title}
          className={`video-card-cover-img ${variant === 'landscape' ? 'video-card-cover-img--landscape' : ''}`}
          letter={video.title?.charAt(0)}
          loadingVariant="brand"
          onLoad={() => setImageLoaded(true)}
        />

        {/* 左上角：评分或源名称标签（批量模式下隐藏） */}
        {!batchMode && overlayLabel && variant === 'portrait' && (
          <span className="video-card-source-badge">{overlayLabel}</span>
        )}
        {!batchMode && !overlayLabel && rating !== undefined && rating > 0 && (
          <span className="video-card-rating">
            <Star size={10} fill="currentColor" />
            {rating.toFixed(1)}
          </span>
        )}

        {/* 收藏 — 右上角：未收藏 hover 显形，已收藏常驻（批量模式下隐藏） */}
        {!batchMode && !hideFavorite && imageLoaded && (
          <button
            className={`video-card-fav-btn ${isCollected ? 'visible active' : 'hover-visible'} ${isAnimating ? 'animate-pop-bounce' : ''}`}
            onClick={handleFavorite}
            title={isCollected ? '取消收藏' : '添加收藏'}
            aria-label={isCollected ? '取消收藏' : '添加收藏'}
          >
            <Heart
              size={12}
              fill={isCollected ? 'var(--color-favorite-active)' : 'none'}
              color={isCollected ? 'var(--color-favorite-active)' : 'currentColor'}
            />
          </button>
        )}

        {/* 年份 — 左下角（批量模式下隐藏） */}
        {!batchMode && video.year && (
          <span className="video-card-year-badge">{video.year}</span>
        )}

        {/* 类型 — 右下角（批量模式下隐藏） */}
        {!batchMode && video.type && (
          <span className="video-card-type">
            {typeLabels[video.type] || video.type}
          </span>
        )}

        {/* 横版封面叠加层：源+集数徽章 + 底部渐变进度 */}
        {variant === 'landscape' && (
          <>
            {/* 左上角：源名称 + 集数 */}
            {overlayLabel && (
              <span className="video-card-landscape__source-badge">{overlayLabel}</span>
            )}
            {/* 底部进度条 + 右侧时间 */}
            {progress !== undefined && duration !== undefined && duration > 0 && (() => {
              const pct = progress / duration;
              const fmt = (s: number) => {
                const h = Math.floor(s / 3600);
                const m = Math.floor((s % 3600) / 60);
                const sec = Math.floor(s % 60);
                return h > 0
                  ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
                  : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
              };
              const label = pct >= 0.9 ? '已看完' : `${fmt(progress)}/${fmt(duration)}`;
              return (
                <div className="video-card-landscape__progress-overlay">
                  <div className="video-card-landscape__progress-bar-wrap">
                    <div
                      className="video-card-landscape__progress-bar"
                      style={{ width: `${Math.min(100, pct * 100)}%` }}
                    />
                  </div>
                  <span className="video-card-landscape__progress-text">{label}</span>
                </div>
              );
            })()}
          </>
        )}
      </div>

      <div className="video-card-info">
        <div className="video-card-title-wrap">
          <div
            ref={titleRef}
            className={`video-card-title ${isOverflow ? 'video-card-title--overflow' : ''}`}
            title={video.title}
          >
            <span className="video-card-title-track">
              <span className="video-card-title-text">
                {highlightQuery ? highlightedTitle : displayTitle}
              </span>
              {isOverflow && (
                <span className="video-card-title-text" aria-hidden>
                  {highlightQuery ? highlightedTitle : displayTitle}
                </span>
              )}
            </span>
          </div>
        </div>
        {variant === 'landscape' && timeLabel && (
          <span className="video-card__time-inline">{timeLabel}</span>
        )}
      </div>
    </Link>
  );
});

export default VideoCard;
