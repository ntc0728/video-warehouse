import { useEffect, useRef, useState } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';
import './IPTVOSDBar.css';

interface VolumePopupProps {
  visible: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

const AUTO_HIDE_DELAY = 3000;

export default function VolumePopup({
  visible,
  volume,
  onVolumeChange,
}: VolumePopupProps) {
  const [localVisible, setLocalVisible] = useState(visible);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setLocalVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setLocalVisible(false);
      }, AUTO_HIDE_DELAY);
    } else {
      setLocalVisible(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onVolumeChange(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLocalVisible(false);
    }, AUTO_HIDE_DELAY);
  };

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      className={`iptv-volume-popup ${localVisible ? 'iptv-volume-visible' : 'iptv-volume-hidden'}`}
    >
      <div className="iptv-volume-icon">
        <VolumeIcon size={28} />
      </div>
      <div className="iptv-volume-slider-wrapper">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolumeChange}
          className="iptv-volume-slider"
        />
      </div>
      <span className="iptv-volume-percent">
        {Math.round(volume * 100)}%
      </span>
    </div>
  );
}