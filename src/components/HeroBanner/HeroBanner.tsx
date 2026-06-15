/**
 * HeroBanner — 首页 Hero 横幅
 * 基于 TMDB trending 数据，自动轮播 + 主题感知渐变蒙版 + CTA 按钮
 * 7 客户端适配 + prefers-reduced-motion 支持
 *
 * 增强功能：鼠标悬停 1.5 秒后显示剧照轮播（多张时自动切换 + 缩放动画）
 *           无剧照时降级为背景图缩放动画
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { usePointerType } from '@/hooks/usePointerType';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { buildImageUrl, buildImageSrcSet, fetchMovieImages, fetchTVImages } from '@/services/tmdbService';
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
  // Legacy snake_case support
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
}

/** 悬停多久后触发剧照轮播（毫秒） */
const HOVER_STILLS_DELAY = 1500;
/** 剧照自动轮播间隔（毫秒） */
const STILLS_ROTATE_INTERVAL = 4000;
/** Hero 蒙版颜色（深色径向渐变） */
const HERO_MASK_BG = 'var(--hero-mask-dark)';
/** 鼠标拖拽触发 prev/next 的累计位移阈值（px） */
const DRAG_THRESHOLD = 60;

/**
 * 解析 TMDB ID 为纯数字。接受以下格式：
 * - 纯数字：`12345` → 12345
 * - 数字字符串：`"12345"` → 12345
 * - 复合 ID（video.id）：`"tmdb-movie-12345"` / `"tmdb-tv-12345"` → 12345
 * - 无效输入：返回 NaN
 */
function parseTmdbId(id: number | string | null | undefined): number {
  if (id == null) return NaN;
  if (typeof id === 'number') return id;
  const m = String(id).match(/^tmdb-(?:movie|tv)-(\d+)$/);
  if (m) return Number(m[1]);
  const n = Number(id);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * 预加载图片到浏览器缓存。用 `new Image()` 异步加载但不渲染到 DOM，
 * 浏览器会把图片存入 HTTP 缓存，下次 `<img src={url}>` 时立即命中。
 *
 * 用途：切 current 时 backdrop/poster 已在缓存 → 立即显示完整图片，避免
 *       "文字立即变 + 图片慢慢加载"导致"封面图和电影对应不上"。
 */
function preloadImage(url: string | null | undefined): void {
  if (!url) return;
  const img = new Image();
  img.src = url;
}

/** 预加载的最大 item 数量（前 N 个，避免一次发太多请求） */
const PRELOAD_AHEAD_COUNT = 20;

export default function HeroBanner({
  items,
  autoPlayInterval = 5000,
  onItemClick,
}: HeroBannerProps) {

  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const pointerType = usePointerType();
  const isMobile = useIsMobile();
  const isTV = useIsTV();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // 剧照轮播状态
  const [stills, setStills] = useState<string[]>([]);
  const [currentStillIndex, setCurrentStillIndex] = useState(0);
  const stillsTimerRef = useRef<ReturnType<typeof setInterval>>();
  // 剧照缓存：key = `${mediaType}:${tmdbId}`，value = urls（成功/空结果均缓存）
  const stillsCacheRef = useRef<Map<string, string[]>>(new Map());
  // 失败冷却：key -> 失败时间戳；30 秒内不重试
  const failedAtRef = useRef<Map<string, number>>(new Map());
  // 永久失败集合：失败重试 1 次后仍失败则加入。跨 hover 保留，跨刷新清空。
  const permanentlyFailedRef = useRef<Set<string>>(new Set());
  // 当前进行中的请求控制器：用于 prev/next/dot/unmount 取消
  const abortControllerRef = useRef<AbortController | null>(null);
  // 当前正在加载的 cacheKey（防止同 key 并发请求）
  const loadingKeyRef = useRef<string | null>(null);
  // 鼠标是否停留在左右切换按钮 / dot 上：true 时阻止 hover 行为（避免
  // 鼠标在按钮上停留 1.5s 误触发剧照加载和背景图 kenburns）
  const isPointerOnButtonRef = useRef<boolean>(false);
  // items 引用：避免 useEffect 对 items 数组引用的依赖导致 store re-render 时反复跑
  const itemsRef = useRef<HeroItem[]>(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // 鼠标拖拽状态
  const sectionRef = useRef<HTMLElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragAccumDxRef = useRef<number>(0);
  const dragMovedRef = useRef<boolean>(false);

  // 预加载前 N 个 items 的 backdrop + poster：让切 current 时图片已在浏览器缓存，
  // 切到目标 current 时立即显示完整封面图（避免异步加载导致"对应不上"）。
  // 用 requestIdleCallback 调度,避免 mount 时同步触发 20+ 张网络请求阻塞主线程。
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

  // 当前项的海报图立即预加载：requestIdleCallback 可能在首屏渲染后才执行，
  // 导致移动端海报图比背景图晚出现。立即预加载确保 <img> 渲染时已命中缓存。
  useEffect(() => {
    const item = items[current];
    if (!item) return;
    const posterPath = item.posterPath || item.poster_path;
    if (posterPath) preloadImage(buildImageUrl(posterPath, 'w342'));
  }, [current, items]);

  /** 失败冷却时间 */
  const FAILED_COOLDOWN_MS = 5_000;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const effectiveInterval = prefersReducedMotion ? 0 : autoPlayInterval;

  // ── 自动轮播 ─────────────────────────────────
  useEffect(() => {
    if (!effectiveInterval || items.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      setCurrent((p) => (p + 1) % items.length);
    }, effectiveInterval);
    return () => clearInterval(timer);
  }, [effectiveInterval, items.length, isHovered]);

  const handlePrev = useCallback(() => {
    // 取消 in-flight 的剧照请求：避免旧 current 响应覆盖新 current
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setCurrent((p) => (p - 1 + items.length) % items.length);
  }, [items.length]);

  const handleNext = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setCurrent((p) => (p + 1) % items.length);
  }, [items.length]);

  // ── 加载剧照（用 ref 转发以解决"startHoverTimer 引用在前"的问题） ───
  // loadStills 函数体定义在文件下方；通过 loadStillsRef 让 startHoverTimer / useEffect 调用
  const loadStillsRef = useRef<(tmdbId: number | string, mediaType: string | undefined) => Promise<void>>(
    async () => undefined,
  );

  // ── 悬停计时 ─────────────────────────────────
  // 1.5s 后设置 isHovered=true，由 main useEffect 负责调 loadStills。
  // 不能在回调里直接调 loadStills：setTimeout 回调闭包 current 是启动时的旧值，
  // 用户在 1.5s 内点击切 current 后，回调仍会用旧 current 调 loadStills，
  // 导致"显示上一张封面的剧照"。main useEffect 闭包用 useState 实时 current，永远正确。
  const startHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(true);
    }, HOVER_STILLS_DELAY);
  }, []);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = undefined;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (isMobile) return;
    // 鼠标直接进入按钮（不经过内容区域）时，section 的 mouseEnter 也会触发
    // （按钮是 section 的子元素）。此时 isPointerOnButtonRef 可能还是旧值
    // （按钮的 onMouseEnter 还没触发）；但只要 ref 是 true 就跳过。
    if (isPointerOnButtonRef.current) return;
    startHoverTimer();
  }, [isMobile, startHoverTimer]);

  // 按钮 onMouseEnter：立即取消 hover timer + 关闭 isHovered，
  // 避免"鼠标在按钮上停留 1.5s"误触发剧照加载和背景图 kenburns。
  const handleButtonPointerEnter = useCallback(() => {
    isPointerOnButtonRef.current = true;
    clearHoverTimer();
    setIsHovered(false);
  }, [clearHoverTimer]);

  // 按钮 onMouseLeave：恢复 hover 行为。鼠标离开按钮后 1.5s 再次触发
  // 剧照加载（如果 isHovered 之前是 true，会被 setIsHovered(false) 关闭）。
  const handleButtonPointerLeave = useCallback(() => {
    isPointerOnButtonRef.current = false;
    if (isMobile) return;
    startHoverTimer();
  }, [isMobile, startHoverTimer]);

  const handleMouseLeave = useCallback(() => {
    clearHoverTimer();
    setIsHovered(false);
    // 清空空 backdrops 缓存 + 失败标记：让用户再次 hover 同一张时能重新调用，
    // 避免 hover 离开后被静默拦截（看不到调用痕迹）。
    // 注意：成功缓存（非空）保留，避免反复请求已确认有剧照的影片。
    for (const [key, urls] of stillsCacheRef.current.entries()) {
      if (urls.length === 0) {
        stillsCacheRef.current.delete(key);
      }
    }
    failedAtRef.current.clear();
  }, [clearHoverTimer]);

  // ── 加载剧照 ─────────────────────────────────
  const loadStills = useCallback(
    async (tmdbId: number | string, mediaType: string | undefined) => {
      // 1. 入口过滤：person 类型不支持 /images 端点，直接跳过
      if (mediaType !== 'movie' && mediaType !== 'tv') return;

      // 2. 解析 TMDB 数字 ID：支持纯数字、'tmdb-movie-12345' / 'tmdb-tv-12345' 复合 ID
      const numericId = parseTmdbId(tmdbId);
      if (!Number.isFinite(numericId) || numericId <= 0) return;

      const cacheKey = `${mediaType}:${numericId}`;

      // 3. 永久失败短路：已确认失败的影片不再发请求
      if (permanentlyFailedRef.current.has(cacheKey)) return;

      // 4. 缓存命中：直接复用
      if (stillsCacheRef.current.has(cacheKey)) {
        const cached = stillsCacheRef.current.get(cacheKey)!;
        setStills(cached);
        setCurrentStillIndex(0);
        return;
      }

      // 5. 失败冷却：5 秒内不重试
      const failedAt = failedAtRef.current.get(cacheKey);
      if (failedAt && Date.now() - failedAt < FAILED_COOLDOWN_MS) return;

      // 6. 并发守卫：同一 key 已有进行中的请求，跳过
      if (loadingKeyRef.current === cacheKey) return;

      // 7. 准备请求：取消上一次 in-flight + 创建新 controller
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      loadingKeyRef.current = cacheKey;

      const doFetch = async () =>
        mediaType === 'movie'
          ? fetchMovieImages(numericId, { signal: controller.signal })
          : fetchTVImages(numericId, { signal: controller.signal });

      try {
        const images = await doFetch();

        // 防御：响应已不是最新（被 abort 后又 resolve）→ 不更新 state
        if (abortControllerRef.current !== controller) return;

        // dedupe：TMDB /images 偶尔会返回重复 file_path，需用 Set 去重避免
        // React duplicate key 警告（HeroBanner 用 URL 作为 img key）
        const urls = Array.from(new Set(
          (images.backdrops || [])
            .map((b) => buildImageUrl(b.file_path, 'w1920'))
            .filter((u): u is string => Boolean(u)),
        ));

        // 8. 写入缓存：有结果缓存非空；空结果缓存空数组（避免重复请求永久短路的影片）
        if (urls.length > 0) {
          stillsCacheRef.current.set(cacheKey, urls);
          failedAtRef.current.delete(cacheKey);
        } else {
          stillsCacheRef.current.set(cacheKey, []);
          failedAtRef.current.set(cacheKey, Date.now());
        }

        setStills(urls);
        setCurrentStillIndex(0);
      } catch (err) {
        // CanceledError：用户主动切换 / 卸载，**不计入失败**
        if (axios.isCancel(err)) return;

        // 防御：过时响应不更新
        if (abortControllerRef.current !== controller) return;

        // 9. 自动重试 1 次
        try {
          const images = await doFetch();
          if (abortControllerRef.current !== controller) return;

          // dedupe（重试路径同样需要）
          const urls = Array.from(new Set(
            (images.backdrops || [])
              .map((b) => buildImageUrl(b.file_path, 'w1920'))
              .filter((u): u is string => Boolean(u)),
          ));

          if (urls.length > 0) {
            stillsCacheRef.current.set(cacheKey, urls);
            failedAtRef.current.delete(cacheKey);
          } else {
            stillsCacheRef.current.set(cacheKey, []);
            failedAtRef.current.set(cacheKey, Date.now());
          }

          setStills(urls);
          setCurrentStillIndex(0);
        } catch (retryErr) {
          // 重试仍失败：永久标记 + 缓存空 + 不再调接口
          if (axios.isCancel(retryErr)) return;
          if (abortControllerRef.current !== controller) return;

          permanentlyFailedRef.current.add(cacheKey);
          stillsCacheRef.current.set(cacheKey, []);
          setStills([]);
        }
      } finally {
        if (loadingKeyRef.current === cacheKey) {
          loadingKeyRef.current = null;
        }
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [],
  );

  // 挂载到 ref，让 startHoverTimer / useEffect 能调用
  loadStillsRef.current = loadStills;

  // ── 切换 trending 项时：优先复用缓存，避免视觉清空闪烁 ──────
  useEffect(() => {
    // 取消 in-flight：避免切换时还在拉旧 current 的剧照
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setCurrentStillIndex(0);
    // 优先复用缓存：有缓存则直接切换显示（不重新请求 + 不清空容器）
    const item = itemsRef.current[current];
    let cacheHit = false;
    if (item) {
      const rawType = item.mediaType || item.media_type;
      if (rawType === 'movie' || rawType === 'tv') {
        const numericId = parseTmdbId(item.id);
        if (Number.isFinite(numericId) && numericId > 0) {
          const cacheKey = `${rawType}:${numericId}`;
          if (stillsCacheRef.current.has(cacheKey)) {
            const cached = stillsCacheRef.current.get(cacheKey)!;
            if (cached.length > 0) {
              setStills(cached);
              cacheHit = true;
            } else {
              // 命中空数组缓存：删除条目，让 loadStills 重新查
              // 避免 current 切换后残留空 backdrops 缓存导致 hover 1.5s 静默不调接口。
              stillsCacheRef.current.delete(cacheKey);
            }
          }
        }
      }
    }
    // cache miss：清空 stills 块（避免显示"上一张"封面的剧照）。
    // 优化:仅在 isHovered === true 时才 setStills([])。
    // 未 hover 时 stills 块用 CSS opacity 0 隐藏,显示的是 backdrop;
    // setStills([]) 会触发一次重渲染 + DOM update,每 5s 切 current 时
    // 都会执行一次,造成不必要的主线程压力。
    if (!cacheHit && isHovered) {
      setStills([]);
    }
    if (isHovered && item) {
      loadStillsRef.current(item.id, item.mediaType || item.media_type);
    }

    // 预加载 next/prev 的 backdrop + poster：让连续切 current 时图片已在缓存，
    // 下一帧立即显示完整封面（避免连续点击时反复出现"图片慢慢加载"）。
    const len = itemsRef.current.length;
    if (len > 1) {
      for (const offset of [-1, 1]) {
        const neighbor = itemsRef.current[(current + offset + len) % len];
        if (!neighbor) continue;
        const backdropPath = neighbor.backdropPath || neighbor.backdrop_path;
        const posterPath = neighbor.posterPath || neighbor.poster_path;
        if (backdropPath) preloadImage(buildImageUrl(backdropPath, 'w1920'));
        if (posterPath) preloadImage(buildImageUrl(posterPath, 'w342'));
      }
    }
  }, [current, isHovered]);

  // ── 剧照轮播定时器 ───────────────────────────
  useEffect(() => {
    if (!isHovered || stills.length < 2) {
      if (stillsTimerRef.current) {
        clearInterval(stillsTimerRef.current);
        stillsTimerRef.current = undefined;
      }
      return;
    }
    stillsTimerRef.current = setInterval(() => {
      setCurrentStillIndex((p) => (p + 1) % stills.length);
    }, STILLS_ROTATE_INTERVAL);
    return () => {
      if (stillsTimerRef.current) {
        clearInterval(stillsTimerRef.current);
        stillsTimerRef.current = undefined;
      }
    };
  }, [isHovered, stills.length]);

  // ── 触发加载剧照（缓存/冷却/并发守卫在 loadStills 内部处理） ────
  // 注：依赖项刻意不含 items（用 itemsRef 读取最新值），避免 store re-render
  //     时 items 引用变化导致 useEffect 反复跑。
  useEffect(() => {
    if (!isHovered) {
      // 鼠标离开：重置索引（保留缓存以便再次快速悬停）
      setCurrentStillIndex(0);
      return;
    }
    const currentItems = itemsRef.current;
    if (currentItems.length === 0) {
      return;
    }
    if (stills.length === 0) {
      const item = currentItems[current];
      if (!item) return; // 防御：current 越界
      const rawType = item.mediaType || item.media_type;
      // loadStills 内部会过滤非 'movie'/'tv' 的类型，且有缓存/冷却/并发守卫
      loadStillsRef.current(item.id, rawType);
    }
  }, [isHovered, current, stills.length]);

  // 切换轮播项
  const goTo = useCallback(
    (index: number) => {
      setCurrent(index);
      // 不再直接调用 loadStills：current 变化会触发上面 useEffect，
      // 在 isHovered=true 时由它来按需加载（含缓存命中短路）
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
    if (e.pointerType === 'touch') return; // 触摸走 touchstart

    // 关键修复：用户按下的是 button（arrow / dot），由 button 自己处理 click；
    // section 不应 capture pointer，否则 click 会被重定向到 section → onItemClick 误触发
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
      clearHoverTimer();
      if (stillsTimerRef.current) clearInterval(stillsTimerRef.current);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [clearHoverTimer]);

  if (!items.length) {
    // 空数据占位：保留高度和 hover 行为，避免 trending=[] 时整页无 HeroBanner
    return (
      <section
        className={`hero-banner hero-banner--empty${isTV ? ' hero-banner--tv' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label="热门推荐"
      >
        <div className="hero-banner__bg-wrapper">
          <div className="hero-banner__bg-placeholder" />
          <div className="hero-banner__mask" style={{ background: HERO_MASK_BG }} />
        </div>
        <div className="hero-banner__content">
          <div className="hero-banner__text">
            <h1 className="hero-banner__title hero-banner__title--placeholder">暂无推荐</h1>
            <p className="hero-banner__desc hero-banner__desc--placeholder">
              {isHovered
                ? '已触发悬停 · 配置 TMDB Access Token 后即可展示剧照预览'
                : '配置 TMDB Access Token 后，悬停此处 1.5 秒即可预览剧照'}
            </p>
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

  // Backdrop 图片：使用 w1920 作为基准尺寸，srcSet 提供多种尺寸供浏览器选择
  const backdropPath = itemData.backdropPath || itemData.backdrop_path || '';
  const backdropUrl = buildImageUrl(backdropPath, 'w1920') || '';
  const backdropSrcSet = buildImageSrcSet(backdropPath, ['w780', 'w1280', 'w1920']);

  // Poster 图片：使用 w342 作为基准尺寸，srcSet 提供多种尺寸
  const posterPath = itemData.posterPath || itemData.poster_path || '';
  const posterUrl = buildImageUrl(posterPath, 'w342') || '';
  const posterSrcSet = buildImageSrcSet(posterPath, ['w185', 'w342', 'w500']);

  const mediaType = itemData.mediaType || itemData.media_type;
  const showArrows = pointerType !== 'coarse' || isTV;
  const mask = HERO_MASK_BG;

  // 是否有剧照可显示
  const hasStills = stills.length > 0;

  return (
    <section
      ref={sectionRef}
      className={`hero-banner${isTV ? ' hero-banner--tv' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-roledescription="carousel"
      aria-label="热门推荐"
      aria-live={prefersReducedMotion ? 'off' : 'polite'}
      onClick={() => {
        if (dragMovedRef.current) {
          dragMovedRef.current = false;
          return;
        }
        onItemClick?.(item);
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      style={{ cursor: onItemClick ? 'pointer' : undefined }}
    >
      {/* Background */}
      <div className="hero-banner__bg-wrapper">
        {backdropUrl && (
          <img
            className={`hero-banner__bg ${
              isHovered && !hasStills ? 'hero-banner__bg--kenburns' : ''
            }`}
            src={backdropUrl}
            srcSet={backdropSrcSet || undefined}
            sizes="100vw"
            alt=""
            aria-hidden="true"
            loading="eager"
          />
        )}
        <div className="hero-banner__mask" style={{ background: mask }} />
      </div>

      {/* Stills Carousel Overlay（始终渲染，用 CSS opacity 控制可见性以获得平滑过渡） */}
      <div
        className={`hero-banner__stills${
          isHovered && hasStills ? ' hero-banner__stills--active' : ''
        }`}
        aria-hidden={isHovered && hasStills ? 'false' : 'true'}
      >
        {stills.map((url, i) => (
          <img
            key={url}
            className={`hero-banner__still ${
              i === currentStillIndex ? 'hero-banner__still--active' : ''
            }`}
            src={url}
            alt={`${title} 剧照 ${i + 1}`}
            aria-hidden={i === currentStillIndex ? 'false' : 'true'}
          />
        ))}
      </div>

      {/* Content */}
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
        </div>

        {/* Desktop poster */}
        {!isMobile && posterUrl && (
          <div className="hero-banner__poster">
            <img key={posterUrl} src={posterUrl} srcSet={posterSrcSet || undefined} sizes="160px" alt={title} loading="eager" />
          </div>
        )}
        {/* Mobile poster */}
        {isMobile && posterUrl && (
          <img key={posterUrl} className="hero-banner__poster-mobile" src={posterUrl} srcSet={posterSrcSet || undefined} sizes="60px" alt={title} loading="eager" />
        )}
      </div>

      {/* Arrows */}
      {showArrows && items.length > 1 && (
        <>
          <button
            className="hero-banner__arrow hero-banner__arrow--left"
            onClick={handlePrevClick}
            onMouseEnter={handleButtonPointerEnter}
            onMouseLeave={handleButtonPointerLeave}
            aria-label="上一个"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            className="hero-banner__arrow hero-banner__arrow--right"
            onClick={handleNextClick}
            onMouseEnter={handleButtonPointerEnter}
            onMouseLeave={handleButtonPointerLeave}
            aria-label="下一个"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Dots */}
      {items.length > 1 && (
        <div className="hero-banner__dots">
          {items.map((_, i) => (
            <button
              key={i}
              className={`hero-banner__dot${i === current ? ' hero-banner__dot--active' : ''}`}
              onClick={() => goTo(i)}
              onMouseEnter={handleButtonPointerEnter}
              onMouseLeave={handleButtonPointerLeave}
              aria-label={`第 ${i + 1} 个`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
