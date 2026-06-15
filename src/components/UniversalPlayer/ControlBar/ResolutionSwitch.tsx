import { useCallback } from 'react';
import { Monitor } from 'lucide-react';
import type { PlayerLevel } from '@/types/player';

function getResolutionLabel(level: PlayerLevel): string {
  if (level.height >= 2160) return '4K';
  if (level.height >= 1440) return '2K';
  if (level.height >= 1080) return '1080p';
  if (level.height >= 720) return '720p';
  if (level.height >= 480) return '480p';
  if (level.height >= 360) return '360p';
  return `${level.height}p`;
}

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

  const handleToggle = useCallback(() => {
    onPopoverChange(isOpen ? null : POPOVER_ID);
  }, [isOpen, onPopoverChange]);

  const handleSelect = useCallback((level: number) => {
    onChange(level);
    onPopoverChange(null);
  }, [onChange, onPopoverChange]);

  if (!visible || levels.length === 0) return null;

  const label = getCurrentLabel(levels, currentLevel);

  return (
    <div className="up-popover-control">
      <button
        className={`up-control-btn ${currentLevel !== -1 ? 'up-control-btn-active' : ''}`}
        onClick={handleToggle}
        title="画质"
      >
        <Monitor size={20} />
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
