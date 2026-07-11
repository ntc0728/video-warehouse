/**
 * useCollapseOnScroll — 滚动折叠状态
 *
 * 监听指定滚动容器的 scrollTop，超过阈值返回 collapsed=true。
 * 用于移动端 M6 方案：页顶完整态 → 向下滚动收缩成吸顶精简栏。
 *
 * - 使用 requestAnimationFrame 节流，避免 scroll 高频触发 setState
 * - 带滞后区间（hysteresis）防止在阈值附近抖动反复切换
 * - effect 清理监听；容器 ref 由 useScrollContainer() 提供（Keep-Alive 下稳定）
 */
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

interface CollapseOptions {
  /** 折叠触发阈值（向下滚动超过该像素后折叠） */
  collapseAt?: number;
  /** 展开触发阈值（向上滚回该像素内后展开），应 <= collapseAt */
  expandAt?: number;
}

export function useCollapseOnScroll(
  scrollRef: RefObject<HTMLElement | null>,
  { collapseAt = 96, expandAt = 48 }: CollapseOptions = {},
): boolean {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const top = el.scrollTop;
      setCollapsed((prev) => {
        if (!prev && top > collapseAt) return true;
        if (prev && top < expandAt) return false;
        return prev;
      });
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef, collapseAt, expandAt]);

  return collapsed;
}

export default useCollapseOnScroll;
