import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

interface MoreMenuProps {
  children: React.ReactNode;
}

export default function MoreMenu({ children }: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="up-popover-control up-more-menu" ref={menuRef}>
      <button
        className="up-control-btn"
        onClick={() => setOpen(!open)}
        title="更多"
      >
        <MoreVertical size={20} />
      </button>
      {open && (
        <div className="up-popover up-more-popover">
          {children}
        </div>
      )}
    </div>
  );
}
