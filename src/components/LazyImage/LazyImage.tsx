/**
 * 懒加载图片组件
 * 使用 IntersectionObserver 实现图片懒加载，支持加载占位、错误回退和文字首字母占位
 *
 * Session 缓存机制：
 * 模块级 `loadedImageCache` 记录本会话内已成功 onLoad 的图片 URL。
 * 路由切换（Home ↔ IPTV）时 Outlet 子树 unmount/remount，
 * LazyImage 重建会丢掉 isLoaded/isInView state，但 URL 已加载的事实不会丢。
 * 新 mount 的 LazyImage 命中缓存后跳过 IntersectionObserver 等待，
 * 浏览器 HTTP 缓存同步绘制图片，避免 0.5s 的 opacity 渐显动画。
 *
 * 缓存工具函数见 `./imageCache.ts`。
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import CardCoverLoading from '../common/CardCoverLoading';
import { useSettingsStore } from '@/stores';
import { isImageLoaded, markImageLoaded } from './imageCache';
import './LazyImage.css';

const LETTER_COLORS = [
  '#e57373', '#f06292', '#ba68c8', '#9575cd',
  '#7986cb', '#64b5f6', '#4fc3f7', '#4dd0e1',
  '#4db6ac', '#81c784', '#aed581', '#ffed57',
  '#ffd54f', '#ffb74d', '#ff8a65', '#a1887f',
];

/** C2-2（2026-08-04）：图片请求挂起兜底——默认超时 8s（可经 timeoutMs prop 覆盖）。
 *  请求既不 onLoad 也不 onError（防盗链/连接挂起）时，超时视为失败 → 走 fallbackSrc，
 *  避免 spinner 无限转（「海报一直处于加载中」）。 */
export const DEFAULT_IMAGE_LOAD_TIMEOUT = 8000;

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return LETTER_COLORS[Math.abs(hash) % LETTER_COLORS.length];
}

interface LazyImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: React.ReactNode;
  fallbackSrc?: string;
  /**
   * 候选回退源链：src 加载失败时依次尝试，全部失败后才进入 error 态
   * （走 fallbackSrc / letter 占位）。不传时行为与原先完全一致。
   */
  srcCandidates?: string[];
  letter?: string;
  onLoad?: (url?: string) => void;
  /** error 第二参数为当前失败的候选 URL（srcCandidates 场景下定位失败项） */
  onError?: (error: Error, failedUrl?: string) => void;
  threshold?: number;
  srcSet?: string;
  sizes?: string;
  /**
   * 加载占位风格：
   * - default：shimmer + 小 spinner（默认，向后兼容）
   * - brand：KinoTV 抠图 + 进度条（用于 card 封面）
   */
  loadingVariant?: 'default' | 'brand';
  /**
   * 加载中即显示字母占位（不渲染 shimmer/spinner）：
   * 用于台标等「无图率高、加载可能超时」的场景，避免 spinner 空白等待期；
   * 加载成功后图片淡入替换。默认 false（保持旧占位行为）。
   */
  immediateLetter?: boolean;
  /**
   * 加载超时（毫秒）：图片请求挂起（既不 onLoad 也不 onError，如防盗链 pending）时
   * 超时视为加载失败 → 走 fallbackSrc。默认 8s；0 表示禁用超时。
   */
  timeoutMs?: number;
}

export default function LazyImage({
  src,
  alt = '',
  className = '',
  style = {},
  placeholder,
  fallbackSrc,
  srcCandidates,
  letter,
  onLoad,
  onError,
  threshold = 0.1,
  srcSet,
  sizes,
  loadingVariant = 'default',
  timeoutMs = DEFAULT_IMAGE_LOAD_TIMEOUT,
  immediateLetter = false,
}: LazyImageProps) {
  // 命中 session 缓存时直接进入 loaded + inView 态，跳过 IntersectionObserver 等待
  const [isLoaded, setIsLoaded] = useState(() => isImageLoaded(src));
  const [isInView, setIsInView] = useState(() => isImageLoaded(src));
  const [error, setError] = useState(false);

  // 9.1：失败兜底图按主题自适应 —— 暗色用 placeholder.svg（品牌蓝灰），
  // 亮色用 placeholder-light.svg（品牌浅色），替代固定深色 SVG 在亮色主题下的「黑色块」。
  // 调用方传 fallbackSrc 时优先用传入值（如 PlaylistModal 的 TMDB 海报兜底）。
  const theme = useSettingsStore((s) => s.theme);
  const resolvedFallbackSrc =
    fallbackSrc ??
    (theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? '/placeholder.svg'
      : '/placeholder-light.svg');
  // 候选链：src 为链首，srcCandidates 为后续候选（过滤空值）
  const candidates = useMemo(() => {
    const all = src ? [src, ...(srcCandidates ?? [])] : [];
    return all.filter(Boolean);
  }, [src, srcCandidates]);
  // 当前候选下标：src 变化时重置回链首
  const [candidateIndex, setCandidateIndex] = useState(0);
  useEffect(() => {
    setCandidateIndex(0);
  }, [src]);
  const imgRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // 命中 session 缓存：DOM 重建时跳过 0.5s opacity/transform 渐显动画
  const isCached = isImageLoaded(src);

  /** 使用 IntersectionObserver 监听元素是否进入可视区域，提前50px预加载 */
  useEffect(() => {
    // session 缓存命中：URL 已加载过，无需再监听视口
    if (isImageLoaded(src)) {
      return;
    }
    if (!imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '50px 0px',
        threshold,
      }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [threshold, src]);

  const handleLoad = () => {
    setIsLoaded(true);
    // 写入 session 缓存（记录实际成功加载的候选 URL，供后续同 URL 的 mount 跳过等待）
    markImageLoaded(imageSrc);
    // 回调携带成功 URL（srcCandidates 场景下定位命中项；供调用方记录跨会话成功记忆）
    onLoad?.(candidates[candidateIndex]);
  };

  const handleError = () => {
    // 候选链未用尽：推进到下一候选继续尝试，不进入 error 态
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((i) => i + 1);
      onError?.(new Error('Failed to load image'), candidates[candidateIndex]);
      return;
    }
    setError(true);
    // 错误的 URL 不写入缓存,允许后续重试或显示 fallback
    onError?.(new Error('Failed to load image'), candidates[candidateIndex]);
  };

  const hasValidSrc = candidates.length > 0;

  // C2-2（2026-08-04）：加载超时兜底——img 挂载（进入视口）后 timeoutMs 内未 onLoad
  // 也未 onError（请求挂起），视为失败走 fallbackSrc，避免 spinner 无限转。
  // 候选链场景：超时优先推进候选，链用尽才进入 error 态。
  // onLoad/onError 改变 isLoaded/error 后本 effect 清理计时器，不误触发。
  useEffect(() => {
    if (!isInView || isLoaded || error || !hasValidSrc || timeoutMs <= 0) return;
    const timer = window.setTimeout(() => {
      if (candidateIndex + 1 < candidates.length) {
        setCandidateIndex((i) => i + 1);
      } else {
        setError(true);
        // 与 handleError 一致：超时挂起最终进入 error 态时也要通知调用方，
        // 否则 IPTV 卡片等依赖 onError 切换占位（如 Tv 图标）的调用方不会更新
        onError?.(new Error('Image load timed out'), candidates[candidateIndex]);
      }
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [isInView, isLoaded, error, hasValidSrc, timeoutMs, candidateIndex, candidates.length]);
  const imageSrc = error || !hasValidSrc ? resolvedFallbackSrc : candidates[candidateIndex];
  // 移除 autoSrcSet：原逻辑 `${src} 1x, ${src} 2x` 错误地为同一 URL 声明两种密度，
  // 浏览器在高 DPR 屏幕下会加载原始大图（可能 3000px+），导致内存暴增和性能下降。
  // 若需要响应式图片，应由调用方通过 srcSet prop 传入正确格式的 srcSet。

  return (
    <div
      ref={imgRef}
      className={`lazy-image-container ${isLoaded ? 'loaded' : ''} ${error ? 'error' : ''} ${loadingVariant === 'brand' ? 'lazy-image-container--brand' : ''} ${isCached ? 'lazy-image-container--cached' : ''} ${className}`}
      style={style}
    >
      {/* 有 letter 且无有效候选时不再渲染 fallback 图（由下方 letter 分支独占）：
          否则 /placeholder.svg 加载成功 opacity:1，与 letter 纯色块同时显示 →
          文字占位与台标背景图重叠（2026-08-11 修复，IPTVChannelCard 无 logo 频道场景）。 */}
      {!error && isInView && (!letter || hasValidSrc) && (
        <img
          src={imageSrc}
          alt={alt}
          className="lazy-image"
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          srcSet={srcSet}
          sizes={sizes}
        />
      )}

      {/* 占位层仅在「有有效 src 且正在加载」时渲染。
          收紧原因（2026-08-04）：error / 空源时走下方 fallback 图分支，
          该分支无 onLoad → isLoaded 恒为 false → 若此时仍渲染占位层，
          白色 shimmer 将永不淡出，形成盖在兜底图上的「白遮罩」。 */}
      {!isLoaded && !error && hasValidSrc && (
        <div className="lazy-image-placeholder">
          {loadingVariant === 'brand' ? (
            immediateLetter && letter ? (
              <div className="lazy-image-letter" style={{ backgroundColor: stringToColor(letter) }}>{letter}</div>
            ) : (
              <CardCoverLoading />
            )
          ) : (
            placeholder || (
              <div className="lazy-image-spinner">
                <div className="image-spinner"></div>
              </div>
            )
          )}
        </div>
      )}

      {(error || !hasValidSrc) && letter ? (
        <div className="lazy-image-letter" style={{ backgroundColor: stringToColor(letter) }}>{letter}</div>
      ) : (error || !hasValidSrc) && resolvedFallbackSrc ? (
        <img
          src={resolvedFallbackSrc}
          alt={alt}
          className="lazy-image lazy-image-fallback"
          decoding="async"
          onError={() => {}}
        />
      ) : null}
    </div>
  );
}

/**
 * 懒加载背景图组件
 * 将图片作为背景图加载，加载完成后切换显示，适用于需要背景图覆盖的场景
 */
export function LazyImageBackground({
  src,
  children,
  className = '',
  style = {},
  fallbackColor = 'var(--color-placeholder, #f0f0f0)',
}: {
  src: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  fallbackColor?: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '50px 0px',
        threshold: 0,
      }
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div
      ref={containerRef}
      className={`lazy-image-bg-container ${isLoaded ? 'loaded' : ''} ${className}`}
      style={{
        ...style,
        backgroundColor: isLoaded ? `url(${src})` : fallbackColor,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {!isLoaded && <div className="lazy-image-bg-loading"></div>}
      {children}
      {/* 隐藏的 img 元素用于预加载背景图 */}
      {isInView && (
        <img
          src={src}
          alt=""
          style={{ display: 'none' }}
          onLoad={handleLoad}
        />
      )}
    </div>
  );
}
