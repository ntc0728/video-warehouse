interface PlayerSidebarProps {
  children: React.ReactNode;
}

export function PlayerSidebar({ children }: PlayerSidebarProps) {
  return (
    <div className="player-sidebar">
      {children}
    </div>
  );
}
