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
import { useSettingsStore, useKeepAliveStore, useNavStore } from '@/stores';
import { useIsTV, useIsRealMobile, useIsMobileLayout } from '@/hooks/useMediaQuery';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { isNativePlatform } from '@/lib/platform';
import { ScrollContainerContext } from '@/hooks/useScrollContext';
import { matchRoute, routeComponentMap, preloadAllRoutes } from './routeConfig';
import { ActiveRouteContext, SelfRouteContext } from '@/hooks/routeTitleContext';
import { getRouteTitle, APP_NAME } from '@/hooks/useDocumentTitle';

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
  // Keep-Alive 二次进入动画重放所需的容器引用（见下方 useLayoutEffect）
  const pageTransitionRef = useRef<HTMLDivElement>(null);

  // 空闲（首屏渲染后）立即预加载所有路由 chunk：切换到未访问页面时不再出现
  // 「Suspense chunk 加载 → 页面自身 loading」的双重 AppLoading 闪烁。
  // 不再等待 requestIdleCallback（最长 3s）/ setTimeout(1500ms)，避免用户在首屏后
  // 的窗口期内点击分类页仍命中未缓存 chunk 而触发两次 AppLoading。
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
  }, [isTV, isNative, isMobileWeb]);

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

  // ── Keep-Alive: 跟踪已访问的路由 ──
  const location = useLocation();
  const activePath = location.pathname;
  const activeRouteKey = useMemo(() => matchRoute(activePath), [activePath]);

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

  // ── 全局滚动兜底：进入「无保存滚动位置」的页面时回顶 ──
  // Keep-Alive 下所有页面共享同一个滚动容器（CustomScrollbar）。若进入的页面没有
  // 保存过的滚动位置（首次进入 / Settings / Person / Play 等未接入 useScrollRestore
  // 的页面），容器的 scrollTop 会残留上一页的深度 → 「进入页面滚动条不在初始位置」。
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

  // 不使用 Keep-Alive 的路由（静态 Set，避免每次渲染创建）
  const noKeepAliveRef = useRef(new Set(['/play']));
  const noKeepAlive = noKeepAliveRef.current;

  // 有限 Keep-Alive：detail 仅在点播放进入 /play 时被 pin 挂起（见 useKeepAliveStore），
  // 其他路由仍走「访问即常驻」。isCacheable 决定某路由本次是否应被缓存。
  const pinnedDetailId = useKeepAliveStore((s) => s.pinnedDetailId);
  const isCacheable = (routeKey: string): boolean => {
    if (routeKey === '/detail') return pinnedDetailId !== null;
    return !noKeepAlive.has(routeKey);
  };

  // 已访问过的路由集合（排除本次不应缓存的路由）
  // 直接 mutate Set 不触发重渲染——首次访问时父级 useLocation 已触发渲染,
  // 此次渲染即可读到新加的 key;后续切回该路由时 location 变化同样会触发渲染
  const [visitedRoutes] = useState(() => new Set<string>());
  if (activeRouteKey && isCacheable(activeRouteKey) && !visitedRoutes.has(activeRouteKey)) {
    visitedRoutes.add(activeRouteKey);
  }

  // 统一渲染列表：常驻路由（display 切换）+ 当前激活但非常驻路由（每次重新挂载）。
  // detail 在两种模式下 key 都含 id（detail:${id}），pin 切换时 key 一致 → React 复用
  // 同一实例（不 remount）；不同 id 的 detail 则 key 不同 → 重新挂载并重新加载。
  const detailIdFromPath = (p: string): string | null => {
    const m = p.match(/^\/detail\/(.+?)(?:\?|$)/);
    return m ? m[1] : null;
  };
  const visitedSize = visitedRoutes.size;
  const renderNodes = useMemo(() => {
    const nodes: { key: string; routeKey: string; cacheable: boolean }[] = [];
    for (const routeKey of visitedRoutes) {
      if (routeKey === '/detail') {
        if (pinnedDetailId === null) continue; // 未 pin 的 detail 不常驻
        const id = detailIdFromPath(activePath) ?? pinnedDetailId;
        nodes.push({ key: `detail:${id}`, routeKey, cacheable: true });
      } else {
        nodes.push({ key: routeKey, routeKey, cacheable: true });
      }
    }
    // 有限 Keep-Alive 兜底：被 pin 的 detail 在「detail → /play」切换瞬间可能尚未进入
    // visitedRoutes —— visitedRoutes 仅在「激活且可缓存」时写入，而 pinDetail 与离开路由
    // 几乎同时发生、那一帧 activeRouteKey 已变为 /play，导致 detail 节点被整体移除、detail
    // 组件卸载、其 cleanup 触发 unpinDetail，最终从 /play 返回时 detail 重挂载并重置 tab / 重拉数据。
    // 因此只要 pinnedDetailId 非空，强制保留 detail 节点（挂起态），保证实例不被卸载。
    if (pinnedDetailId !== null && !nodes.some((n) => n.routeKey === '/detail')) {
      const id = detailIdFromPath(activePath) ?? pinnedDetailId;
      nodes.push({ key: `detail:${id}`, routeKey: '/detail', cacheable: true });
    }
    // 当前激活但非常驻的路由：直接渲染（key 含 path/id，确保不同实例重新挂载）
    if (activeRouteKey && !isCacheable(activeRouteKey)) {
      const key = activeRouteKey === '/detail'
        ? `detail:${detailIdFromPath(activePath) ?? ''}`
        : activePath;
      if (!nodes.some((n) => n.key === key)) {
        nodes.push({ key, routeKey: activeRouteKey, cacheable: false });
      }
    }
    return nodes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitedRoutes, visitedSize, activeRouteKey, activePath, pinnedDetailId]);

  // ── 有限 Keep-Alive：离开 detail 且非「返回 /play」时解除 pin ──
  // 这样 detail → home / browse / 另一个 detail 等「其他情况」都会让 detail 不再常驻
  // （卸载并重新加载），而 detail → /play → detail 则保持 pin，返回时瞬时恢复。
  const prevRouteKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const from = prevRouteKeyRef.current;
    const to = activeRouteKey;
    if (from === '/detail' && to !== '/play') {
      useKeepAliveStore.getState().unpinDetail();
    }
    prevRouteKeyRef.current = to;
  }, [activeRouteKey]);

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
              {/* Keep-Alive 容器：常驻路由保持挂载仅切换 CSS 可见性；
                  非常驻路由（未 pin 的 detail / /play 等）每次重新挂载 */}
              <ActiveRouteContext.Provider value={activeRouteKey}>
                <div className="page-transition" ref={pageTransitionRef}>
                  {renderNodes.map(({ key, routeKey, cacheable }) => {
                    // 直接查 routeComponentMap（routeKey 已是合法 key），避免每次都走 matchRoute 遍历
                    const Component = routeComponentMap[routeKey];
                    if (!Component) return null;
                    const isActive = routeKey === activeRouteKey;
                    // 常驻且非激活 → display:none（挂起）；否则 display:contents
                    const display = cacheable && !isActive ? 'none' : 'contents';
                    return (
                      <div
                        key={key}
                        style={{ display }}
                        data-route={routeKey}
                      >
                        <SelfRouteContext.Provider value={routeKey}>
                          <Suspense fallback={<LoadingFallback />}>
                            <RouteRenderer Component={Component} />
                          </Suspense>
                        </SelfRouteContext.Provider>
                      </div>
                    );
                  })}
                  <div id="load-more-portal" />
                </div>
              </ActiveRouteContext.Provider>
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
