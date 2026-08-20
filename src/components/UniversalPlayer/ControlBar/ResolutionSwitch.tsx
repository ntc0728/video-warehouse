import { useCallback } from 'react';
import { Monitor, MonitorPlay } from 'lucide-react';
import type { PlayerLevel } from '@/types/player';
import { DuoIcon } from '@/components/ui/DuoIcon';
import { getResolutionLabel } from '../lib/utils';

function getCurrentLabel(levels: PlayerLevel[], currentLevel: number): string {
  if (currentLevel === -1) return '自动';
  const level = levels[currentLevel];
  if (!level) return '自动';
  return getResolutionLabel(level);
}

interface ResolutionSwitchProps {
  levels: PlayerLevel[];
  currentLevel: number;
  onChange: (level: number) => void;
  visible: boolean;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
}

const POPOVER_ID = 'resolution';

export default function ResolutionSwitch({ levels, currentLevel, onChange, visible, activePopover, onPopoverChange }: ResolutionSwitchProps) {
  const isOpen = activePopover === POPOVER_ID;

  const handleSelect = useCallback((level: number) => {
    onChange(level);
    onPopoverChange(null);
  }, [onChange, onPopoverChange]);

  const handleButtonTouch = useCallback(() => {
    if (isOpen) {
      onPopoverChange(null);
    } else {
      onPopoverChange(POPOVER_ID);
    }
  }, [isOpen, onPopoverChange]);

  if (!visible || levels.length === 0) return null;

  const label = getCurrentLabel(levels, currentLevel);

  return (
    <div
      className="up-popover-control"
      onMouseEnter={() => onPopoverChange(POPOVER_ID)}
      onMouseLeave={() => onPopoverChange(null)}
    >
      <button
        title="画质"
        onTouchStart={handleButtonTouch}
      >
        <DuoIcon primary={Monitor} secondary={MonitorPlay} size="md" />
        <span className="up-speed-label">{label}</span>
      </button>
      {isOpen && (
        <div className="up-popover up-resolution-popover">
          <button
            className={`up-popover-item ${currentLevel === -1 ? 'up-popover-item-active' : ''}`}
            onClick={() => handleSelect(-1)}
          >
            自动
          </button>
          {levels.map((level, index) => (
            <button
              key={index}
              className={`up-popover-item ${index === currentLevel ? 'up-popover-item-active' : ''}`}
              onClick={() => handleSelect(index)}
            >
              {getResolutionLabel(level)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
