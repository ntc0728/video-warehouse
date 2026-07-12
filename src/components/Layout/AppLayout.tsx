import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import TabBar from './TabBar';
import Sidebar from './Sidebar';
import HomeSidebar from './HomeSidebar';
import StickyHeader, { IMMERSIVE_ROUTES } from '@/components/StickyHeader';
import { CustomScrollbar } from '@/components/common';
import OverlayScrollbar from '@/components/common/OverlayScrollbar';
import { AppLoading } from '@/components/common';
import './Layout.css';
import { useSettingsStore } from '@/stores';
import { useIsTV, useIsRealMobile } from '@/hooks/useMediaQuery';
import { isNativePlatform } from '@/lib/platform';
import { ScrollContainerContext } from '@/hooks/useScrollContext';
import { matchRoute, getRouteComponent } from './routeConfig';

function LoadingFallback() {
  return (
    <div className="page-padding">
      <AppLoading />
    </div>
  );
}

/**
 * 路由级 Keep-Alive 容器
 *
 * 核心思路：所有已访问的页面组件保持挂载，通过 CSS display 切换可见性。
 * 路由切换时无需 unmount/remount，消除了组件初始化、滚动监听器重建、
 * 图片预加载等开销，解决首页 ↔ IPTV 切换卡顿问题。
 *
 * 与旧实现（Outlet）的区别：
 * - 旧：每次路由切换 unmount 旧页 + mount 新页（含 lazy chunk 加载 + 全量初始化）
 * - 新：首次访问时 mount + 后续切换仅 CSS display 切换（~1ms）
 */
export default function AppLayout() {
  const isNative = isNativePlatform();
  const isRealMobile = useIsRealMobile();
  const isTV = useIsTV();
  const isMobileWeb = !isNative && !isTV && isRealMobile;
  // 桌面端（非移动 web / 非原生 App / 非 TV）：显示全局常驻左侧栏
  const isDesktopWeb = !isMobileWeb && !isNative && !isTV;
  const theme = useSettingsStore((s) => s.theme);
  const getEffectiveTheme = useSettingsStore((s) => s.getEffectiveTheme);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

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
      setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
    };
    applyTheme();
    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', applyTheme);
      return () => mql.removeEventListener('change', applyTheme);
    }
  }, [theme, getEffectiveTheme]);

  // ── Keep-Alive: 跟踪已访问的路由 ──
  const location = useLocation();
  const activePath = location.pathname;
  const activeRouteKey = useMemo(() => matchRoute(activePath), [activePath]);

  // 已访问过的路由集合（一旦访问，永不移除）
  const [visitedRoutes] = useState(() => new Set<string>());
  if (activeRouteKey && !visitedRoutes.has(activeRouteKey)) {
    visitedRoutes.add(activeRouteKey);
  }

  // 沉浸式（全屏播放）页面：侧边栏/顶栏不应用卡片化，保持原全屏布局
  const isImmersive = IMMERSIVE_ROUTES.some(
    (route) => activePath === route || activePath.startsWith(route),
  );

  return (
    <ScrollContainerContext.Provider value={scrollContainerRef}>
      <div
        className={`app-shell${activePath === '/' ? ' app-shell--home' : ''}${isImmersive ? ' app-shell--immersive' : ''}`}
        style={{
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
        }}
      >
        {isMobileWeb && (
          <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} isMobile />
        )}
        {isDesktopWeb && <HomeSidebar />}
        <div className="app-shell__main">
          <StickyHeader onMenuToggle={isMobileWeb ? toggleSidebar : undefined} menuOpen={isMobileWeb && sidebarOpen} />
          <div className="app-shell__scroll-wrapper">
            <CustomScrollbar
              ref={scrollContainerRef}
              className="app-shell__scroll"
              style={{ backgroundColor: 'var(--color-background)' }}
              direction="vertical"
            >
              {/* Keep-Alive 容器：所有已访问的页面组件保持挂载，仅切换 CSS 可见性 */}
              <div className="page-transition">
                {Array.from(visitedRoutes).map((routeKey) => {
                  const Component = getRouteComponent(routeKey);
                  if (!Component) return null;
                  const isActive = routeKey === activeRouteKey;
                  return (
                    <div
                      key={routeKey}
                      style={{ display: isActive ? 'contents' : 'none' }}
                      data-route={routeKey}
                    >
                      <Suspense fallback={<LoadingFallback />}>
                        <Component />
                      </Suspense>
                    </div>
                  );
                })}
                <div id="load-more-portal" />
              </div>
            </CustomScrollbar>
            <OverlayScrollbar scrollContainer={scrollContainerRef} />
          </div>
          {isNative && <TabBar />}
        </div>
      </div>
    </ScrollContainerContext.Provider>
  );
}
