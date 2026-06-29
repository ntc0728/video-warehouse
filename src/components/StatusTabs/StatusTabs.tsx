import type { LucideIcon } from 'lucide-react';
import './StatusTabs.css';

interface StatusTab {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  count: number;
}

interface StatusTabsProps {
  tabs: StatusTab[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export default function StatusTabs({ tabs, activeKey, onChange, className }: StatusTabsProps) {
  return (
    <div className={`status-tabs${className ? ` ${className}` : ''}`} role="tablist">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`status-tab${isActive ? ' status-tab--active' : ''}`}
            style={isActive ? { '--status-tab-color': tab.color } as React.CSSProperties : undefined}
            onClick={() => onChange(tab.key)}
          >
            <Icon size={18} />
            <span>{tab.label}</span>
            {tab.count > 0 && <span className="status-tab__count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
