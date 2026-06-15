import { useRef, useEffect, useCallback } from 'react';
import { MoreVertical } from 'lucide-react';

interface MoreMenuProps {
  children: React.ReactNode;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
}

const POPOVER_ID = 'more';

export default function MoreMenu({ children, activePopover, onPopoverChange }: MoreMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const isOpen = activePopover === POPOVER_ID;

  const handleToggle = useCallback(() => {
    onPopoverChange(isOpen ? null : POPOVER_ID);
  }, [isOpen, onPopoverChange]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onPopoverChange(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onPopoverChange]);

  return (
    <div className="up-popover-control up-more-menu" ref={menuRef}>
      <button
        className="up-control-btn"
        onClick={handleToggle}
        title="更多"
      >
        <MoreVertical size={20} />
      </button>
      {isOpen && (
        <div className="up-popover up-more-popover">
          {children}
        </div>
      )}
    </div>
  );
}
