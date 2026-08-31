/**
 * SettingsTabBar — 设置页桌面端标签栏
 *
 * 6 个 tab 各带 Lucide 图标；active tab 文字 + 图标 + 底部边框映射 --color-primary
 */
import { Palette, Film, PlayCircle, Tv, User, Info } from 'lucide-react';
import { Icon } from "@/components/ui/Icon";

const TAB_ICONS: Record<string, React.ReactNode> = {
  appearance: <Icon icon={Palette} size="sm" />,
  video: <Icon icon={Film} size="sm" />,
  playback: <Icon icon={PlayCircle} size="sm" />,
  iptv: <Icon icon={Tv} size="sm" />,
  personal: <Icon icon={User} size="sm" />,
  about: <Icon icon={Info} size="sm" />,
};

export const SETTINGS_TABS = [
  { key: 'appearance', label: '外观' },
  { key: 'video', label: '视频设置' },
  { key: 'playback', label: '播放设置' },
  { key: 'iptv', label: 'IPTV设置' },
  { key: 'personal', label: '个人设置' },
  { key: 'about', label: '关于' },
] as const;

export type SettingsTabKey = typeof SETTINGS_TABS[number]['key'];

interface SettingsTabBarProps {
  activeTab: SettingsTabKey;
  onChange: (key: SettingsTabKey) => void;
  /** 搜索过滤后的 tab 列表，不传时展示全部 */
  tabs?: ReadonlyArray<{ key: SettingsTabKey; label: string }>;
}

export default function SettingsTabBar({ activeTab, onChange, tabs = SETTINGS_TABS }: SettingsTabBarProps) {
  return (
    <div className="settings-tabbar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === activeTab}
          className={`settings-tab${tab.key === activeTab ? ' settings-tab--active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          <span className="settings-tab__icon">{TAB_ICONS[tab.key]}</span>
          <span className="settings-tab__label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
