/**
 * HeroBanner — 首页 Hero 横幅
 * 基于 TMDB trending 数据，自动轮播 + 主题感知渐变蒙版 + CTA 按钮
 * 使用 Swiper 实现高性能轮播
 */
import { useState, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Keyboard } from 'swiper/modules';
import type { SwiperRef } from 'swiper/react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { usePointerType } from '@/hooks/usePointerType';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { buildImageUrl, buildImageSrcSet } from '@/services/tmdbService';
import 'swiper/css';
import 'swiper/css/autoplay';
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

const HERO_MASK_BG = 'var(--hero-mask-dark)';

/** 预加载图片 */
function preloadImage(url: string | null | undefined): void {
  if (!url) return;
  const img = new Image();
  img.src = url;
  if (typeof img.decode === 'function') {
    img.decode().catch(() => {});
  }
}

const PRELOAD_AHEAD_COUNT = 5;

export default function HeroBanner({
  items,
  autoPlayInterval = 5000,
  onItemClick,
  onContinuePlay,
  historyMap,
}: HeroBannerProps) {
  const swiperRef = useRef<SwiperRef>(null);
  const pointerType = usePointerType();
  const isMobile = useIsMobile();
  const isTV = useIsTV();
  const sectionRef = useRef<HTMLElement>(null);

  // 预加载前 N 个 items 的 backdrop + poster
  useEffect(() => {
    const limit = Math.min(items.length, PRELOAD_AHEAD_COUNT);
    if (limit === 0) return;
    const idle = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
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

  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const effectiveInterval = prefersReducedMotion ? 0 : autoPlayInterval;

  const handlePrev = () => swiperRef.current?.swiper.slidePrev();
  const handleNext = () => swiperRef.current?.swiper.slideNext();

  const handlePrevClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handlePrev();
  };

  const handleNextClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleNext();
  };

  // 空状态
  if (!items.length) {
    return (
      <section className={`hero-banner hero-banner--empty${isTV ? ' hero-banner--tv' : ''}`} aria-label="热门推荐">
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

  const showArrows = pointerType !== 'coarse' || isTV;

  return (
    <section
      ref={sectionRef}
      className={`hero-banner${isTV ? ' hero-banner--tv' : ''}`}
      aria-roledescription="carousel"
      aria-label="热门推荐"
    >
      <Swiper
        ref={swiperRef}
        modules={[Autoplay, Keyboard]}
        slidesPerView={1}
        spaceBetween={0}
        loop={items.length > 1}
        speed={800}
        allowTouchMove={true}
        keyboard={{ enabled: true }}
        observer={true}
        observeParents={true}
        autoplay={effectiveInterval ? {
          delay: effectiveInterval,
          disableOnInteraction: false,
          reverseDirection: false,
        } : false}
        className="hero-banner__swiper"
      >
        {items.map((item, index) => {
          const itemData = item as HeroItem & { name?: string };
          const backdropPath = itemData.backdropPath || itemData.backdrop_path || '';
          const backdropUrl = buildImageUrl(backdropPath, 'w1920') || '';
          const backdropSrcSet = buildImageSrcSet(backdropPath, ['w780', 'w1280', 'w1920']);

          return (
            <SwiperSlide key={item.id || index}>
              <div className="hero-banner__slide">
                {backdropUrl && (
                  <img
                    className="hero-banner__bg"
                    src={backdropUrl}
                    srcSet={backdropSrcSet || undefined}
                    sizes="100vw"
                    alt=""
                    aria-hidden="true"
                    loading={index === 0 ? 'eager' : 'lazy'}
                    width={1920}
                    height={1080}
                  />
                )}
                <div className="hero-banner__mask" style={{ background: HERO_MASK_BG }} />
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>

      {/* 内容 — 始终显示当前活跃 slide 的内容 */}
      <HeroContent
        items={items}
        swiperRef={swiperRef}
        onItemClick={onItemClick}
        onContinuePlay={onContinuePlay}
        historyMap={historyMap}
        isMobile={isMobile}
      />

      {/* 箭头按钮 */}
      {showArrows && items.length > 1 && (
        <>
          <button className="hero-banner__arrow hero-banner__arrow--left" onClick={handlePrevClick} aria-label="上一个">
            <ChevronLeft size={28} />
          </button>
          <button className="hero-banner__arrow hero-banner__arrow--right" onClick={handleNextClick} aria-label="下一个">
            <ChevronRight size={28} />
          </button>
        </>
      )}

      {/* 指示点 */}
      {items.length > 1 && (
        <PaginationDots items={items} swiperRef={swiperRef} />
      )}
    </section>
  );
}

/** 内容层：监听 swiper activeIndex 变化，显示对应 slide 的标题/按钮 */
function HeroContent({
  items,
  swiperRef,
  onItemClick,
  onContinuePlay,
  historyMap,
  isMobile,
}: {
  items: HeroItem[];
  swiperRef: React.RefObject<SwiperRef>;
  onItemClick?: (item: HeroItem) => void;
  onContinuePlay?: (item: HeroItem) => void;
  historyMap?: Map<string, { progress: number }>;
  isMobile: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const swiper = swiperRef.current?.swiper;
    if (!swiper) return;
    const onSlideChange = () => setActiveIndex(swiper.realIndex);
    swiper.on('slideChange', onSlideChange);
    return () => { swiper.off('slideChange', onSlideChange); };
  }, [swiperRef]);

  const item = items[activeIndex] || items[0];
  if (!item) return null;

  const itemData = item as HeroItem & { name?: string };
  const title = itemData.name || item.title || '';
  const releaseDate = itemData.releaseDate || itemData.release_date || itemData.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
  const rating = itemData.voteAverage ?? itemData.vote_average ?? 0;
  const overview = item.overview || '';
  const mediaType = itemData.mediaType || itemData.media_type;

  return (
    <div className="hero-banner__content">
      <div className="hero-banner__text">
        <h1 className="hero-banner__title">{title}</h1>

        <div className="hero-banner__meta">
          {rating > 0 && <span className="hero-banner__rating">★ {rating.toFixed(1)}</span>}
          {year && <span className="hero-banner__year">{year}</span>}
          {mediaType && <span className="hero-banner__type">{mediaType === 'tv' ? '剧集' : '电影'}</span>}
        </div>

        {!isMobile && overview && (
          <p className="hero-banner__desc">{overview.slice(0, 150)}{overview.length > 150 ? '…' : ''}</p>
        )}

        {onItemClick && (
          <div className="hero-banner__actions">
            {historyMap?.has(String(item.id)) && onContinuePlay && (
              <button className="hero-banner__cta hero-banner__cta--continue" onClick={(e) => { e.stopPropagation(); onContinuePlay(item); }}>
                <Play size={18} fill="currentColor" />
                <span>继续播放</span>
              </button>
            )}
            <button className="hero-banner__cta" onClick={(e) => { e.stopPropagation(); onItemClick(item); }}>
              <Play size={18} fill="currentColor" />
              <span>查看详情</span>
            </button>
          </div>
        )}
      </div>

      {!isMobile && (
        <HeroPoster item={item} />
      )}
      {isMobile && (
        <HeroPosterMobile item={item} />
      )}
    </div>
  );
}

/** 海报（桌面端） */
function HeroPoster({ item }: { item: HeroItem }) {
  const itemData = item as HeroItem & { name?: string };
  const posterPath = itemData.posterPath || itemData.poster_path || '';
  const posterUrl = buildImageUrl(posterPath, 'w342') || '';
  const posterSrcSet = buildImageSrcSet(posterPath, ['w185', 'w342', 'w500']);
  const title = itemData.name || item.title || '';

  if (!posterUrl) return null;

  return (
    <div className="hero-banner__poster">
      <img src={posterUrl} srcSet={posterSrcSet || undefined} sizes="(min-width: 2560px) 280px, (min-width: 1920px) 240px, (min-width: 1280px) 200px, (min-width: 1024px) 180px, 168px" alt={title} loading="eager" width={300} height={450} />
    </div>
  );
}

/** 海报（移动端） */
function HeroPosterMobile({ item }: { item: HeroItem }) {
  const itemData = item as HeroItem & { name?: string };
  const posterPath = itemData.posterPath || itemData.poster_path || '';
  const posterUrl = buildImageUrl(posterPath, 'w342') || '';
  const posterSrcSet = buildImageSrcSet(posterPath, ['w185', 'w342', 'w500']);
  const title = itemData.name || item.title || '';

  if (!posterUrl) return null;

  return (
    <img className="hero-banner__poster-mobile" src={posterUrl} srcSet={posterSrcSet || undefined} sizes="60px" alt={title} loading="eager" width={300} height={450} />
  );
}

/** 分页指示点：监听 swiper activeIndex */
function PaginationDots({
  items,
  swiperRef,
}: {
  items: HeroItem[];
  swiperRef: React.RefObject<SwiperRef>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const swiper = swiperRef.current?.swiper;
    if (!swiper) return;
    const onSlideChange = () => setActiveIndex(swiper.realIndex);
    swiper.on('slideChange', onSlideChange);
    return () => { swiper.off('slideChange', onSlideChange); };
  }, [swiperRef]);

  const handleClick = (index: number) => {
    swiperRef.current?.swiper.slideToLoop(index);
  };

  return (
    <div className="hero-banner__dots">
      {items.map((_, i) => (
        <button
          key={i}
          className={`hero-banner__dot${i === activeIndex ? ' hero-banner__dot--active' : ''}`}
          onClick={() => handleClick(i)}
          aria-label={`第 ${i + 1} 个`}
        />
      ))}
    </div>
  );
}
