/**
 * BackToTopButton — 玻璃感"返回顶部"按钮
 *
 * - 路径切换自动重置：useLocation 监听 pathname 变化，强制隐藏
 * - 进出场动画：CSS keyframe（slide-up + fade）模拟 AnimatePresence
 * - 玻璃感样式：半透明 + backdrop-filter blur + saturate（详见 BackToTopButton.css）
 * - 位置：position: fixed 固定在浏览器可视口右下角
 * - 业务回调：onVisibilityChange（可选）让父级感知可见性变化
 *
 * 注意：项目未引入 framer-motion，纯 CSS 方案更轻量。
 * 通过 `shouldRender`（DOM 中存在）+ `isExiting`（播退场动画）两个 state 协调
 * "先播 exit 动画，再从 DOM 移除" 的进出场过渡。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useScrollContainer, type ScrollContainerRef } from '@/hooks/useScrollContext';
import { useIsWideDesktop } from '@/hooks/useIsWideDesktop';
import './BackToTopButton.css';
import { Icon } from "@/components/ui/Icon";

interface BackToTopButtonProps {
  /** 自定义阈值（默认 280px） */
  threshold?: number;
  /** 自定义类名 */
  className?: string;
  /** 可见性变化回调（可选） */
  onVisibilityChange?: (visible: boolean) => void;
  /** 自定义滚动容器（不传则使用 ScrollContainerContext） */
  scrollContainerRef?: ScrollContainerRef;
}

const EXIT_DURATION_MS = 250;
/** 滚动停止多少毫秒后 FAB 才淡入（2026-09-11 用户拍板：滚动中隐藏，停止后淡入并半透明化显示） */
const SCROLL_IDLE_MS = 800;
/** 点击「顶部」的平滑滚动时长（2026-11-08 用户反馈原生 smooth 观感僵硬/各端不一致，
 *  改为固定时长 + ease-out-expo 的 rAF 动画；prefers-reduced-motion 直接跳顶） */
const SMOOTH_SCROLL_MS = 450;

export default function BackToTopButton({
  threshold = 280,
  className = '',
  onVisibilityChange,
  scrollContainerRef: customScrollRef,
}: BackToTopButtonProps) {
  const location = useLocation();
  const defaultScrollRef = useScrollContainer();
  const scrollContainerRef = customScrollRef ?? defaultScrollRef;
  // ≥1024 且非 TV：全部页面统一「方形刷新 + 方形顶部」浮层（2026-09-11 用户拍板：
  // 刷新 = 页面刷新，且不应只在首页出现 —— 组件级开关，使用方零改动自动获得）
  const isWideDesktop = useIsWideDesktop();
  const showActionStack = isWideDesktop;

  /** 用户意图：是否应该可见（基于滚动 + 路径切换） */
  const [shouldShow, setShouldShow] = useState(false);
  /** DOM 中是否真的渲染（包含退出动画期间） */
  const [shouldRender, setShouldRender] = useState(false);
  /** 退出动画定时器 ref */
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 滚动中标记（滚动进行时 FAB 淡出，停止 SCROLL_IDLE_MS 后淡入） */
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 「顶部」平滑滚动的 rAF 句柄（连续点击/卸载时取消上一轮） */
  const scrollRafRef = useRef(0);

  /** 清理退出定时器 */
  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  // 滚动监听：超过阈值显示，否则隐藏；滚动进行中标记 isScrolling（FAB 淡出），
  // 停止 SCROLL_IDLE_MS 后取消标记（FAB 淡入）——避免按钮压在滚动中的内容上
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      const v = el.scrollTop > threshold;
      setShouldShow(v);
      onVisibilityChange?.(v);
      setIsScrolling(true);
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = setTimeout(() => {
        scrollIdleTimerRef.current = null;
        setIsScrolling(false);
      }, SCROLL_IDLE_MS);
    };

    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
    };
  }, [scrollContainerRef, threshold, onVisibilityChange]);

  // 路径切换 → 强制隐藏（避免"幽灵显示"）
  useEffect(() => {
    setShouldShow(false);
    onVisibilityChange?.(false);
  }, [location.pathname, onVisibilityChange]);

  // 协调 shouldShow ↔ shouldRender（用于 enter/exit 动画）
  useEffect(() => {
    if (shouldShow) {
      // 想显示：清除任何待执行的卸载，渲染组件（CSS 自动播 enter 动画）
      clearExitTimer();
      setShouldRender(true);
    } else if (shouldRender) {
      // 想隐藏：保持渲染（播 exit 动画），动画结束后才真正卸载
      clearExitTimer();
      exitTimerRef.current = setTimeout(() => {
        setShouldRender(false);
        exitTimerRef.current = null;
      }, EXIT_DURATION_MS);
    }
  }, [shouldShow, shouldRender, clearExitTimer]);

  // 组件卸载时清理定时器与进行中的平滑滚动
  useEffect(
    () => () => {
      clearExitTimer();
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    },
    [clearExitTimer],
  );

  /** 点击「顶部」：rAF 平滑滚动（固定 450ms + ease-out-expo，各端观感一致）。
   *  原生 behavior:'smooth' 时长由浏览器自定且各端差异大（用户反馈僵硬）；
   *  用户滚轮/触摸接管时立即让位；reduced-motion 直接跳顶。 */
  const handleClick = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const from = el.scrollTop;
    if (from <= 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.scrollTop = 0;
      return;
    }
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    const t0 = performance.now();
    let interrupted = false;
    const yieldControl = () => { interrupted = true; };
    const cleanup = () => {
      el.removeEventListener('wheel', yieldControl);
      el.removeEventListener('touchstart', yieldControl);
      scrollRafRef.current = 0;
    };
    el.addEventListener('wheel', yieldControl, { passive: true });
    el.addEventListener('touchstart', yieldControl, { passive: true });
    const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const step = (now: number) => {
      if (interrupted) { cleanup(); return; }
      const p = Math.min(1, (now - t0) / SMOOTH_SCROLL_MS);
      el.scrollTop = Math.round(from * (1 - easeOutExpo(p)));
      if (p < 1) {
        scrollRafRef.current = requestAnimationFrame(step);
      } else {
        cleanup();
      }
    };
    scrollRafRef.current = requestAnimationFrame(step);
  }, [scrollContainerRef]);

  /**
   * 刷新 = 软刷新（2026-09-11 用户二次拍板：只刷新页面内容——图片、文本等重新请求，
   * 页面主体结构（Layout 壳/侧栏/顶栏/滚动容器）不重载）。
   * 由 AppLayout 监听 kino:content-refresh 后给当前路由组件换 key 重挂载实现。
   */
  const handleRefresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent('kino:content-refresh'));
  }, []);

  if (!shouldRender) return null;

  // ── ≥1024 全页面形态：方形刷新（上）+ 方形「顶部」（下）（用户 2026-09-11 截图样式）──
  // 进出场动画挂在容器上（原圆形按钮挂在按钮自身），避免两枚按钮各自 translate 观感割裂。
  if (showActionStack) {
    return createPortal(
      <div
        className={[
          'fab-stack',
          shouldShow ? 'fab-stack--visible' : 'fab-stack--exiting',
          isScrolling ? 'fab-stack--scrolling' : '',
          className,
        ].filter(Boolean).join(' ')}
      >
        <button
          type="button"
          className="fab-stack__refresh"
          onClick={handleRefresh}
          aria-label="刷新"
          title="刷新"
        >
          <Icon icon={RefreshCw} size="sm" aria-hidden="true" />
        </button>
        <button
          type="button"
          /* 复用 .back-to-top-button 基类：home.spec.ts 的「回到顶部」用例按该类名定位，
             方形形态只加修饰类，避免断言失配。 */
          className="back-to-top-button back-to-top-button--square"
          onClick={handleClick}
          aria-label="返回顶部"
          title="返回顶部"
        >
          <Icon icon={ArrowUp} size="sm" className="back-to-top-button__icon" aria-hidden="true" />
          <span className="back-to-top-button__label">顶部</span>
        </button>
      </div>,
      document.body,
    );
  }

  // 通过 Portal 挂到 document.body 顶层：
  // 滚动容器 .app-shell__scroll 带 `contain: layout`，会作为 fixed 后代的包含块，
  // 导致按钮相对滚动容器定位、随内容滚动而"飘走/消失"。挂到 body 后 fixed 真正相对视口。
  return createPortal(
    <button
      type="button"
      className={[
        'back-to-top-button',
        shouldShow ? 'back-to-top-button--visible' : 'back-to-top-button--exiting',
        className,
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      aria-label="返回顶部"
      title="返回顶部"
    >
      <Icon icon={ArrowUp} size="md" className="back-to-top-button__icon" aria-hidden="true" />
    </button>,
    document.body,
  );
}
