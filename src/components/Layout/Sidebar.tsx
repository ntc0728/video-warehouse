/**
 * 侧边栏导航组件
 * 桌面端左侧导航栏，支持展开/收起切换
 * 移动端 overlay 模式，从左侧滑入
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { navTo } from '@/lib/navigation';
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
import { useHeaderContent } from '@/components/Layout/useHeaderContent';

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
  const navigate = useNavigate();
  const location = useLocation();
  const { goHome } = useHeaderContent();

  const sidebarWidth = isMobile ? 200 : 240;

  const handleTabClick = (key: string) => {
    if (key === '/') {
      goHome();
    } else {
      navTo(navigate, key, location.pathname + location.search);
    }
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
            <button onClick={onToggle} className="sidebar-toggle-btn btn-press">
              <X size={18} />
            </button>
          </div>
          <div className="sidebar-nav">
            {tabs.map((tab) => {
              const isActive = tab.key === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(tab.key);
              return (
                <div
                  key={tab.key}
                  onClick={() => handleTabClick(tab.key)}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                >
                  {isActive && <div className="sidebar-nav-indicator" />}
                  <span className={`sidebar-nav-icon ${isActive ? 'animate-icon-bounce' : ''}`}>
                    {isActive ? tab.activeIcon : tab.icon}
                  </span>
                  <span className="sidebar-nav-text">{tab.title}</span>
                </div>
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
        >
          {isOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>

      <div className="sidebar-nav">
        {tabs.map((tab) => {
          // 首页精确匹配，其他路由前缀匹配
          const isActive = tab.key === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.key);
          return (
            <div
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
            >
              {isActive && <div className="sidebar-nav-indicator" />}
              <span className={`sidebar-nav-icon ${isActive ? 'animate-icon-bounce' : ''}`}>
                {isActive ? tab.activeIcon : tab.icon}
              </span>
              <span className="sidebar-nav-text">{tab.title}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
