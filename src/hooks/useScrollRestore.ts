/**
 * 页面滚动位置恢复 Hook（Keep-Alive 版）
 *
 * 适配 AppLayout 的 Keep-Alive 容器：页面组件保持挂载，仅切换 CSS 可见性。
 *
 * 行为：
 * - 前进（PUSH/REPLACE）→ 不自动重置到顶部（由页面组件自行处理，如 DetailPage
 *   在 useEffect 中监听 id 变化后 scrollToTop）
 * - 返回（POP）→ 恢复上次保存的位置
 * - 路由切换时 → 自动保存当前页面的滚动位置到 navStore
 *
 * 容器获取优先级：
 *  1. 调用方显式传入的 `containerRef`（推荐）
 *  2. 通过 ScrollContainerContext 自动获取（useScrollContainer）
 *  3. 兜底：null（不附加 listener）
 */
import { useEffect, useRef } from 'react';
import { useNavigationType, useLocation } from 'react-router-dom';
import { useNavStore } from '@/stores/useNavStore';
import { useScrollContainer, type ScrollContainerRef } from './useScrollContext';

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

  // 跟踪当前路径，用于路由切换时保存滚动位置
  const location = useLocation();
  const pathRef = useRef(location.pathname);

  // 返回（POP）→ 恢复滚动位置
  // 使用 useLayoutEffect 确保在浏览器绘制前设置 scrollTop
  useEffect(() => {
    if (navigationType !== 'POP') return;
    if (restoredRef.current) return;
    const target = saved?.scrollTop;
    if (target == null || target <= 0) return;

    const el = container.current;
    if (!el) return;

    el.scrollTop = target;
    restoredRef.current = true;
  }, [navigationType, saved?.scrollTop, container]);

  // 路由切换时保存当前页面的滚动位置
  // Keep-Alive 模式下组件不会 unmount，需要在路由变化时主动保存
  useEffect(() => {
    // 更新路径引用（下一次路由变化时，cleanup 会用到这个值）
    pathRef.current = location.pathname;
    // 捕获当前容器引用，避免 cleanup 时读到已变化的 ref
    const el = container.current;

    return () => {
      // cleanup：路由即将切换，保存当前页面的滚动位置
      if (el) {
        saveRef.current(pageKey, { scrollTop: el.scrollTop });
      }
    };
  }, [location.pathname, pageKey, container]);

  // 持续跟踪滚动位置，组件卸载时最终保存一次
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
