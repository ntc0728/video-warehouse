import { useState, useCallback } from 'react';
import { Gauge } from 'lucide-react';

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface SpeedControlProps {
  currentRate: number;
  onChange: (rate: number) => void;
}

export default function SpeedControl({ currentRate, onChange }: SpeedControlProps) {
  const [showPopover, setShowPopover] = useState(false);

  const handleSelect = useCallback((rate: number) => {
    onChange(rate);
    setShowPopover(false);
  }, [onChange]);

  return (
    <div className="up-popover-control">
      <button
        className="up-control-btn up-speed-btn"
        onClick={() => setShowPopover(!showPopover)}
        title="倍速"
      >
        <Gauge size={20} />
        <span className="up-speed-label">{currentRate === 1 ? '倍速' : `${currentRate}x`}</span>
      </button>
      {showPopover && (
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
