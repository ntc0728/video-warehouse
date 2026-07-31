/**
 * 移动端底部标签栏组件
 * 基于自建 TabBar 实现，仅在移动端显示
 */
import { useLocation } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import { TabBar as UTabBar } from '@/components/ui';
import {
  Home,
  Tv,
  Star,
  Clock,
  Settings,
} from 'lucide-react';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';
import { Icon } from "@/components/ui/Icon";

const tabs = [
  { key: '/', title: '首页', icon: <Icon icon={Home} size="md" />, activeIcon: <Icon icon={Home} size="md" fill="currentColor" strokeWidth={1.5} /> },
  { key: '/iptv', title: 'IPTV', icon: <Icon icon={Tv} size="md" />, activeIcon: <Icon icon={Tv} size="md" fill="currentColor" strokeWidth={1.5} /> },
  { key: '/collections', title: '收藏', icon: <Icon icon={Star} size="md" />, activeIcon: <Icon icon={Star} size="md" fill="currentColor" strokeWidth={1.5} /> },
  { key: '/history', title: '历史', icon: <Icon icon={Clock} size="md" />, activeIcon: <Icon icon={Clock} size="md" fill="currentColor" strokeWidth={1.5} /> },
  { key: '/settings', title: '设置', icon: <Icon icon={Settings} size="md" />, activeIcon: <Icon icon={Settings} size="md" fill="currentColor" strokeWidth={1.5} /> },
];

export default function TabBar() {
  const location = useLocation();
  const navigate = useCustomNavigate();
  const { goHome } = useHeaderContent();

  const activeKey = tabs.find(tab =>
    tab.key === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.key)
  )?.key || '/';

  const navigateToTab = (key: string) => {
    if (key === '/') {
      goHome();
    } else if (key !== location.pathname) {
      navigate(key);
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
