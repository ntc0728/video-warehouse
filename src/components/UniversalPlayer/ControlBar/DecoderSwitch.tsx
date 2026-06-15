import { useState, useCallback, useRef, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import type { DecoderMode } from '@/types/player';

interface DecoderSwitchProps {
  currentMode: DecoderMode;
  onChange: (mode: DecoderMode) => void;
  visible: boolean;
}

const DECODER_OPTIONS: { mode: DecoderMode; label: string }[] = [
  { mode: 'native', label: '硬解' },
  { mode: 'wasm', label: '软解' },
];

export default function DecoderSwitch({ currentMode, onChange, visible }: DecoderSwitchProps) {
  const [showPopover, setShowPopover] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback((mode: DecoderMode) => {
    onChange(mode);
    setShowPopover(false);
  }, [onChange]);

  useEffect(() => {
    if (!showPopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  if (!visible) return null;

  const currentLabel = DECODER_OPTIONS.find(o => o.mode === currentMode)?.label ?? '硬解';

  return (
    <div className="up-popover-control" ref={containerRef}>
      <button
        className="up-control-btn"
        onClick={() => setShowPopover(!showPopover)}
        title="解码方式"
      >
        <Cpu size={20} />
        <span className="up-speed-label">{currentLabel}</span>
      </button>
      {showPopover && (
        <div className="up-popover up-decoder-popover">
          {DECODER_OPTIONS.map(opt => (
            <button
              key={opt.mode}
              className={`up-popover-item ${opt.mode === currentMode ? 'up-popover-item-active' : ''}`}
              onClick={() => handleSelect(opt.mode)}
            >
              <span>{opt.label}</span>
              {opt.mode === currentMode && <span className="up-popover-item-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
