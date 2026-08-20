import { useCallback, useRef } from 'react';
import { Volume, Volume2, Volume1, VolumeX } from 'lucide-react';
import { DuoIcon } from '@/components/ui/DuoIcon';

interface VolumeControlProps {
  volume: number;
  onChange: (volume: number) => void;
  /** C2：统一静音入口（记忆原音量），与键盘 M 共用 toggleMute */
  onToggleMute?: () => void;
  /** G2：音量变化时弹出 3s 音量条 */
  onVolumePopup?: () => void;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
}

const POPOVER_ID = 'volume';

export default function VolumeControl({ volume, onChange, onToggleMute, onVolumePopup, activePopover, onPopoverChange }: VolumeControlProps) {
  const isOpen = activePopover === POPOVER_ID;
  const isTouchRef = useRef(false);

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  // hover 近似变体：静音→Volume、低→Volume2、高→Volume1（相邻级别图标微跳）
  const VolumeIconAlt = volume === 0 ? Volume : volume < 0.5 ? Volume2 : Volume1;

  const handleToggleMute = useCallback(() => {
    if (isTouchRef.current) {
      isTouchRef.current = false;
      return;
    }
    // C2：统一走 toggleMute（记忆原音量）；未提供时回退旧行为
    if (onToggleMute) {
      onToggleMute();
    } else {
      onChange(volume === 0 ? 1 : 0);
    }
  }, [volume, onChange, onToggleMute]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
    onVolumePopup?.();
  }, [onChange, onVolumePopup]);

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
        <DuoIcon primary={VolumeIcon} secondary={VolumeIconAlt} size="md" />
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
              onChange={handleSliderChange}
              className="up-volume-slider"
            />
          </div>
        </div>
      )}
    </div>
  );
}
