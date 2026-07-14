/**
 * HomeSidebar — 桌面端全局常驻左侧导航栏
 *
 * 只在桌面端（!isMobileWeb && !isNative && !isTV）渲染，每个页面都显示。
 * 8 个图标+文本项：首页 / IPTV / 电影 / 电视剧 / 综艺 / 动漫 / 纪录片 / 排行榜。
 *
 * 交互：
 * - 点击「首页」→ 回首页并重置为默认发现页（activeCategory='home'）
 * - 点击「IPTV」→ navigate('/iptv')（独立路由页）
 * - 点击其余类目 → 若在首页则直接切换内容（不跳页）；否则先回首页再切换
 *
 * 高亮：根据当前路由 + activeCategory 判断（IPTV 由路由判定，类目由 store 判定）。
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Tv, Film, Clapperboard, Mic2, Sparkles, Camera, Trophy } from 'lucide-react';
import { useHomeCategoryStore } from '@/stores/useHomeCategoryStore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import type { HomeCategoryKey } from '@/pages/Home/categoryConfig';
import KinoTVLogo from '@/assets/icon/KinoTV.webp';
import './HomeSidebar.css';

type IconType = typeof Home;

interface SidebarItem {
  key: string;
  label: string;
  icon: IconType;
  /** 内容类目（点击切换首页右侧内容） */
  category?: HomeCategoryKey;
  /** 独立路由（点击直接跳转） */
  route?: string;
}

const ITEMS: SidebarItem[] = [
  { key: 'home', label: '首页', icon: Home, category: 'home' },
  { key: 'iptv', label: 'IPTV', icon: Tv, route: '/iptv' },
  { key: 'movie', label: '电影', icon: Film, category: 'movie' },
  { key: 'tv', label: '电视剧', icon: Clapperboard, category: 'tv' },
  { key: 'variety', label: '综艺', icon: Mic2, category: 'variety' },
  { key: 'anime', label: '动漫', icon: Sparkles, category: 'anime' },
  { key: 'documentary', label: '纪录片', icon: Camera, category: 'documentary' },
  { key: 'top', label: '排行榜', icon: Trophy, category: 'top' },
];

export default function HomeSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeCategory = useHomeCategoryStore((s) => s.activeCategory);
  const setActiveCategory = useHomeCategoryStore((s) => s.setActiveCategory);
  const scrollContainerRef = useScrollContainer();

  const handleClick = (item: SidebarItem) => {
    // 独立路由（IPTV）
    if (item.route) {
      navigate(item.route);
      return;
    }

    const cat = item.category as HomeCategoryKey;
    // 当前不在首页 → 先回首页（Keep-Alive 不重建，仅切可见性）
    if (location.pathname !== '/') {
      navigate('/');
    }
    // 切换首页右侧内容（不跳页）
    setActiveCategory(cat);

    // 切类目时滚动回顶部，体验更顺
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (el) el.scrollTo({ top: 0, behavior: 'auto' });
    });
  };

  /** 点击左上角 logo → 回首页 + 重置为默认发现页 */
  const handleLogoClick = () => {
    if (location.pathname !== '/') navigate('/');
    setActiveCategory('home');
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (el) el.scrollTo({ top: 0, behavior: 'auto' });
    });
  };

  const isActive = (item: SidebarItem): boolean => {
    if (item.route) {
      return location.pathname.startsWith(item.route);
    }
    if (item.key === 'home') {
      return location.pathname === '/' && activeCategory === 'home';
    }
    return location.pathname === '/' && activeCategory === item.category;
  };

  return (
    <aside className="home-sidebar" aria-label="主导航">
      {/* 左上角 logo（取代顶部导航栏 logo，高度对齐 StickyHeader） */}
      <button
        type="button"
        className="home-sidebar__logo no-interaction-visual"
        onClick={handleLogoClick}
        aria-label="kinoTv — 返回首页"
      >
        <div className="home-sidebar__logo-wrap">
          <img className="home-sidebar__logo-img" src={KinoTVLogo} alt="kinoTv" draggable={false} />
        </div>
        <span className="home-sidebar__brand-name">kinoTV</span>
      </button>
      <nav className="home-sidebar__nav">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <button
              key={item.key}
              type="button"
              className={`home-sidebar__item${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
              title={item.label}
              onClick={() => handleClick(item)}
            >
              {active && <span className="home-sidebar__indicator" />}
              <Icon size={20} className="home-sidebar__icon" aria-hidden="true" />
              <span className="home-sidebar__label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
