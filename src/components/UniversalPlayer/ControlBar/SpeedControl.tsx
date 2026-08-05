import { useCallback } from 'react';
import { Gauge, GaugeCircle } from 'lucide-react';
import { DuoIcon } from '@/components/ui/DuoIcon';

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface SpeedControlProps {
  currentRate: number;
  onChange: (rate: number) => void;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
}

const POPOVER_ID = 'speed';

export default function SpeedControl({ currentRate, onChange, activePopover, onPopoverChange }: SpeedControlProps) {
  const isOpen = activePopover === POPOVER_ID;

  const handleSelect = useCallback((rate: number) => {
    onChange(rate);
    onPopoverChange(null);
  }, [onChange, onPopoverChange]);

  const handleButtonTouch = useCallback(() => {
    if (isOpen) {
      onPopoverChange(null);
    } else {
      onPopoverChange(POPOVER_ID);
    }
  }, [isOpen, onPopoverChange]);

  return (
    <div
      className="up-popover-control"
      onMouseEnter={() => onPopoverChange(POPOVER_ID)}
      onMouseLeave={() => onPopoverChange(null)}
    >
      <button
        className="up-speed-btn"
        title="倍速"
        onTouchStart={handleButtonTouch}
        aria-label="播放速度"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <DuoIcon primary={Gauge} secondary={GaugeCircle} size="md" />
        <span className="up-speed-label">{currentRate === 1 ? '倍速' : `${currentRate}x`}</span>
      </button>
      {isOpen && (
        <div className="up-popover up-speed-popover" role="menu" aria-label="选择播放速度">
          {PLAYBACK_RATES.map(rate => (
            <button
              key={rate}
              className={`up-popover-item ${rate === currentRate ? 'up-popover-item-active' : ''}`}
              onClick={() => handleSelect(rate)}
              role="menuitemradio"
              aria-checked={rate === currentRate}
            >
              {rate === 1 ? '正常' : `${rate}x`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
