/**
 * StillsLightbox — 剧照全屏灯箱
 * 深色背景 + 键盘导航 + 缩略图滑动 + 计数器
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import './StillsLightbox.css';

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

  // 拖拽缩略图条
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });

  // 灯箱打开时阻止背景滚动
  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;

    // 锁定背景滚动
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';

    return () => {
      // 恢复背景滚动
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.overflow = '';
      html.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [open]);

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

  return (
    <div className="stills-lightbox" role="dialog" aria-modal="true" aria-label="剧照查看">
      <div className="stills-lightbox__backdrop" onClick={onClose} />

      <button className="stills-lightbox__close" onClick={onClose} aria-label="关闭">
        <X size={24} />
      </button>

      <div className="stills-lightbox__counter">
        {currentIndex + 1} / {urls.length}
      </div>

      {currentIndex > 0 && (
        <button className="stills-lightbox__nav stills-lightbox__nav--prev" onClick={goPrev} aria-label="上一张">
          <ChevronLeft size={32} />
        </button>
      )}

      {currentIndex < urls.length - 1 && (
        <button className="stills-lightbox__nav stills-lightbox__nav--next" onClick={goNext} aria-label="下一张">
          <ChevronRight size={32} />
        </button>
      )}

      {/* 主图区域 */}
      <div ref={scrollRef} className="stills-lightbox__scroll">
        {urls.map((url, i) => (
          <div key={url} className="stills-lightbox__slide">
            <img
              src={url}
              alt={`剧照 ${i + 1}`}
              loading={Math.abs(i - currentIndex) <= 2 ? 'eager' : 'lazy'}
              draggable={false}
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
    </div>
  );
}
