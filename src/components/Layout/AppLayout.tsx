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
import { useSettingsStore, useKeepAliveStore } from '@/stores';
import { useIsTV, useIsRealMobile, useMediaQuery } from '@/hooks/useMediaQuery';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { isNativePlatform } from '@/lib/platform';
import { ScrollContainerContext } from '@/hooks/useScrollContext';
import { matchRoute, routeComponentMap, preloadAllRoutes } from './routeConfig';
import { ActiveRouteContext, SelfRouteContext } from '@/hooks/routeTitleContext';
import { getRouteTitle, APP_NAME } from '@/hooks/useDocumentTitle';

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

    // 统一对称流程（折叠/展开共用同一段代码）：
    // 1. 读取侧栏当前真实宽度（含动画中间态）作为新动画起点 → 支持「动画中途反向」平滑续接
    // 2. 摘除旧动画回调后再 cancel——WAAPI 的 cancel/finish 事件是异步派发的，
    //    若不摘除，旧回调会在新动画启动后才触发 finishCleanup，把新动画连带 cancel 掉，
    //    表现为「刚收起立即点展开 → 侧栏无过渡瞬间弹出」（历史 bug 根因）
    // 3. inline width 钉在起点 → flushSync 立即翻转状态（collapsed 类即时切换：
    //    折叠时标题瞬时消失「干脆感」；展开时标题立即恢复、随宽度展开被 overflow 揭示）
    // 4. 下一帧 WAAPI width 起点 → 终点，onfinish 清理交还 CSS
    // 注意：绝不对 app-shell__main 施加 transform——transform 会创建 containing block，
    //   导致其内部 position:fixed 的顶栏（.sticky-header）随 main 一起位移。
    const appShell = appShellRef.current;
    if (!appShell) {
      // 容器未挂载（如移动端不渲染 HomeSidebar），直接切状态
      setSidebarCollapsed(next);
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return;
    }

    const spacer = appShell.querySelector<HTMLElement>('.sidebar-spacer');
    const sidebar = appShell.querySelector<HTMLElement>('.home-sidebar');
    if (!spacer || !sidebar) {
      setSidebarCollapsed(next);
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return;
    }

    // 清理 inline 残留样式（中断与收尾共用）
    const clearInline = () => {
      appShell
        .querySelectorAll<HTMLElement>(
          '.sidebar-spacer, .home-sidebar, .app-shell__main, .home-sidebar__nav, .home-sidebar__label',
        )
        .forEach((el) => {
          el.style.transform = '';
          el.style.opacity = '';
          el.style.width = '';
        });
    };

    // 必须在 cancel 之前读取：动画进行中读到的是 WAAPI 中间宽度（反向续接起点），
    // 静止时读到的就是当前状态的 CSS 宽度。
    const currentWidth = sidebar.getBoundingClientRect().width;

    // 中断上一轮：摘回调 → cancel → 清 inline；并取消尚未执行的启动 rAF，
    // 防止旧 rAF 在新一轮之后触发、用过期起点重启动画。
    if (sidebarRafRef.current !== null) {
      cancelAnimationFrame(sidebarRafRef.current);
      sidebarRafRef.current = null;
    }
    if (sidebarAnimRef.current) {
      sidebarAnimRef.current.forEach((a) => {
        a.onfinish = null;
        a.oncancel = null;
        a.cancel();
      });
      sidebarAnimRef.current = null;
      clearInline();
    }

    // 读取两个状态的真实像素宽度。注意：--sidebar-width 是 clamp(...) 表达式，
    // getPropertyValue 返回的是声明字符串而非计算 px，parseFloat 会得到 NaN，会触发
    // 下方提前 return、导致动画被完全跳过（侧栏仍瞬切、但无任何过渡）。
    // 因此用临时探测元素测量 var() 的实际计算宽度，与当前折叠状态无关、且响应式准确。
    const measureWidthVar = (name: string): number => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;width:var(' + name + ');';
      appShell.appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      appShell.removeChild(probe);
      return w;
    };
    const widthExpanded = measureWidthVar('--sidebar-width');
    const widthCollapsed = measureWidthVar('--sidebar-width-collapsed');
    if (!isFinite(widthExpanded) || !isFinite(widthCollapsed) || widthExpanded <= 0 || widthCollapsed <= 0) {
      // 变量读取失败，回退到直接切状态
      setSidebarCollapsed(next);
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return;
    }

    const from = isFinite(currentWidth) && currentWidth > 0
      ? currentWidth
      : (next ? widthExpanded : widthCollapsed);
    const to = next ? widthCollapsed : widthExpanded;

    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const duration = 480;
    const animOpts = { duration, easing, fill: 'forwards' as const };

    // 收尾：释放 WAAPI fill（否则持续覆盖 CSS）+ 清除 inline，让 collapsed/expanded
    // 类的 CSS 完整接管。图标视觉坐标因 sidebar 固定 left:0、仅右缘收拢而全程恒定，
    // onfinish 无可见跳变。cancel 前摘回调，避免异步 cancel 事件二次进入。
    const finishCleanup = () => {
      if (sidebarAnimRef.current) {
        sidebarAnimRef.current.forEach((a) => {
          a.onfinish = null;
          a.oncancel = null;
          a.cancel();
        });
        sidebarAnimRef.current = null;
      }
      clearInline();
    };

    // 步骤1：inline width 钉在起点（静止=当前状态宽 / 中断=动画中间宽），视觉无跳变。
    spacer.style.width = `${from}px`;
    sidebar.style.width = `${from}px`;
    // 步骤2：flushSync 立即翻转 React 状态 → collapsed 类即时切换：
    //   折叠：标题瞬时 opacity:0（「一按折叠、文字立刻消失」的干脆感）；
    //   展开：标题立即恢复可见，被 inline 起点宽 overflow 裁切、随展开逐步揭示。
    //   目标态 CSS width 被 inline width 覆盖，视觉仍停在起点位（无跳变）。
    //   状态即时翻转还保证连点时 next 方向永远正确（不再依赖 onfinish 才翻转）。
    flushSync(() => {
      setSidebarCollapsed(next);
    });
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch { /* ignore */ }
    // 步骤3：下一帧 width 起点 → 终点（真实收缩/展开），main 由 flex 自然填充（无 transform）。
    sidebarRafRef.current = requestAnimationFrame(() => {
      sidebarRafRef.current = null;
      const animations = [
        spacer.animate([{ width: `${from}px` }, { width: `${to}px` }], animOpts),
        sidebar.animate([{ width: `${from}px` }, { width: `${to}px` }], animOpts),
      ];
      sidebarAnimRef.current = animations;
      // 动画结束：释放 fill + 清 inline（CSS 目标态 width:var(--sidebar-offset) 接管，无跳变）
      animations[0].onfinish = () => {
        finishCleanup();
      };
    });
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
  // 折叠/展开动画由 JS WAAPI 控制：
  // - sidebar / spacer：直接对 width 做 WAAPI 动画（真实收缩/展开，可见的过渡），
  //   因侧栏仅有少量导航项、spacer 为空占位，reflow 代价极小。
  // - app-shell__main：不施加 transform（避免其内部 fixed 顶栏位移），由 flex 自然填充。
  // - 图标天然不动：sidebar 固定 left:0，width 变化只动右缘，左缘与图标坐标恒定。
  // - 状态（collapsed 类）在动画开始前即翻转（文字瞬时显隐），动画结束后释放 fill + 清 inline，
  //   CSS（width:var(--sidebar-offset)）接管。
  const appShellRef = useRef<HTMLDivElement>(null);
  const sidebarAnimRef = useRef<Animation[] | null>(null);
  // 步骤3 启动动画的 rAF id：连点中断时需 cancel，防止旧 rAF 用过期起点重启动画
  const sidebarRafRef = useRef<number | null>(null);
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

  // TV 方向键空间导航：全局接入（appShellRef 覆盖导航栏 + 页面内容区）
  useSpatialNavigation({ containerRef: appShellRef, isTV });

  useEffect(() => {
    const applyTheme = () => {
      const effective = getEffectiveTheme();
      document.documentElement.classList.add('theme-transitioning');
      document.documentElement.setAttribute('data-theme', effective);
      setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 500);
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
