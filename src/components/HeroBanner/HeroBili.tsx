/**
 * HeroBili — 首页 Hero B 站风（>1280px 桌面专用，TV 不启用）
 *
 * 布局：左侧大 banner 轮播（1fr）+ 右侧 3×2 竖版卡（--hero-side-w）+ 脱标「换一换」浮层。
 * - banner 池固定前 6 张（BANNER_POOL），轮播（5s 自动 / 左右箭头 / 圆点）只在这 6 张内
 *   推进 activeIndex，【绝不重建右侧卡片】
 * - 右侧卡片展示 banner 池之外的条目（第 7 张起）；「换一换」只推进 shuffleOffset、
 *   按卡片数整组推进——activeIndex 与 shuffleOffset 两个状态完全解耦
 * - banner 保留 继续播放（historyMap 命中时渲染）/ 查看详情 双按钮（沿用 hero-banner__cta token）
 * - 卡片点击跳详情；收藏按钮命中时 toggle 收藏 + 不冒泡（不触发跳转）
 * - 卡片标题不换行，溢出时悬浮跑马灯（双段等长无缝循环）
 * - 「换一换」防抖 = 动画锁：is-spinning（0.6s 转圈）未结束前点击直接 return
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RefreshCw, Heart, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { buildImageUrl } from '@/services/tmdbService';
import { useUserStore } from '@/stores/useUserStore';
import { Icon } from '@/components/ui/Icon';
import './HeroBili.css';

/** HeroBili 接受的条目形状（TMDB trending，与 HeroBanner 的 HeroItem 结构兼容；title 必填与其对齐） */
interface HeroBiliItem {
  id: number | string;
  title: string;
  name?: string;
  backdropPath?: string | null;
  posterPath?: string | null;
  backdrop_path?: string;
  poster_path?: string;
  voteAverage?: number;
  vote_average?: number;
  releaseDate?: string;
  release_date?: string;
  first_air_date?: string;
  mediaType?: 'movie' | 'tv';
  media_type?: string;
}

interface HeroBiliProps {
  items: HeroBiliItem[];
  onItemClick?: (item: HeroBiliItem) => void;
  onContinuePlay?: (item: HeroBiliItem) => void;
  historyMap?: Map<string, { progress: number }>;
  /** Keep-Alive 激活信号：首页不可见时暂停自动轮播（与 HeroBanner 同语义） */
  active?: boolean;
}

/** 右侧卡片数：3 列 × 2 行 */
const SIDE_COLS = 3;
const SIDE_ROWS = 2;
/** banner 轮播只取前 6 张，其余条目全部进右侧卡片 */
const BANNER_POOL = 6;
/** 换一换动画锁时长（= 转圈动画时长，防抖窗口） */
const SHUFFLE_LOCK_MS = 600;

/** 条目标题 */
function itemTitle(item: HeroBiliItem): string {
  return item.name || item.title || '';
}

/** 条目评分（0 视为无评分） */
function itemRating(item: HeroBiliItem): number {
  return item.voteAverage ?? item.vote_average ?? 0;
}

/** 条目年份 */
function itemYear(item: HeroBiliItem): number | undefined {
  const rd = item.releaseDate || item.release_date || item.first_air_date;
  return rd ? new Date(rd).getFullYear() : undefined;
}

/** 条目类型文案 */
function itemTypeLabel(item: HeroBiliItem): string {
  const mt = item.mediaType || item.media_type;
  return mt === 'tv' ? '剧集' : '电影';
}

/** 竖版海报 URL（w342 足够单卡 ~330px 宽） */
function itemPosterUrl(item: HeroBiliItem): string {
  const p = item.posterPath || item.poster_path || '';
  return p ? buildImageUrl(p, 'w342') || '' : '';
}

/** 横版背景 URL */
function itemBackdropUrl(item: HeroBiliItem): string {
  const p = item.backdropPath || item.backdrop_path || '';
  return p ? buildImageUrl(p, 'w1280') || '' : '';
}

/** 卡片横版封面：backdrop 优先（横图），缺失时回落竖版海报 */
function itemCardCoverUrl(item: HeroBiliItem): string {
  const bd = item.backdropPath || item.backdrop_path || '';
  if (bd) return buildImageUrl(bd, 'w780') || '';
  return itemPosterUrl(item);
}

export default function HeroBili({
  items,
  onItemClick,
  onContinuePlay,
  historyMap,
  active = true,
}: HeroBiliProps) {
  const total = items.length;
  // banner 池固定前 6 张；轮播只在这 6 张内推进，与右侧卡片完全解耦
  const bannerItems = useMemo(() => items.slice(0, BANNER_POOL), [items]);
  const bannerTotal = bannerItems.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [shuffleOffset, setShuffleOffset] = useState(0);
  // 换一换动画锁：true 期间既驱动转圈动画、又拦截重复点击（防抖）
  const [spinning, setSpinning] = useState(false);
  // banner 交叉淡入层：[旧, 新] 最多 2 层，旧层垫底、新层淡入
  const [layers, setLayers] = useState<number[]>([0]);
  const shuffleTimerRef = useRef<number | null>(null);

  const safeActiveIndex = bannerTotal > 0 ? Math.min(activeIndex, bannerTotal - 1) : 0;

  // items 变化（切分类）：重置轮播与换一换状态
  useEffect(() => {
    setActiveIndex(0);
    setShuffleOffset(0);
    setLayers([0]);
  }, [items]);

  // 卸载兜底清理
  useEffect(() => () => {
    if (shuffleTimerRef.current) window.clearTimeout(shuffleTimerRef.current);
  }, []);

  // 层推进：activeIndex 变化时保留上一张垫底、新层淡入（crossfade）
  useEffect(() => {
    setLayers((prev) => {
      const last = prev[prev.length - 1];
      if (last === safeActiveIndex) return prev;
      return [last, safeActiveIndex];
    });
  }, [safeActiveIndex]);

  // 预加载当前与下一张 banner 背景
  useEffect(() => {
    if (bannerTotal <= 1) return;
    for (const off of [0, 1]) {
      const it = bannerItems[(safeActiveIndex + off) % bannerTotal];
      const url = it ? itemBackdropUrl(it) : '';
      if (!url) continue;
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }, [safeActiveIndex, bannerItems, bannerTotal]);

  const go = useCallback((dir: 1 | -1) => {
    if (bannerTotal <= 1) return;
    setActiveIndex((i) => ((i + dir) % bannerTotal + bannerTotal) % bannerTotal);
  }, [bannerTotal]);

  // 自动轮播（5s）：悬停暂停 / 页面隐藏暂停 / 仅 1 项不轮播
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || !active || bannerTotal <= 1) return;
    const timer = window.setInterval(() => go(1), 5000);
    return () => window.clearInterval(timer);
  }, [paused, active, bannerTotal, go]);

  // 换一换：只推进 shuffleOffset（轮播不重建右卡，两个状态解耦）
  const handleShuffle = useCallback(() => {
    if (spinning) return; // 动画锁 = 防抖：0.6s 内最多触发一次
    setSpinning(true);
    setShuffleOffset((o) => o + 1);
    if (shuffleTimerRef.current) window.clearTimeout(shuffleTimerRef.current);
    shuffleTimerRef.current = window.setTimeout(() => setSpinning(false), SHUFFLE_LOCK_MS);
  }, [spinning]);

  // 右侧卡片：banner 池（前 6 张）之外的条目，取数循环也排除 banner 池——
  // 不依赖 activeIndex，轮播（自动/手动）绝不重建右卡；换一换每次推进 1 张、在池内循环
  const cardPoolSize = Math.max(0, total - BANNER_POOL);
  const rightCards = useMemo(() => {
    if (cardPoolSize === 0) return [];
    const out: { item: HeroBiliItem; idx: number }[] = [];
    const count = Math.min(SIDE_COLS * SIDE_ROWS, cardPoolSize);
    for (let i = 0; i < count; i++) {
      const idx = BANNER_POOL + ((shuffleOffset + i) % cardPoolSize);
      out.push({ item: items[idx], idx });
    }
    return out;
  }, [items, cardPoolSize, shuffleOffset]);

  const activeItem = items[safeActiveIndex];
  if (!activeItem) return null;

  const hasHistory = historyMap?.has(String(activeItem.id)) ?? false;

  return (
    <section className="hero-bili" data-role="hero" aria-label="热门推荐">
      {/* ── 左：banner 轮播 ── */}
      <div className="hero-bili__left">
        <div
          className="hero-bili__banner"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {layers.map((idx, pos) => {
            const it = items[idx];
            if (!it) return null;
            const isActive = pos === layers.length - 1;
            return (
              <img
                key={`${it.id}-${idx}`}
                className={`hero-bili__banner-img${isActive ? ' is-active' : ''}`}
                src={itemBackdropUrl(it)}
                alt={itemTitle(it)}
                loading="eager"
                decoding="async"
                draggable={false}
              />
            );
          })}

          {bannerTotal > 1 && (
            <>
              <button
                type="button"
                className="hero-bili__arrow hero-bili__arrow--prev"
                aria-label="上一张"
                onClick={() => go(-1)}
              >
                <Icon icon={ChevronLeft} size="lg" />
              </button>
              <button
                type="button"
                className="hero-bili__arrow hero-bili__arrow--next"
                aria-label="下一张"
                onClick={() => go(1)}
              >
                <Icon icon={ChevronRight} size="lg" />
              </button>
            </>
          )}

          {/* 底部渐变字幕：标题 + 双按钮（按钮单独放开 pointer-events） */}
          <div className="hero-bili__caption">
            <h2 className="hero-bili__title">{itemTitle(activeItem)}</h2>
            <div className="hero-bili__meta">
              {itemRating(activeItem) > 0 && (
                <span className="hero-bili__rating">★ {itemRating(activeItem).toFixed(1)}</span>
              )}
              {itemYear(activeItem) !== undefined && (
                <span className="hero-bili__year">{itemYear(activeItem)}</span>
              )}
              <span className="hero-bili__type">{itemTypeLabel(activeItem)}</span>
            </div>
            {(onItemClick || onContinuePlay) && (
              <div className="hero-banner__actions">
                {hasHistory && onContinuePlay && (
                  <button
                    type="button"
                    className="hero-banner__cta hero-banner__cta--continue"
                    onClick={(e) => { e.stopPropagation(); onContinuePlay(activeItem); }}
                  >
                    <Icon icon={Play} size="sm" fill="currentColor" />
                    <span>继续播放</span>
                  </button>
                )}
                {onItemClick && (
                  <button
                    type="button"
                    className="hero-banner__cta"
                    onClick={(e) => { e.stopPropagation(); onItemClick(activeItem); }}
                  >
                    <Icon icon={Play} size="sm" fill="currentColor" />
                    <span>查看详情</span>
                  </button>
                )}
              </div>
            )}
            {/* 圆点：banner 底部居中、双按钮下方 */}
            {bannerTotal > 1 && (
              <div className="hero-bili__dots" role="tablist" aria-label="轮播圆点">
                {bannerItems.map((it, i) => (
                  <button
                    key={`dot-${it.id}-${i}`}
                    type="button"
                    className={`hero-bili__dot${i === safeActiveIndex ? ' is-active' : ''}`}
                    aria-label={`第 ${i + 1} 张`}
                    onClick={() => setActiveIndex(i)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 右：3×2 竖版卡 + 脱标换一换浮层 ── */}
      <div className="hero-bili__right">
        <div className="hero-bili__cards">
          {rightCards.map(({ item }) => (
            <HeroSideCard
              key={String(item.id)}
              item={item}
              onItemClick={onItemClick}
            />
          ))}
        </div>
        <button
          type="button"
          className={`hero-bili__shuffle${spinning ? ' is-spinning' : ''}`}
          onClick={handleShuffle}
          aria-label="换一换"
        >
          <Icon icon={RefreshCw} size="sm" className="hero-bili__shuffle-icon" />
          <span className="hero-bili__shuffle-text">换一换</span>
        </button>
      </div>
    </section>
  );
}

/**
 * HeroSideCard — 单张竖版卡（封面在上标题在下，四角信息）
 * - 左上评分 / 右上收藏（悬浮显现）/ 左下年份 / 右下类型
 * - 点击整卡跳详情；收藏命中时 toggle + stopPropagation + 不进入跳转
 * - 标题 nowrap，溢出时悬浮跑马灯（is-marquee，双段等长无缝 4.5s）
 */
function HeroSideCard({
  item,
  onItemClick,
}: {
  item: HeroBiliItem;
  onItemClick?: (item: HeroBiliItem) => void;
}) {
  const videoId = String(item.id);
  const title = itemTitle(item);
  const posterUrl = itemPosterUrl(item);
  const coverUrl = itemCardCoverUrl(item);
  // 收藏态：订阅 collections（命中即重渲染）
  const collected = useUserStore((s) => s.collections.some((c) => c.videoId === videoId));
  const addCollection = useUserStore((s) => s.addCollection);
  const removeCollection = useUserStore((s) => s.removeCollection);
  const [marquee, setMarquee] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  // 跑马灯只在「悬浮 + 溢出」时启用，移出即停（不自动滚动）
  const handleTitleEnter = useCallback(() => {
    const el = titleRef.current;
    if (el && el.scrollWidth > el.clientWidth) setMarquee(true);
  }, []);
  const handleTitleLeave = useCallback(() => setMarquee(false), []);

  const handleFav = useCallback((e: React.MouseEvent) => {
    // 收藏不冒泡：命中收藏按钮 → toggle + 阻止冒泡，绝不进入跳转分支
    e.stopPropagation();
    if (collected) {
      removeCollection(videoId);
    } else {
      addCollection(videoId, {
        title,
        cover: posterUrl || undefined,
        type: (item.mediaType || item.media_type) === 'tv' ? 'tv' : 'movie',
        year: itemYear(item),
        rating: itemRating(item) > 0 ? itemRating(item) : undefined,
      });
    }
  }, [collected, removeCollection, addCollection, videoId, title, posterUrl, item]);

  return (
    <div
      className="hero-side-card"
      role="button"
      tabIndex={0}
      onClick={() => onItemClick?.(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onItemClick?.(item);
      }}
      aria-label={title}
    >
      <div className="hero-side-card__cover">
        {coverUrl ? (
          <img
            className="hero-side-card__img"
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ) : (
          <span className="hero-side-card__img hero-side-card__img--empty thumbnail-skeleton-bg" />
        )}
        {itemRating(item) > 0 && (
          <span className="hero-side-card__corner hero-side-card__corner--rating">
            ★ {itemRating(item).toFixed(1)}
          </span>
        )}
        <button
          type="button"
          className={`hero-side-card__fav${collected ? ' is-on' : ''}`}
          aria-label={collected ? '取消收藏' : '收藏'}
          onClick={handleFav}
        >
          <Icon icon={Heart} size="sm" fill="currentColor" />
        </button>
        {itemYear(item) !== undefined && (
          <span className="hero-side-card__corner hero-side-card__corner--year">
            {itemYear(item)}
          </span>
        )}
        <span className="hero-side-card__corner hero-side-card__corner--type">
          {itemTypeLabel(item)}
        </span>
      </div>
      <div
        ref={titleRef}
        className={`hero-side-card__title${marquee ? ' is-marquee' : ''}`}
        onMouseEnter={handleTitleEnter}
        onMouseLeave={handleTitleLeave}
      >
        <span className="hero-side-card__title-track">
          <span className="hero-side-card__title-seg">{title}</span>
          {/* 第二段只在与跑马灯时渲染——短标题不会出现「两个标题」 */}
          {marquee && (
            <span className="hero-side-card__title-seg" aria-hidden="true">{title}</span>
          )}
        </span>
      </div>
    </div>
  );
}
