/**
 * StickyHeader — 全局顶部导航栏
 * 半透明背景 + 阴影，Logo + 左右导航 + 主题切换 + 中央搜索框。
 * 首页滚动距离 >= --header-height 时切换为实体背景（仅首页生效）。
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Tv, Star, Clock, Settings, Sun, Moon, Monitor } from 'lucide-react';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useIsTV } from '@/hooks/useMediaQuery';
import { useSettingsStore } from '@/stores';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';
import { useScrollContainer } from '@/hooks/useScrollContext';
import SearchBox from '@/components/SearchBox';
import KinoTVLogo from '@/assets/icon/KinoTV.webp';
import './StickyHeader.css';

interface NavItem { key: string; title: string; icon: React.ReactNode; path: string; }

const LEFT_NAV_ITEMS: NavItem[] = [
  { key: 'home', title: '首页', icon: <Home size={18} />, path: '/' },
  { key: 'iptv', title: 'IPTV', icon: <Tv size={18} />, path: '/iptv' },
];

const RIGHT_NAV_ITEMS: NavItem[] = [
  { key: 'collections', title: '收藏', icon: <Star size={18} />, path: '/collections' },
  { key: 'history', title: '历史', icon: <Clock size={18} />, path: '/history' },
  { key: 'settings', title: '设置', icon: <Settings size={18} />, path: '/settings' },
];

const THEME_ICONS = [Sun, Moon, Monitor] as const;
const THEME_CYCLE: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];

interface StickyHeaderProps { immersive?: boolean; }

export default function StickyHeader({ immersive = false }: StickyHeaderProps) {
  const theme = useThemeMode();
  const isTV = useIsTV();
  const navigate = useNavigate();
  const location = useLocation();
  // 使用 selector 订阅,只跟踪需要的字段,避免设置 store 任意变更都触发重渲染
  const currentTheme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const { goHome } = useHeaderContent();

  const handleNavClick = useCallback((path: string) => {
    if (path === '/') {
      goHome();
    } else {
      navigate(path);
    }
  }, [navigate, goHome]);

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  /**
   * 在以下路由下隐藏顶部中央的 SearchBox，避免与页面内的 SearchBox 重复：
   *  - /browse* : BrowseHeader 中间已有自己的 SearchBox
   *  - /iptv*   : IPTV 页左侧栏已有搜索入口，避免双搜索框
   */
  const isSearchHidden = location.pathname.startsWith('/browse');

  // ── 滚动检测：仅首页监听滚动距离，超过 --header-height 切换为实体背景 ──
  // 滚动容器是 AppLayout 的 CustomScrollbar（不是 window）；用 useScrollContainer 拿 ref
  const scrollContainerRef = useScrollContainer();
  const isHome = location.pathname === '/';
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) {
      setIsScrolled(false);
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
  }, [isHome, scrollContainerRef]);

  const handleThemeToggle = useCallback(() => {
    const idx = THEME_CYCLE.indexOf(currentTheme);
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  }, [currentTheme, setTheme]);

  const ThemeIcon = THEME_ICONS[THEME_CYCLE.indexOf(currentTheme)] || Monitor;

  const renderNavItem = (item: NavItem) => {
    const onClick = item.path === '/' ? goHome : () => handleNavClick(item.path);
    return (
      <button key={item.key} className={`sticky-header__nav-item${isActive(item.path) ? ' sticky-header__nav-item--active' : ''}`} onClick={onClick} title={item.title}>
        {item.icon}<span className="sticky-header__nav-label">{item.title}</span>
      </button>
    );
  };

  return (
    <header
      className={`sticky-header${immersive ? ' sticky-header--immersive' : ''}${isTV ? ' sticky-header--tv' : ''}${isScrolled ? ' sticky-header--scrolled' : ''}`}
      data-theme={theme}
    >
      <div className="sticky-header__inner">
        <div className="sticky-header__left">
          <button className="sticky-header__logo-group" onClick={goHome} aria-label="kinoTv — 返回首页">
            <div className="sticky-header__logo-wrap">
              <img className="sticky-header__logo" src={KinoTVLogo} alt="kinoTv" draggable={false} />
            </div>
            <div className="sticky-header__brand">
              <span className="sticky-header__brand-name">kinoTv</span>
            </div>
          </button>
          <nav className="sticky-header__nav" aria-label="主要导航">
            {LEFT_NAV_ITEMS.map(renderNavItem)}
          </nav>
        </div>
        <div className="sticky-header__center">
          {/* 顶部导航中央：公共搜索框（variant="header"）。
              URL ?q= 已由 SearchBox 内部 useSearchParams 自动同步 input 值。
              /browse/* 与 /iptv/* 路由下不渲染（避免与页面内搜索框重复）。 */}
          {isSearchHidden ? null : <SearchBox variant="header" />}
        </div>
        <div className="sticky-header__right">
          <nav className="sticky-header__nav" aria-label="次要导航">
            {RIGHT_NAV_ITEMS.map(renderNavItem)}
          </nav>
          <button className="sticky-header__theme-btn" onClick={handleThemeToggle} aria-label={`当前主题：${currentTheme}，点击切换`} title={`主题：${currentTheme}`}>
            <ThemeIcon size={24} />
          </button>
        </div>
      </div>
    </header>
  );
}
