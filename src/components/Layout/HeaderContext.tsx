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
import { createContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useScrollContainer } from '@/hooks/useScrollContext';
import type { HeaderConfig, HeaderActionsValue, HeaderStateValue } from './types';

const HeaderActionsContext = createContext<HeaderActionsValue>({
  goHome: () => {},
  setHeaderConfig: () => () => {},
});

const HeaderStateContext = createContext<HeaderStateValue>({
  centerContent: null,
  showFilter: false,
  onFilterClick: null,
  immersive: false,
});

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [activeConfig, setActiveConfig] = useState<HeaderConfig | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const scrollContainerRef = useScrollContainer();

  const setHeaderConfig = useCallback((config: HeaderConfig) => {
    setActiveConfig(config);
    return () => {
      setActiveConfig((prev) => (prev === config ? null : prev));
    };
  }, []);

  const homeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goHome = useCallback(() => {
    const isOnHome = location.pathname === '/';
    if (!isOnHome) {
      navigate('/');
    }
    if (homeTimerRef.current) clearTimeout(homeTimerRef.current);
    homeTimerRef.current = setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }, [location.pathname, navigate, scrollContainerRef]);

  const actionsValue = useMemo<HeaderActionsValue>(
    () => ({ goHome, setHeaderConfig }),
    [goHome, setHeaderConfig],
  );

  const stateValue = useMemo<HeaderStateValue>(
    () => ({
      immersive: activeConfig?.immersive === true,
      centerContent: activeConfig?.content ?? null,
      showFilter: activeConfig?.showFilter ?? false,
      onFilterClick: activeConfig?.onFilterClick ?? null,
    }),
    [
      activeConfig?.immersive,
      activeConfig?.content,
      activeConfig?.showFilter,
      activeConfig?.onFilterClick,
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

export { HeaderActionsContext, HeaderStateContext };
