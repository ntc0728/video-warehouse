import { X, Sun, Droplet, Contrast } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { usePlayerStore } from '@/stores';
import type { ColorFilter } from '@/stores/usePlayerStore';

const FIELDS: { key: keyof ColorFilter; label: string; icon: typeof Sun; min: number; max: number }[] = [
  { key: 'brightness', label: '亮度', icon: Sun, min: 0, max: 2 },
  { key: 'saturation', label: '饱和度', icon: Droplet, min: 0, max: 2 },
  { key: 'contrast', label: '对比度', icon: Contrast, min: 0, max: 2 },
];

/**
 * Issue4 视频色彩调整弹窗：亮度 / 饱和度 / 对比度（CSS filter），含重置。
 * 与移动端纵向滑动手势共用 store.colorFilter（手势只改 brightness），PlayerCore 统一应用。
 */
export default function ColorAdjustPanel({ onClose }: { onClose: () => void }) {
  const colorFilter = usePlayerStore((s) => s.colorFilter);
  const setColorFilter = usePlayerStore((s) => s.setColorFilter);

  return (
    <div className="up-settings-panel" role="dialog" aria-label="视频色彩调整" onClick={(e) => e.stopPropagation()}>
      <div className="up-settings-panel__header">
        <span className="up-settings-panel__title">视频色彩调整</span>
        <button className="up-settings-panel__close" type="button" onClick={onClose} aria-label="关闭">
          <Icon icon={X} size="sm" />
        </button>
      </div>
      <div className="up-settings-panel__body">
        {FIELDS.map((f) => (
          <label key={f.key} className="up-settings-row up-settings-row--color">
            <Icon icon={f.icon} size="sm" className="up-settings-row__icon" />
            <span className="up-settings-row__label">{f.label}</span>
            <input
              type="range"
              min={f.min}
              max={f.max}
              step={0.01}
              value={colorFilter[f.key]}
              onChange={(e) =>
                setColorFilter({ [f.key]: parseFloat(e.target.value) } as Partial<ColorFilter>)
              }
              className="up-settings-slider"
              aria-label={f.label}
            />
            <span className="up-settings-row__value">{Math.round(colorFilter[f.key] * 100)}%</span>
          </label>
        ))}
      </div>
      <div className="up-settings-panel__footer">
        <button
          type="button"
          className="up-settings-reset"
          onClick={() => setColorFilter({ brightness: 1, saturation: 1, contrast: 1 })}
        >
          重置
        </button>
      </div>
    </div>
  );
}
