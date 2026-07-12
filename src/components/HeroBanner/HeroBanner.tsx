/**
 * HeroBanner — 首页 Hero 横幅
 *
 * 布局：左侧主背景图（active item，crossfade）+ 右侧竖排缩略图列（海报+标题）。
 * - 不再左右滑动（已移除 Embla 横向轮播）
 * - 主图随 activeIndex 切换，淡入淡出
 * - 右侧缩略图自动轮播（5s），鼠标悬停切换主图并暂停轮播
 * - 移动端隐藏右侧缩略图列，仅保留主图 + 内容
 */
import { useState, useEffect, useCallback } from 'react';
import { Play } from 'lucide-react';
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
  backdrop_path?: string;
  poster_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  name?: string;
}

interface HeroBannerProps {
  items: HeroItem[];
  autoPlayInterval?: number;
  onItemClick?: (item: HeroItem) => void;
  onContinuePlay?: (item: HeroItem) => void;
  historyMap?: Map<string, { progress: number }>;
  /** hero 数据是否加载中（加载中且 items 为空时只显示骨架，不显示误导文字） */
  loading?: boolean;
}

const HERO_MASK_BG = 'var(--hero-mask-dark)';
/** 骨架占位数量（加载中/无数据时立即渲染，避免缩略图列出现太慢） */
const SKELETON_COUNT = 5;
/** banner 最多展示的 item 数量（控制背景层与缩略图数量，避免过多图片请求） */
/** 预加载图片 */
function preloadImage(url: string | null | undefined): void {
  if (!url) return;
  const img = new Image();
  img.src = url;
  if (typeof img.decode === 'function') {
    img.decode().catch(() => {});
  }
}

export default function HeroBanner({
  items,
  autoPlayInterval = 5000,
  onItemClick,
  onContinuePlay,
  historyMap,
  loading = false,
}: HeroBannerProps) {
  const isMobile = useIsMobile();
  const isTV = useIsTV();
  // 不截取接口数据：使用全部 items 驱动轮播；主图仅渲染当前+上一张（见 bgIndices）避免加载全部背景图
  const displayItems = items;

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // 悬停预览态：鼠标悬停缩略图时主图预览该项，但不改变 activeIndex（缩略图窗口不移动）
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // 主图实际显示项：悬停时预览 hoveredIndex，否则显示 activeIndex
  const displayIndex = hoveredIndex !== null ? hoveredIndex : activeIndex;
  // 主图背景层：仅渲染当前 + 上一张（最多 2 层），支持无限数据而不预加载全部背景图
  const [bgIndices, setBgIndices] = useState<number[]>([0]);
  // 主 banner 图是否已渲染完成（首张背景图 onLoad 后置 true）。
  // 用于控制右侧缩略图列：渲染完成前显示骨架占位，完成后才揭示真实缩略图。
  const [bannerReady, setBannerReady] = useState(false);
  // 固定 5 个缩略图（等分容器高度，完整显示）；不足时取实际数量并保证奇数（居中）
  const rawCount = Math.min(5, displayItems.length);
  const visibleCount = rawCount > 1 && rawCount % 2 === 0 ? rawCount - 1 : rawCount;

  // items 变化时重置 activeIndex、预览态与背景层
  // 同时启动一个超时兜底：无论背景图加载成功/失败，最多 3s 后强制揭示缩略图列，
  // 避免 TMDB 图（走代理）加载失败时 bannerReady 永远为 false 而整列卡在骨架。
  useEffect(() => {
    setActiveIndex(0);
    setHoveredIndex(null);
    setBgIndices([0]);
    setBannerReady(false);
    const t = window.setTimeout(() => setBannerReady(true), 3000);
    return () => window.clearTimeout(t);
  }, [displayItems]);

  // 当前主图无背景图时（无图可等），直接视为已就绪，避免缩略图列一直卡在骨架
  useEffect(() => {
    const item = displayItems[displayIndex];
    const hasBackdrop = !!(item?.backdropPath || item?.backdrop_path);
    if (!hasBackdrop) setBannerReady(true);
  }, [displayIndex, displayItems]);

  // displayIndex 变化时（含悬停预览），背景层保留上一张用于 crossfade
  useEffect(() => {
    setBgIndices((prev) => {
      const last = prev[prev.length - 1];
      if (last === displayIndex) return prev;
      return [last, displayIndex];
    });
  }, [displayIndex]);

  // 预加载下一张背景图，保证轮播切换时图片已就绪
  useEffect(() => {
    if (displayItems.length <= 1) return;
    const nextIdx = (activeIndex + 1) % displayItems.length;
    const nextBackdrop = displayItems[nextIdx]?.backdropPath || displayItems[nextIdx]?.backdrop_path;
    if (nextBackdrop) preloadImage(buildImageUrl(nextBackdrop, 'w1280'));
  }, [activeIndex, displayItems]);

  // 自动轮播（悬停暂停 / 仅 1 项不轮播）
  useEffect(() => {
    if (paused || displayItems.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % displayItems.length);
    }, autoPlayInterval);
    return () => window.clearInterval(timer);
  }, [paused, displayItems.length, autoPlayInterval]);

  // 悬停缩略图：预览主图（不改 activeIndex，缩略图窗口不移动）+ 暂停轮播 + 预加载背景图
  const handleThumbEnter = useCallback((idx: number) => {
    setHoveredIndex(idx);
    setPaused(true);
    const item = displayItems[idx];
    const p = item?.backdropPath || item?.backdrop_path;
    if (p) preloadImage(buildImageUrl(p, 'w1280'));
  }, [displayItems]);

  // 移出缩略图区：取消预览（主图回到 activeIndex）+ 恢复轮播
  const handleThumbLeave = useCallback(() => {
    setHoveredIndex(null);
    setPaused(false);
  }, []);

  // 空状态：加载中只显示骨架（无文字），加载完成且无数据才显示"暂无推荐"。
  // 注意：即使 items 为空，也立即渲染右侧缩略图骨架列，避免骨架"出现太慢"。
  if (!displayItems.length) {
    return (
      <section className={`hero-banner hero-banner--empty${isTV ? ' hero-banner--tv' : ''}`} aria-label="热门推荐">
        <div className="hero-banner__bg-wrapper">
          <div className="hero-banner__bg-placeholder" />
          <div className="hero-banner__mask" style={{ background: HERO_MASK_BG }} />
        </div>
        {!loading && (
          <div className="hero-banner__content">
            <div className="hero-banner__text">
              <h1 className="hero-banner__title hero-banner__title--placeholder">暂无推荐</h1>
            </div>
          </div>
        )}
        {!isMobile && (
          <div className="hero-banner__thumbs hero-banner__thumbs--skeleton" aria-hidden="true">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <div key={`sk-${i}`} className="hero-banner__thumb hero-banner__thumb--skeleton">
                <span className="hero-banner__thumb-skeleton" />
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  const activeItem = displayItems[displayIndex];
  const itemData = activeItem as HeroItem;
  const title = itemData.name || itemData.title || '';
  const releaseDate = itemData.releaseDate || itemData.release_date || itemData.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
  const rating = itemData.voteAverage ?? itemData.vote_average ?? 0;
  const overview = activeItem.overview || '';
  const mediaType = itemData.mediaType || itemData.media_type;

  // 缩略图窗口：选中项始终居中，循环显示相邻项（窗口大小 = visibleCount，按 banner 高度计算）
  const thumbSlots: number[] = [];
  if (displayItems.length > 0) {
    const total = displayItems.length;
    const half = Math.floor(Math.min(visibleCount, total) / 2);
    for (let offset = -half; offset <= half; offset++) {
      thumbSlots.push(((activeIndex + offset) % total + total) % total);
    }
  }

  return (
    <section
      className={`hero-banner${isTV ? ' hero-banner--tv' : ''}`}
      aria-roledescription="carousel"
      aria-label="热门推荐"
    >
      {/* ── 主图区 ── */}
      <div className="hero-banner__main">
        {/* 背景层：仅渲染当前 + 上一张（最多 2 层），crossfade；不预加载全部背景图 */}
        {bgIndices.map((idx) => {
          const item = displayItems[idx];
          if (!item) return null;
          const backdropPath = item.backdropPath || item.backdrop_path || '';
          const backdropUrl = buildImageUrl(backdropPath, 'w1280') || '';
          const backdropSrcSet = buildImageSrcSet(backdropPath, ['w780', 'w1280']);
          const isActive = idx === displayIndex;
          return (
            <img
              key={idx}
              className={`hero-banner__bg-layer${isActive ? ' is-active' : ''}`}
              src={backdropUrl}
              srcSet={backdropSrcSet || undefined}
              sizes="(max-width: 767px) 100vw, 80vw"
              alt=""
              aria-hidden="true"
              loading="eager"
              draggable={false}
              onLoad={() => { if (isActive) setBannerReady(true); }}
              onError={() => { if (isActive) setBannerReady(true); }}
              ref={(el) => {
                // 已缓存图片不会触发 onLoad，用 complete 兜底标记就绪
                if (el && el.complete && el.naturalWidth > 0 && isActive) setBannerReady(true);
              }}
            />
          );
        })}
        <div className="hero-banner__mask" style={{ background: HERO_MASK_BG }} />

        {/* 内容叠加（标题/评分/简介/CTA） */}
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
                {historyMap?.has(String(activeItem.id)) && onContinuePlay && (
                  <button className="hero-banner__cta hero-banner__cta--continue" onClick={(e) => { e.stopPropagation(); onContinuePlay(activeItem); }}>
                    <Play size={18} fill="currentColor" />
                    <span>继续播放</span>
                  </button>
                )}
                <button className="hero-banner__cta" onClick={(e) => { e.stopPropagation(); onItemClick(activeItem); }}>
                  <Play size={18} fill="currentColor" />
                  <span>查看详情</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 右侧缩略图列（桌面端，横图 + 悬浮标题；窗口化，选中居中） ──
          banner 未就绪时显示固定数量骨架占位（立即出现），
          banner 渲染完成后揭示真实缩略图（每个缩略图自身也有加载骨架） */}
      {!isMobile && (
        <div className={`hero-banner__thumbs${!bannerReady ? ' hero-banner__thumbs--skeleton' : ''}`} onMouseLeave={handleThumbLeave}>
          {!bannerReady ? (
            Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <div key={`sk-${i}`} className="hero-banner__thumb hero-banner__thumb--skeleton" aria-hidden="true">
                <span className="hero-banner__thumb-skeleton" />
              </div>
            ))
          ) : (
            thumbSlots.map((idx) => (
              <HeroThumb
                key={idx}
                item={displayItems[idx]}
                active={idx === displayIndex}
                onEnter={() => handleThumbEnter(idx)}
                onLeave={handleThumbLeave}
                onClick={() => { setActiveIndex(idx); setHoveredIndex(null); }}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

/**
 * HeroThumb — 单个右侧缩略图（自包含）
 * - 图片加载完成前显示骨架占位（shimmer），加载完成后淡入图片与标题
 * - 用 ref 检查 img.complete 兜底，避免已缓存图片不触发 onLoad 而永久卡在骨架
 */
function HeroThumb({
  item,
  active,
  onEnter,
  onLeave,
  onClick,
}: {
  item: HeroItem;
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const thumbPath = item.backdropPath || item.backdrop_path || '';
  const thumbUrl = thumbPath ? buildImageUrl(thumbPath, 'w500') : '';
  const title = item.name || item.title || '';
  return (
    <button
      type="button"
      className={`hero-banner__thumb${active ? ' is-active' : ''}${imgLoaded ? ' is-loaded' : ''}`}
      onMouseEnter={onEnter}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={title}
      aria-current={active ? 'true' : undefined}
    >
      {thumbUrl ? (
        <img
          className="hero-banner__thumb-img"
          src={thumbUrl}
          alt=""
          loading="eager"
          draggable={false}
          onLoad={() => setImgLoaded(true)}
          ref={(el) => { if (el && el.complete && el.naturalWidth > 0) setImgLoaded(true); }}
        />
      ) : null}
      {!imgLoaded && <span className="hero-banner__thumb-skeleton" aria-hidden="true" />}
      <span className="hero-banner__thumb-title">{title}</span>
    </button>
  );
}
