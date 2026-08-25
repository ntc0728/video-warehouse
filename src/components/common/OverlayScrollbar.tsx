import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import './OverlayScrollbar.css';

interface OverlayScrollbarProps {
  scrollContainer: React.RefObject<HTMLDivElement | null>;
}

/**
 * OverlayScrollbar — 覆盖式自定义滚动条
 *
 * 实现要点（踩坑记录，勿回退）：
 * 1. thumb 尺寸/位置直接写 DOM（style.height/transform），**不经 React state**——
 *    高频滚动下 setState 渲染会被主线程繁忙（content-visibility 布局、入场动画、
 *    Keep-Alive 多页常驻）挤占，表现为「页面在滚、滚动条卡顶不跟手」。
 * 2. 所有监听器（scroll / ResizeObserver / MutationObserver）**直接调用 updateThumb**，
 *    不用 rAF 节流——`requestAnimationFrame` 在 headless / 后台标签 / 节能模式 /
 *    主线程繁忙时会延迟甚至不触发，scroll 更新会被吞掉（实测 thumb 固定顶部）。
 *    scroll 事件本身由浏览器合成器以 60fps 上限派发，DOM 写入成本极低，无需节流；
 *    MutationObserver 回调按 microtask 批次合并，天然低频。
 * 3. 仅 visible（有/无滚动）切换走 state——低频，且同值 setState React 自动 bail out。
 */
export default function OverlayScrollbar({ scrollContainer }: OverlayScrollbarProps) {
  const thumbRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // 路由切换过渡锁：切换期间 updateThumb 不主动显示 thumb，
  // 等新页面首帧布局稳定后再判定（见底部 route-change useLayoutEffect）。
  const transitioningRef = useRef(false);
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
    // 路由切换过渡期：不主动显示。新页面布局未稳（旧内容卸载、字体/图片/异步数据
    // 未就绪）时 scrollHeight 会短暂「假性溢出」，若此刻显示就会闪现旧页滚动条；
    // 等 route-change 的 rAF/超时解锁后再判定真实显隐（见下方 useLayoutEffect）。
    if (transitioningRef.current) return;
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

  // 监听滚动事件 + 容器尺寸变化（直接调用，不经 rAF 节流）
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

  // 监听内容 DOM 变化（2026-08-13 修复「内容变矮后滚动条残留」）：
  // 滚动容器的直接子级（.page-transition）是 flex:1 恒填满视口高度，内容变矮时
  // 容器/子级盒高都不变、scrollTop 不动——scroll 事件与 ResizeObserver 均不触发，
  // thumb 残留。DOM 变化（Keep-Alive display 切换、设置页切 tab、异步数据渲染、
  // 图片占位替换）是「内容变了」的可靠信号，借此重算 thumb 尺寸/位置。
  useEffect(() => {
    const el = scrollContainer.current;
    if (!el) return;
    const mo = new MutationObserver(updateThumb);
    mo.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    return () => mo.disconnect();
  }, [scrollContainer, updateThumb]);

  // 延迟重试：处理 ref 可能延迟绑定的情况
  useEffect(() => {
    const timer = setTimeout(() => updateThumb(), 100);
    return () => clearTimeout(timer);
  }, [updateThumb]);

  // ── 路由切换同步重算 thumb（2026-08-24，二次修正）────────────────
  // 根因（实测复现）：路由切换时旧页面（高内容 → thumb 可见）卸载、新页面（如设置页）
  // 挂载。旧实现直接在 layout 阶段调 updateThumb，但此刻新页面布局未稳——
  // 旧内容刚卸载、字体/图片/异步数据未就绪，scrollHeight 会短暂「假性溢出」，
  // updateThumb 误判为可滚动 → 保留 thumb 可见；等设置页稳定变矮后，后续
  // MutationObserver 才把它隐藏。表现即「进入设置页滚动条先显示再消失」。
  // 修复：
  //  1) 路由切换瞬间在 layout 阶段先 setVisible(false)（绘制前、无过渡，CSS base
  //     规则无 opacity 过渡 → 立即消失，不闪旧页状态）。
  //  2) 置 transitioningRef 锁：过渡期内 updateThumb 不主动 setVisible(true)，
  //     屏蔽 MutationObserver/ResizeObserver/scroll 因过渡态「假性溢出」提前显示。
  //  3) 等新页面首帧布局稳定后再解锁并 updateThumb 判定真实显隐：
  //     rAF 覆盖绝大多数情况（~16ms）；setTimeout(200) 兜底 rAF 被吞
  //     （headless / 后台标签 / 节能模式，详见文件头踩坑记录）。
  const location = useLocation();
  const lastPathRef = useRef(location.pathname);
  useLayoutEffect(() => {
    if (lastPathRef.current !== location.pathname) {
      lastPathRef.current = location.pathname;
      transitioningRef.current = true;
      setVisible(false);
      const settle = () => {
        if (!transitioningRef.current) return;
        transitioningRef.current = false;
        updateThumb();
      };
      const raf = requestAnimationFrame(settle);
      const timer = setTimeout(settle, 200);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [location.pathname, updateThumb]);

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
