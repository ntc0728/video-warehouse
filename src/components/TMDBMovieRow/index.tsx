/**
 * TMDB 横向滚动行组件（多客户端适配）
 * 展示一行标题 + 横向滚动卡片列表，用于首页各 TMDB 区块
 *
 * 适配：
 * - 移动端：触摸滑动
 * - 桌面端：鼠标滚轮 + hover 箭头
 * - TV 端：方向键左右滚动 + 焦点导航 + 自动滚动到焦点卡片
 *
 * 性能: 用 React.memo + 自定义比较包裹,避免 7 行同时接收到 loading 翻
 * 转时全部重渲染。items 引用由 store 控制(fetch 时整体替换),比引用即可
 * 判断"数据是否变了"。
 */
import { memo, useRef, useState, useEffect, useCallback } from 'react';
import { VideoCard } from '@/components/VideoCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import type { TMDBVideoItem } from '@/stores/useTMDBStore';
import type { Video, VideoType } from '@/types/video';
import './TMDBMovieRow.css';

interface TMDBMovieRowProps {
  title: string;
  items: TMDBVideoItem[];
  isLoading?: boolean;
  error?: string | null;
}

/**
 * 将 TMDBVideoItem 转换为 VideoCard 兼容的 Video 类型
 */
function toVideo(item: TMDBVideoItem): Video {
  return {
    id: item.id,
    title: item.title,
    cover: item.cover,
    type: item.type as VideoType,
    year: item.year,
    tags: item.tags,
    description: item.description,
    actors: [],
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** 骨架卡片 */
function SkeletonCards({ count = 7 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="tmdb-movierow-card tmdb-movierow-skeleton">
          <div className="tmdb-movierow-skeleton-img" />
          <div className="tmdb-movierow-skeleton-title" />
        </div>
      ))}
    </>
  );
}

function TMDBMovieRow({
  title,
  items,
  isLoading = false,
  error = null,
}: TMDBMovieRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const isMobile = useIsMobile();
  const isTV = useIsTV();

  // 拖拽状态
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const dragScrollLeftRef = useRef<number>(0);
  const dragMovedRef = useRef<boolean>(false);
  // 累计欧式距离平方（X + Y），用于"卡片上轻抖不触发 drag"的二次判定
  const dragLastXRef = useRef<number>(0);
  const dragLastYRef = useRef<number>(0);
  const dragTotalPathSqRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  /** 全局最小拖拽阈值：6px — 卡片上轻抖不触发 dragMovedRef，避免被误判为点击跳详情 */
  const DRAG_MIN_DISTANCE_SQ = 36; // 6 * 6

  /** 焦点管理：TV 端卡片聚焦时自动滚动到可见区域 */
  const handleCardFocus = useCallback(
    (cardEl: HTMLElement) => {
      if (!isTV || !rowRef.current) return;
      const row = rowRef.current;
      const cardRect = cardEl.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();

      // 卡片超出右侧 → 向右滚动
      if (cardRect.right > rowRect.right - 20) {
        row.scrollBy({ left: cardRect.right - rowRect.right + 40, behavior: 'smooth' });
      }
      // 卡片超出左侧 → 向左滚动
      else if (cardRect.left < rowRect.left + 20) {
        row.scrollBy({ left: cardRect.left - rowRect.left - 40, behavior: 'smooth' });
      }
    },
    [isTV],
  );

  /** 箭头可见性 */
  const updateArrows = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setShowLeftArrow(el.scrollLeft > 0);
    setShowRightArrow(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    updateArrows();
    return () => el.removeEventListener('scroll', updateArrows);
  }, [items, updateArrows]);

  /** 视口步进：点击箭头滚动一屏，剩余不足一屏则直接到末尾 */
  const scrollByViewport = useCallback((direction: 'left' | 'right') => {
    const el = rowRef.current;
    if (!el) return;
    const viewport = el.clientWidth;
    if (direction === 'left') {
      const target = Math.max(0, el.scrollLeft - viewport);
      el.scrollTo({ left: target, behavior: 'smooth' });
    } else {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const remaining = maxScroll - el.scrollLeft;
      // 剩余不足一屏（含 4px 容差）→ 直接滚到末尾
      if (remaining <= viewport + 4) {
        el.scrollTo({ left: maxScroll, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: viewport, behavior: 'smooth' });
      }
    }
  }, []);

  /** TV 端键盘导航：左右方向键滚动行 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isTV) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollByViewport('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollByViewport('right');
      }
    },
    [isTV, scrollByViewport],
  );

  // 鼠标拖拽：仅在桌面端非 TV、非触摸设备时启用
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isMobile || isTV) return;
    if (e.pointerType === 'touch') return; // 触摸走 touchstart
    const el = rowRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    dragTotalPathSqRef.current = 0;
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    dragLastXRef.current = e.clientX;
    dragLastYRef.current = e.clientY;
    dragScrollLeftRef.current = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
  }, [isMobile, isTV]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const el = rowRef.current;
    if (!el) return;
    const dx = e.clientX - dragStartXRef.current;
    if (Math.abs(dx) > 4) dragMovedRef.current = true;
    // 累计欧式距离平方（X + Y），用于释放时的二次判定
    const ddx = e.clientX - dragLastXRef.current;
    const ddy = e.clientY - dragLastYRef.current;
    dragTotalPathSqRef.current += ddx * ddx + ddy * ddy;
    dragLastXRef.current = e.clientX;
    dragLastYRef.current = e.clientY;
    el.scrollLeft = dragScrollLeftRef.current - dx;
  }, []);

  const handlePointerUpOrCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    const el = rowRef.current;
    if (el && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
    // 释放时若累计位移 < 6px，强制清空 dragMovedRef（视为点击，让卡片 onClick 正常触发）
    if (dragTotalPathSqRef.current < DRAG_MIN_DISTANCE_SQ) {
      dragMovedRef.current = false;
    }
  }, []);

  if (items.length === 0 && !isLoading) {
    // 有错误时显示错误行，否则隐藏
    if (error) {
      return (
        <div className="tmdb-movierow">
          <div className="tmdb-movierow-header">
            <h2 className="tmdb-movierow-title">{title}</h2>
            <span className="tmdb-movierow-error">{error}</span>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className="tmdb-movierow"
      data-device-row={isTV ? 'tv' : undefined}
      onKeyDown={isTV ? handleKeyDown : undefined}
    >
      <div className="tmdb-movierow-header">
        <h2 className="tmdb-movierow-title">{title}</h2>
      </div>

      <div className="tmdb-movierow-wrapper">
        {/* 左箭头（TV 端隐藏，用方向键代替） */}
        {!isMobile && !isTV && showLeftArrow && (
          <button
            className="tmdb-movierow-arrow tmdb-movierow-arrow-left"
            onClick={() => scrollByViewport('left')}
            aria-label="向左滚动"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* 卡片列表 */}
        <div
          className={`tmdb-movierow-scroll${isDragging ? ' tmdb-movierow-scroll--dragging' : ''}`}
          ref={rowRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
        >
          {isLoading ? (
            <SkeletonCards />
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="tmdb-movierow-card"
                onFocus={(e) => handleCardFocus(e.currentTarget)}
                onClickCapture={(e) => {
                  if (dragMovedRef.current) {
                    e.stopPropagation();
                    e.preventDefault();
                    dragMovedRef.current = false;
                  }
                }}
              >
                <VideoCard video={toVideo(item)} rating={item.voteAverage} />
              </div>
            ))
          )}
        </div>

        {/* 右箭头（TV 端隐藏） */}
        {!isMobile && !isTV && showRightArrow && (
          <button
            className="tmdb-movierow-arrow tmdb-movierow-arrow-right"
            onClick={() => scrollByViewport('right')}
            aria-label="向右滚动"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(TMDBMovieRow, (prev, next) =>
  prev.title === next.title &&
  prev.isLoading === next.isLoading &&
  prev.error === next.error &&
  prev.items === next.items,
);
