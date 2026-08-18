import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useThrottle } from '@/hooks/useThrottle';
import './OverlayScrollbar.css';

interface OverlayScrollbarProps {
  scrollContainer: React.RefObject<HTMLDivElement | null>;
}

/**
 * OverlayScrollbar — 覆盖式自定义滚动条
 *
 * thumb 的尺寸/位置直接写入 DOM（style.height / transform），**不经 React state**：
 * 滚动是高频事件，若每帧 setState 触发重渲染，主线程繁忙（长列表 content-visibility
 * 布局、入场动画、Keep-Alive 多页常驻）时 thumb 更新会被渲染调度挤占，表现为
 * 「页面在滚、滚动条卡在顶部不跟手」。直接 DOM 写入绕开 React 调度，始终实时跟手。
 * 仅 visible（有/无滚动）切换走 state——低频，且同值 setState React 自动 bail out。
 */
export default function OverlayScrollbar({ scrollContainer }: OverlayScrollbarProps) {
  const thumbRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);

  const updateThumb = useCallback(() => {
    const el = scrollContainer.current;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight) {
      thumb.style.height = '0px';
      thumb.style.transform = 'translateY(0px)';
      setVisible(false);
      return;
    }
    const ratio = clientHeight / scrollHeight;
    const h = Math.max(30, clientHeight * ratio);
    const maxTop = clientHeight - h;
    const top = (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    thumb.style.height = `${h}px`;
    thumb.style.transform = `translateY(${top}px)`;
    setVisible(true);
  }, [scrollContainer]);

  // 立即更新一次（DOM 准备好后）
  useLayoutEffect(() => {
    updateThumb();
  }, [updateThumb]);

  const throttledUpdateThumb = useThrottle(updateThumb);

  // 监听滚动事件
  useEffect(() => {
    const el = scrollContainer.current;
    if (!el) return;
    el.addEventListener('scroll', throttledUpdateThumb, { passive: true });
    updateThumb();
    const ro = new ResizeObserver(throttledUpdateThumb);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', throttledUpdateThumb);
      ro.disconnect();
    };
  }, [scrollContainer, throttledUpdateThumb, updateThumb]);

  // 监听内容 DOM 变化（2026-08-13 修复「内容变矮后滚动条残留」）：
  // 滚动容器的直接子级（.page-transition）是 flex:1 恒填满视口高度，内容变矮时
  // 容器/子级盒高都不变、scrollTop 不动——scroll 事件与 ResizeObserver 均不触发，
  // thumb 残留。DOM 变化（Keep-Alive display 切换、设置页切 tab、异步数据渲染、
  // 图片占位替换）是「内容变了」的可靠信号，借此重算 thumb 尺寸/位置。
  // MutationObserver 回调本身按 microtask 批次合并，再经 useThrottle 节流，开销可控。
  useEffect(() => {
    const el = scrollContainer.current;
    if (!el) return;
    const mo = new MutationObserver(throttledUpdateThumb);
    mo.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    return () => mo.disconnect();
  }, [scrollContainer, throttledUpdateThumb]);

  // 延迟重试：处理 ref 可能延迟绑定的情况
  useEffect(() => {
    const timer = setTimeout(() => updateThumb(), 100);
    return () => clearTimeout(timer);
  }, [updateThumb]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = scrollContainer.current?.scrollTop ?? 0;
    const target = e.target as HTMLElement;
    target.setPointerCapture(e.pointerId);
    // 拖动态样式：ref 变化不触发渲染，直接操作 classList
    target.classList.add('overlay-scrollbar__thumb--dragging');
  }, [scrollContainer]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !scrollContainer.current || !thumbRef.current) return;
    const el = scrollContainer.current;
    const dy = e.clientY - dragStartY.current;
    const scrollRange = el.scrollHeight - el.clientHeight;
    const thumbH = parseFloat(thumbRef.current.style.height) || 0;
    const thumbTrack = el.clientHeight - thumbH;
    if (thumbTrack <= 0) return;
    const scrollDelta = (dy / thumbTrack) * scrollRange;
    el.scrollTop = dragStartScrollTop.current + scrollDelta;
  }, [scrollContainer]);

  const handlePointerUp = useCallback(() => {
    if (isDraggingRef.current && thumbRef.current) {
      thumbRef.current.classList.remove('overlay-scrollbar__thumb--dragging');
    }
    isDraggingRef.current = false;
  }, []);

  return (
    <div className={`overlay-scrollbar${visible ? ' overlay-scrollbar--visible' : ''}`}>
      <div
        ref={thumbRef}
        className="overlay-scrollbar__thumb"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
