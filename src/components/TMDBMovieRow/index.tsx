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
import { buildImageSrcSet, POSTER_CARD_SIZES } from '@/services/tmdbService';
import type { TMDBVideoItem } from '@/types';
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

/** 骨架卡片（错开动画延迟，避免同步闪烁） */
function SkeletonCards({ count = 12 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="tmdb-movierow-card tmdb-movierow-skeleton"
          style={{ animationDelay: `${(i % 4) * 0.2}s` }}
        >
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
  const [hasOverflow, setHasOverflow] = useState(false);
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
  // 拖拽源 card 元素：用于在释放前准确 releasePointerCapture / 计算 snap 边界
  const dragCardElRef = useRef<HTMLElement | null>(null);
  // rAF 节流：避免同一帧内多次 scrollLeft 赋值
  const rafIdRef = useRef<number | null>(null);
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

  /** 箭头可见性 + 溢出判定 */
  const updateArrows = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    // 仅当内容真实溢出视口（数据量超过当前视口可展示数量）时才需要箭头
    setHasOverflow(el.scrollWidth > el.clientWidth + 1);
    setShowLeftArrow(el.scrollLeft > 0);
    setShowRightArrow(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    updateArrows();
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [items, updateArrows]);

  /** 视口步进：点击箭头滚动一屏，剩余不足一屏则直接到末尾（浏览器原生平滑滚动） */
  const scrollByViewport = useCallback(
    (direction: 'left' | 'right') => {
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
    },
    [],
  );

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
  // 设计：卡片上按下 → 进入 drag 模式；空白处按下 → 忽略
  // click 事件：通过 onClickCapture 在 pointerup 后精确判断（距离 < 6px 视为点击）
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isMobile || isTV) return;
    if (e.pointerType === 'touch') return;
    const el = rowRef.current;
    if (!el) return;
    const cardEl = (e.target as HTMLElement).closest('.tmdb-movierow-card') as HTMLElement | null;
    if (!cardEl) return;
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    dragTotalPathSqRef.current = 0;
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    dragLastXRef.current = e.clientX;
    dragLastYRef.current = e.clientY;
    dragScrollLeftRef.current = el.scrollLeft;
    dragCardElRef.current = cardEl;
  }, [isMobile, isTV]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const el = rowRef.current;
    if (!el) return;
    const dx = e.clientX - dragStartXRef.current;
    if (Math.abs(dx) > 4) dragMovedRef.current = true;
    const ddx = e.clientX - dragLastXRef.current;
    const ddy = e.clientY - dragLastYRef.current;
    dragTotalPathSqRef.current += ddx * ddx + ddy * ddy;
    dragLastXRef.current = e.clientX;
    dragLastYRef.current = e.clientY;
    const targetLeft = dragScrollLeftRef.current - dx;
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      el.scrollLeft = targetLeft;
    });
  }, []);

  const handlePointerUpOrCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    dragCardElRef.current = null;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // 用最终位移（而非累计路径）判定：距起点 < 6px → 视为点击
    const finalDx = e.clientX - dragStartXRef.current;
    const finalDy = e.clientY - dragStartYRef.current;
    const finalDistSq = finalDx * finalDx + finalDy * finalDy;
    if (finalDistSq < DRAG_MIN_DISTANCE_SQ) {
      dragMovedRef.current = false;
    }
    // 拖拽结束后 snap 到最近 card 边界
    if (dragMovedRef.current) {
      const el = rowRef.current;
      if (el) {
        const currentLeft = el.scrollLeft;
        const firstCard = el.querySelector('.tmdb-movierow-card') as HTMLElement | null;
        if (firstCard) {
          const cardWidth = firstCard.getBoundingClientRect().width;
          const gap = parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap || '0') || 0;
          const step = cardWidth + gap;
          if (step > 0) {
            const idx = Math.round(currentLeft / step);
            const target = Math.max(0, Math.min(idx * step, el.scrollWidth - el.clientWidth));
            setTimeout(() => {
              el.scrollTo({ left: target, behavior: 'smooth' });
            }, 50);
          }
        }
      }
    }
  }, []);

  // 全局 pointerup 兜底：鼠标移出行外释放时也能正确结束拖拽
  useEffect(() => {
    if (!isDragging) return;
    const handleGlobalPointerUp = (e: PointerEvent) => {
      handlePointerUpOrCancel(e as unknown as React.PointerEvent<HTMLDivElement>);
    };
    window.addEventListener('pointerup', handleGlobalPointerUp, { once: true });
    window.addEventListener('pointercancel', handleGlobalPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [isDragging, handlePointerUpOrCancel]);

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
        {/* 左箭头（TV 端隐藏）。仅当内容溢出视口「且可向左滚动（未到头）」时渲染 */}
        {!isMobile && !isTV && hasOverflow && items.length > 0 && showLeftArrow && (
          <button
            type="button"
            className="tmdb-movierow-arrow tmdb-movierow-arrow-left"
            onClick={(e) => {
              // 阻止默认行为 + 冒泡，确保点击箭头绝不会触发卡片导航或任何祖先跳转
              e.preventDefault();
              e.stopPropagation();
              scrollByViewport('left');
            }}
            aria-label="向左滚动"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* 卡片列表 — pointer 事件注册在 row 容器（外层），
            handlePointerDown 内部用 closest() 判定 e.target 是否是 .tmdb-movierow-card，
            空白处 mousedown 不进入 drag 模式；同时 setPointerCapture 绑到 card 元素
            以保证浏览器原生 click 事件正确命中（jump/收藏按钮正常工作）。 */}
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
            items.map((item) => {
              // 为 TMDB poster 图片生成响应式 srcSet
              // TMDBMovieRow 是横向滚动布局，卡片宽度根据 --card-cols 动态计算
              // 使用 (100vw / var(--card-cols)) 作为 sizes 参考值，浏览器会自动选择合适尺寸
              // 海报封面压缩：上限 w342（卡片显示仅 ~230px，2x DPR 下也足够清晰），
              // 体积约为 w500 的一半，减少首页多行海报的下载/解码开销，缓解侧栏折叠卡顿。
              const posterSrcSet = item.posterPath ? buildImageSrcSet(item.posterPath, POSTER_CARD_SIZES) : undefined;
               return (
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
                   <VideoCard
                     video={toVideo(item)}
                     rating={item.voteAverage}
                     srcSet={posterSrcSet ?? undefined}
                    sizes="(max-width: 767px) 33vw, (max-width: 1279px) 16vw, 12vw"
                  />
                </div>
              );
            })
          )}
        </div>

        {/* 右箭头（TV 端隐藏）。仅当内容溢出视口「且可向右滚动（未到尾）」时渲染 */}
        {!isMobile && !isTV && hasOverflow && items.length > 0 && showRightArrow && (
          <button
            type="button"
            className="tmdb-movierow-arrow tmdb-movierow-arrow-right"
            onClick={(e) => {
              // 阻止默认行为 + 冒泡，确保点击箭头绝不会触发卡片导航或任何祖先跳转
              e.preventDefault();
              e.stopPropagation();
              scrollByViewport('right');
            }}
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
