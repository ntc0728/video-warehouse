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
import { useIsMobileLayout, useIsTV } from '@/hooks/useMediaQuery';
import { buildImageSrcSet, POSTER_CARD_SIZES } from '@/services/tmdbService';
import type { TMDBVideoItem } from '@/types';
import type { Video, VideoType } from '@/types/video';
import './TMDBMovieRow.css';
import { Icon } from "@/components/ui/Icon";

export interface ContinueWatchingItem {
  /** 视频 id（tmdb-xxx），用于跳转 /play/:id */
  id: string;
  /** 封面图（竖版 cover） */
  cover: string;
  /** 横版背景图（landscape 卡片用），无则回退 cover */
  backdrop?: string;
  title: string;
  type: 'movie' | 'tv';
  /** 横版封面左上角标签（如 "源1 · 第3集"） */
  overlayLabel?: string;
  /** 播放进度（秒） */
  progress: number;
  /** 总时长（秒） */
  duration: number;
  /** 最后更新时间（毫秒时间戳），用于排序 */
  updatedAt?: number;
}

interface TMDBMovieRowProps {
  title: string;
  items: TMDBVideoItem[];
  isLoading?: boolean;
  error?: string | null;
  /**
   * 继续观看模式：卡片用横版 landscape 样式、显示进度条、
   * 点击直达 /play/:id。items 传 ContinueWatchingItem[]（类型兼容 TMDBVideoItem 的 id/cover/title/type 字段）。
   */
  continueMode?: boolean;
  /** continueMode 时使用的继续观看数据（带 progress/duration/backdrop/overlayLabel） */
  continueItems?: ContinueWatchingItem[];
}

/**
 * 将 TMDBVideoItem 转换为 VideoCard 兼容的 Video 类型
 * （input 放宽为 TMDBVideoItem 或 ContinueWatchingItem 的结构子集，仅消费 id/title/cover/type/tags）
 */
function toVideo(item: {
  id: string;
  title: string;
  cover: string;
  type: VideoType;
  tags?: string[];
}): Video {
  return {
    id: item.id,
    title: item.title,
    cover: item.cover,
    type: item.type,
    year: undefined,
    tags: item.tags ?? [],
    description: undefined,
    actors: [],
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** 骨架卡片（错开动画延迟，避免同步闪烁）
 *  - 默认竖版（2:3）：镜像 .video-card portrait 结构 — 封面 + 左上评分角标 + 右上收藏点 + 左下年份 + 右下类型 + 底部标题
 *  - landscape：横版（16:9）继续观看卡，仅封面 + 左上源徽章占位 + 底部标题
 */
function SkeletonCards({ count = 12, landscape = false }: { count?: number; landscape?: boolean }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`tmdb-movierow-card tmdb-movierow-skeleton${landscape ? ' tmdb-movierow-skeleton--landscape' : ''}`}
          style={{ animationDelay: `${(i % 4) * 0.2}s` }}
        >
          <div className="tmdb-movierow-skeleton-img">
            {landscape ? (
              /* 横版：左上源徽章占位（对齐继续观看卡 overlayLabel） */
              <span className="tmdb-movierow-skeleton-badge tmdb-movierow-skeleton-badge--tl" />
            ) : (
              /* 竖版四角标：左上评分 / 右上收藏 / 左下年份 / 右下类型 */
              <>
                <span className="tmdb-movierow-skeleton-badge tmdb-movierow-skeleton-badge--tl" />
                <span className="tmdb-movierow-skeleton-badge tmdb-movierow-skeleton-badge--tr" />
                <span className="tmdb-movierow-skeleton-badge tmdb-movierow-skeleton-badge--bl" />
                <span className="tmdb-movierow-skeleton-badge tmdb-movierow-skeleton-badge--br" />
              </>
            )}
          </div>
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
  continueMode = false,
  continueItems,
}: TMDBMovieRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [hasOverflow, setHasOverflow] = useState(false);
  // 用 useIsMobileLayout（native || 真实手机UA || 视口<768px）而非 useIsMobile（<1024px）：
  // 非手机 web 小视口（768–1023px 桌面窄窗 / 平板横竖屏）仍走桌面 UI，应显示左右箭头；
  // 只有真实手机 / App / <768px 窄窗（触摸布局）才隐藏箭头。
  const isMobile = useIsMobileLayout();
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

  // continueMode 时以 continueItems 为准（items 为空属正常）；普通模式以 items 为准
  if (continueMode ? (continueItems?.length ?? 0) === 0 : items.length === 0 && !isLoading) {
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
      className={`tmdb-movierow${continueMode ? ' tmdb-movierow--continue' : ''}`}
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
            <Icon icon={ChevronLeft} size="md" />
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
          {isLoading && (continueMode ? (continueItems?.length ?? 0) === 0 : items.length === 0) ? (
            <SkeletonCards landscape={continueMode} />
          ) : continueMode ? (
            (continueItems ?? []).map((item) => (
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
                  hideFavorite
                  variant="landscape"
                  backdropSrc={item.backdrop || item.cover}
                  overlayLabel={item.overlayLabel}
                  progress={item.progress}
                  duration={item.duration}
                  navigateTo={`/play/${item.id}`}
                />
              </div>
            ))
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
            <Icon icon={ChevronRight} size="md" />
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
  prev.items === next.items &&
  prev.continueMode === next.continueMode &&
  prev.continueItems === next.continueItems,
);
