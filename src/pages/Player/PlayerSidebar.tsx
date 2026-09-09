interface PlayerSidebarProps {
  children: React.ReactNode;
  /** 桌面端（≥1024px，ADR-023 rail 类布局起点）面板布局变体："tv"=有选季面板，"movie"=无选季面板 */
  variant?: 'tv' | 'movie';
  /** 各面板展开状态（桌面 ≥1024 用）：驱动 grid 行模板，展开=1fr 折叠=auto */
  expanded?: Record<string, boolean>;
}

export function PlayerSidebar({ children, variant = 'tv', expanded = {} }: PlayerSidebarProps) {
  const keys = variant === 'tv' ? ['cms', 'season', 'episodes'] : ['cms', 'episodes'];
  // 检查是否所有面板都收起
  const allCollapsed = keys.every(k => !expanded[k]);
  // 所有面板收起时保持 auto 行高（各面板只显示 header），否则按展开状态分配
  const rows = keys.map(k => (expanded[k] ? '1fr' : 'auto')).join(' ');
  return (
    <div
      className={`player-sidebar player-sidebar--${variant}${allCollapsed ? ' player-sidebar--all-collapsed' : ''}`}
      style={{ '--panel-rows': rows } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
