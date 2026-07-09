import { useCallback } from 'react';
import { MoreVertical } from 'lucide-react';

interface MoreMenuProps {
  children: React.ReactNode;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
}

const POPOVER_ID = 'more';

export default function MoreMenu({ children, activePopover, onPopoverChange }: MoreMenuProps) {
  const isOpen = activePopover === POPOVER_ID;

  const handleButtonTouch = useCallback(() => {
    if (isOpen) {
      onPopoverChange(null);
    } else {
      onPopoverChange(POPOVER_ID);
    }
  }, [isOpen, onPopoverChange]);

  const handlePopoverClick = useCallback((e: React.MouseEvent) => {
    // 点击弹出菜单内部时不关闭菜单
    e.stopPropagation();
  }, []);

  return (
    <div
      className="up-popover-control up-more-menu"
      onMouseEnter={() => onPopoverChange(POPOVER_ID)}
      onMouseLeave={() => onPopoverChange(null)}
    >
      <button
        title="更多"
        onTouchStart={handleButtonTouch}
      >
        <MoreVertical size={20} />
      </button>
      {isOpen && (
        <div className="up-popover up-more-popover" onClick={handlePopoverClick}>
          {children}
        </div>
      )}
    </div>
  );
}
