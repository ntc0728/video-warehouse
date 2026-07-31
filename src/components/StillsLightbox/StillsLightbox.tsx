/**
 * StillsLightbox — 剧照全屏灯箱
 * 深色背景 + 键盘导航 + 缩略图滑动 + 计数器
 * 增强：主图触摸滑动切换、键盘 Home/End、图片加载淡入
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useScrollContainer } from '../../hooks/useScrollContext';
import './StillsLightbox.css';
import { Icon } from "@/components/ui/Icon";

interface StillsLightboxProps {
  urls: string[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

export default function StillsLightbox({ urls, initialIndex, open, onClose }: StillsLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const urlsRef = useRef(urls);
  urlsRef.current = urls;
  const [loadedMap, setLoadedMap] = useState<Record<number, boolean>>({});
  const touchStart = useRef({ x: 0, y: 0 });
  const scrollContainerRef = useScrollContainer();

  // 拖拽缩略图条
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });

  // 灯箱打开时锁定背景滚动
  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const scroller = scrollContainerRef.current;

    // 兜底：锁定 window/body（部分场景滚动在 window 上）
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    // 关键：本项目滚动发生在自定义滚动容器（CustomScrollbar / ScrollContainerContext），
    // 仅锁 body/window 无效，必须锁住真实滚动容器才能阻止背景滚轮 / 触摸滚动。
    if (scroller) scroller.style.overflow = 'hidden';

    return () => {
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.overflow = '';
      html.style.overflow = '';
      if (scroller) scroller.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [open, scrollContainerRef]);

  const scrollToIndex = useCallback((idx: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const child = container.children[idx] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, []);

  const scrollThumbsToIndex = useCallback((idx: number) => {
    const container = thumbsRef.current;
    if (!container) return;
    const child = container.children[idx] as HTMLElement | undefined;
    if (child) {
      const containerCenter = container.clientWidth / 2;
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      container.scrollTo({ left: childCenter - containerCenter, behavior: 'smooth' });
    }
  }, []);

  const goPrev = useCallback(() => {
    setCurrentIndex((p) => Math.max(0, p - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((p) => Math.min(urlsRef.current.length - 1, p + 1));
  }, []);

  // 主图触摸滑动切换（移动端）
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goNext();
        else goPrev();
      }
    },
    [goNext, goPrev],
  );

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      scrollToIndex(initialIndex);
    }
  }, [open, initialIndex, scrollToIndex]);

  // 键盘导航
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Home') { setCurrentIndex(0); return; }
      if (e.key === 'End') { setCurrentIndex(urlsRef.current.length - 1); return; }
      setCurrentIndex((p) => {
        const next = e.key === 'ArrowLeft'
          ? Math.max(0, p - 1)
          : e.key === 'ArrowRight'
            ? Math.min(urlsRef.current.length - 1, p + 1)
            : p;
        return next;
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // currentIndex 变化时同步主图和缩略图
  useEffect(() => {
    scrollToIndex(currentIndex);
    scrollThumbsToIndex(currentIndex);
  }, [currentIndex, scrollToIndex, scrollThumbsToIndex]);

  // ── 缩略图条鼠标拖拽 ──
  const handleThumbsMouseDown = useCallback((e: React.MouseEvent) => {
    const el = thumbsRef.current;
    if (!el) return;
    drag.current = { active: true, startX: e.pageX, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!drag.current.active) return;
      e.preventDefault();
      const el = thumbsRef.current;
      if (!el) return;
      el.scrollLeft = drag.current.scrollLeft - (e.pageX - drag.current.startX);
    };

    const handleMouseUp = () => {
      if (!drag.current.active) return;
      drag.current.active = false;
      const el = thumbsRef.current;
      if (el) {
        el.style.cursor = '';
        el.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!open) return null;

  return createPortal(
    <div className="stills-lightbox" role="dialog" aria-modal="true" aria-label="剧照查看">
      <div className="stills-lightbox__backdrop" onClick={onClose} />

      <button className="stills-lightbox__close" onClick={onClose} aria-label="关闭">
        <Icon icon={X} size="lg" />
      </button>

      <div className="stills-lightbox__counter">
        {currentIndex + 1} / {urls.length}
      </div>

      {currentIndex > 0 && (
        <button className="stills-lightbox__nav stills-lightbox__nav--prev" onClick={goPrev} aria-label="上一张">
          <Icon icon={ChevronLeft} size="2xl" />
        </button>
      )}

      {currentIndex < urls.length - 1 && (
        <button className="stills-lightbox__nav stills-lightbox__nav--next" onClick={goNext} aria-label="下一张">
          <Icon icon={ChevronRight} size="2xl" />
        </button>
      )}

      {/* 主图区域 */}
      <div
        ref={scrollRef}
        className="stills-lightbox__scroll"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {urls.map((url, i) => (
          <div key={url} className="stills-lightbox__slide">
            <img
              src={url}
              alt={`剧照 ${i + 1}`}
              loading={Math.abs(i - currentIndex) <= 2 ? 'eager' : 'lazy'}
              draggable={false}
              className={loadedMap[i] ? 'is-loaded' : ''}
              onLoad={() => setLoadedMap((p) => ({ ...p, [i]: true }))}
              onError={() => setLoadedMap((p) => ({ ...p, [i]: true }))}
            />
          </div>
        ))}
      </div>

      {/* 缩略图条 */}
      {urls.length > 1 && (
        <div
          ref={thumbsRef}
          className="stills-lightbox__thumbs"
          onMouseDown={handleThumbsMouseDown}
        >
          {urls.map((url, i) => (
            <button
              key={url}
              className={`stills-lightbox__thumb${i === currentIndex ? ' stills-lightbox__thumb--active' : ''}`}
              onClick={() => setCurrentIndex(i)}
              aria-label={`第 ${i + 1} 张`}
            >
              <img src={url} alt="" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
