/**
 * 移动端底部标签栏组件
 * 基于自建 TabBar 实现，仅在移动端显示
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { TabBar as UTabBar } from '@/components/ui';
import { navTo } from '@/lib/navigation';
import {
  Home,
  Tv,
  Star,
  Clock,
  Settings,
} from 'lucide-react';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';

const tabs = [
  { key: '/', title: '首页', icon: <Home size={20} />, activeIcon: <Home size={20} strokeWidth={2.5} /> },
  { key: '/iptv', title: 'IPTV', icon: <Tv size={20} />, activeIcon: <Tv size={20} strokeWidth={2.5} /> },
  { key: '/collections', title: '收藏', icon: <Star size={20} />, activeIcon: <Star size={20} strokeWidth={2.5} /> },
  { key: '/history', title: '历史', icon: <Clock size={20} />, activeIcon: <Clock size={20} strokeWidth={2.5} /> },
  { key: '/settings', title: '设置', icon: <Settings size={20} />, activeIcon: <Settings size={20} strokeWidth={2.5} /> },
];

export default function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { goHome } = useHeaderContent();

  /** 首页精确匹配，其他路由前缀匹配，确定当前激活的标签 */
  const activeKey = tabs.find(tab =>
    tab.key === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.key)
  )?.key || '/';

  const handleChange = (key: string) => {
    if (key === '/') {
      goHome();
    } else {
      navTo(navigate, key, location.pathname + location.search);
    }
  };

  const handleClick = (key: string) => {
    if (key === '/') {
      goHome();
    } else {
      navTo(navigate, key, location.pathname + location.search);
    }
  };

  return (
    <UTabBar
      activeKey={activeKey}
      onChange={handleChange}
      className="mobile-tab-bar"
    >
      {tabs.map((tab) => (
        <UTabBar.Item
          key={tab.key}
          itemKey={tab.key}
          title={tab.title}
          icon={tab.icon}
          onClick={() => handleClick(tab.key)}
        />
      ))}
    </UTabBar>
  );
}
