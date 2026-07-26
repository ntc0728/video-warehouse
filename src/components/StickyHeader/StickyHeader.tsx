/**
 * StickyHeader — 全局顶部导航栏
 * 半透明背景 + 阴影，Logo + 左右导航 + 主题切换 + 中央搜索框。
 * 首页滚动距离 >= --header-height 时切换为实体背景（仅首页生效）。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Star, Clock, Settings, Sun, Moon, Monitor, Menu, X, Search, ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useIsTV, useMediaQuery } from '@/hooks/useMediaQuery';
import { useSettingsStore } from '@/stores';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { usePageSearchStore } from '@/stores/usePageSearchStore';
import SearchBox from '@/components/SearchBox';
import KinoTVLogo from '@/assets/icon/KinoTV.webp';
import './StickyHeader.css';

interface NavItem { key: string; title: string; icon: React.ReactNode; path: string; }

const RIGHT_NAV_ITEMS: NavItem[] = [
  { key: 'collections', title: '收藏', icon: <Star size={18} />, path: '/collections' },
  { key: 'history', title: '历史', icon: <Clock size={18} />, path: '/history' },
  { key: 'settings', title: '设置', icon: <Settings size={18} />, path: '/settings' },
];

/** 移动端进入这些页面时，顶部导航栏中央显示对应标题（非搜索模式） */
const PAGE_TITLES: Record<string, string> = {
  '/browse': '搜索中心',
  '/iptv': 'IPTV',
  '/collections': '收藏',
  '/history': '历史记录',
  '/settings': '设置',
};

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
  const theme = useThemeMode();
  const isTV = useIsTV();
  // 移动端断点与 AppLayout 一致：< 768px 使用 hamburger 菜单，≥ 768px 使用侧边栏折叠按钮
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isCompact = useMediaQuery('(max-width: 767px)');
  const navigate = useNavigate();
  const location = useLocation();
  // 使用 selector 订阅,只跟踪需要的字段,避免设置 store 任意变更都触发重渲染
  const currentTheme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const { goHome } = useHeaderContent();

  // 移动端搜索模式（基于视口宽度）
  const [isSearchMode, setIsSearchMode] = useState(false);

  const handleSearchModeToggle = useCallback(() => {
    setIsSearchMode(true);
  }, []);

  const handleSearchModeExit = useCallback(() => {
    setIsSearchMode(false);
    // 清空搜索词
    usePageSearchStore.getState().clearPageSearch();
  }, []);

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
        title={item.title}
      >
        {item.icon}<span className="sticky-header__nav-label">{item.title}</span>
      </a>
    );
  };

  const pageSearch = usePageSearchStore();

  const handleMobileSearch = useCallback((query: string) => {
    if (pageSearch.onSearch) {
      pageSearch.onSearch(query);
    } else {
      // 与 SearchBox 默认行为一致：用 location.state 传搜索词，
      // 避免仅用 ?q= 查询参数导致 BrowsePage（只读 state.q）丢失搜索词
      navigate('/browse', { state: { q: query } });
    }
  }, [pageSearch.onSearch, navigate]);

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

  // 移动端：根据当前路由派生顶部中央要显示的页面标题（仅列出的页面）
  const pageTitle = useMemo(() => {
    const base = location.pathname.split('?')[0];
    if (PAGE_TITLES[base]) return PAGE_TITLES[base];
    const key = Object.keys(PAGE_TITLES).find((k) => base.startsWith(`${k}/`));
    return key ? PAGE_TITLES[key] : undefined;
  }, [location.pathname]);

  return (
    <header
      className={`sticky-header${immersive ? ' sticky-header--immersive' : ''}${isTV ? ' sticky-header--tv' : ''}${isScrolled ? ' sticky-header--scrolled' : ''}`}
      data-theme={theme}
    >
      <div className="sticky-header__inner">
        <div className="sticky-header__left">
          {isMobile ? (
            isSearchMode ? (
              <button className="sticky-header__menu-btn" onClick={handleSearchModeExit} aria-label="退出搜索">
                <ArrowLeft size={22} />
              </button>
            ) : (
              <>
                <button className="sticky-header__menu-btn" onClick={onMenuToggle} aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'}>
                  {menuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
                <button className="sticky-header__logo-group no-interaction-visual" onClick={goHome} aria-label="kinoTv — 返回首页">
                  <div className="sticky-header__logo-wrap">
                    <img className="sticky-header__logo" src={KinoTVLogo} alt="kinoTv" draggable={false} />
                  </div>
                  <div className="sticky-header__brand">
                    <span className="sticky-header__brand-name">kinoTV</span>
                  </div>
                </button>
              </>
            )
          ) : (
            <>
              {onSidebarToggle && (
                <button
                  className="sticky-header__sidebar-toggle"
                  onClick={onSidebarToggle}
                  aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                  title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                >
                  {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                </button>
              )}
              <button className="sticky-header__logo-group no-interaction-visual" onClick={goHome} aria-label="kinoTv — 返回首页">
                <div className="sticky-header__logo-wrap">
                  <img className="sticky-header__logo" src={KinoTVLogo} alt="kinoTv" draggable={false} />
                </div>
                <div className="sticky-header__brand">
                  <span className="sticky-header__brand-name">kinoTV</span>
                </div>
              </button>
            </>
          )}
        </div>
        <div className="sticky-header__center">
          {isMobile && isSearchMode ? (
            <div className="sticky-header__mobile-search">
              <SearchBox
                variant="header"
                autoFocus
                defaultValue={pageSearch.search || undefined}
                onSearch={handleMobileSearch}
                placeholder={pageSearch.placeholder || '搜索'}
                showHotSearch={showHotSearch}
                scope={searchScope}
              />
            </div>
          ) : isMobile && (pageTitle || isHome) ? (
            // 首页无 pageTitle 时中央显示品牌名 kinoTV（移动端左侧品牌文字已隐藏）
            <div className={`sticky-header__page-title${pageTitle ? '' : ' sticky-header__page-title--brand'}`}>
              {pageTitle ?? 'kinoTV'}
            </div>
          ) : (
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
          )}
        </div>
        <div className="sticky-header__right">
          <nav className="sticky-header__nav" aria-label="次要导航">
            {RIGHT_NAV_ITEMS.map(renderNavItem)}
          </nav>
          {isCompact && !isSearchMode ? (
            <button className="sticky-header__search-btn" onClick={handleSearchModeToggle} aria-label="打开搜索">
              <Search size={22} />
            </button>
          ) : null}
          <button className="sticky-header__theme-btn" onClick={handleThemeToggle} aria-label={`当前主题：${currentTheme}，点击切换`} title={`主题：${currentTheme}`}>
            <ThemeIcon size={24} />
          </button>
        </div>
      </div>
    </header>
  );
}
