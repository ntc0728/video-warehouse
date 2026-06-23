import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import './OverlayScrollbar.css';

interface OverlayScrollbarProps {
  scrollContainer: React.RefObject<HTMLDivElement | null>;
}

export default function OverlayScrollbar({ scrollContainer }: OverlayScrollbarProps) {
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);

  const updateThumb = useCallback(() => {
    const el = scrollContainer.current;
    if (!el) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight) {
      setThumbHeight(0);
      return;
    }
    const ratio = clientHeight / scrollHeight;
    const h = Math.max(30, clientHeight * ratio);
    const maxTop = clientHeight - h;
    const top = (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    setThumbHeight(h);
    setThumbTop(top);
  }, [scrollContainer]);

  // 立即更新一次（DOM 准备好后）
  useLayoutEffect(() => {
    updateThumb();
  }, [updateThumb]);

  // 监听滚动事件
  useEffect(() => {
    const el = scrollContainer.current;
    if (!el) return;
    el.addEventListener('scroll', updateThumb, { passive: true });
    updateThumb();
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateThumb);
      ro.disconnect();
    };
  }, [scrollContainer, updateThumb]);

  // 延迟重试：处理 ref 可能延迟绑定的情况
  useEffect(() => {
    const timer = setTimeout(() => updateThumb(), 100);
    return () => clearTimeout(timer);
  }, [updateThumb]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = scrollContainer.current?.scrollTop ?? 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [scrollContainer]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !scrollContainer.current) return;
    const el = scrollContainer.current;
    const dy = e.clientY - dragStartY.current;
    const scrollRange = el.scrollHeight - el.clientHeight;
    const thumbTrack = el.clientHeight - thumbHeight;
    if (thumbTrack <= 0) return;
    const scrollDelta = (dy / thumbTrack) * scrollRange;
    el.scrollTop = dragStartScrollTop.current + scrollDelta;
  }, [scrollContainer, thumbHeight]);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  return (
    <div className={`overlay-scrollbar${thumbHeight > 0 ? ' overlay-scrollbar--visible' : ''}`}>
      {thumbHeight > 0 && (
        <div
          className={`overlay-scrollbar__thumb${isDragging ? ' overlay-scrollbar__thumb--dragging' : ''}`}
          style={{ height: thumbHeight, transform: `translateY(${thumbTop}px)` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      )}
    </div>
  );
}
