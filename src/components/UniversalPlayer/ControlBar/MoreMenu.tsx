import { useCallback, useState } from 'react';
import { MoreVertical, MoreHorizontal } from 'lucide-react';
import { DuoIcon } from '@/components/ui/DuoIcon';

interface MoreMenuProps {
  children: React.ReactNode;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
}

const POPOVER_ID = 'more';

export default function MoreMenu({ children, activePopover, onPopoverChange }: MoreMenuProps) {
  const isOpen = activePopover === POPOVER_ID;
  const [isExiting, setIsExiting] = useState(false);

  const handleButtonTouch = useCallback(() => {
    if (isOpen) {
      setIsExiting(true);
      setTimeout(() => {
        onPopoverChange(null);
        setIsExiting(false);
      }, 160);
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
      onMouseEnter={() => { if (!isOpen && !isExiting) onPopoverChange(POPOVER_ID); }}
      onMouseLeave={() => { if (!isExiting) { setIsExiting(true); setTimeout(() => { onPopoverChange(null); setIsExiting(false); }, 160); } }}
    >
      <button
        title="更多"
        onTouchStart={handleButtonTouch}
      >
        <DuoIcon primary={MoreVertical} secondary={MoreHorizontal} size="md" />
      </button>
      {(isOpen || isExiting) && (
        <div className={`up-popover up-more-popover${isExiting ? ' up-more-popover--exiting' : ''}`} onClick={handlePopoverClick}>
          {children}
        </div>
      )}
    </div>
  );
}
