import React, { useCallback, useRef } from 'react';
import * as Tabs from '@radix-ui/react-tabs';

interface TabBarProps {
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
  children: React.ReactNode;
}

interface TabBarItemProps {
  title: string;
  icon?: React.ReactNode;
  activeIcon?: React.ReactNode;
  itemKey?: string;
  onClick?: () => void;
}

const TabBarItem: React.FC<TabBarItemProps> = ({ title, icon, activeIcon, itemKey, onClick }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerRef.current?.click();
    }
  }, []);

  return (
    <Tabs.Trigger
      ref={triggerRef}
      value={itemKey ?? ''}
      onKeyDown={handleKeyDown}
      onClick={onClick}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 outline-none font-semibold transition-colors duration-200 data-[state=active]:text-[var(--color-primary)] data-[state=active]:tab-pop-active data-[state=inactive]:text-[var(--color-text-secondary)]"
    >
      <span className="inline-flex items-center justify-center w-6 h-6">
        <span className="hidden data-[state=active]:inline-flex">{activeIcon || icon}</span>
        <span className="inline-flex data-[state=active]:hidden">{icon}</span>
      </span>
      <span className="text-[10px] leading-none">{title}</span>
    </Tabs.Trigger>
  );
};

const TabBarRoot: React.FC<TabBarProps> = ({ activeKey, onChange, className, children }) => {
  return (
    <Tabs.Root value={activeKey} onValueChange={onChange} className={className}>
      <Tabs.List className="fixed bottom-0 left-0 right-0 z-50 flex h-[var(--layout-tabbar-height)] w-full items-center justify-around border-t border-[var(--color-border-light)] bg-[var(--color-surface)] px-1">
        {children}
      </Tabs.List>
    </Tabs.Root>
  );
};

export const TabBar = Object.assign(TabBarRoot, { Item: TabBarItem });

export default TabBar;
