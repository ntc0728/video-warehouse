/**
 * HeroBili — 首页 Hero B 站风（≥1024px 桌面专用，TV 不启用）
 * 断点演进：原 >1280 → 2026-09-07 曾 1280→1440、同日回退 → 2026-09-10 降为 ≥1024。
 *
 * 布局：左侧大 banner 轮播 + 右侧竖版卡（--hero-side-w）+ 脱标「换一换」浮层。
 * 右卡为**满格矩形**、无跨列无空缺，列数随视口分档（JS = useHeroSideCols，CSS 同步）：
 * - ≥1281           3 列 × 2 行 = 6 张（.hero-bili__cards 基础形态）
 * - 1153–1280       2 列 × 2 行 = 4 张
 * - 1024–1152       1 列 × 2 行 = 2 张（右栏窄，单列给足封面宽度）
 * - ≤1023           2 列 × 2 行 = 4 张（网格 1:1）
 * - banner 池固定前 6 张（BANNER_POOL），轮播（5s 自动 / 左右箭头 / 圆点）只在这 6 张内
 *   推进 activeIndex，【绝不重建右侧卡片】
 * - 右侧卡片展示 banner 池之外的条目（第 7 张起）；「换一换」只推进 shuffleOffset、
 *   按卡片数整组推进——activeIndex 与 shuffleOffset 两个状态完全解耦
 * - banner 保留 继续播放（historyMap 命中时渲染）/ 查看详情 双按钮（沿用 hero-banner__cta token）
 * - 卡片点击跳详情；收藏按钮命中时 toggle 收藏 + 不冒泡（不触发跳转）
 * - 卡标题默认单行 ellipsis 兜底（高度恒定，保 banner 齐平）；hover/focus 且
 *   溢出时切跑马灯（方案 A，2026-09-30 用户确认 demos/hero-title-marquee-demo.html）
 * - 「换一换」防抖 = 动画锁：is-spinning（0.6s 转圈）未结束前点击直接 return
 * - 「换一换」自动轮播（P3-A，8s，2026-09-30 用户确认）：定时触发同款推进；
 *   暂停条件 = hover 右栏 / 焦点在右栏内 / document.hidden / Keep-Alive 非激活；
 *   手动或自动切换后经 shuffleOffset 依赖重置 8s 计时器；仅桌面生效
 *   （TV / ≤1023 由挂载条件 useIsWideDesktop 排除，Capacitor app 由
 *   isNativePlatform 排除——宽屏平板虽渲染 HeroBili 但不自动轮播）
 * - Banner 信息层：标题 + 评分/年份/类型 chips（P3-B，纯 token 化胶囊，仅有的
 *   数据字段渲染，缺字段不渲染 chip）+ 加深底部渐变；caption 恒 absolute，
 *   不参与布局流，banner 齐平不变量不受影响
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RefreshCw, Heart, ChevronLeft, ChevronRight, Play, MonitorPlay } from 'lucide-react';
import { buildImageUrl } from '@/services/tmdbService';
import { useUserStore } from '@/stores/useUserStore';
import { useHeroSideCols } from '@/hooks';
import { isNativePlatform } from '@/lib/platform';
import { Icon } from '@/components/ui/Icon';
import LazyImage from '@/components/LazyImage/LazyImage';
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

/** 右侧卡片网格：行数恒为 2，列数随视口分档（2026-09-10 用户拍板）。
 *
 *  演进：原 6（3 列 × 2 行）→ 用户要求「减 1」改 5（末卡跨 2 列补位）→ 用户否决跨列
 *  → 回到 6 满格 → **本轮（第五轮）用户要求按视口分档降列**：
 *    1024–1152 → 1 列（2 张） / 1153–1280 → 2 列（4 张） / ≥1281 → 3 列（6 张）。
 *  列数唯一 JS 真源 = `useHeroSideCols()`（`@/hooks`），CSS 侧 grid-template
 *  必须按同一批断点同步（见 HeroBili.css）。
 *  卡数 = 列数 × 行数，恒为完整矩形：**不跨列、不留空槽**。 */
const SIDE_ROWS = 2;
/** banner 轮播池：前 6 张 */
const BANNER_POOL = 6;
/** 换一换动画锁时长（= 转圈动画时长，防抖窗口） */
const SHUFFLE_LOCK_MS = 600;
/** 换一换自动轮播间隔（P3-A：8s，2026-09-30 用户确认） */
const SHUFFLE_AUTO_MS = 8000;

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
  // 2026-09-06 约定（与分类面板横版卡一致）：无横版 backdrop 不再回退竖版海报，
  // 返回空串 → HeroSideCard 渲染 --empty 骨架占位
  const bd = item.backdropPath || item.backdrop_path || '';
  return bd ? buildImageUrl(bd, 'w780') || '' : '';
}

export default function HeroBili({
  items,
  onItemClick,
  onContinuePlay,
  historyMap,
  active = true,
}: HeroBiliProps) {
  const location = useLocation();
  const total = items.length;
  // 右栏列数（视口分档）：卡数 = 列数 × 2 行，恒为完整矩形
  const sideCols = useHeroSideCols();
  const sideCards = sideCols * SIDE_ROWS;
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
  // 主图加载失败的 backdrop URL 集合 → 渲染公共 LazyImage 品牌兜底（MonitorPlay + kinoTV）
  const [failedBackdrops, setFailedBackdrops] = useState<Set<string>>(() => new Set());
  const markBackdropFailed = useCallback((url: string) => {
    if (!url) return;
    setFailedBackdrops((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
  }, []);

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

  // 池计算：banner 池（前 6 张）之外的条目；换一换一次整批 = 右卡槽位数（随列数变化），
  // 轮数 = ceil(池大小 / 批大小)，新图耗尽后回到最初一轮
  const cardPoolSize = Math.max(0, total - BANNER_POOL);
  const shuffleBatch = sideCards;
  const shuffleCycles = cardPoolSize > 0 ? Math.ceil(cardPoolSize / shuffleBatch) : 1;

  // 换一换推进核心（手动与自动共用）：转圈动画 + 整批推进 + 0.6s 动画锁重置。
  // 切换为同步索引推进（无网络请求），无异步竞态面，天然无 loading 永驻隐患
  const advanceShuffle = useCallback(() => {
    setSpinning(true);
    // 一次整批推进（= 当前列数 × 2 张）；新图耗尽后回到最初一轮（补位逻辑见 rightCards）
    setShuffleOffset((o) => (o + 1) % shuffleCycles);
    if (shuffleTimerRef.current) window.clearTimeout(shuffleTimerRef.current);
    shuffleTimerRef.current = window.setTimeout(() => setSpinning(false), SHUFFLE_LOCK_MS);
  }, [shuffleCycles]);

  // 换一换：只推进 shuffleOffset（轮播不重建右卡，两个状态解耦）
  const handleShuffle = useCallback(() => {
    if (spinning) return; // 动画锁 = 防抖：0.6s 内最多触发一次
    advanceShuffle();
  }, [spinning, advanceShuffle]);

  // ── 换一换自动轮播（P3-A）：8s 间隔定时触发同款推进 ─────────────────────
  // 启用条件：桌面 ≥1024 非 TV 非 app——TV / ≤1023 由挂载条件 useIsWideDesktop
  // 排除（HeroBili 根本不渲染），Capacitor app（宽屏平板会渲染本组件）由
  // isNativePlatform 显式排除（遥控/触屏场景静止，2026-09-30 用户口径）。
  // 暂停：hover 右栏 / 焦点在右栏内（React onFocus/onBlur = focusin/focusout 冒泡）/
  // document.hidden / Keep-Alive 非激活；池为空不轮播。
  // 手动或自动切换都使 shuffleOffset 变化 → 依赖重建 interval = 计时器重置 8s。
  const [rightHovered, setRightHovered] = useState(false);
  const [rightFocused, setRightFocused] = useState(false);
  const [docHidden, setDocHidden] = useState(() => document.hidden);
  useEffect(() => {
    const onVis = () => setDocHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  useEffect(() => {
    const disabled = rightHovered || rightFocused || docHidden || !active || cardPoolSize === 0;
    if (disabled || isNativePlatform()) return;
    const timer = window.setInterval(advanceShuffle, SHUFFLE_AUTO_MS);
    return () => window.clearInterval(timer);
  }, [rightHovered, rightFocused, docHidden, active, cardPoolSize, advanceShuffle, shuffleOffset]);

  // 右侧卡片：banner 池（前 6 张）之外的条目，取数循环也排除 banner 池——
  // 不依赖 activeIndex，轮播（自动/手动）绝不重建右卡。
  // 换一换一次整批替换「当前列数 × 2」张新图（cursor×批大小 起始）；池内新图不够一批时，
  // 用池首（最初的图片）补位，新图耗尽后整体回到最初一轮。
  const rightCards = useMemo(() => {
    if (cardPoolSize === 0) return [];
    const count = Math.min(shuffleBatch, cardPoolSize);
    const base = shuffleOffset * shuffleBatch;
    const out: { item: HeroBiliItem; idx: number }[] = [];
    for (let i = 0; i < count; i++) {
      const p = base + i;
      // 新图不够一批：超出池尾的部分用池首（最初的图片）补位
      const pIdx = p < cardPoolSize ? p : p - cardPoolSize;
      const idx = BANNER_POOL + pIdx;
      out.push({ item: items[idx], idx });
    }
    return out;
  }, [items, cardPoolSize, shuffleOffset, shuffleBatch]);

  const activeItem = items[safeActiveIndex];
  if (!activeItem) return null;

  const hasHistory = historyMap?.has(String(activeItem.id)) ?? false;

  return (
    <section className="hero-bili" data-role="hero" aria-label="热门推荐">
      <div className="hero-bili__grid">
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
            const url = itemBackdropUrl(it);
            return (
              <img
                key={`${it.id}-${idx}`}
                className={`hero-bili__banner-img${isActive ? ' is-active' : ''}`}
                src={url}
                alt={itemTitle(it)}
                loading="eager"
                decoding="async"
                draggable={false}
                onError={() => markBackdropFailed(url)}
              />
            );
          })}

          {/* 主图加载失败兜底：与 HeroBanner / VideoCard / IPTV 卡共用公共品牌样式
              （此前失败只露 .hero-bili__banner 的 #0b0b0e 深色底） */}
          {bannerItems[safeActiveIndex] && failedBackdrops.has(itemBackdropUrl(bannerItems[safeActiveIndex])) && (
            <div className="lazy-image-fallback lazy-image-fallback--brand hero-bili__banner-fallback">
              <Icon icon={MonitorPlay} size="2xl" className="lazy-image-fallback__icon" />
              <span className="lazy-image-fallback__brand">kinoTV</span>
            </div>
          )}

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
                  <Link
                    to={{ pathname: `/play/${activeItem.id}` }}
                    state={{ from: location.pathname + location.search }}
                    className="hero-banner__cta hero-banner__cta--continue"
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <Icon icon={Play} size="sm" fill="currentColor" />
                    <span>继续播放</span>
                  </Link>
                )}
                {onItemClick && (
                  <Link
                    to={{ pathname: `/detail/${activeItem.id}` }}
                    state={{ from: location.pathname + location.search }}
                    className="hero-banner__cta"
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <Icon icon={Play} size="sm" fill="currentColor" />
                    <span>查看详情</span>
                  </Link>
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
      <div
        className="hero-bili__right"
        onMouseEnter={() => setRightHovered(true)}
        onMouseLeave={() => setRightHovered(false)}
        onFocus={() => setRightFocused(true)}
        onBlur={() => setRightFocused(false)}
      >
        <div className="hero-bili__cards">
          {rightCards.map(({ item }) => (
            <HeroSideCard
              key={String(item.id)}
              item={item}
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
      </div>{/* /hero-bili__grid */}
    </section>
  );
}

/**
 * HeroSideCard — 单张竖版卡（封面在上标题在下，四角信息）
 * - 左上评分 / 右上收藏（悬浮显现）/ 左下年份 / 右下类型
 * - 整卡为 <Link>（支持右键新标签页打开详情）；收藏命中时 toggle + preventDefault 不跳转
 * - 标题方案 A（2026-09-30 用户确认）：默认单行 ellipsis 兜底（标题条高度恒定，
 *   banner 齐平推导的单行基准不变）；hover 标题区 / 键盘聚焦整卡且文本溢出时，
 *   切换为双段等长无缝跑马灯（4.5s），移出/失焦即停；reduced-motion 降级静态 ellipsis
 */
function HeroSideCard({ item }: { item: HeroBiliItem }) {
  const location = useLocation();
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

  // 跑马灯只在「悬浮/聚焦 + 溢出」时启用，移出/失焦即停（不自动滚动）。
  // 溢出测量对象 = 兜底层（.hero-side-card__title-fallback，恒单行 nowrap），
  // 与 demos/hero-title-marquee-demo.html 的判定一致
  const handleTitleEnter = useCallback(() => {
    const el = titleRef.current?.querySelector('.hero-side-card__title-fallback');
    if (el && el.scrollWidth > el.clientWidth) setMarquee(true);
  }, []);
  const handleTitleLeave = useCallback(() => setMarquee(false), []);

  const handleFav = useCallback((e: React.MouseEvent) => {
    // 收藏不跳转：整卡是 <Link>，必须 preventDefault（仅 stopPropagation 挡不住浏览器默认跟 href）
    e.preventDefault();
    e.stopPropagation();
    // 鼠标点击后主动移除焦点：与 VideoCard 收藏按钮行为统一
    if (e.detail > 0) (e.currentTarget as HTMLElement).blur();
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
    <Link
      to={`/detail/${item.id}`}
      state={{ from: location.pathname + location.search }}
      className="hero-side-card"
      aria-label={title}
      /* 键盘可达：聚焦整卡与悬浮标题区同语义触发跑马灯（失焦即停） */
      onFocus={handleTitleEnter}
      onBlur={handleTitleLeave}
    >
      <div className="hero-side-card__cover">
        {coverUrl ? (
          /* 封面失败兜底与「继续观看」卡（VideoCard → LazyImage）一致：
             骨架占位加载，失败走默认品牌兜底（MonitorPlay + kinoTV） */
          <LazyImage
            src={coverUrl}
            alt=""
            className="hero-side-card__img"
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
          <Icon icon={Heart} size="xs" fill="currentColor" />
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
        {/* 兜底层：恒单行 ellipsis（标题条高度恒定，banner 齐平基准不受跑马灯影响） */}
        <span className="hero-side-card__title-fallback">{title}</span>
        {/* 跑马灯层：absolute 覆盖标题条（不占布局，切换零跳动），跑马灯时才显示 */}
        <span className="hero-side-card__title-marquee" aria-hidden="true">
          <span className="hero-side-card__title-track">
            <span className="hero-side-card__title-seg">{title}</span>
            {/* 第二段只在跑马灯时渲染——短标题不会出现「两个标题」 */}
            {marquee && (
              <span className="hero-side-card__title-seg" aria-hidden="true">{title}</span>
            )}
          </span>
        </span>
      </div>
    </Link>
  );
}
