/**
 * 侧边栏导航组件
 * 桌面端左侧导航栏，支持展开/收起切换
 * 移动端 overlay 模式，从左侧滑入
 */
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Tv,
  Star,
  Clock,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';

const ariaLabels: Record<string, string> = {
  '/': '首页',
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
  { key: '/', title: '首页', icon: <Home size={20} />, activeIcon: <Home size={20} strokeWidth={2.5} /> },
  { key: '/iptv', title: 'IPTV', icon: <Tv size={20} />, activeIcon: <Tv size={20} strokeWidth={2.5} /> },
  { key: '/collections', title: '收藏', icon: <Star size={20} />, activeIcon: <Star size={20} strokeWidth={2.5} /> },
  { key: '/history', title: '历史记录', icon: <Clock size={20} />, activeIcon: <Clock size={20} strokeWidth={2.5} /> },
  { key: '/settings', title: '设置', icon: <Settings size={20} />, activeIcon: <Settings size={20} strokeWidth={2.5} /> },
];

export default function Sidebar({ isOpen, onToggle, isMobile }: SidebarProps) {
  const location = useLocation();
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

  const sidebarWidth = isMobile ? 200 : 240;

  const handleTabClick = () => {
    if (isMobile) onToggle();
  };

  if (isMobile) {
    return (
      <>
        {isOpen && <div className="sidebar-overlay" onClick={onToggle} />}
        <aside
          className={`sidebar-container sidebar-container--mobile${isOpen ? ' sidebar-container--open' : ''}`}
          style={{ width: sidebarWidth }}
        >
          <div className="sidebar-header">
            <span className="sidebar-title animate-slide-in-left">影视大全</span>
            <button onClick={onToggle} className="sidebar-toggle-btn btn-press" aria-label="关闭侧边栏">
              <X size={18} />
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
                  onClick={handleTabClick}
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
      </>
    );
  }

  return (
    <aside
      className="sidebar-container"
      style={{
        width: isOpen ? sidebarWidth : 64,
        minWidth: isOpen ? sidebarWidth : 64,
      }}
    >
      <div className="sidebar-header">
        <span className="sidebar-title animate-slide-in-left">影视大全</span>
        <button
          onClick={onToggle}
          className="sidebar-toggle-btn btn-press"
          aria-label={isOpen ? '收起侧边栏' : '展开侧边栏'}
        >
          {isOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
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
