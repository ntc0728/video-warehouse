import { useCallback } from 'react';
import { Gauge } from 'lucide-react';

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

  const handleToggle = useCallback(() => {
    onPopoverChange(isOpen ? null : POPOVER_ID);
  }, [isOpen, onPopoverChange]);

  const handleSelect = useCallback((rate: number) => {
    onChange(rate);
    onPopoverChange(null);
  }, [onChange, onPopoverChange]);

  return (
    <div className="up-popover-control">
      <button
        className="up-control-btn up-speed-btn"
        onClick={handleToggle}
        title="倍速"
      >
        <Gauge size={20} />
        <span className="up-speed-label">{currentRate === 1 ? '倍速' : `${currentRate}x`}</span>
      </button>
      {isOpen && (
        <div className="up-popover up-speed-popover">
          {PLAYBACK_RATES.map(rate => (
            <button
              key={rate}
              className={`up-popover-item ${rate === currentRate ? 'up-popover-item-active' : ''}`}
              onClick={() => handleSelect(rate)}
            >
              {rate === 1 ? '正常' : `${rate}x`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
