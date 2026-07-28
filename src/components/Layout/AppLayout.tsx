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

    // 方案 B 改进版：双向 transform 补偿，消除展开时右侧空白跳动。
    // 核心思路：动画期间 main 始终保持「铺满视口」的宽度，用 transform 平移产生视觉位移。
    //
    // 折叠（next=true）：
    //   1. 加 --animating（冻结 width=展开），main width 不变
    //   2. spacer/sidebar/main transform: 0 → -delta（main 向左滑，右侧 delta 内容被 overflow 裁掉，无空白）
    //   3. 动画结束：切 --sidebar-collapsed（width=collapsed）+ 清 transform
    //
    // 展开（next=false）：
    //   1. 切 --sidebar-collapsed（width=展开，main 瞬间变宽，1 次 reflow）
    //      同时 main transform 瞬时设 -delta（把变宽的 main 推回 collapsed 视觉位置）
    //      → 用户看到的是 main 仍贴在 collapsed 位置，无跳动
    //   2. spacer/sidebar/main transform: -delta → 0（main 向右滑出，始终铺满视口）
    //   3. 动画结束：清 transform
    const appShell = appShellRef.current;
    if (!appShell) {
      // 容器未挂载（如移动端不渲染 HomeSidebar），直接切状态
      setSidebarCollapsed(next);
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return;
    }

    // 取消正在进行的动画
    if (sidebarAnimRef.current) {
      sidebarAnimRef.current.forEach((a) => a.cancel());
      sidebarAnimRef.current = null;
    }

    // 读取 CSS 变量计算 delta
    const styles = getComputedStyle(appShell);
    const widthExpanded = parseFloat(styles.getPropertyValue('--sidebar-width'));
    const widthCollapsed = parseFloat(styles.getPropertyValue('--sidebar-width-collapsed'));
    if (!isFinite(widthExpanded) || !isFinite(widthCollapsed) || widthExpanded <= 0 || widthCollapsed <= 0) {
      // 变量读取失败，回退到直接切状态
      setSidebarCollapsed(next);
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return;
    }
    const delta = widthExpanded - widthCollapsed;

    // 三个目标元素：sidebar-spacer、home-sidebar、app-shell__main
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
      // ── 折叠方向 ──
      // 动画期间 width 不变（展开值），transform 0 → -delta
      // main 向左滑，右侧 delta 内容被 app-shell overflow:hidden 裁掉，无空白
      const keyframes = [{ transform: zero }, { transform: negDelta }];
      animations = [
        spacer.animate(keyframes, { duration, easing, fill: 'forwards' }),
        sidebar.animate(keyframes, { duration, easing, fill: 'forwards' }),
        main.animate(keyframes, { duration, easing, fill: 'forwards' }),
      ];
      sidebarAnimRef.current = animations;
      // 动画结束：切类（width=collapsed）+ 清 transform
      animations[0].onfinish = () => {
        spacer.style.transform = '';
        sidebar.style.transform = '';
        main.style.transform = '';
        setSidebarCollapsed(true);
        try { localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true'); } catch { /* ignore */ }
        sidebarAnimRef.current = null;
      };
    } else {
      // ── 展开方向 ──
      // 步骤1：先把三个元素 transform 设到 -delta（此时 width 还是 collapsed）
      //   spacer width=collapsed + transform=-delta → 视觉上滑到视口外
      //   main width=窄 + transform=-delta → main 左缘对齐视口左缘，但右缘短 delta（临时空白）
      spacer.style.transform = negDelta;
      sidebar.style.transform = negDelta;
      main.style.transform = negDelta;
      // 步骤2：用 flushSync 同步更新 React 状态 → DOM 立即移除 --sidebar-collapsed 类
      //   spacer width 变宽（展开值），main width 变宽（flex:1 跟随）
      //   此时 main width=铺满视口 + transform=-delta → main 左缘对齐 collapsed 位置
      //   右侧 delta 内容超出视口被 overflow 裁掉——无空白、无跳动
      flushSync(() => {
        setSidebarCollapsed(false);
        try { localStorage.setItem(SIDEBAR_STORAGE_KEY, 'false'); } catch { /* ignore */ }
      });
      // 步骤3：下一帧 transform -delta → 0（main 向右滑出，始终铺满视口）
      requestAnimationFrame(() => {
        const keyframes = [{ transform: negDelta }, { transform: zero }];
        animations = [
          spacer.animate(keyframes, { duration, easing, fill: 'forwards' }),
          sidebar.animate(keyframes, { duration, easing, fill: 'forwards' }),
          main.animate(keyframes, { duration, easing, fill: 'forwards' }),
        ];
        sidebarAnimRef.current = animations;
        // 动画结束清 transform
        animations[0].onfinish = () => {
          spacer.style.transform = '';
          sidebar.style.transform = '';
          main.style.transform = '';
          sidebarAnimRef.current = null;
        };
      });
    }

    // 异常取消：清理 transform
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
  // 方案 B（transform 补偿）：折叠/展开动画由 JS WAAPI 控制，避免 width transition
  // 每帧触发 reflow（首页 49 张卡片 grid 重排导致卡顿）。
  // - 动画期间：sidebar-spacer / home-sidebar / app-shell__main 三者由 WAAPI transform 平移，
  //   width 由 --sidebar-collapsed 类（CSS 变量驱动、无 transition）保持冻结，0 reflow。
  // - 折叠：onfinish 时切 --sidebar-collapsed 类一次性收窄 width（1 次 reflow，动画已结束不可见）；
  //   展开：flushSync 先切 --sidebar-collapsed 类立即变宽，再 WAAPI transform 从 -delta 滑入 0。
  const appShellRef = useRef<HTMLDivElement>(null);
  const sidebarAnimRef = useRef<Animation[] | null>(null);
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
  //
  // 统一选择器：所有页面进入动画都用 .page-transition-enter* 三套变体（默认/--fade/--stagger），
  // 不再有 .browse-page / .iptv-content / .settings-page 等页面自定义动画类。
  // stagger 变体的子元素（.page-transition-enter--stagger > *）也带 animation，需一并重放。
  //
  // 重放手法：对命中的元素执行「animation:none → 强制同步 reflow → 还原」，
  // 可重启任意 CSS animation，且不依赖具体类名。
  // 尊重无障碍：相关动画已在 animations.css 内对 prefers-reduced-motion 禁用，还原后无可见效果。
  useLayoutEffect(() => {
    if (!activeRouteKey) return;
    const container = pageTransitionRef.current;
    if (!container) return;
    const wrapper = container.querySelector<HTMLElement>(
      `[data-route="${activeRouteKey}"]`,
    );
    if (!wrapper) return;
    // 匹配带 page-transition-enter 类的元素（含 --fade / --stagger 变体），
    // 以及 stagger 变体的直接子元素（子元素也带 animation 需重放）
    const targets = wrapper.querySelectorAll<HTMLElement>(
      '[class*="page-transition-enter"], [class*="page-transition-enter"] > *',
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
