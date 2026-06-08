import { useRef, useCallback, useState, useEffect } from 'react';
import type { PlayerMode } from '@/types/player';

interface ProgressBarProps {
  mode: PlayerMode;
  currentTime: number;
  duration: number;
  buffered: number;
  onSeek: (time: number) => void;
}

export default function ProgressBar({ mode, currentTime, duration, buffered, onSeek }: ProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);

  const isLive = mode === 'live';

  const calcTime = useCallback((clientX: number): number => {
    if (!barRef.current || duration <= 0) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLive) return;
    setIsDragging(true);
    const time = calcTime(e.clientX);
    onSeek(time);
  }, [isLive, calcTime, onSeek]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(ratio * duration);
    setHoverPosition(ratio * 100);
    if (isDragging) {
      onSeek(ratio * duration);
    }
  }, [duration, isDragging, onSeek]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (barRef.current && duration > 0) {
          const rect = barRef.current.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          onSeek(ratio * duration);
        }
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('mousemove', handleGlobalMouseMove);
      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        window.removeEventListener('mousemove', handleGlobalMouseMove);
      };
    }
  }, [isDragging, duration, onSeek]);

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const progress = duration > 0 && Number.isFinite(duration) ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 && Number.isFinite(duration) ? (buffered / duration) * 100 : 0;

  return (
    <div className="up-progress-container">
      {!isLive && (
        <span className="up-time-display">{formatTime(currentTime)}</span>
      )}
      <div
        ref={barRef}
        className={`up-progress-bar ${isLive ? 'up-progress-live' : ''} ${isDragging ? 'up-progress-dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setHoverTime(null)}
      >
        <div className="up-progress-buffered" style={{ width: `${bufferedPercent}%` }} />
        <div className="up-progress-played" style={{ width: `${progress}%` }} />
        {!isLive && (
          <div className="up-progress-thumb" style={{ left: `${progress}%` }} />
        )}
        {hoverTime !== null && !isLive && (
          <div className="up-progress-tooltip" style={{ left: `${hoverPosition}%` }}>
            {formatTime(hoverTime)}
          </div>
        )}
      </div>
      {!isLive && (
        <span className="up-time-display">{formatTime(duration)}</span>
      )}
    </div>
  );
}
