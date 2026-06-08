/**
 * HeaderContext — 允许页面向全局 StickyHeader 注入内容
 *
 * 拆分为两个 Context 以减少不必要的重渲染蔓延：
 * - HeaderActionsContext：稳定（所有成员均为 useCallback）,Subscriber
 *   几乎不会因为 Provider 状态变化而重渲染。
 * - HeaderStateContext：仅当 immersive / centerContent / filter 等展示态
 *   变化时才变化,Subscriber 按需订阅。
 *
 * 兼容层 `useHeaderContent(config?)` 保留在独立文件 useHeaderContent.ts
 * （满足 react-refresh/only-export-components 约束）。
 */
import { createContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useScrollContainer } from '@/hooks/useScrollContext';
import type { HeaderConfig, HeaderActionsValue, HeaderStateValue } from './types';

const HeaderActionsContext = createContext<HeaderActionsValue>({
  goHome: () => {},
  triggerHomeReset: () => {},
  setHeaderConfig: () => () => {},
});

const HeaderStateContext = createContext<HeaderStateValue>({
  centerContent: null,
  showFilter: false,
  onFilterClick: null,
  immersive: false,
  homeResetKey: 0,
});

export function HeaderProvider({ children }: { children: ReactNode }) {
  // 改用单槽存储:HomePage/DetailPage 等页面在同一时刻只有一个会注册 immersive。
  // 旧实现使用 Map + 随机 id,每次注册都新建 Map,导致 Provider value 引用变化 → 所有 subscriber 重渲染。
  // 单槽引用稳定,只在 mount/unmount 时变更。
  const [activeConfig, setActiveConfig] = useState<HeaderConfig | null>(null);
  const [homeResetKey, setHomeResetKey] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const scrollContainerRef = useScrollContainer();

  const triggerHomeReset = useCallback(() => {
    setHomeResetKey((k) => k + 1);
  }, []);

  const setHeaderConfig = useCallback((config: HeaderConfig) => {
    setActiveConfig(config);
    return () => {
      setActiveConfig((prev) => (prev === config ? null : prev));
    };
  }, []);

  const goHome = useCallback(() => {
    const isOnHome = location.pathname === '/';
    if (!isOnHome) {
      navigate('/');
      // 跨页时 reset,让 React Router 重建 HomeRoute 实例,回到「带封面的首页」。
      triggerHomeReset();
    }
    // 已在 / 时,不再 reset(HomeRoute 也不再 remount),仅滚到顶部。
    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [location.pathname, navigate, triggerHomeReset, scrollContainerRef]);

  // Actions value 永远稳定(成员均为 useCallback)
  const actionsValue = useMemo<HeaderActionsValue>(
    () => ({ goHome, triggerHomeReset, setHeaderConfig }),
    [goHome, triggerHomeReset, setHeaderConfig],
  );

  // State value 仅在展示态字段变化时变化
  const stateValue = useMemo<HeaderStateValue>(
    () => ({
      immersive: activeConfig?.immersive === true,
      centerContent: activeConfig?.content ?? null,
      showFilter: activeConfig?.showFilter ?? false,
      onFilterClick: activeConfig?.onFilterClick ?? null,
      homeResetKey,
    }),
    [
      activeConfig?.immersive,
      activeConfig?.content,
      activeConfig?.showFilter,
      activeConfig?.onFilterClick,
      homeResetKey,
    ],
  );

  return (
    <HeaderActionsContext.Provider value={actionsValue}>
      <HeaderStateContext.Provider value={stateValue}>
        {children}
      </HeaderStateContext.Provider>
    </HeaderActionsContext.Provider>
  );
}

// 从独立文件 re-export 内部 Context（供 useHeaderContent 消费）
export { HeaderActionsContext, HeaderStateContext };
