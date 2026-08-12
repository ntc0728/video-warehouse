/**
 * HomeSidebar — 桌面端/平板端全局常驻左侧导航栏
 *
 * 支持展开/收起：
 * - 展开态：显示图标 + 文字（~220px）
 * - 收起态：仅显示图标（~64px），文字隐藏
 *
 * 交互：
 * - 点击「首页」→ 回首页并重置为默认发现页（activeCategory='home'）
 * - 点击「IPTV」→ navigate('/iptv')（独立路由页）
 * - 点击其余类目 → 若在首页则直接切换内容（不跳页）；否则先回首页再切换
 *
 * 高亮：根据当前路由 + activeCategory 判断（IPTV 由路由判定，类目由 store 判定）。
 */
import { useLocation } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import { Home, Tv, Film, Clapperboard, Mic2, Sparkles, Camera, Trophy, Settings } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { useHomeCategoryStore } from '@/stores/useHomeCategoryStore';
import { useScrollContainer } from '@/hooks/useScrollContext';
import type { HomeCategoryKey } from '@/pages/Home/categoryConfig';
import pkg from '../../../package.json';
import './HomeSidebar.css';

type IconType = typeof Home;

interface SidebarItem {
  key: string;
  label: string;
  icon: IconType;
  category?: HomeCategoryKey;
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

interface HomeSidebarProps {
  collapsed?: boolean;
}

export default function HomeSidebar({ collapsed = false }: HomeSidebarProps) {
  const navigate = useCustomNavigate();
  const location = useLocation();
  const activeCategory = useHomeCategoryStore((s) => s.activeCategory);
  const setActiveCategory = useHomeCategoryStore((s) => s.setActiveCategory);
  const scrollContainerRef = useScrollContainer();

  const handleClick = (item: SidebarItem) => {
    if (item.route) {
      navigate(item.route);
      return;
    }
    const cat = item.category as HomeCategoryKey;
    if (location.pathname !== '/') {
      navigate('/');
    }
    setActiveCategory(cat);
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
    <>
      {/* 布局占位：作为 app-shell flex 首列承担侧栏偏移，使 main 无需 margin-left。
          width 由 --sidebar-offset 变量驱动（app-shell--sidebar-collapsed 类瞬切，
          与 sidebar 同帧到位，仅 1 次 reflow）。 */}
      <div className="sidebar-spacer" aria-hidden="true" />
      <aside className={`home-sidebar${collapsed ? ' home-sidebar--collapsed' : ''}`} aria-label="主导航">
      <nav className="home-sidebar__nav">
        {ITEMS.map((item) => {
          const ItemIcon = item.icon;
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
              {/* 指示器常驻渲染：仅用 .active 类切换显隐（CSS transition），
                 不再随 active 挂载/卸载，避免导航重渲染期间关键帧被反复重放导致"闪几下" */}
              <span className="home-sidebar__indicator" aria-hidden="true" />
              <Icon icon={ItemIcon} size="md" className="home-sidebar__icon" aria-hidden="true" />
              <span className="home-sidebar__label">{item.label}</span>
            </button>
          );
        })}
      </nav>
      {/* 底部设置区：设置入口 + 版本号同一元素（hover 背景覆盖整个元素）。
          不设选中态（设置页入口无「停留高亮」语义）。 */}
      <div className="home-sidebar__footer">
        <button
          type="button"
          className="home-sidebar__footer-btn"
          title="设置"
          onClick={() => navigate('/settings')}
        >
          <Icon icon={Settings} size="md" className="home-sidebar__footer-icon" aria-hidden="true" />
          <span className="home-sidebar__footer-label">设置</span>
          <span className="home-sidebar__version" aria-hidden="true">v{pkg.version}</span>
        </button>
      </div>
    </aside>
    </>
  );
}
