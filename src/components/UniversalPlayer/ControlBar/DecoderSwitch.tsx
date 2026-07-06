import { Cpu } from 'lucide-react';
import type { DecoderMode } from '@/types/player';

interface DecoderSwitchProps {
  currentMode: DecoderMode;
  onChange: (mode: DecoderMode) => void;
  visible: boolean;
}

export function DecoderSwitchMenuItem({ currentMode, onChange, visible }: DecoderSwitchProps) {
  if (!visible) return null;

  const nextMode: DecoderMode = currentMode === 'native' ? 'wasm' : 'native';
  const label = currentMode === 'native' ? '硬解' : '软解';

  return (
    <button
      className="up-popover-item"
      onClick={() => onChange(nextMode)}
    >
      <Cpu size={16} />
      <span>{label}</span>
    </button>
  );
}
