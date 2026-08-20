import { Sun, Volume2 } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';

interface BrightnessVolumeIndicatorProps {
  visible: boolean;
  axis: 'brightness' | 'volume' | null;
  brightness: number;
  volume: number;
}

/**
 * G7-G10：移动端纵向滑动调节亮度/音量的指示器（柱状图 + 图标 + 数值）。
 * 纯展示组件，位置居中、自动隐藏由 useTouchGesture 控制。
 */
export default function BrightnessVolumeIndicator({
  visible,
  axis,
  brightness,
  volume,
}: BrightnessVolumeIndicatorProps) {
  if (!visible || !axis) return null;

  const value = axis === 'brightness' ? (brightness - 0.1) / 1.9 : volume;
  const pct = Math.round((axis === 'brightness' ? brightness : volume) * 100);

  return (
    <div className={`up-gesture-indicator up-gesture-indicator--${axis}`}>
      <Icon icon={axis === 'brightness' ? Sun : Volume2} size="lg" />
      <div className="up-gesture-indicator__bar">
        <div
          className="up-gesture-indicator__fill"
          style={{ height: `${Math.max(2, Math.min(100, value * 100))}%` }}
        />
      </div>
      <span className="up-gesture-indicator__value">
        {axis === 'brightness' ? `${pct}%` : `${Math.min(100, pct)}%`}
      </span>
    </div>
  );
}