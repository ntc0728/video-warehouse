/**
 * 视频卡片组件（多客户端适配）
 *
 * 竖版海报布局（2:3）
 * 评分左上 / 收藏右上 / 年份左下 / 类型右下 / 标题溢出跑马灯
 */
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';
import { useUserStore } from '@/stores';
import { useIsTV } from '@/hooks/useMediaQuery';
import type { Video } from '@/types/video';
import LazyImage from '../LazyImage/LazyImage';
import './VideoCard.css';

interface VideoCardProps {
  video: Video;
  index?: number;
  rating?: number;
  hideFavorite?: boolean;
}

const typeLabels: Record<string, string> = {
  movie: '电影',
  tv: '剧集',
  variety: '综艺',
  anime: '动漫',
};

const VideoCard = memo(function VideoCard({
  video,
  index = 0,
  rating,
  hideFavorite = false,
}: VideoCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { collections, addCollection, removeCollection } = useUserStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isOverflow, setIsOverflow] = useState(false);
  const titleRef = useRef<HTMLSpanElement>(null);
  const isTV = useIsTV();

  const isCollected = collections.some((c) => c.videoId === video.id);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const check = () => setIsOverflow(el.scrollWidth > el.clientWidth);
    check();
    const obs = new ResizeObserver(check);
    obs.observe(el);
    return () => obs.disconnect();
  }, [video.title]);

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsAnimating(true);
      if (isCollected) removeCollection(video.id);
      else addCollection(video.id, { title: video.title, cover: video.cover, type: video.type, year: video.year, rating });
      setTimeout(() => setIsAnimating(false), 450);
    },
    [isCollected, addCollection, removeCollection, video.id, video.title, video.cover, video.type, video.year, rating],
  );

  const handleClick = useCallback(() => navigate(`/detail/${video.id}`, {
    state: { from: location.pathname + location.search },
  }), [navigate, video.id, location.pathname, location.search]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleClick();
  }, [handleClick]);

  const stagger = { animationDelay: `${index * 0.03}s` };

  return (
    <div
      className="video-card animate-card-enter"
      style={stagger}
      onClick={handleClick}
      tabIndex={isTV ? 0 : undefined}
      onKeyDown={isTV ? handleKeyDown : undefined}
    >
      <div className="video-card-cover">
        <LazyImage
          src={video.cover}
          alt={video.title}
          className="video-card-cover-img"
          letter={video.title?.charAt(0)}
          loadingVariant="brand"
        />

        {/* 评分 — 左上角 */}
        {rating !== undefined && rating > 0 && (
          <span className="video-card-rating">
            <Star size={10} fill="currentColor" />
            {rating.toFixed(1)}
          </span>
        )}

        {/* 收藏 — 右上角：未收藏 hover 显形，已收藏常驻 */}
        {!hideFavorite && (
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

        {/* 年份 — 左下角 */}
        {video.year && (
          <span className="video-card-year-badge">{video.year}</span>
        )}

        {/* 类型 — 右下角 */}
        {video.type && (
          <span className="video-card-type">
            {typeLabels[video.type] || video.type}
          </span>
        )}
      </div>

      <div className="video-card-info">
        <div className="video-card-title-wrap">
          <h3
            className={`video-card-title ${isOverflow ? 'video-card-title--overflow' : ''}`}
            title={video.title}
          >
            <span ref={titleRef} className="video-card-title-text">
              {video.title}
            </span>
          </h3>
        </div>
      </div>
    </div>
  );
});

export default VideoCard;
