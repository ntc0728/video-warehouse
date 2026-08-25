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
import { useSettingsStore, useNavStore } from '@/stores';
import { useIsTV, useIsRealMobile, useIsMobileLayout } from '@/hooks/useMediaQuery';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { isNativePlatform } from '@/lib/platform';
import { setCurrentPathname, recordPopPrevious } from '@/lib/navigation';
import { ScrollContainerContext } from '@/hooks/useScrollContext';
import { matchRoute, routeComponentMap, preloadAllRoutes } from './routeConfig';
import { getRouteTitle, APP_NAME } from '@/hooks/useDocumentTitle';

// 已访问过的路由集合（模块级，跨导航持久）。用于「二次进入」门控：已访问过的路由
// 不再重放 opacity:0 进入动画（见 animations.css 的 .page-transition[data-revisit] 规则），
// 消除方案 B（每次重新挂载）下「先空白再出现数据」的重进闪烁。首页刻意不排除——
// 其 .home-page__content 在 CSS 中被 :not() 排除，保持专属过渡。
const visitedRoutes = new Set<string>();

function LoadingFallback() {
  // 8.3B：chunk fallback 不显示进度条——进度条只由「页面自身 loading」播放一次，
  // 避免 fallback 与页面 loading 两个 AppLoading 实例各播一遍进度条（进度条重放 = 「加载两次」感知）。
  // 8.3C：记录 fallback 发生时刻（时间戳），供首页判断「刚经历过 chunk fallback」，
  // 从而跳过其固定 500ms 整页 loading（避免叠加第二次 AppLoading）。
  // 用时间戳而非布尔值：fallback 后若 1s 内未消费则视为过期（残留不影响后续页面）。
  useEffect(() => {
    window.__kinoSuspenseFallback = Date.now();
  }, []);
  return (
    <div className="page-padding page-loading page-transition-enter">
      <AppLoading showProgress={false} />
    </div>
  );
}

/**
 * 路由渲染器（方案 B：无 Keep-Alive，每次路由切换重新挂载页面组件）
 *
 * 路由切换时旧页面卸载、新页面挂载：数据回显依赖各页面的 store 缓存
 * （useTMDBStore TTL / useHomeCategoryStore / sourceManager 幂等 bootstrap /
 * IndexedDB 读取），组件内部状态（tab、筛选、滚动等）随卸载重置。
 *
 * memo 包裹：AppLayout 因侧边栏折叠/展开等状态变化而重渲染时，
 * Component 引用在 routeComponentMap 中稳定 → 已挂载页面不被牵连重渲染。
 */
const RouteRenderer = memo(function RouteRenderer({ Component }: { Component: ComponentType }) {
  return <Component />;
});

export default function AppLayout() {
  const isNative = isNativePlatform();
  const isRealMobile = useIsRealMobile();
  const isTV = useIsTV();
  const isMobileWeb = !isNative && !isTV && isRealMobile;
  // 移动端布局判断（app 端恒真 / 真实手机恒真 / <768px 窄屏）。
  // 9.1：不再用裸 max-width:767px —— app 横屏时宽度 >767 会被误判为桌面端。
  const isCompactViewport = useIsMobileLayout();
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
    // 2026-08-04 侧边栏折叠重构（方案 A''）：不再做宽度动画。
    // 折叠/展开 = 一次状态翻转（app-shell--sidebar-collapsed 类切换 --sidebar-offset），
    // spacer 与 sidebar 宽度同帧到位（仅 1 次 reflow）——右侧不卡不抖、左右缘恒定、
    // 无中间态遮挡/空白。过渡动画由非布局属性承担：图标 left 位移（收起态 absolute
    // 居中）+ label 淡出（见 HomeSidebar.css），均不触发 reflow。
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
  // appShellRef 供 useSpatialNavigation（TV 方向键空间导航）与折叠状态类绑定使用。
  // 折叠/展开不再有宽度动画：宽度由 --sidebar-offset 变量 + app-shell--sidebar-collapsed
  // 类一次性切换（瞬切，仅 1 次 reflow），过渡动画由 HomeSidebar.css 的图标 left /
  // label opacity 承担。
  const appShellRef = useRef<HTMLDivElement>(null);

  // 空闲（首屏渲染后）立即预加载所有路由 chunk：切换到未访问页面时不再出现
  // 「Suspense chunk 加载 → 页面自身 loading」的双重 AppLoading 闪烁。
  //
  // dev 模式跳过：dev 下 import() 触发逐模块 transform，12 路由 248 模块编译
  // 阻塞主线程 ~5s 白屏。dev 首屏后预加载其他路由反而拖慢后续交互。
  // production 保留：chunk 已预构建，import() 仅 fetch+eval，无编译开销。
  useEffect(() => {
    if (import.meta.env.DEV) return;
    preloadAllRoutes();
  }, []);

  const tvOverscan = useSettingsStore((s) => s.tvOverscan);

  useEffect(() => {
    const device = isTV ? 'tv' : isNative ? 'app' : isMobileWeb ? 'mobile-web' : '';
    document.documentElement.setAttribute('data-device', device);
    // 移动端布局全局标记（useIsMobileLayout：App 恒真 / 真实手机 UA 恒真 / 视口 <768px）：
    // 供全局 CSS 以「布局」而非「视口宽度」区分桌面/移动 —— App 横屏/手机桌面模式等
    // 视口可 ≥768px 仍属移动端布局，仅用 @media(max-width:767px) 会把它们误判为桌面端。
    const root = document.documentElement;
    if (isCompactViewport) root.dataset.mobileLayout = 'true';
    else delete root.dataset.mobileLayout;
  }, [isTV, isNative, isMobileWeb, isCompactViewport]);

  // TV 过扫描（overscan）安全区：预设滑块（0/5/10/15/20，单位 vw/vh）写入 CSS 变量。
  // 0 = 铺满到裁切边；兼容旧版本持久化的布尔值（true→5，false→0）及任意旧数值（吸附到最近预设）。
  useEffect(() => {
    const PRESETS = [0, 5, 10, 15, 20];
    let v: number;
    if (typeof tvOverscan !== 'number' || Number.isNaN(tvOverscan)) {
      v = tvOverscan ? 5 : 0;
    } else {
      v = PRESETS.reduce((a, b) =>
        Math.abs(b - tvOverscan) < Math.abs(a - tvOverscan) ? b : a,
      );
    }
    const root = document.documentElement;
    root.style.setProperty('--safe-area-x', `${v}vw`);
    root.style.setProperty('--safe-area-y', `${v}vh`);
  }, [tvOverscan]);

  // TV 方向键空间导航：全局接入（appShellRef 覆盖导航栏 + 页面内容区）
  useSpatialNavigation({ containerRef: appShellRef, isTV });

  useEffect(() => {
    const applyTheme = () => {
      const effective = getEffectiveTheme();
      document.documentElement.classList.add('theme-transitioning');
      document.documentElement.setAttribute('data-theme', effective);
      // 11.6：清理定时器与过渡时长（--dur-theme=200ms）对齐，避免类残留窗口过长
      setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 200);
    };
    applyTheme();
    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', applyTheme);
      return () => mql.removeEventListener('change', applyTheme);
    }
  }, [theme, getEffectiveTheme]);

  // ── 当前激活路由 ──
  const location = useLocation();
  const activePath = location.pathname;
  const activeRouteKey = useMemo(() => matchRoute(activePath), [activePath]);
  // 当前路由是否「二次进入」。首次进入为 false（播放进入动画），再进入为 true（抑制动画）。
  const isRevisit = activeRouteKey ? visitedRoutes.has(activeRouteKey) : false;
  useEffect(() => {
    if (activeRouteKey) visitedRoutes.add(activeRouteKey);
  }, [activeRouteKey]);

  // 同步当前展示路径（供 useScrollRestore 判定「从哪个页面进入」）
  useLayoutEffect(() => {
    setCurrentPathname(activePath);
  }, [activePath]);

  // 浏览器前进/后退：在新页提交前记录来源 = 当前展示页
  useEffect(() => {
    const onPop = () => recordPopPrevious();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ── 进入新页面立即更新浏览器页签标题（无需等待页面 chunk / 数据加载） ──
  // 路由切换瞬间（layout 阶段，绘制前）即写入路由名兜底标题，避免「已切到新页、
  // 页签仍显示上一页标题」的延迟体感。页面数据就绪后由 useDocumentTitle 叠加内容标题。
  // 沉浸式全屏路由（/play、/player）由页面自身的 useDocumentTitle 完全接管，此处跳过。
  useLayoutEffect(() => {
    if (!activeRouteKey) return;
    if (IMMERSIVE_ROUTES.some((r) => activePath === r || activePath.startsWith(r))) return;
    const routeTitle = getRouteTitle(activePath);
    document.title = routeTitle ? `${routeTitle} - ${APP_NAME}` : APP_NAME;
  }, [activeRouteKey, activePath]);

  // ── 全局滚动兜底：进入「无保存滚动位置」的页面时回顶 ──
  // 方案 B（无 Keep-Alive）：每次路由切换旧页面卸载、新页面挂载。若目标页没有
  // 保存过的滚动位置（首次进入 / Settings / Person / Play 等未接入 useScrollRestore
  // 的页面），容器 scrollTop 会残留上一页的深度 → 「进入页面滚动条不在初始位置」。
  // 兜底规则：目标页有保存位置 → 交由页面 useScrollRestore 恢复（不干预，避免破坏
  // 「返回时恢复上次位置」）；无保存位置 → 立即回顶。
  // 时序安全：React layout effect 子先父后，页面的 useScrollRestore 先恢复保存值，
  // 本 effect 后执行，此时读取到的 saved 已是非空，不会覆盖恢复结果。
  useLayoutEffect(() => {
    if (!activeRouteKey) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const pageKey = routeKeyToPageKey(activeRouteKey, activePath);
    const saved = useNavStore.getState().getState(pageKey)?.scrollTop;
    if (saved == null || saved <= 0) {
      el.scrollTop = 0;
    }
  }, [activeRouteKey, activePath]);

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

    // 皮肤切换时添加过渡动画类（仅用户手动切换时触发）；11.6：定时器与 --dur-theme(200ms) 对齐
    if (prevSkinRef.current !== skin) {
      document.documentElement.classList.add('skin-transitioning');
      const timer = setTimeout(() => {
        document.documentElement.classList.remove('skin-transitioning');
      }, 200);
      prevSkinRef.current = skin;
      return () => clearTimeout(timer);
    }
  }, [skin, location.search]);

  // 沉浸式（全屏播放）页面：侧边栏/顶栏不应用卡片化，保持原全屏布局
  const isImmersive = IMMERSIVE_ROUTES.some(
    (route) => activePath === route || activePath.startsWith(route),
  );

  // 进入沉浸式（全屏播放）页时自动收起左侧公共栏，离开时恢复进入前的状态，
  // 避免污染其它页面的侧边栏偏好（isImmersive 的切换沿路由变化，非全局持久）
  const prevImmersiveRef = useRef(false);
  const savedCollapsedRef = useRef(sidebarCollapsed);
  useEffect(() => {
    if (isImmersive && !prevImmersiveRef.current) {
      savedCollapsedRef.current = sidebarCollapsed;
      setSidebarCollapsed(true);
    } else if (!isImmersive && prevImmersiveRef.current) {
      setSidebarCollapsed(savedCollapsedRef.current);
    }
    prevImmersiveRef.current = isImmersive;
  }, [isImmersive, sidebarCollapsed, setSidebarCollapsed]);

  // 方案 B：只渲染当前激活路由（无 Keep-Alive 容器）。
  // 路由切换 = 卸载旧页 + 挂载新页；chunk 已由 preloadAllRoutes 预加载
  // （lazyWithRetry 缓存 Promise），Suspense 同步解析，不闪 fallback。
  const Component = activeRouteKey ? routeComponentMap[activeRouteKey] : null;

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
        {isCompactViewport && !isNative && (
          <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} isMobile />
        )}
        {!isCompactViewport && !isNative && !isTV && (
          <HomeSidebar collapsed={sidebarCollapsed} />
        )}
        <div className="app-shell__main">
          <StickyHeader
            onMenuToggle={isCompactViewport && !isNative ? toggleSidebar : undefined}
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
              <div className="page-transition" data-revisit={isRevisit ? 'true' : 'false'}>
                {Component ? (
                  <Suspense fallback={<LoadingFallback />}>
                    <RouteRenderer Component={Component} />
                  </Suspense>
                ) : null}
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

/**
 * routeKey（路径模式）→ useScrollRestore 的 pageKey 映射。
 * 有滚动位置管理的页面：home / browse / iptv / collections / history / detail:<id>；
 * 其余（settings / person / play / source-checker / iptv-play 等）无保存位置，
 * 由全局滚动兜底统一回顶。
 */
function routeKeyToPageKey(routeKey: string, activePath: string): string {
  if (routeKey === '/') return 'home';
  if (routeKey === '/detail') {
    const m = activePath.match(/^\/detail\/(.+?)(?:\?|$)/);
    return `detail:${m ? m[1] : ''}`;
  }
  return routeKey.replace(/^\//, '');
}
