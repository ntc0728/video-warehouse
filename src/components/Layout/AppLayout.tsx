import { Suspense, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { flushSync } from 'react-dom';
import { useLocation } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import TabBar from './TabBar';
import Sidebar from './Sidebar';
import HomeSidebar from './HomeSidebar';
import StickyHeader, { IMMERSIVE_ROUTES } from '@/components/StickyHeader';
import { CustomScrollbar } from '@/components/common';
import OverlayScrollbar from '@/components/common/OverlayScrollbar';
import { AppLoading } from '@/components/common';
import './Layout.css';
import { useSettingsStore } from '@/stores';
import { useIsTV, useIsRealMobile, useMediaQuery } from '@/hooks/useMediaQuery';
import { isNativePlatform } from '@/lib/platform';
import { ScrollContainerContext } from '@/hooks/useScrollContainer';
import { matchRoute, routeComponentMap, preloadAllRoutes } from './routeConfig';

function LoadingFallback() {
  return (
    <div className="page-padding page-loading page-transition-enter">
      <AppLoading />
    </div>
  );
}

const RouteRenderer = memo(function RouteRenderer({ Component }: { Component: ComponentType }) {
  return <Component />;
});

export default function AppLayout() {
  const isNative = isNativePlatform();
  const isRealMobile = useIsRealMobile();
  const isTV = useIsTV();
  const isMobileWeb = !isNative && !isTV && isRealMobile;
  const isCompactViewport = useMediaQuery('(max-width: 767px)');
  const theme = useSettingsStore((s) => s.theme);
  const getEffectiveTheme = useSettingsStore((s) => s.getEffectiveTheme);
  const skin = useSettingsStore((s) => s.skin);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'; }
    catch { return false; }
  });
  const toggleSidebarCollapsed = useCallback(() => {
    const next = !sidebarCollapsed;

    const appShell = appShellRef.current;
    if (!appShell) {
      setSidebarCollapsed(next);
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return;
    }

    if (sidebarAnimRef.current) {
      sidebarAnimRef.current.forEach((a) => a.cancel());
      sidebarAnimRef.current = null;
    }

    const styles = getComputedStyle(appShell);
    const widthExpanded = parseFloat(styles.getPropertyValue('--sidebar-width'));
    const widthCollapsed = parseFloat(styles.getPropertyValue('--sidebar-width-collapsed'));
    if (!isFinite(widthExpanded) || !isFinite(widthCollapsed) || widthExpanded <= 0 || widthCollapsed <= 0) {
      setSidebarCollapsed(next);
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return;
    }
    const delta = widthExpanded - widthCollapsed;

    const spacer = appShell.querySelector<HTMLElement>('.sidebar-spacer');
    const sidebar = appShell.querySelector<HTMLElement>('.home-sidebar');
    const main = appShell.querySelector<HTMLElement>('.app-shell__main');
    if (!spacer || !sidebar || !main) {
      setSidebarCollapsed(next);
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return;
    }

    const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';
    const duration = 240;
    const negDelta = `translateX(${-delta}px)`;
    const zero = 'translateX(0)';

    let animations: Animation[];
    if (next) {
      const keyframes = [{ transform: zero }, { transform: negDelta }];
      animations = [
        spacer.animate(keyframes, { duration, easing, fill: 'forwards' }),
        sidebar.animate(keyframes, { duration, easing, fill: 'forwards' }),
        main.animate(keyframes, { duration, easing, fill: 'forwards' }),
      ];
      sidebarAnimRef.current = animations;
      animations[0].onfinish = () => {
        spacer.style.transform = '';
        sidebar.style.transform = '';
        main.style.transform = '';
        setSidebarCollapsed(true);
        try { localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true'); } catch { /* ignore */ }
        sidebarAnimRef.current = null;
      };
    } else {
      spacer.style.transform = negDelta;
      sidebar.style.transform = negDelta;
      main.style.transform = negDelta;
      flushSync(() => {
        setSidebarCollapsed(false);
        try { localStorage.setItem(SIDEBAR_STORAGE_KEY, 'false'); } catch { /* ignore */ }
      });
      requestAnimationFrame(() => {
        const keyframes = [{ transform: negDelta }, { transform: zero }];
        animations = [
          spacer.animate(keyframes, { duration, easing, fill: 'forwards' }),
          sidebar.animate(keyframes, { duration, easing, fill: 'forwards' }),
          main.animate(keyframes, { duration, easing, fill: 'forwards' }),
        ];
        sidebarAnimRef.current = animations;
        animations[0].onfinish = () => {
          spacer.style.transform = '';
          sidebar.style.transform = '';
          main.style.transform = '';
          sidebarAnimRef.current = null;
        };
      });
    }

    const cleanup = () => {
      spacer.style.transform = '';
      sidebar.style.transform = '';
      main.style.transform = '';
      sidebarAnimRef.current = null;
    };
    if (sidebarAnimRef.current) {
      sidebarAnimRef.current[0].oncancel = cleanup;
    }
  }, [sidebarCollapsed]);

    useEffect(() => {
      if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const appShellRef = useRef<HTMLDivElement>(null);
  const sidebarAnimRef = useRef<Animation[] | null>(null);
  const pageTransitionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    preloadAllRoutes();
  }, []);

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

  const location = useLocation();
  const activePath = location.pathname;
  const activeRouteKey = useMemo(() => matchRoute(activePath), [activePath]);

  useLayoutEffect(() => {
    if (!activeRouteKey) return;
    const container = pageTransitionRef.current;
    if (!container) return;
    const wrapper = container.querySelector<HTMLElement>(
      `[data-route="${activeRouteKey}"]`,
    );
    if (!wrapper) return;
    const targets = wrapper.querySelectorAll<HTMLElement>(
      '[class*="page-transition-enter"], [class*="page-transition-enter"] > *',
    );
    targets.forEach((target) => {
      target.style.animation = 'none';
      void target.offsetWidth;
      target.style.animation = '';
    });
  }, [activeRouteKey]);

  const prevSkinRef = useRef(skin);
  useEffect(() => {
    const urlSkin = new URLSearchParams(location.search).get('skin');
    const valid = ['default', 'cartoon', 'mechanical', 'retro'] as const;
    const effective = (urlSkin && (valid as readonly string[]).includes(urlSkin) ? urlSkin : skin) as string;

    if (effective && effective !== 'default') {
      document.documentElement.setAttribute('data-skin', effective);
    } else {
      document.documentElement.removeAttribute('data-skin');
    }

    if (prevSkinRef.current !== skin) {
      document.documentElement.classList.add('skin-transitioning');
      const timer = setTimeout(() => {
        document.documentElement.classList.remove('skin-transitioning');
      }, 500);
      prevSkinRef.current = skin;
      return () => clearTimeout(timer);
    }
  }, [skin, location.search]);

  const noKeepAliveRef = useRef(new Set(['/play']));
  const noKeepAlive = noKeepAliveRef.current;

  const [visitedRoutes] = useState(() => new Set<string>());
  if (activeRouteKey && !noKeepAlive.has(activeRouteKey) && !visitedRoutes.has(activeRouteKey)) {
    visitedRoutes.add(activeRouteKey);
  }

  const visitedSize = visitedRoutes.size;
  const visitedRouteKeys = useMemo(
    () => Array.from(visitedRoutes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visitedRoutes, visitedSize],
  );

  const isImmersive = IMMERSIVE_ROUTES.some(
    (route) => activePath === route || activePath.startsWith(route),
  );

  return (
    <Tooltip.Provider delayDuration={200}>
      <ScrollContainerContext.Provider value={scrollContainerRef}>
        <div
        ref={appShellRef}
        className={`app-shell${activePath === '/' ? ' app-shell--home' : ''}${isImmersive ? ' app-shell--immersive' : ''}${sidebarCollapsed && !isCompactViewport && !isNative && !isTV ? ' app-shell--sidebar-collapsed' : ''}`}
        style={{
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
        }}
      >
        {isCompactViewport && (
          <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} isMobile />
        )}
        {!isCompactViewport && !isNative && !isTV && (
          <HomeSidebar collapsed={sidebarCollapsed} />
        )}
        <div className="app-shell__main">
          <StickyHeader
            onMenuToggle={isCompactViewport ? toggleSidebar : undefined}
            menuOpen={isCompactViewport && sidebarOpen}
            onSidebarToggle={!isCompactViewport && !isNative && !isTV ? toggleSidebarCollapsed : undefined}
            sidebarCollapsed={sidebarCollapsed}
          />
          <div className="app-shell__scroll-wrapper">
            <CustomScrollbar
              ref={scrollContainerRef}
              className="app-shell__scroll"
              style={{ backgroundColor: 'var(--color-background)' }}
              direction="vertical"
            >
              <div className="page-transition" ref={pageTransitionRef}>
                {visitedRouteKeys.map((routeKey) => {
                  const Component = routeComponentMap[routeKey];
                  if (!Component) return null;
                  const isActive = routeKey === activeRouteKey;
                  return (
                    <div
                      key={routeKey}
                      style={{ display: isActive ? 'contents' : 'none' }}
                      data-route={routeKey}
                    >
                      <Suspense fallback={<LoadingFallback />}>
                        <RouteRenderer Component={Component} />
                      </Suspense>
                    </div>
                  );
                })}
                {activeRouteKey && noKeepAlive.has(activeRouteKey) && (() => {
                  const Component = routeComponentMap[activeRouteKey];
                  if (!Component) return null;
                  return (
                    <div key={activePath} data-route={activeRouteKey}>
                      <Suspense fallback={<LoadingFallback />}>
                        <RouteRenderer Component={Component} />
                      </Suspense>
                    </div>
                  );
                })()}
                <div id="load-more-portal" />
              </div>
            </CustomScrollbar>
            <OverlayScrollbar scrollContainer={scrollContainerRef} />
          </div>
          {isNative && <TabBar />}
        </div>
      </div>
    </ScrollContainerContext.Provider>
    </Tooltip.Provider>
  );
}
