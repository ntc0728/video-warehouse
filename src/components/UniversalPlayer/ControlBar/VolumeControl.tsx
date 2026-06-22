import { useCallback, useRef, useEffect } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

interface VolumeControlProps {
  volume: number;
  onChange: (volume: number) => void;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
}

const POPOVER_ID = 'volume';
const HIDE_DELAY = 300;

export default function VolumeControl({ volume, onChange, activePopover, onPopoverChange }: VolumeControlProps) {
  const isOpen = activePopover === POPOVER_ID;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchRef = useRef(false);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

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

  const handleSliderPointerDown = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleSliderPointerUp = useCallback(() => {
    hideTimerRef.current = setTimeout(() => {
      onPopoverChange(null);
      hideTimerRef.current = null;
    }, HIDE_DELAY);
  }, [onPopoverChange]);

  return (
    <div
      className="up-volume-control"
      onMouseEnter={() => onPopoverChange(POPOVER_ID)}
      onMouseLeave={() => onPopoverChange(null)}
    >
      <button
        className="up-control-btn"
        onClick={handleToggleMute}
        onTouchStart={handleButtonTouch}
        title="静音 (M)"
      >
        <VolumeIcon size={20} />
      </button>
      {isOpen && (
        <div className="up-volume-slider-popup">
          <span className="up-volume-value">{Math.round(volume * 100)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            onPointerDown={handleSliderPointerDown}
            onPointerUp={handleSliderPointerUp}
            onTouchEnd={handleSliderPointerUp}
            className="up-volume-slider"
            style={{ '--vol': `${volume * 100}%` } as React.CSSProperties}
          />
        </div>
      )}
    </div>
  );
}
