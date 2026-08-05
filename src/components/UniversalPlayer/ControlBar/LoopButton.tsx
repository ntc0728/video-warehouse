import { Repeat, Repeat1 } from 'lucide-react';
import type { LoopMode } from '@/types/player';
import { Icon } from '@/components/ui/Icon';
import { DuoIcon } from '@/components/ui/DuoIcon';

interface LoopButtonProps {
  mode: LoopMode;
  onChange: (mode: LoopMode) => void;
}

const LOOP_CYCLE: LoopMode[] = ['none', 'single', 'list'];

export function LoopButtonMenuItem({ mode, onChange }: LoopButtonProps) {
  const nextMode: LoopMode = LOOP_CYCLE[(LOOP_CYCLE.indexOf(mode) + 1) % LOOP_CYCLE.length];
  const label = mode === 'none' ? '不循环' : mode === 'single' ? '单集循环' : '列表循环';
  const nextLabel = nextMode === 'none' ? '不循环' : nextMode === 'single' ? '单集循环' : '列表循环';
  return (
    <button className="up-popover-item" onClick={() => onChange(nextMode)}>
      <Icon icon={Repeat} size="sm" />
      <span>{label} → {nextLabel}</span>
    </button>
  );
}

export default function LoopButton({ mode, onChange }: LoopButtonProps) {
  const handleClick = () => {
    const idx = LOOP_CYCLE.indexOf(mode);
    const next = LOOP_CYCLE[(idx + 1) % LOOP_CYCLE.length];
    onChange(next);
  };

  const label = mode === 'none' ? '循环' : mode === 'single' ? '单集循环' : '列表循环';

  return (
    <button
      onClick={handleClick}
      title={`${label} (L)`}
      aria-label={label}
      aria-pressed={mode !== 'none'}
    >
      {mode === 'single'
        ? <DuoIcon primary={Repeat1} secondary={Repeat} size="md" />
        : <DuoIcon primary={Repeat} secondary={Repeat1} size="md" />}
    </button>
  );
}
