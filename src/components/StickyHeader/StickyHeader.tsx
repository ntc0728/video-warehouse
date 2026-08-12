/**
 * StickyHeader — 全局顶部导航栏
 * 半透明背景 + 阴影，Logo + 左右导航 + 主题切换 + 中央搜索框。
 * 首页滚动距离 >= --header-height 时切换为实体背景（仅首页生效）。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import { Star, Clock, Settings, Sun, Moon, Monitor, Menu, X, PanelLeftClose, PanelLeftOpen, Tv, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useIsTV, useIsMobileLayout } from '@/hooks/useMediaQuery';
import { useSettingsStore } from '@/stores';
import { isNativePlatform } from '@/lib/platform';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { usePageSearchStore } from '@/stores/usePageSearchStore';
import SearchBox from '@/components/SearchBox';
import KinoTVLogo from '@/assets/icon/KinoTV.webp';
import './StickyHeader.css';
import { Icon } from "@/components/ui/Icon";

interface NavItem { key: string; title: string; icon: LucideIcon; path: string; }

const RIGHT_NAV_ITEMS: NavItem[] = [
  { key: 'collections', title: '收藏', icon: Star, path: '/collections' },
  { key: 'history', title: '历史', icon: Clock, path: '/history' },
];

/** TV 模式在顶部导航栏补充 IPTV 入口（侧边栏在 TV 模式下隐藏，需经顶栏可达） */
const TV_NAV_ITEMS: NavItem[] = [{ key: 'iptv', title: 'IPTV', icon: Tv, path: '/iptv' }];

/** 设置入口：桌面 web 已迁入 HomeSidebar 底部；TV 无侧边栏，保留顶栏入口 */
const SETTINGS_NAV_ITEM: NavItem = { key: 'settings', title: '设置', icon: Settings, path: '/settings' };

const THEME_ICONS = [Sun, Moon, Monitor] as const;
const THEME_CYCLE: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];

interface StickyHeaderProps {
  onMenuToggle?: () => void;
  menuOpen?: boolean;
  onSidebarToggle?: () => void;
  sidebarCollapsed?: boolean;
}

/** 沉浸式页面路由前缀：播放页（hero 透明叠加）
 *  首页 / 详情页已改为非沉浸式：header 静态常驻，banner / hero 不再被覆盖
 *  导出供 AppLayout 同步判断（决定侧边栏/顶栏是否应用卡片化，避免破坏全屏播放页） */
export const IMMERSIVE_ROUTES = ['/play', '/player'];

/** 顶部搜索框历史作用域：不同页面的搜索历史互不影响 */
export function getSearchScope(pathname: string): string {
  const p = pathname.split('?')[0];
  if (p === '/iptv' || p.startsWith('/iptv/')) return 'iptv';
  if (p === '/settings' || p.startsWith('/settings/')) return 'settings';
  if (p === '/collections' || p.startsWith('/collections/')) return 'collections';
  if (p === '/history' || p.startsWith('/history/')) return 'history';
  if (p === '/browse' || p.startsWith('/browse/')) return 'browse';
  if (p === '/person' || p.startsWith('/person/')) return 'person';
  if (p === '/detail' || p.startsWith('/detail/')) return 'detail';
  return 'global';
}

/** 这些页面顶部搜索框下拉不显示热门搜索 */
const HOT_SEARCH_DISABLED_PAGES = ['/collections', '/history', '/iptv', '/settings'];
function isHotSearchDisabled(pathname: string): boolean {
  const p = pathname.split('?')[0];
  return HOT_SEARCH_DISABLED_PAGES.some((base) => p === base || p.startsWith(base + '/'));
}

export default function StickyHeader({ onMenuToggle, menuOpen, onSidebarToggle, sidebarCollapsed }: StickyHeaderProps) {
  const isTV = useIsTV();
  // 移动端布局判断：与 AppLayout 一致（app 端恒真 / 真实手机恒真 / <768px 窄屏）。
  // 9.1：不再用裸 max-width:767px —— app 横屏时宽度 >767 会被误判为桌面。
  const isMobile = useIsMobileLayout();
  // 9.1：app 端导航由底部 TabBar 承担，汉堡菜单按钮（+ 移动 Sidebar）对 app 隐藏
  const isNative = isNativePlatform();
  const navigate = useCustomNavigate();
  const location = useLocation();
  // 使用 selector 订阅,只跟踪需要的字段,避免设置 store 任意变更都触发重渲染
  const currentTheme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  // 个人资料（移动 web 顶栏头像 + 用户名入口）
  const username = useSettingsStore((s) => s.username);
  const avatar = useSettingsStore((s) => s.avatar);
  const { goHome } = useHeaderContent();

  // 沉浸式模式：基于当前路由判断（不再依赖页面组件通过 setHeaderConfig 设置，
  // 因为 Keep-Alive 模式下多个页面同时挂载会互相覆盖 immersive 值）
  const immersive = IMMERSIVE_ROUTES.some(
    (route) => route === '/' ? location.pathname === '/' : location.pathname.startsWith(route),
  );

  const handleNavClick = useCallback((path: string) => {
    if (path === '/') {
      goHome();
    } else {
      navigate(path);
    }
  }, [navigate, goHome]);

  // ── 统一右键菜单（logo 与右侧导航项共用，含"在新标签页中打开链接"） ──
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  // 打开右键菜单：e.clientX/clientY 定位，targetPath 为新标签页要打开的地址
  const openContextMenu = useCallback((e: React.MouseEvent, targetPath: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path: targetPath });
  }, []);
  // logo 右键 → 打开首页
  const handleLogoContextMenu = useCallback((e: React.MouseEvent) => {
    openContextMenu(e, '/');
  }, [openContextMenu]);
  // 导航项右键 → 打开该项路径
  const handleNavContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    openContextMenu(e, path);
  }, [openContextMenu]);

  // 点击菜单项：新开页签打开对应链接
  const openInNewTab = useCallback(() => {
    if (!contextMenu) return;
    window.open(contextMenu.path, '_blank', 'noopener');
    setContextMenu(null);
  }, [contextMenu]);

  // 点击其他区域 / 按 Esc 时关闭菜单
  useEffect(() => {
    if (!contextMenu) return;
    const onDocDown = (e: MouseEvent) => {
      const el = e.target as Node;
      if (el instanceof HTMLElement && el.closest('.sticky-header__logo-context-menu')) return;
      setContextMenu(null);
    };
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onDocKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onDocKey);
    };
  }, [contextMenu]);

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  // ── 滚动检测：仅首页监听滚动距离，超过 --header-height 切换为实体背景 ──
  // 滚动容器是 AppLayout 的 CustomScrollbar（不是 window）；用 useScrollContainer 拿 ref
  const scrollContainerRef = useScrollContainer();
  const isHome = location.pathname === '/';
  const isPlayer = location.pathname.startsWith('/play');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!isHome && !isPlayer) {
      setIsScrolled(false);
      return;
    }
    // Player 页有自己的滚动容器，导航栏始终实体背景
    if (isPlayer) {
      setIsScrolled(true);
      return;
    }
    const el = scrollContainerRef.current;
    if (!el) return;

    // 缓存头部高度，避免在每个滚动事件中重复计算
    const cs = getComputedStyle(el);
    const v = cs.getPropertyValue('--header-height').trim();
    const headerHeight = v ? parseFloat(v) : ((document.querySelector('.sticky-header') as HTMLElement | null)?.offsetHeight ?? 64);

    const onScroll = () => {
      setIsScrolled(el.scrollTop >= headerHeight);
    };

    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
    };
  }, [isHome, isPlayer, scrollContainerRef]);

  const handleThemeToggle = useCallback(() => {
    const idx = THEME_CYCLE.indexOf(currentTheme);
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  }, [currentTheme, setTheme]);

  const ThemeIcon = THEME_ICONS[THEME_CYCLE.indexOf(currentTheme)] || Monitor;

  const renderNavItem = (item: NavItem) => {
    const onClick = item.path === '/' ? goHome : () => handleNavClick(item.path);
    return (
      <a
        key={item.key}
        href={item.path}
        className={`sticky-header__nav-item${isActive(item.path) ? ' sticky-header__nav-item--active' : ''}`}
        onClick={(e) => { e.preventDefault(); onClick(); }}
        onContextMenu={(e) => handleNavContextMenu(e, item.path)}
        title={item.title}
      >
        <Icon icon={item.icon} size={isTV ? 'md' : 'sm'} /><span className="sticky-header__nav-label">{item.title}</span>
      </a>
    );
  };

  const pageSearch = usePageSearchStore();

  // 路由切换时同步清空搜索状态（useLayoutEffect 确保在浏览器绘制前完成）
  // 各页面的 useEffect 会在新路由下重新注册自己的回调和搜索词
  const prevPathnameRef = useRef(location.pathname);
  useLayoutEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname;
      usePageSearchStore.getState().clearPageSearch();
    }
  }, [location.pathname]);

  // 顶部搜索框历史作用域 + 热门搜索开关（按当前路由派生）
  const searchScope = getSearchScope(location.pathname);
  const showHotSearch = !isHotSearchDisabled(location.pathname);

  // 侧边栏展开/收起按钮防抖：忽略 300ms 内的连续点击，避免快速连点导致状态抖动
  const lastSidebarToggleRef = useRef(0);
  const handleSidebarToggle = useCallback(() => {
    const now = Date.now();
    if (now - lastSidebarToggleRef.current < 300) return;
    lastSidebarToggleRef.current = now;
    onSidebarToggle?.();
  }, [onSidebarToggle]);

  return (
    <header
      className={`sticky-header${immersive ? ' sticky-header--immersive' : ''}${isTV ? ' sticky-header--tv' : ''}${isScrolled ? ' sticky-header--scrolled' : ''}`}
    >
      <div className="sticky-header__inner">
        <div className="sticky-header__left">
          {isMobile && !isNative ? (
            <button className="sticky-header__menu-btn" onClick={onMenuToggle} aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'}>
              {menuOpen ? <Icon icon={X} size="md" /> : <Icon icon={Menu} size="md" />}
            </button>
          ) : (
            onSidebarToggle && (
              <button
                className="sticky-header__sidebar-toggle"
                onClick={handleSidebarToggle}
                aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
              >
                {sidebarCollapsed ? <Icon icon={PanelLeftOpen} size="md" /> : <Icon icon={PanelLeftClose} size="md" />}
              </button>
            )
          )}
          <button className="sticky-header__logo-group no-interaction-visual" onClick={goHome} onContextMenu={handleLogoContextMenu} aria-label="kinoTv — 返回首页">
            <div className="sticky-header__logo-wrap">
              <img className="sticky-header__logo" src={KinoTVLogo} alt="kinoTv" draggable={false} />
            </div>
            <div className="sticky-header__brand">
              <span className="sticky-header__brand-name">kinoTV</span>
            </div>
          </button>
        </div>
        <div className="sticky-header__center">
          {/* 移动端/桌面端统一：中央常驻搜索框（不再有"点击搜索按钮展开"的临时搜索模式） */}
          <SearchBox
            key={location.pathname}
            variant="header"
            className="sticky-header__search"
            defaultValue={pageSearch.search || undefined}
            onSearch={pageSearch.onSearch ?? undefined}
            placeholder={pageSearch.placeholder}
            showHotSearch={showHotSearch}
            scope={searchScope}
          />
        </div>
        <div className="sticky-header__right">
          <nav className="sticky-header__nav" aria-label="次要导航">
            {isTV && TV_NAV_ITEMS.map(renderNavItem)}
            {RIGHT_NAV_ITEMS.map(renderNavItem)}
            {/* 设置入口：仅 TV 保留顶栏（桌面 web 已迁入 HomeSidebar 底部） */}
            {isTV && renderNavItem(SETTINGS_NAV_ITEM)}
          </nav>
          {/* 个人设置入口（头像 + 用户名）→ /settings?tab=personal：
             设置页深链自动打开个人设置子页。渲染范围：移动 web（isMobile）+
             桌面 web（!isTV，桌面设置入口在顶栏最右侧）；app 端导航由底部 TabBar
             承担、TV 端保留顶栏「设置」文字入口（无侧边栏），均不渲染本按钮 */}
          {!isTV && !isNative && (
            <button
              type="button"
              className="sticky-header__profile"
              onClick={() => navigate('/settings?tab=personal')}
              aria-label="个人设置"
              title={username.trim() || '未设置昵称'}
            >
              <span className="sticky-header__profile-avatar">
                {avatar ? <img src={avatar} alt="" /> : <Icon icon={User} size="sm" />}
              </span>
              <span className="sticky-header__profile-name">{username.trim() || '未设置昵称'}</span>
            </button>
          )}
          <button className="sticky-header__theme-btn" onClick={handleThemeToggle} aria-label={`当前主题：${currentTheme}，点击切换`} title={`主题：${currentTheme}`}>
            <Icon icon={ThemeIcon} size="lg" />
          </button>
        </div>
      </div>

      {/* 统一右键菜单（logo / 右侧导航项共用）：在新标签页中打开链接 */}
      {contextMenu && (
        <div
          className="sticky-header__logo-context-menu"
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button type="button" role="menuitem" className="sticky-header__logo-context-item" onClick={openInNewTab}>
            在新标签页中打开链接
          </button>
        </div>
      )}
    </header>
  );
}
