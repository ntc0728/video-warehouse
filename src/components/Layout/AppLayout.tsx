import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';
import Sidebar from './Sidebar';
import RouteTransition from './RouteTransition';
import StickyHeader from '@/components/StickyHeader';
import { useHeaderContent } from './useHeaderContent';
import { CustomScrollbar } from '@/components/common';
import OverlayScrollbar from '@/components/common/OverlayScrollbar';
import './Layout.css';
import { useSettingsStore } from '@/stores';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { isNativePlatform } from '@/lib/platform';
import { ScrollContainerContext } from '@/hooks/useScrollContext';

export default function AppLayout() {
  const isNative = isNativePlatform();
  const isMobile = useIsMobile();
  const isTV = useIsTV();
  const isMobileWeb = !isNative && !isTV && isMobile;
  // 使用 selector 订阅,避免设置 store 任意字段变化都触发 AppLayout 整树重渲染
  const theme = useSettingsStore((s) => s.theme);
  const getEffectiveTheme = useSettingsStore((s) => s.getEffectiveTheme);
  const { immersive } = useHeaderContent();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  // 侧边栏打开时锁定背景滚动
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // 滚动容器 ref — 通过 ScrollContainerContext 共享给所有子页面，
  // 替代旧的 `document.querySelector('main')` 死代码。
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const device = isTV ? 'tv' : isNative ? 'app' : isMobileWeb ? 'mobile-web' : '';
    document.documentElement.setAttribute('data-device', device);
  }, [isTV, isNative, isMobileWeb]);

  useEffect(() => {
    const applyTheme = () => {
      const effective = getEffectiveTheme();
      document.documentElement.classList.add('theme-transitioning');
      document.documentElement.setAttribute('data-theme', effective);
      // 移除 class 时长略大于 CSS 过渡时长(0.3s),确保过渡完成后再移除
      setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
    };
    applyTheme();
    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', applyTheme);
      return () => mql.removeEventListener('change', applyTheme);
    }
  }, [theme, getEffectiveTheme]);

  return (
    <ScrollContainerContext.Provider value={scrollContainerRef}>
      {/*
        三段式垂直布局（桌面：header / scroll；移动：header / scroll / tabbar）：
        - StickyHeader 移出 CustomScrollbar，作为 grid 第一行常驻视口顶部。
        - CustomScrollbar 顶在 StickyHeader 下方，thumb 真实起点 = StickyHeader 底部，
          不再被导航栏覆盖（不论 immersive 或非 immersive 页面）。
        - immersive 模式下 StickyHeader 改用 position: fixed（不占文档流），
          CustomScrollbar 仍紧贴视口顶部，StickyHeader 浮在 hero 之上。
      */}
      <div
        className="app-shell"
        style={{
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
        }}
      >
        {isMobileWeb && (
          <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} isMobile />
        )}
        <StickyHeader immersive={immersive} onMenuToggle={isMobileWeb ? toggleSidebar : undefined} menuOpen={isMobileWeb && sidebarOpen} />
        <div className="app-shell__scroll-wrapper">
          <CustomScrollbar
            ref={scrollContainerRef}
            className="app-shell__scroll"
            style={{ backgroundColor: 'var(--color-background)' }}
            direction="vertical"
          >
            {/* 注意:此处不再使用 key={location.pathname} 强制 unmount Outlet 子树。
                旧实现会让每次切页都重 mount HomePage,触发 fetchAllHomeData + 20 张图预加载,
                是首页/IPTV 切换卡顿的主要根因。CSS 动画 (.page-transition) 仍生效。
                主动重置首页的场景由 HomeRoute 的 key={homeResetKey} 单独处理。 */}
            <div className="page-transition">
              <RouteTransition>
                <Outlet />
              </RouteTransition>
              <div id="load-more-portal" />
            </div>
          </CustomScrollbar>
          <OverlayScrollbar scrollContainer={scrollContainerRef} />
        </div>
        {isNative && <TabBar />}
      </div>
    </ScrollContainerContext.Provider>
  );
}
