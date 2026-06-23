/**
 * TMDB Trending 横幅轮播组件（多客户端适配）
 * 大图轮播展示 trending 影片的 backdrop + logo + 评分 + 简介
 * 带交叉淡入淡出过渡动画
 *
 * 适配：
 * - 移动端：触摸滑动
 * - 桌面端：鼠标 hover 箭头 + 点击指示点
 * - TV 端：方向键左右切换 + Enter 确认 + 聚焦时暂停自动播放
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsTV } from '@/hooks/useMediaQuery';
import { buildImageUrl } from '@/services/tmdbService';
import type { TMDBVideoItem } from '@/types';
import './TMDBTrendingBanner.css';

interface TMDBTrendingBannerProps {
  items: TMDBVideoItem[];
  autoPlayInterval?: number;
}

/** 单个 slide 的内容渲染 */
function SlideContent({
  item,
  isTV,
}: {
  item: TMDBVideoItem;
  isTV: boolean;
}) {
  return (
    <>
      <div className="tmdb-trending-gradient" />
      <div className="tmdb-trending-content">
        {item.logoPath && (
          <img
            className="tmdb-trending-logo"
            src={buildImageUrl(item.logoPath, 'w500') || ''}
            alt={item.title}
          />
        )}
        {!item.logoPath && (
          <h2 className="tmdb-trending-title">{item.title}</h2>
        )}
        <div className="tmdb-trending-meta">
          <span className="tmdb-trending-rating">
            ★ {item.voteAverage.toFixed(1)}
          </span>
          {item.year && (
            <span className="tmdb-trending-year">{item.year}</span>
          )}
          <span className="tmdb-trending-type">
            {item.mediaType === 'movie' ? '电影' : '剧集'}
          </span>
        </div>
        {item.description && (
          <p className="tmdb-trending-overview">{item.description}</p>
        )}
        {isTV && (
          <div className="tmdb-trending-tv-hint">
            ← → 切换 &nbsp; Enter 进入
          </div>
        )}
      </div>
    </>
  );
}

export default function TMDBTrendingBanner({
  items,
  autoPlayInterval = 5000,
}: TMDBTrendingBannerProps) {
  const [current, setCurrent] = useState(0);
  const [prevIndex, setPrevIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const touchStartRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTV = useIsTV();

  const navigate = useNavigate();
  const location = useLocation();
  const count = items.length;

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning || count === 0) return;
      setIsTransitioning(true);
      setLeaving(false);
      setPrevIndex(current);
      setCurrent(((index % count) + count) % count);
      // 下一帧添加 leaving class，触发 opacity 过渡
      requestAnimationFrame(() => setLeaving(true));
      setTimeout(() => { setIsTransitioning(false); setLeaving(false); }, 550);
    },
    [count, isTransitioning, current],
  );

  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);
  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);

  // 自动播放
  useEffect(() => {
    if (count <= 1 || isFocused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(goNext, autoPlayInterval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [goNext, autoPlayInterval, count, isFocused]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isTV) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const item = items[current];
        if (item) navigate(`/detail/${item.id}`, {
          state: { from: location.pathname + location.search },
          viewTransition: true,
        });
      }
    },
    [isTV, goPrev, goNext, current, items, navigate, location.pathname, location.search],
  );

  const handleClick = (item: TMDBVideoItem) => {
    navigate(`/detail/${item.id}`, {
      state: { from: location.pathname + location.search },
      viewTransition: true,
    });
  };

  if (count === 0) return null;

  const currentItem = items[current];
  const prevItem = items[prevIndex];
  const currentBg = buildImageUrl(currentItem.backdropPath ?? null, 'w1280') || '';
  const prevBg = buildImageUrl(prevItem.backdropPath ?? null, 'w1280') || '';

  return (
    <div
      ref={containerRef}
      className={`tmdb-trending-banner ${isTV ? 'tmdb-trending-banner--tv' : ''}`}
      tabIndex={isTV ? 0 : undefined}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
    >
      <div className="tmdb-trending-slides">
        {/* 前一张（fade out） */}
        {isTransitioning && prevIndex !== current && (
          <div
            className={`tmdb-trending-slide ${leaving ? 'tmdb-trending-slide--leaving' : ''}`}
            style={{ backgroundImage: prevBg ? `url(${prevBg})` : undefined }}
          >
            <SlideContent item={prevItem} isTV={isTV} />
          </div>
        )}

        {/* 当前张 */}
        <div
          className={`tmdb-trending-slide ${isTransitioning ? 'tmdb-trending-slide--entering' : ''}`}
          style={{ backgroundImage: currentBg ? `url(${currentBg})` : undefined }}
          onClick={() => !isTV && handleClick(currentItem)}
        >
          <SlideContent item={currentItem} isTV={isTV} />
        </div>
      </div>

      {/* 指示点 */}
      {count > 1 && (
        <div className="tmdb-trending-dots">
          {items.map((_, i) => (
            <button
              key={i}
              className={`tmdb-trending-dot ${i === current ? 'active' : ''}`}
              onClick={() => goTo(i)}
              tabIndex={-1}
              aria-label={`第 ${i + 1} 张`}
            />
          ))}
        </div>
      )}

      {/* 桌面端箭头 */}
      {count > 1 && !isTV && (
        <>
          <button className="tmdb-trending-arrow tmdb-trending-arrow-left" onClick={goPrev} aria-label="上一张">
            <ChevronLeft size={24} />
          </button>
          <button className="tmdb-trending-arrow tmdb-trending-arrow-right" onClick={goNext} aria-label="下一张">
            <ChevronRight size={24} />
          </button>
        </>
      )}
    </div>
  );
}
