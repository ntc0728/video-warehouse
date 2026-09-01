interface PlayerSidebarProps {
  children: React.ReactNode;
  /** 桌面端（>1280px）面板布局变体："tv"=有选季面板（cms:season:episodes=2:4:4），"movie"=无选季面板（cms:episodes=3:7） */
  variant?: 'tv' | 'movie';
}

export function PlayerSidebar({ children, variant = 'tv' }: PlayerSidebarProps) {
  return (
    <div className={`player-sidebar player-sidebar--${variant}`}>
      {children}
    </div>
  );
}
