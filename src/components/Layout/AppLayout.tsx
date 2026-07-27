import { Suspense, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';
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
import { ScrollContainerContext } from '@/hooks/useScrollContext';
import { matchRoute, routeComponentMap, preloadAllRoutes } from './routeConfig';

function LoadingFallback() {
  return (
    <div className="page-padding page-loading page-transition-enter">
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
// 记忆化路由渲染器：Component 引用在 routeComponentMap 中稳定，
// 用 memo 包裹后，AppLayout 因侧边栏折叠/展开等状态变化而重渲染时，
// 已挂载的 Keep-Alive 页面（首页等重型页面）不会被牵连重渲染，避免切换卡顿。
const RouteRenderer = memo(function RouteRenderer({ Component }: { Component: ComponentType }) {
  return <Component />;
});

export default function AppLayout() {
  const isNative = isNativePlatform();
  const isRealMobile = useIsRealMobile();
  const isTV = useIsTV();
  const isMobileWeb = !isNative && !isTV && isRealMobile;
  // 平板端以下（< 768px）使用移动端 overlay sidebar，≥ 768px 使用桌面端常驻侧边栏
  const isCompactViewport = useMediaQuery('(max-width: 767px)');
  const theme = useSettingsStore((s) => s.theme);
  const getEffectiveTheme = useSettingsStore((s) => s.getEffectiveTheme);
  const skin = useSettingsStore((s) => s.skin);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  // ── HomeSidebar 展开/收起状态（持久化到 localStorage） ──
  const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'; }
    catch { return false; }
  });
  const toggleSidebarCollapsed = useCallback(() => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch { /* ignore */ }
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
  // 折叠/展开不再用 JS 动画：.sidebar-spacer 与 .home-sidebar 各自 width transition 平滑过渡
  // （见 Layout.css / HomeSidebar.css），main 跟随 flex 自动重排。内容右缘始终贴浏览器右缘、
  // 左缘随侧栏平滑内移，无 transform 造假 → 无右侧空隙、无回弹、无跳动。
  // Keep-Alive 二次进入动画重放所需的容器引用（见下方 useLayoutEffect）
  const pageTransitionRef = useRef<HTMLDivElement>(null);

  // 空闲（首屏渲染后）立即预加载所有路由 chunk：切换到未访问页面时不再出现
  // 「Suspense chunk 加载 → 页面自身 loading」的双重 AppLoading 闪烁。
  // 不再等待 requestIdleCallback（最长 3s）/ setTimeout(1500ms)，避免用户在首屏后
  // 的窗口期内点击分类页仍命中未缓存 chunk 而触发两次 AppLoading。
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

  // ── Keep-Alive: 跟踪已访问的路由 ──
  const location = useLocation();
  const activePath = location.pathname;
  const activeRouteKey = useMemo(() => matchRoute(activePath), [activePath]);

  // ── Keep-Alive 二次进入：重放页面进入动画 ──
  // 根容器的 CSS animation 在 Keep-Alive 的 display 切换下不会自动重放——元素本身保持
  // 挂载，仅祖先容器在 display:none ↔ contents 间切换，元素自身的 display 从未变过，
  // 故浏览器不会重启其 animation。每当 activeRouteKey 变化（含二次进入）手动重放。
  // 覆盖所有页面根容器（不仅 .page-transition-enter）：Browse(.browse-page) /
  // IPTV(.iptv-content) / Settings(.settings-page) 各有独立进入动画，此前二次进入
  // 不会重放，本次一并纳入。
  // 重放手法：对命中的元素执行「animation:none → 强制同步 reflow → 还原」，
  // 可重启任意 CSS animation（含 page-enter-fade / browse-fade-in /
  // iptv-content-fade-in / settings-page-fade-in），且不依赖具体类名。
  // 尊重无障碍：相关动画已在各自 CSS 内对 prefers-reduced-motion 禁用，还原后无可见效果。
  useLayoutEffect(() => {
    if (!activeRouteKey) return;
    const container = pageTransitionRef.current;
    if (!container) return;
    const wrapper = container.querySelector<HTMLElement>(
      `[data-route="${activeRouteKey}"]`,
    );
    if (!wrapper) return;
    const targets = wrapper.querySelectorAll<HTMLElement>(
      '.page-transition-enter, .browse-page, .iptv-content, .settings-page',
    );
    targets.forEach((target) => {
      target.style.animation = 'none';
      void target.offsetWidth; // 强制 reflow 以重放动画
      target.style.animation = '';
    });
  }, [activeRouteKey]);

  // ── 美术资源皮肤：应用 data-skin 到 <html>（支持 ?skin= 覆盖，便于截图验收） ──
  const prevSkinRef = useRef(skin);
  useEffect(() => {
    const urlSkin = new URLSearchParams(location.search).get('skin');
    const valid = ['default', 'cartoon', 'mechanical', 'retro'] as const;
    const effective = (urlSkin && (valid as readonly string[]).includes(urlSkin) ? urlSkin : skin) as string;

    // 始终设置/移除 data-skin 属性
    if (effective && effective !== 'default') {
      document.documentElement.setAttribute('data-skin', effective);
    } else {
      document.documentElement.removeAttribute('data-skin');
    }

    // 皮肤切换时添加过渡动画类（仅用户手动切换时触发）
    if (prevSkinRef.current !== skin) {
      document.documentElement.classList.add('skin-transitioning');
      const timer = setTimeout(() => {
        document.documentElement.classList.remove('skin-transitioning');
      }, 500);
      prevSkinRef.current = skin;
      return () => clearTimeout(timer);
    }
  }, [skin, location.search]);

  // 不使用 Keep-Alive 的路由（静态 Set，避免每次渲染创建）
  const noKeepAliveRef = useRef(new Set(['/play']));
  const noKeepAlive = noKeepAliveRef.current;

  // 已访问过的路由集合（排除 noKeepAlive 路由）
  // 直接 mutate Set 不触发重渲染——首次访问时父级 useLocation 已触发渲染,
  // 此次渲染即可读到新加的 key;后续切回该路由时 location 变化同样会触发渲染
  const [visitedRoutes] = useState(() => new Set<string>());
  if (activeRouteKey && !noKeepAlive.has(activeRouteKey) && !visitedRoutes.has(activeRouteKey)) {
    visitedRoutes.add(activeRouteKey);
  }

  // 缓存 visitedRoutes 数组：仅在 Set 内容变化时重建，避免每次渲染都 Array.from
  // size 作为依赖：新增路由时 size 变化触发重算
  const visitedSize = visitedRoutes.size;
  const visitedRouteKeys = useMemo(
    () => Array.from(visitedRoutes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visitedRoutes, visitedSize],
  );

  // 沉浸式（全屏播放）页面：侧边栏/顶栏不应用卡片化，保持原全屏布局
  const isImmersive = IMMERSIVE_ROUTES.some(
    (route) => activePath === route || activePath.startsWith(route),
  );

  return (
    <Tooltip.Provider delayDuration={200}>
      <ScrollContainerContext.Provider value={scrollContainerRef}>
        <div
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
              {/* Keep-Alive 容器：所有已访问的页面组件保持挂载，仅切换 CSS 可见性 */}
              <div className="page-transition" ref={pageTransitionRef}>
                {visitedRouteKeys.map((routeKey) => {
                  // 直接查 routeComponentMap（routeKey 已是合法 key），避免每次都走 matchRoute 遍历
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
                {/* noKeepAlive 路由：直接渲染，不缓存 */}
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
