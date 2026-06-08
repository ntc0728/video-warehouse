import { useState, useCallback } from 'react';
import { List } from 'lucide-react';
import type { VideoSource } from '@/types/video';

interface SourceSwitchProps {
  sources: VideoSource[];
  currentIndex: number;
  onSwitch: (index: number) => void;
}

export default function SourceSwitch({ sources, currentIndex, onSwitch }: SourceSwitchProps) {
  const [showPopover, setShowPopover] = useState(false);

  const handleSelect = useCallback((index: number) => {
    onSwitch(index);
    setShowPopover(false);
  }, [onSwitch]);

  if (sources.length <= 1) return null;

  return (
    <div className="up-popover-control">
      <button
        className="up-control-btn"
        onClick={() => setShowPopover(!showPopover)}
        title="播放源"
      >
        <List size={20} />
      </button>
      {showPopover && (
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

export function SourceSwitchMenuItem({ sources, currentIndex, onSwitch }: SourceSwitchProps) {
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
