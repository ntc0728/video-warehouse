/**
 * 移动端底部标签栏组件
 * 基于自建 TabBar 实现，仅在移动端显示
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { TabBar as UTabBar } from '@/components/ui';
import {
  Home,
  Tv,
  Star,
  Clock,
  Settings,
} from 'lucide-react';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';

const tabs = [
  { key: '/', title: '首页', icon: <Home size={22} />, activeIcon: <Home size={22} fill="currentColor" strokeWidth={1.5} /> },
  { key: '/iptv', title: 'IPTV', icon: <Tv size={22} />, activeIcon: <Tv size={22} fill="currentColor" strokeWidth={1.5} /> },
  { key: '/collections', title: '收藏', icon: <Star size={22} />, activeIcon: <Star size={22} fill="currentColor" strokeWidth={1.5} /> },
  { key: '/history', title: '历史', icon: <Clock size={22} />, activeIcon: <Clock size={22} fill="currentColor" strokeWidth={1.5} /> },
  { key: '/settings', title: '设置', icon: <Settings size={22} />, activeIcon: <Settings size={22} fill="currentColor" strokeWidth={1.5} /> },
];

export default function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { goHome } = useHeaderContent();

  const activeKey = tabs.find(tab =>
    tab.key === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.key)
  )?.key || '/';

  const navigateToTab = (key: string) => {
    if (key === '/') {
      goHome();
    } else if (key !== location.pathname) {
      navigate(key, { viewTransition: true });
    }
  };

  return (
    <UTabBar
      activeKey={activeKey}
      onChange={navigateToTab}
      className="mobile-tab-bar"
    >
      {tabs.map((tab) => (
        <UTabBar.Item
          key={tab.key}
          itemKey={tab.key}
          title={tab.title}
          icon={tab.icon}
          activeIcon={tab.activeIcon}
          onClick={() => navigateToTab(tab.key)}
        />
      ))}
    </UTabBar>
  );
}
