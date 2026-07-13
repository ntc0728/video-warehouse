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
import { ArrowUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useScrollContainer, type ScrollContainerRef } from '@/hooks/useScrollContext';
import './BackToTopButton.css';

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

export default function BackToTopButton({
  threshold = 280,
  className = '',
  onVisibilityChange,
  scrollContainerRef: customScrollRef,
}: BackToTopButtonProps) {
  const location = useLocation();
  const defaultScrollRef = useScrollContainer();
  const scrollContainerRef = customScrollRef ?? defaultScrollRef;

  /** 用户意图：是否应该可见（基于滚动 + 路径切换） */
  const [shouldShow, setShouldShow] = useState(false);
  /** DOM 中是否真的渲染（包含退出动画期间） */
  const [shouldRender, setShouldRender] = useState(false);
  /** 退出动画定时器 ref */
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 清理退出定时器 */
  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  // 滚动监听：超过阈值显示，否则隐藏
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      const v = el.scrollTop > threshold;
      setShouldShow(v);
      onVisibilityChange?.(v);
    };

    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
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

  // 组件卸载时清理定时器
  useEffect(() => clearExitTimer, [clearExitTimer]);

  const handleClick = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [scrollContainerRef]);

  if (!shouldRender) return null;

  return (
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
      <ArrowUp className="back-to-top-button__icon" aria-hidden="true" />
    </button>
  );
}
