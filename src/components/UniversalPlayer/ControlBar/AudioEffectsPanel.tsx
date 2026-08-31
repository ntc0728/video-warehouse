import { X, Volume2 } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { usePlayerStore } from '@/stores';
import type { AudioPreset } from '@/stores/usePlayerStore';

const PRESETS: { key: AudioPreset; label: string }[] = [
  { key: 'off', label: '关闭' },
  { key: 'pop', label: '流行' },
  { key: 'rock', label: '摇滚' },
  { key: 'classical', label: '古典' },
  { key: 'bass', label: '重低音' },
  { key: 'vocal', label: '人声' },
  { key: 'treble', label: '高音增强' },
  { key: '3d', label: '3D 环绕' },
];

/**
 * Issue4 视频音效调节弹窗：EQ 预设 + 声道平衡 + 音量增强，含重置。
 * 经 Web Audio 图谱（useAudioEffects）应用到 <video> 音频；默认态不构建图谱，零风险。
 */
export default function AudioEffectsPanel({ onClose }: { onClose: () => void }) {
  const audioEffect = usePlayerStore((s) => s.audioEffect);
  const setAudioEffect = usePlayerStore((s) => s.setAudioEffect);

  const balanceLabel =
    audioEffect.balance === 0
      ? '居中'
      : audioEffect.balance < 0
        ? `左 ${Math.round(-audioEffect.balance * 100)}`
        : `右 ${Math.round(audioEffect.balance * 100)}`;

  return (
    <div className="up-settings-panel" role="dialog" aria-label="视频音效调节" onClick={(e) => e.stopPropagation()}>
      <div className="up-settings-panel__header">
        <span className="up-settings-panel__title">视频音效调节</span>
        <button className="up-settings-panel__close" type="button" onClick={onClose} aria-label="关闭">
          <Icon icon={X} size="sm" />
        </button>
      </div>
      <div className="up-settings-panel__body">
        <div className="up-settings-presets">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`up-settings-preset ${audioEffect.preset === p.key ? 'is-active' : ''}`}
              onClick={() => setAudioEffect({ preset: p.key })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="up-settings-row">
          <Icon icon={Volume2} size="sm" className="up-settings-row__icon" />
          <span className="up-settings-row__label">声道平衡</span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={audioEffect.balance}
            onChange={(e) => setAudioEffect({ balance: parseFloat(e.target.value) })}
            className="up-settings-slider"
            aria-label="声道平衡"
          />
          <span className="up-settings-row__value">{balanceLabel}</span>
        </label>
        <label className="up-settings-row">
          <Icon icon={Volume2} size="sm" className="up-settings-row__icon" />
          <span className="up-settings-row__label">音量增强</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.01}
            value={audioEffect.gain}
            onChange={(e) => setAudioEffect({ gain: parseFloat(e.target.value) })}
            className="up-settings-slider"
            aria-label="音量增强"
          />
          <span className="up-settings-row__value">{Math.round(audioEffect.gain * 100)}%</span>
        </label>
      </div>
      <div className="up-settings-panel__footer">
        <button
          type="button"
          className="up-settings-reset"
          onClick={() => setAudioEffect({ preset: 'off', balance: 0, gain: 1 })}
        >
          重置
        </button>
      </div>
    </div>
  );
}
