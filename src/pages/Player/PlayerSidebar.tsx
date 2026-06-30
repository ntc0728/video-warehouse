interface PlayerSidebarProps {
  children: React.ReactNode;
  compact?: boolean;
}

export function PlayerSidebar({ children, compact = false }: PlayerSidebarProps) {
  return (
    <div className={`player-sidebar${compact ? ' player-sidebar--compact' : ''}`}>
      {children}
    </div>
  );
}
