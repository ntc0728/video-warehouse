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
  /**
   * 分类切换信号：值变化时将行 scrollLeft 复位为 0。
   * 首页分类切换时行内容整体替换（items 引用变化），浏览器 scroll-snap 会把
   * scrollLeft 拉到 maxScroll（40 卡→20 卡时实测 0→2032），导致「预加载收集的
   * 首屏卡（index 0..N）」与「实际可见卡（行尾）」错位 → 未命中缓存 → 骨架遮罩。
   * 复位后可见卡回到 index 0 起，与预加载范围对齐，命中 session 缓存直接 loaded。
   */
  scrollResetToken?: string;
  /**
   * 卡片封面旧图→新图交叉淡入（首页分类切换用）。开启后卡片以「槽位索引」复用，
   * 封面切换走 LazyImage 交叉淡入，与 banner/缩略图过渡一致；不开启时保持原 blur-up。
   */
  crossfadeOnChange?: boolean;
  /** 跳过进入动画（首页进入过渡期间禁用 animate-card-enter，避免"继续观看"行卡片闪烁）。 */
  skipAnimations?: boolean;
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
  year?: number;
}): Video {
  return {
    id: item.id,
    title: item.title,
    cover: item.cover,
    type: item.type,
    year: item.year,
    tags: item.tags ?? [],
    description: undefined,
    actors: [],
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 稳定 video 引用（B 项修复）：VideoCard 是 memo，但此前每次渲染都传
 * `toVideo(item)`（新建对象）→ memo 永远失效 → 父级任意重渲染都让全部卡片重渲染，
 * 击穿 memo。这里按 item 对象本身（store 中同一数据项引用恒定）缓存转换结果，
 * 同一 item 跨渲染/跨分类复用同一 video 引用 → 仅数据真变的卡片重渲染。
 * 数据刷新后 store 会换成新的 item 对象 → 自动重新计算，不会显示旧数据。
 */
const videoMemoCache = new WeakMap<object, Video>();
function getVideo(item: {
  id: string;
  title: string;
  cover: string;
  type: VideoType;
  tags?: string[];
  year?: number;
}): Video {
  const cached = videoMemoCache.get(item);
  if (cached) return cached;
  const v = toVideo(item);
  videoMemoCache.set(item, v);
  return v;
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
  scrollResetToken,
  crossfadeOnChange = false,
  skipAnimations = false,
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
    // continueMode 下 items 恒为空数组（引用不变），continueItems 变化时
    // 必须重新计算 hasOverflow，否则箭头在数据到达后不显示
  }, [items, continueItems, updateArrows]);

  // 分类切换（scrollResetToken 变化）时行 scrollLeft 复位为 0：
  // 内容整体替换瞬间 scroll-snap 会把 scrollLeft 拉到 maxScroll（实测 0→2032），
  // 导致预加载覆盖的首屏卡（index 0..N）与可见卡错位 → 未命中缓存 → 骨架遮罩闪。
  // 复位后与预加载范围对齐，命中 session 缓存直接 loaded 渲染。
  useEffect(() => {
    if (scrollResetToken === undefined) return;
    const el = rowRef.current;
    if (!el) return;
    // 先禁用 scroll-snap，避免复位瞬间又被 snap 拉走（snap 在内容变化帧会重新吸附）
    el.classList.add('tmdb-movierow-scroll--no-snap');
    el.scrollLeft = 0;
    updateArrows();
    // 下一帧恢复 snap（复位后内容已稳定，不再触发重新吸附）
    requestAnimationFrame(() => {
      el.classList.remove('tmdb-movierow-scroll--no-snap');
    });
  }, [scrollResetToken, updateArrows]);

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
        {!isMobile && !isTV && hasOverflow && (continueMode ? (continueItems?.length ?? 0) > 0 : items.length > 0) && showLeftArrow && (
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
                   video={getVideo(item)}
                   hideFavorite
                   variant="landscape"
                   backdropSrc={item.backdrop || item.cover}
                   overlayLabel={item.overlayLabel}
                   progress={item.progress}
                   duration={item.duration}
                   navigateTo={`/play/${item.id}`}
                   skipAnimations={skipAnimations}
                 />
              </div>
            ))
          ) : (
            items.map((item, index) => {
              // 为 TMDB poster 图片生成响应式 srcSet
              // TMDBMovieRow 是横向滚动布局，卡片宽度根据 --card-cols 动态计算
              // 使用 (100vw / var(--card-cols)) 作为 sizes 参考值，浏览器会自动选择合适尺寸
              // 海报封面压缩：上限 w342（卡片显示仅 ~230px，2x DPR 下也足够清晰），
              // 体积约为 w500 的一半，减少首页多行海报的下载/解码开销，缓解侧栏折叠卡顿。
              const posterSrcSet = item.posterPath ? buildImageSrcSet(item.posterPath, POSTER_CARD_SIZES) : undefined;
               return (
                 <div
                   // 槽位索引 key：分类切换时卡片实例存活（不重挂载），
                   // 既避免 animate-card-enter 重放，又让 LazyImage 复用实例走交叉淡入。
                   key={index}
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
                     video={getVideo(item)}
                     rating={item.voteAverage}
                     srcSet={posterSrcSet ?? undefined}
                     sizes="(max-width: 767px) 33vw, (max-width: 1279px) 16vw, 12vw"
                     crossfadeOnChange={crossfadeOnChange}
                     skipAnimations={skipAnimations}
                   />
                </div>
              );
            })
          )}
        </div>

        {/* 右箭头（TV 端隐藏）。仅当内容溢出视口「且可向右滚动（未到尾）」时渲染 */}
        {!isMobile && !isTV && hasOverflow && (continueMode ? (continueItems?.length ?? 0) > 0 : items.length > 0) && showRightArrow && (
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
