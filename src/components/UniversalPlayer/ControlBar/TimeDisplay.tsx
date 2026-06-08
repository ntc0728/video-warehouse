interface TimeDisplayProps {
  currentTime: number;
  duration: number;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TimeDisplay({ currentTime, duration }: TimeDisplayProps) {
  return (
    <span className="up-time-display-inline" title="播放时间">
      {formatTime(currentTime)} / {formatTime(duration)}
    </span>
  );
}
