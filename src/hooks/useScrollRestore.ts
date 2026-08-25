/**
 * 页面滚动位置恢复 Hook（Keep-Alive 版）
 *
 * 适配 AppLayout 的 Keep-Alive 容器：页面组件保持挂载，仅切换 CSS 可见性。
 *
 * 行为：
 * - 本页变为「可见路由」(isActive: false → true) 时，恢复上次保存的位置（每次可见期只恢复一次）。
 * - 本页隐藏 (isActive → false) 时清空恢复守卫，使下次再次可见时能重新恢复。
 * - 仅当本页可见时才持续持久化滚动位置，避免 Keep-Alive 下隐藏页篡改共享容器的滚动状态。
 *
 * 容器获取优先级：
 *  1. 调用方显式传入的 `containerRef`（推荐）
 *  2. 通过 ScrollContainerContext 自动获取（useScrollContainer）
 *  3. 兜底：null（不附加 listener）
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useNavStore } from '@/stores/useNavStore';
import { useScrollContainer, type ScrollContainerRef } from './useScrollContext';
import { getPreviousPathname } from '@/lib/navigation';

/** 允许恢复滚动位置的来源路由前缀（如 ['detail', 'play'] 表示仅从详情/播放页进入时恢复）。 */
export type RestoreFrom = Array<'detail' | 'play' | 'collections' | 'history' | 'browse' | 'home' | 'iptv'>;

export function useScrollRestore(
  pageKey: string,
  containerRef?: ScrollContainerRef,
  isActive = true,
  options?: { restoreFrom?: RestoreFrom },
) {
  const { getState, saveState } = useNavStore();
  const fallbackRef = useScrollContainer();
  const container = containerRef ?? fallbackRef;
  const saveRef = useRef(saveState);
  saveRef.current = saveState;
  const restoreFromRef = useRef(options?.restoreFrom);
  restoreFromRef.current = options?.restoreFrom;
  // 本轮「可见期」是否已恢复，避免可见期内重复恢复
  const restoredRef = useRef(false);

  // 持续跟踪滚动位置（仅本页可见时持久化），并在隐藏/卸载时最终保存一次
  useEffect(() => {
    const el = container.current;
    if (!el) return;

    let last = el.scrollTop;
    const handleScroll = () => {
      last = el.scrollTop;
      if (isActive) saveRef.current(pageKey, { scrollTop: last });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      el.removeEventListener('scroll', handleScroll);
      // 仅在本页仍可见时保存，避免隐藏页持久化共享容器的当前（可能是别的页的）滚动位置
      if (isActive) saveRef.current(pageKey, { scrollTop: last });
    };
  }, [pageKey, container, isActive]);

  // 本页变为可见时恢复保存的位置（每次可见期只恢复一次）
  // options.restoreFrom 存在时：仅当来源路径命中允许列表才恢复，否则重置到顶部。
  //   例：收藏页仅「从 detail/play 进入」时恢复滚动条，其余（侧栏/首页进入）重置。
  useLayoutEffect(() => {
    if (!isActive) {
      // 隐藏时清空守卫，下次可见能重新恢复
      restoredRef.current = false;
      return;
    }
    if (restoredRef.current) return;

    const from = getPreviousPathname();
    const allowed = restoreFromRef.current;
    const shouldRestore = !allowed || allowed.some((r) => from != null && from.startsWith('/' + r));

    const el = container.current;
    if (!shouldRestore) {
      // 不符合恢复条件：直接回顶，不读取/恢复保存位置
      if (el) el.scrollTop = 0;
      restoredRef.current = true;
      return;
    }

    const target = getState(pageKey)?.scrollTop;
    if (target == null || target <= 0) {
      // 无保存位置时也标记已恢复，避免反复尝试
      restoredRef.current = true;
      return;
    }

    if (!el) return;

    el.scrollTop = target;
    restoredRef.current = true;
  }, [isActive, pageKey, container, getState]);
}
