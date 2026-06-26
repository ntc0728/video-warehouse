import { Repeat, Repeat1 } from 'lucide-react';
import type { LoopMode } from '@/types/player';

interface LoopButtonProps {
  mode: LoopMode;
  onChange: (mode: LoopMode) => void;
}

const LOOP_CYCLE: LoopMode[] = ['none', 'single', 'list'];

export default function LoopButton({ mode, onChange }: LoopButtonProps) {
  const handleClick = () => {
    const idx = LOOP_CYCLE.indexOf(mode);
    const next = LOOP_CYCLE[(idx + 1) % LOOP_CYCLE.length];
    onChange(next);
  };

  const label = mode === 'none' ? '循环' : mode === 'single' ? '单集循环' : '列表循环';

  return (
    <button
      className={`up-control-btn ${mode !== 'none' ? 'up-control-btn-active' : ''}`}
      onClick={handleClick}
      title={`${label} (L)`}
      aria-label={label}
      aria-pressed={mode !== 'none'}
    >
      {mode === 'single' ? <Repeat1 size={20} /> : <Repeat size={20} />}
    </button>
  );
}
