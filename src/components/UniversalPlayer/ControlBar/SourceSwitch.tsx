import { useState, useCallback } from 'react';
import { List } from 'lucide-react';
import type { VideoSource } from '@/types/video';

interface SourceSwitchProps {
  sources: VideoSource[];
  currentIndex: number;
  onSwitch: (index: number) => void;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
}

const POPOVER_ID = 'source';

export default function SourceSwitch({ sources, currentIndex, onSwitch, activePopover, onPopoverChange }: SourceSwitchProps) {
  const isOpen = activePopover === POPOVER_ID;

  const handleSelect = useCallback((index: number) => {
    onSwitch(index);
    onPopoverChange(null);
  }, [onSwitch, onPopoverChange]);

  if (sources.length <= 1) return null;

  return (
    <div className="up-popover-control">
      <button
        className="up-control-btn"
        onClick={() => onPopoverChange(isOpen ? null : POPOVER_ID)}
        title="播放源"
      >
        <List size={20} />
      </button>
      {isOpen && (
        <div className="up-popover up-source-popover">
          {sources.map((source, index) => (
            <button
              key={source.id}
              className={`up-popover-item ${index === currentIndex ? 'up-popover-item-active' : ''}`}
              onClick={() => handleSelect(index)}
            >
              {source.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SourceSwitchMenuItem({ sources, currentIndex, onSwitch }: Omit<SourceSwitchProps, 'activePopover' | 'onPopoverChange'>) {
  const [expanded, setExpanded] = useState(false);

  if (sources.length <= 1) return null;

  return (
    <div className="up-more-submenu">
      <button
        className={`up-popover-item ${expanded ? 'up-popover-item-active' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <List size={16} />
        <span>播放源</span>
      </button>
      {expanded && (
        <div className="up-more-submenu-items">
          {sources.map((source, index) => (
            <button
              key={source.id}
              className={`up-popover-item ${index === currentIndex ? 'up-popover-item-active' : ''}`}
              onClick={() => { onSwitch(index); setExpanded(false); }}
            >
              {source.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
