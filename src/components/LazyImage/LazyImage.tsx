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
import { useState, useEffect, useRef } from 'react';
import CardCoverLoading from '../common/CardCoverLoading';
import { isImageLoaded, markImageLoaded } from './imageCache';
import './LazyImage.css';

const LETTER_COLORS = [
  '#e57373', '#f06292', '#ba68c8', '#9575cd',
  '#7986cb', '#64b5f6', '#4fc3f7', '#4dd0e1',
  '#4db6ac', '#81c784', '#aed581', '#ffed57',
  '#ffd54f', '#ffb74d', '#ff8a65', '#a1887f',
];

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
  letter?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  threshold?: number;
  srcSet?: string;
  sizes?: string;
  /**
   * 加载占位风格：
   * - default：shimmer + 小 spinner（默认，向后兼容）
   * - brand：KinoTV 抠图 + 进度条（用于 card 封面）
   */
  loadingVariant?: 'default' | 'brand';
}

export default function LazyImage({
  src,
  alt = '',
  className = '',
  style = {},
  placeholder,
  fallbackSrc = '/placeholder.png',
  letter,
  onLoad,
  onError,
  threshold = 0.1,
  srcSet,
  sizes,
  loadingVariant = 'default',
}: LazyImageProps) {
  // 命中 session 缓存时直接进入 loaded + inView 态，跳过 IntersectionObserver 等待
  const [isLoaded, setIsLoaded] = useState(() => isImageLoaded(src));
  const [isInView, setIsInView] = useState(() => isImageLoaded(src));
  const [error, setError] = useState(false);
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
    // 写入 session 缓存，供后续同 URL 的 mount 跳过 IntersectionObserver
    markImageLoaded(src);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    // 错误的 URL 不写入缓存,允许后续重试或显示 fallback
    onError?.(new Error('Failed to load image'));
  };

  const hasValidSrc = src && src.trim().length > 0;
  const imageSrc = error || !hasValidSrc ? fallbackSrc : src;
  // 移除 autoSrcSet：原逻辑 `${src} 1x, ${src} 2x` 错误地为同一 URL 声明两种密度，
  // 浏览器在高 DPR 屏幕下会加载原始大图（可能 3000px+），导致内存暴增和性能下降。
  // 若需要响应式图片，应由调用方通过 srcSet prop 传入正确格式的 srcSet。

  return (
    <div
      ref={imgRef}
      className={`lazy-image-container ${isLoaded ? 'loaded' : ''} ${error ? 'error' : ''} ${loadingVariant === 'brand' ? 'lazy-image-container--brand' : ''} ${isCached ? 'lazy-image-container--cached' : ''} ${className}`}
      style={style}
    >
      {!error && isInView && (
        <img
          src={imageSrc}
          alt={alt}
          className="lazy-image"
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          srcSet={srcSet}
          sizes={sizes}
        />
      )}

      {!isLoaded && !error && (
        <div className="lazy-image-placeholder">
          {loadingVariant === 'brand' ? (
            <CardCoverLoading />
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
      ) : (error || !hasValidSrc) && (
        <img
          src={fallbackSrc}
          alt={alt}
          className="lazy-image lazy-image-fallback"
          onError={() => {}}
        />
      )}
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
