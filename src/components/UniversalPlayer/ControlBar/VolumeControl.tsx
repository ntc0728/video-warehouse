import { useState, useCallback } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

interface VolumeControlProps {
  volume: number;
  onChange: (volume: number) => void;
}

export default function VolumeControl({ volume, onChange }: VolumeControlProps) {
  const [showSlider, setShowSlider] = useState(false);

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const handleToggleMute = useCallback(() => {
    onChange(volume === 0 ? 1 : 0);
  }, [volume, onChange]);

  return (
    <div
      className="up-volume-control"
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      <button className="up-control-btn" onClick={handleToggleMute} title="静音 (M)">
        <VolumeIcon size={20} />
      </button>
      {showSlider && (
        <div className="up-volume-slider-popup">
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
      )}
    </div>
  );
}
