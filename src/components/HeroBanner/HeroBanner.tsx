/**
 * HeroBanner — 首页 Hero 横幅
 * 基于 TMDB trending 数据，自动轮播 + 主题感知渐变蒙版 + CTA 按钮
 * 7 客户端适配 + prefers-reduced-motion 支持
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { usePointerType } from '@/hooks/usePointerType';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { buildImageUrl, buildImageSrcSet } from '@/services/tmdbService';
import './HeroBanner.css';

interface HeroItem {
  id: number | string;
  title: string;
  backdropPath?: string | null;
  posterPath?: string | null;
  overview?: string;
  voteAverage?: number;
  releaseDate?: string;
  mediaType?: 'movie' | 'tv';
  // 兼容旧版 snake_case 字段
  backdrop_path?: string;
  poster_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
}

interface HeroBannerProps {
  items: HeroItem[];
  autoPlayInterval?: number;
  onItemClick?: (item: HeroItem) => void;
  onContinuePlay?: (item: HeroItem) => void;
  historyMap?: Map<string, { progress: number }>;

}

/** Hero 蒙版颜色（深色径向渐变） */
const HERO_MASK_BG = 'var(--hero-mask-dark)';
/** 鼠标拖拽触发 prev/next 的累计位移阈值（px） */
const DRAG_THRESHOLD = 60;

/**
 * 预加载图片到浏览器缓存。用 `new Image()` 异步加载但不渲染到 DOM，
 * 浏览器会把图片存入 HTTP 缓存，下次 `<img src={url}>` 时立即命中。
 */
function preloadImage(url: string | null | undefined): void {
  if (!url) return;
  const img = new Image();
  img.src = url;
  if (typeof img.decode === 'function') {
    img.decode().catch(() => {});
  }
}

/** 预加载的最大 item 数量（前 N 个，避免一次发太多请求） */
const PRELOAD_AHEAD_COUNT = 5;

export default function HeroBanner({
  items,
  autoPlayInterval = 5000,
  onItemClick,
  onContinuePlay,
  historyMap,
}: HeroBannerProps) {

  const [current, setCurrent] = useState(0);
  const [slideDir, setSlideDir] = useState<'next' | 'prev'>('next');
  const [crossfade, setCrossfade] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const oldImgUrlRef = useRef('');
  const debounceRef = useRef(false);
  const crossfadeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isFirstLoadRef = useRef(true);
  const crossfadeRef = useRef(false);
  const pointerType = usePointerType();
  const isMobile = useIsMobile();
  const isTV = useIsTV();

  // items 引用：避免 useEffect 对 items 数组引用的依赖导致 store re-render 时反复跑
  const itemsRef = useRef<HeroItem[]>(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // 鼠标拖拽状态
  const sectionRef = useRef<HTMLElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragAccumDxRef = useRef<number>(0);
  const dragMovedRef = useRef<boolean>(false);

  // 预加载前 N 个 items 的 backdrop + poster
  useEffect(() => {
    const limit = Math.min(items.length, PRELOAD_AHEAD_COUNT);
    if (limit === 0) return;
    const idle =
      typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
        ? (cb: () => void) => window.requestIdleCallback(cb)
        : (cb: () => void) => setTimeout(cb, 0);
    const handle = idle(() => {
      for (let i = 0; i < limit; i++) {
        const it = items[i];
        const backdropPath = it.backdropPath || it.backdrop_path;
        const posterPath = it.posterPath || it.poster_path;
        if (backdropPath) preloadImage(buildImageUrl(backdropPath, 'w1920'));
        if (posterPath) preloadImage(buildImageUrl(posterPath, 'w342'));
      }
    });
    return () => {
      if (typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function' && typeof handle === 'number') {
        window.cancelIdleCallback(handle);
      }
    };
  }, [items]);

  // 当前项的海报图立即预加载
  useEffect(() => {
    const item = items[current];
    if (!item) return;
    const posterPath = item.posterPath || item.poster_path;
    if (posterPath) preloadImage(buildImageUrl(posterPath, 'w342'));
  }, [current, items]);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const effectiveInterval = prefersReducedMotion ? 0 : autoPlayInterval;

  const SLIDE_MS = 600;

  // ── 切换：防抖 + 双图层 crossfade ────────
  const switchSlide = useCallback((dir: 'next' | 'prev') => {
    if (debounceRef.current || crossfadeRef.current) return;
    debounceRef.current = true;

    const item = items[current];
    const path = item?.backdropPath || item?.backdrop_path || '';
    oldImgUrlRef.current = path ? buildImageUrl(path, 'w1920') || '' : '';

    setSlideDir(dir);
    setCurrent((p) => (p + (dir === 'next' ? 1 : -1) + items.length) % items.length);
    setCrossfade(true);
    crossfadeRef.current = true;
  }, [current, items]);

  // ── 延迟触发过渡：先渲染初始位置，再应用 transition ──
  useEffect(() => {
    if (!crossfade) {
      setIsTransitioning(false);
      return;
    }
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsTransitioning(true);
      });
    });
    return () => cancelAnimationFrame(t);
  }, [crossfade]);

  // ── SLIDE_MS 后清理旧图 + 解除防抖 ──
  useEffect(() => {
    if (!crossfade) return;
    crossfadeTimerRef.current = setTimeout(() => {
      crossfadeTimerRef.current = undefined;
      oldImgUrlRef.current = '';
      debounceRef.current = false;
      isFirstLoadRef.current = false;
      crossfadeRef.current = false;
      setCrossfade(false);
    }, SLIDE_MS);
    return () => {
      if (crossfadeTimerRef.current) { clearTimeout(crossfadeTimerRef.current); crossfadeTimerRef.current = undefined; }
    };
  }, [crossfade]);

  // ── 自动轮播 ──
  useEffect(() => {
    if (!effectiveInterval || items.length <= 1) return;
    const timer = setInterval(() => {
      switchSlide('next');
    }, effectiveInterval);
    return () => clearInterval(timer);
  }, [effectiveInterval, items.length, switchSlide]);

  const handlePrev = useCallback(() => {
    switchSlide('prev');
  }, [switchSlide]);

  const handleNext = useCallback(() => {
    switchSlide('next');
  }, [switchSlide]);

  // 切换轮播项
  const goTo = useCallback(
    (index: number) => {
      setCurrent(index);
    },
    [],
  );

  const handlePrevClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handlePrev();
    },
    [handlePrev],
  );

  const handleNextClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleNext();
    },
    [handleNext],
  );

  // ── 移动端触摸滑动 ──────────────────────────
  const touchStartX = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) handleNext();
        else handlePrev();
      }
    },
    [handleNext, handlePrev],
  );

  // ── 桌面端鼠标拖拽切换 ──────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (isMobile || isTV) return;
    if (e.pointerType === 'touch') return;

    const target = e.target as HTMLElement | null;
    if (target && target.closest('button')) {
      return;
    }

    isDraggingRef.current = true;
    dragMovedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragAccumDxRef.current = 0;
    const el = sectionRef.current;
    if (el) {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // 某些环境可能不支持，忽略
      }
    }
  }, [isMobile, isTV]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!isDraggingRef.current) return;
    dragAccumDxRef.current = e.clientX - dragStartXRef.current;
    if (Math.abs(dragAccumDxRef.current) > 4) dragMovedRef.current = true;
  }, []);

  const handlePointerUpOrCancel = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const el = sectionRef.current;
    if (el && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
    const dx = dragAccumDxRef.current;
    if (Math.abs(dx) > DRAG_THRESHOLD) {
      if (dx < 0) handleNext();
      else handlePrev();
    }
  }, [handleNext, handlePrev]);

  // 清理 ref
  useEffect(() => {
    return () => {
      if (crossfadeTimerRef.current) clearTimeout(crossfadeTimerRef.current);
    };
  }, []);

  if (!items.length) {
    return (
      <section
        className={`hero-banner hero-banner--empty${isTV ? ' hero-banner--tv' : ''}`}
        aria-label="热门推荐"
      >
        <div className="hero-banner__bg-wrapper">
          <div className="hero-banner__bg-placeholder" />
          <div className="hero-banner__mask" style={{ background: HERO_MASK_BG }} />
        </div>
        <div className="hero-banner__content">
          <div className="hero-banner__text">
            <h1 className="hero-banner__title hero-banner__title--placeholder">暂无推荐</h1>
            <p className="hero-banner__desc hero-banner__desc--placeholder">配置 TMDB Access Token 后即可展示热门内容</p>
          </div>
        </div>
      </section>
    );
  }

  const item = items[current];
  const itemData = item as HeroItem & { name?: string };
  const title = itemData.name || item.title || '';
  const releaseDate = itemData.releaseDate || itemData.release_date || itemData.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
  const rating = itemData.voteAverage ?? itemData.vote_average ?? 0;
  const overview = item.overview || '';

  const backdropPath = itemData.backdropPath || itemData.backdrop_path || '';
  const backdropUrl = buildImageUrl(backdropPath, 'w1920') || '';
  const backdropSrcSet = buildImageSrcSet(backdropPath, ['w780', 'w1280', 'w1920']);

  const posterPath = itemData.posterPath || itemData.poster_path || '';
  const posterUrl = buildImageUrl(posterPath, 'w342') || '';
  const posterSrcSet = buildImageSrcSet(posterPath, ['w185', 'w342', 'w500']);

  const mediaType = itemData.mediaType || itemData.media_type;
  const showArrows = pointerType !== 'coarse' || isTV;
  const mask = HERO_MASK_BG;

  return (
    <section
      ref={sectionRef}
      className={`hero-banner${isTV ? ' hero-banner--tv' : ''}`}
      aria-roledescription="carousel"
      aria-label="热门推荐"
      aria-live={prefersReducedMotion ? 'off' : 'polite'}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
    >
      {/* 背景层 — 双层滑动交叉淡入 */}
      <div className="hero-banner__bg-wrapper">
        {oldImgUrlRef.current && (
          <img
            className={`hero-banner__bg hero-banner__bg--old${isTransitioning ? (slideDir === 'next' ? ' hero-banner__bg--slide-out-left' : ' hero-banner__bg--slide-out-right') : ''}`}
            src={oldImgUrlRef.current}
            sizes="100vw"
            alt=""
            aria-hidden="true"
            width={1920}
            height={1080}
          />
        )}
        {backdropUrl && (
          <img
            className={`hero-banner__bg ${
              crossfade
                ? `hero-banner__bg--new${isTransitioning ? (slideDir === 'next' ? ' hero-banner__bg--slide-right' : ' hero-banner__bg--slide-left') : ''}`
                : isFirstLoadRef.current
                  ? 'hero-banner__bg--fade-in'
                  : ''
            }`}
            src={backdropUrl}
            srcSet={backdropSrcSet || undefined}
            sizes="100vw"
            alt=""
            aria-hidden="true"
            loading="eager"
            width={1920}
            height={1080}
          />
        )}
        <div className="hero-banner__mask" style={{ background: mask }} />
      </div>

      {/* 内容 */}
      <div className="hero-banner__content">
        <div className="hero-banner__text">
          <h1 className="hero-banner__title">{title}</h1>

          <div className="hero-banner__meta">
            {rating > 0 && (
              <span className="hero-banner__rating">★ {rating.toFixed(1)}</span>
            )}
            {year && <span className="hero-banner__year">{year}</span>}
            {mediaType && (
              <span className="hero-banner__type">
                {mediaType === 'tv' ? '剧集' : '电影'}
              </span>
            )}
          </div>

          {!isMobile && overview && (
            <p className="hero-banner__desc">{overview.slice(0, 150)}{overview.length > 150 ? '…' : ''}</p>
          )}

          {onItemClick && (
            <div className="hero-banner__actions">
              {historyMap?.has(String(item.id)) && onContinuePlay && (
                <button
                  className="hero-banner__cta hero-banner__cta--continue"
                  onClick={(e) => { e.stopPropagation(); onContinuePlay(item); }}
                >
                  <Play size={18} fill="currentColor" />
                  <span>继续播放</span>
                </button>
              )}
              <button
                className="hero-banner__cta"
                onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
              >
                <Play size={18} fill="currentColor" />
                <span>查看详情</span>
              </button>
            </div>
          )}
        </div>

        {/* 桌面端海报 */}
        {!isMobile && posterUrl && (
          <div className="hero-banner__poster">
            <img src={posterUrl} srcSet={posterSrcSet || undefined} sizes="160px" alt={title} loading="eager" width={300} height={450} />
          </div>
        )}
        {/* 移动端海报 */}
        {isMobile && posterUrl && (
          <img className="hero-banner__poster-mobile" src={posterUrl} srcSet={posterSrcSet || undefined} sizes="60px" alt={title} loading="eager" width={300} height={450} />
        )}
      </div>

      {/* 箭头按钮 */}
      {showArrows && items.length > 1 && (
        <>
          <button
            className="hero-banner__arrow hero-banner__arrow--left"
            onClick={handlePrevClick}
            aria-label="上一个"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            className="hero-banner__arrow hero-banner__arrow--right"
            onClick={handleNextClick}
            aria-label="下一个"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}

      {/* 指示点 */}
      {items.length > 1 && (
        <div className="hero-banner__dots">
          {items.map((_, i) => (
            <button
              key={i}
              className={`hero-banner__dot${i === current ? ' hero-banner__dot--active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`第 ${i + 1} 个`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
