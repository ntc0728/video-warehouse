import { useCallback, useRef } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';

interface VolumeControlProps {
  volume: number;
  onChange: (volume: number) => void;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
}

const POPOVER_ID = 'volume';

export default function VolumeControl({ volume, onChange, activePopover, onPopoverChange }: VolumeControlProps) {
  const isOpen = activePopover === POPOVER_ID;
  const isTouchRef = useRef(false);

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const handleToggleMute = useCallback(() => {
    if (isTouchRef.current) {
      isTouchRef.current = false;
      return;
    }
    onChange(volume === 0 ? 1 : 0);
  }, [volume, onChange]);

  const handleButtonTouch = useCallback(() => {
    isTouchRef.current = true;
    if (isOpen) {
      onPopoverChange(null);
    } else {
      onPopoverChange(POPOVER_ID);
    }
  }, [isOpen, onPopoverChange]);

  return (
    <div
      className="up-volume-control"
      onMouseEnter={() => onPopoverChange(POPOVER_ID)}
      onMouseLeave={() => onPopoverChange(null)}
    >
      <button
        onClick={handleToggleMute}
        onTouchStart={handleButtonTouch}
        title="静音 (M)"
      >
        <Icon icon={VolumeIcon} size="md" />
      </button>
      {isOpen && (
        <div className="up-volume-slider-popup" style={{ touchAction: 'none' }}>
          <span className="up-volume-value">{Math.round(volume * 100)}</span>
          <div className="up-volume-slider-wrapper" style={{ '--vol-fill': `${volume * 100}%` } as React.CSSProperties}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              className="up-volume-slider"
            />
          </div>
        </div>
      )}
    </div>
  );
}
