/**
 * HeroBanner — 首页 Hero 横幅
 *
 * 布局：左侧主背景图（active item）+ 右侧竖排缩略图列（海报+标题）。
 * - 主图随 activeIndex 切换，采用左右滑动动画（所有客户端一致）；自动轮播也走滑动切换
 * - 桌面端悬停缩略图时预览主图（crossfade），不改变 activeIndex，不触发滑动
 * - 右侧缩略图自动轮播（5s），鼠标悬停切换主图并暂停轮播
 * - 移动端隐藏右侧缩略图列，仅保留主图 + 内容
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Play } from 'lucide-react';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useScreenTier } from '@/hooks/useScreenTier';
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
const SKELETON_COUNT = 4;
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
  const { tier } = useScreenTier();
  const isWide = tier === 'large' || tier === 'xlarge';
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
  // 滑动方向（所有客户端）：'left' = 新图从右滑入（前进），'right' = 新图从左滑入（后退）
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  // 主 banner 图是否已渲染完成（首张背景图 onLoad 后置 true）。
  // 用于控制右侧缩略图列：渲染完成前显示骨架占位，完成后才揭示真实缩略图。
  const [bannerReady, setBannerReady] = useState(false);
  // 缩略图数量自适应：大屏 4 个，普通桌面 3 个
  const maxCount = isWide ? 4 : 3;
  const visibleCount = Math.min(maxCount, displayItems.length);

  // items 变化时重置 activeIndex、预览态与背景层
  // 仅在 items 从空变为有时重置 bannerReady（骨架→真实），
  // 已有数据时保持 bannerReady 不变，避免骨架图闪烁。
  const prevItemsLenRef = useRef(displayItems.length);
  useEffect(() => {
    setActiveIndex(0);
    setHoveredIndex(null);
    setBgIndices([0]);

    const prevLen = prevItemsLenRef.current;
    const curLen = displayItems.length;

    if (curLen > 0 && prevLen === 0) {
      // 从空变为有数据：重置 bannerReady，等待背景图加载
      setBannerReady(false);
      const t = window.setTimeout(() => setBannerReady(true), 3000);
      prevItemsLenRef.current = curLen;
      return () => window.clearTimeout(t);
    } else if (curLen > 0) {
      // 已有数据，items 变化（如轮播数据更新）：保持 bannerReady 不变
      prevItemsLenRef.current = curLen;
    } else {
      // 变为空：重置
      setBannerReady(false);
      prevItemsLenRef.current = curLen;
    }
  }, [displayItems]);

  // 当前主图无背景图时（无图可等），直接视为已就绪，避免缩略图列一直卡在骨架
  useEffect(() => {
    const item = displayItems[displayIndex];
    const hasBackdrop = !!(item?.backdropPath || item?.backdrop_path);
    if (!hasBackdrop) setBannerReady(true);
  }, [displayIndex, displayItems]);

  // displayIndex 变化时（含悬停预览），背景层保留上一张用于 crossfade / slide
  useEffect(() => {
    setBgIndices((prev) => {
      const last = prev[prev.length - 1];
      if (last === displayIndex) return prev;
      return [last, displayIndex];
    });
  }, [displayIndex]);

  // 滑动冷却期：滑动后 1000ms 内暂停自动轮播，避免动画冲突
  const swipeCooldownRef = useRef(0);

  // 预加载下一张背景图 + 即将出现的缩略图，保证轮播切换时图片已就绪
  useEffect(() => {
    if (displayItems.length <= 1) return;
    const total = displayItems.length;

    // 预加载下一张背景图
    const nextIdx = (activeIndex + 1) % total;
    const nextBackdrop = displayItems[nextIdx]?.backdropPath || displayItems[nextIdx]?.backdrop_path;
    if (nextBackdrop) preloadImage(buildImageUrl(nextBackdrop, 'w1280'));

    // 预加载即将出现在缩略图窗口中的图片（窗口大小 4，提前预加载前后各 2 张）
    const n = Math.min(4, total);
    const half = Math.floor(n / 2);
    for (let offset = -half; offset < n - half; offset++) {
      const idx = ((activeIndex + offset + 1) % total + total) % total;
      const thumbPath = displayItems[idx]?.backdropPath || displayItems[idx]?.backdrop_path;
      if (thumbPath) preloadImage(buildImageUrl(thumbPath, 'w500'));
    }
  }, [activeIndex, displayItems]);

  // 自动轮播（悬停暂停 / 仅 1 项不轮播 / 滑动冷却期内暂停）
  useEffect(() => {
    if (paused || displayItems.length <= 1) return;
    const timer = window.setInterval(() => {
      // 滑动后 1000ms 内不轮播，避免与滑动动画冲突
      if (Date.now() - swipeCooldownRef.current < 1000) return;
      // 自动轮播前进：新图从右滑入（slideDir='left'），所有客户端统一走滑动切换
      setSlideDir('left');
      setActiveIndex((i) => (i + 1) % displayItems.length);
    }, autoPlayInterval);
    return () => window.clearInterval(timer);
  }, [paused, displayItems.length, autoPlayInterval]);

  // 悬停缩略图：预览主图 + 暂停轮播 + 预加载背景图
  const handleThumbEnter = useCallback((idx: number) => {
    // 清除滑动方向类，让预览主图回退为 crossfade（桌面端悬停预览的淡入过渡）
    setSlideDir(null);
    setHoveredIndex(idx);
    setPaused(true);
    const item = displayItems[idx];
    const p = item?.backdropPath || item?.backdrop_path;
    if (p) preloadImage(buildImageUrl(p, 'w1280'));
  }, [displayItems]);

  // 移出整个 hero-banner：将 activeIndex 同步到当前预览项，再取消预览 + 恢复轮播
  const handleBannerLeave = useCallback(() => {
    setHoveredIndex((h) => {
      if (h !== null) setActiveIndex(h);
      return null;
    });
    setPaused(false);
  }, []);

  // 拖拽/滑动切换图片：桌面端鼠标拖拽 + 移动端触摸滑动
  const dragStartX = useRef(0);
  const handleDragStart = useCallback((x: number) => {
    dragStartX.current = x;
  }, []);
  const handleDragEnd = useCallback((x: number) => {
    const dx = x - dragStartX.current;
    if (Math.abs(dx) < 50) return;
    const total = displayItems.length;
    if (total <= 1) return;
    // 标记为用户手动滑动，触发动画
    setSlideDir(Math.sign(dx) > 0 ? 'right' : 'left');
    // 记录滑动时间，冷却期内（1000ms）暂停自动轮播
    swipeCooldownRef.current = Date.now();
    setActiveIndex((i) => (i - Math.sign(dx) + total) % total);
    setHoveredIndex(null);
  }, [displayItems.length]);

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
          <div className="hero-banner__thumbs" aria-hidden="true">
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
    const n = Math.min(visibleCount, total);
    const half = Math.floor(n / 2);
    for (let offset = -half; offset < n - half; offset++) {
      thumbSlots.push(((activeIndex + offset) % total + total) % total);
    }
  }

  return (
    <section
      className={`hero-banner${isTV ? ' hero-banner--tv' : ''}`}
      aria-roledescription="carousel"
      aria-label="热门推荐"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={handleBannerLeave}
      onMouseDown={(e) => handleDragStart(e.clientX)}
      onMouseUp={(e) => handleDragEnd(e.clientX)}
      onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
      onTouchEnd={(e) => handleDragEnd(e.changedTouches[0].clientX)}
    >
      {/* ── 主图区 ── */}
      {/* slideDir 切换后保持（不重置），避免动画结束后 is-active 层回退到 crossfade
          重新播放导致"闪一下/出现上一张"；悬停预览时由 handleThumbEnter 显式置 null 恢复 crossfade */}
      <div
        className={`hero-banner__main${slideDir ? ` slide-${slideDir}` : ''}`}
      >
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
        <div
          className="hero-banner__thumbs"
        >
          {!bannerReady ? (
            Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <div key={`sk-${i}`} className="hero-banner__thumb hero-banner__thumb--skeleton" aria-hidden="true">
                <span className="hero-banner__thumb-skeleton" />
              </div>
            ))
          ) : (
            <>
              {thumbSlots.map((idx) => (
                <HeroThumb
                  key={displayItems[idx]?.id ?? idx}
                  item={displayItems[idx]}
                  active={idx === displayIndex}
                  onEnter={() => handleThumbEnter(idx)}
                  onClick={() => onItemClick?.(displayItems[idx])}
                />
              ))}
            </>
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
  onClick,
}: {
  item: HeroItem;
  active: boolean;
  onEnter: () => void;
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
