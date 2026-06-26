/**
 * 页面滚动位置恢复 Hook
 *
 * - 前进（PUSH/REPLACE）→ 重置到顶部，清除保存的位置
 * - 返回（POP）→ 恢复上次保存的位置
 * - 容器在 unmount 时从闭包保存 scrollTop（此时 DOM 可能已更新为新页面内容）
 *
 * 容器获取优先级：
 *  1. 调用方显式传入的 `containerRef`（推荐）
 *  2. 通过 ScrollContainerContext 自动获取（useScrollContainer）
 *  3. 兜底：null（不附加 listener）
 *
 * 彻底替换旧的 `document.querySelector('main')` 死代码。
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigationType } from 'react-router-dom';
import { useNavStore } from '@/stores/useNavStore';
import { useScrollContainer, type ScrollContainerRef } from './useScrollContext';

/**
 * 页面滚动位置恢复 Hook
 * 前进时重置到顶部，返回时恢复上次滚动位置
 * @param pageKey 页面唯一标识，用于存储滚动位置
 * @param containerRef 可选的滚动容器引用，不传则自动获取
 */
export function useScrollRestore(
  pageKey: string,
  containerRef?: ScrollContainerRef,
) {
  const { getState, saveState } = useNavStore();
  const fallbackRef = useScrollContainer();
  const container = containerRef ?? fallbackRef;
  const navigationType = useNavigationType();
  const saved = getState(pageKey);
  const restoredRef = useRef(false);
  const saveRef = useRef(saveState);
  saveRef.current = saveState;

  // 前进（PUSH/REPLACE）→ 重置到顶部
  useLayoutEffect(() => {
    if (navigationType === 'POP') return;
    const el = container.current;
    if (el) el.scrollTop = 0;
    saveRef.current(pageKey, { scrollTop: 0 });
  }, [navigationType, pageKey, container]);

  // 返回（POP）→ 恢复滚动位置
  // 使用 useLayoutEffect 确保在 View Transitions API 捕获新页面快照之前
  // 设置 scrollTop，避免跨页面过渡后出现位置跳变（"向上顶"问题）
  useLayoutEffect(() => {
    if (navigationType !== 'POP') return;
    if (restoredRef.current) return;
    const target = saved?.scrollTop;
    if (target == null || target <= 0) return;

    const el = container.current;
    if (!el) return;

    el.scrollTop = target;
    restoredRef.current = true;

    if (el.scrollHeight <= target + 100) {
      const ro = new ResizeObserver(() => {
        if (el.scrollHeight > target + 100) {
          el.scrollTop = target;
          ro.disconnect();
        }
      });
      ro.observe(el);
      const timeout = setTimeout(() => ro.disconnect(), 10000);
      return () => { ro.disconnect(); clearTimeout(timeout); };
    }
  }, [navigationType, saved?.scrollTop, container]);

  // 持续跟踪滚动位置，unmount 时从闭包保存
  useEffect(() => {
    const el = container.current;
    if (!el) return;

    let scrollTop = el.scrollTop;

    const handleScroll = () => {
      scrollTop = el.scrollTop;
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      el.removeEventListener('scroll', handleScroll);
      saveRef.current(pageKey, { scrollTop });
    };
  }, [pageKey, container]);
}
