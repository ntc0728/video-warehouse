/**
 * SettingsMenuList — 设置页移动端菜单列表
 *
 * 6 个菜单项各带图标 + ChevronRight 箭头，点击后以 SubPage 形式打开对应 tab
 */
import { ChevronRight, Palette, Video, Play, Tv, User, Info } from 'lucide-react';
import type { SettingsTabKey } from './SettingsTabBar';
import { Icon } from "@/components/ui/Icon";

const ICON_COLORS: Record<SettingsTabKey, string> = {
  appearance: '#8b5cf6',
  video: '#3b82f6',
  playback: '#10b981',
  iptv: '#f59e0b',
  personal: '#6b7280',
  about: '#06b6d4',
};

export const MENU_ITEMS: { key: SettingsTabKey; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'appearance', label: '外观', icon: <Icon icon={Palette} size="md" />, desc: '主题模式、皮肤' },
  { key: 'video', label: '视频设置', icon: <Icon icon={Video} size="md" />, desc: 'TMDB、视频源、字幕翻译' },
  { key: 'playback', label: '播放设置', icon: <Icon icon={Play} size="md" />, desc: '跳过片头片尾、自动连播' },
  { key: 'iptv', label: 'IPTV设置', icon: <Icon icon={Tv} size="md" />, desc: '数据源、节目单、代理' },
  { key: 'personal', label: '个人设置', icon: <Icon icon={User} size="md" />, desc: '个人资料与管理' },
  { key: 'about', label: '关于', icon: <Icon icon={Info} size="md" />, desc: '版本号、KinoTV' },
];

/** 按关键字（标题或副标题）过滤设置项 */
export function filterSettingsItems(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return MENU_ITEMS;
  return MENU_ITEMS.filter(
    (i) => i.label.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q),
  );
}

interface SettingsMenuListProps {
  onSelect: (key: SettingsTabKey) => void;
  /** 顶部搜索框传入的过滤关键字，为空时展示全部 */
  query?: string;
}

export default function SettingsMenuList({ onSelect, query = '' }: SettingsMenuListProps) {
  const items = filterSettingsItems(query);
  return (
    <div className="settings-menu-list">
      {items.length === 0 ? (
        <div className="settings-menu-empty">未找到匹配的设置项</div>
      ) : (
        items.map((item) => (
          <button
            key={item.key}
            type="button"
            className="settings-menu-item"
            onClick={() => onSelect(item.key)}
          >
            <span
              className="settings-menu-item__icon"
              style={{ background: ICON_COLORS[item.key] }}
            >
              {item.icon}
            </span>
            <span className="settings-menu-item__text">
              <span className="settings-menu-item__label">{item.label}</span>
              <span className="settings-menu-item__desc">{item.desc}</span>
            </span>
            <Icon icon={ChevronRight} size="sm" className="settings-menu-item__arrow" />
          </button>
        ))
      )}
    </div>
  );
}
