/**
 * 侧边栏导航组件
 * 桌面端左侧导航栏，支持展开/收起切换
 * 移动端 overlay 模式，从左侧滑入
 */
import { useEffect, useRef, type MouseEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import {
  Home,
  Search,
  Tv,
  Star,
  Clock,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import KinoTVLogo from '@/assets/icon/KinoTV.webp';
import pkg from '../../../package.json';
import { Icon } from "@/components/ui/Icon";

const ariaLabels: Record<string, string> = {
  '/': '首页',
  '/browse': '搜索中心',
  '/iptv': 'IPTV',
  '/collections': '收藏',
  '/history': '历史记录',
  '/settings': '设置',
};

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  isMobile: boolean;
}

const tabs = [
  { key: '/', title: '首页', icon: <Icon icon={Home} size="md" />, activeIcon: <Icon icon={Home} size="md" strokeWidth={2.5} /> },
  { key: '/browse', title: '搜索中心', icon: <Icon icon={Search} size="md" />, activeIcon: <Icon icon={Search} size="md" strokeWidth={2.5} /> },
  { key: '/iptv', title: 'IPTV', icon: <Icon icon={Tv} size="md" />, activeIcon: <Icon icon={Tv} size="md" strokeWidth={2.5} /> },
  { key: '/collections', title: '收藏', icon: <Icon icon={Star} size="md" />, activeIcon: <Icon icon={Star} size="md" strokeWidth={2.5} /> },
  { key: '/history', title: '历史记录', icon: <Icon icon={Clock} size="md" />, activeIcon: <Icon icon={Clock} size="md" strokeWidth={2.5} /> },
  { key: '/settings', title: '设置', icon: <Icon icon={Settings} size="md" />, activeIcon: <Icon icon={Settings} size="md" strokeWidth={2.5} /> },
];

export default function Sidebar({ isOpen, onToggle, isMobile }: SidebarProps) {
  const location = useLocation();
  const navigate = useCustomNavigate();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // 移动端：从屏幕边缘滑动关闭侧边栏
  useEffect(() => {
    if (!isMobile || !isOpen) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const screenWidth = window.innerWidth;

      // 从屏幕左侧或右侧边缘开始滑动，且水平滑动距离大于50px，垂直滑动小于100px
      const isEdgeSwipe = touchStartRef.current.x < 30 || touchStartRef.current.x > screenWidth - 30;
      const isHorizontalSwipe = Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100;

      if (isEdgeSwipe && isHorizontalSwipe) {
        onToggle();
      }
      touchStartRef.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, isOpen, onToggle]);


  // 通过 useCustomNavigate 触发（非首页间导航自带 View Transitions 交叉淡入）。
  // 修饰键 / 中键点击放行，交给浏览器默认行为（新标签打开）。
  const handleNavClick = (e: MouseEvent, to: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (isMobile) onToggle();
    navigate(to);
  };

  if (isMobile) {
    const settingsTab = tabs.find((t) => t.key === '/settings')!;
    const settingsActive = location.pathname.startsWith('/settings');
    return (
      <>
        {isOpen && <div className="sidebar-overlay" onClick={onToggle} />}
        <aside
          className={`sidebar-container sidebar-container--mobile${isOpen ? ' sidebar-container--open' : ''}`}
          style={{ width: 'var(--sidebar-width-mobile)' }}
        >
          <div className="sidebar-header">
            <span className="sidebar-header__brand">
              <span className="sidebar-logo-wrap">
                <img className="sidebar-logo" src={KinoTVLogo} alt="kinoTv" draggable={false} />
              </span>
              <span className="sidebar-title animate-slide-in-left">KinoTV</span>
            </span>
            <button onClick={onToggle} className="sidebar-toggle-btn btn-press" aria-label="关闭侧边栏">
              <Icon icon={X} size="sm" />
            </button>
          </div>
          <div className="sidebar-nav">
            {/* 设置项已移至底部独立区（sidebar-footer），列表内不再重复 */}
            {tabs.filter((tab) => tab.key !== '/settings').map((tab) => {
              const isActive = tab.key === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(tab.key);
              return (
                <Link
                  key={tab.key}
                  to={tab.key}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={ariaLabels[tab.key]}
                  onClick={(e) => handleNavClick(e, tab.key)}
                >
                  {isActive && <div className="sidebar-nav-indicator" />}
                  <span className={`sidebar-nav-icon ${isActive ? 'animate-icon-bounce' : ''}`} aria-hidden="true">
                    {isActive ? tab.activeIcon : tab.icon}
                  </span>
                  <span className="sidebar-nav-text">{tab.title}</span>
                </Link>
              );
            })}
          </div>
          {/* 底部设置项：与主列表保持间距（上边框 + 内边距）；
              版本号与设置入口同一元素（hover 背景覆盖整个元素） */}
          <div className="sidebar-footer">
            <Link
              to={settingsTab.key}
              className={`sidebar-nav-item sidebar-nav-item--footer${settingsActive ? ' active' : ''}`}
              aria-current={settingsActive ? 'page' : undefined}
              aria-label={ariaLabels[settingsTab.key]}
              onClick={(e) => handleNavClick(e, settingsTab.key)}
            >
              {settingsActive && <div className="sidebar-nav-indicator" />}
              <span className={`sidebar-nav-icon ${settingsActive ? 'animate-icon-bounce' : ''}`} aria-hidden="true">
                {settingsTab.icon}
              </span>
              <span className="sidebar-nav-text">{settingsTab.title}</span>
              <span className="sidebar-footer__version" aria-hidden="true">v{pkg.version}</span>
            </Link>
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside
      className="sidebar-container"
      style={{
        width: isOpen ? 'var(--sidebar-width)' : 'var(--sidebar-width-collapsed)',
        minWidth: isOpen ? 'var(--sidebar-width)' : 'var(--sidebar-width-collapsed)',
      }}
    >
      <div className="sidebar-header">
        <span className="sidebar-title animate-slide-in-left">KinoTV</span>
        <button
          onClick={onToggle}
          className="sidebar-toggle-btn btn-press"
          aria-label={isOpen ? '收起侧边栏' : '展开侧边栏'}
        >
          {isOpen ? <Icon icon={PanelLeftClose} size="sm" /> : <Icon icon={PanelLeftOpen} size="sm" />}
        </button>
      </div>

      <div className="sidebar-nav">
        {tabs.map((tab) => {
          const isActive = tab.key === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.key);
          return (
            <Link
              key={tab.key}
              to={tab.key}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={ariaLabels[tab.key]}
              onClick={(e) => handleNavClick(e, tab.key)}
            >
              {isActive && <div className="sidebar-nav-indicator" />}
              <span className={`sidebar-nav-icon ${isActive ? 'animate-icon-bounce' : ''}`} aria-hidden="true">
                {isActive ? tab.activeIcon : tab.icon}
              </span>
              <span className="sidebar-nav-text">{tab.title}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
