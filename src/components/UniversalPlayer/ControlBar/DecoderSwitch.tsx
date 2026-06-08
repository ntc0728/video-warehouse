import { useState, useCallback } from 'react';
import { Cpu } from 'lucide-react';
import type { DecoderMode } from '@/types/player';

interface DecoderSwitchProps {
  currentMode: DecoderMode;
  onChange: (mode: DecoderMode) => void;
  visible: boolean;
}

export default function DecoderSwitch({ currentMode, onChange, visible }: DecoderSwitchProps) {
  const [showPopover, setShowPopover] = useState(false);

  const handleSelect = useCallback((mode: DecoderMode) => {
    onChange(mode);
    setShowPopover(false);
  }, [onChange]);

  if (!visible) return null;

  return (
    <div className="up-popover-control">
      <button
        className={`up-control-btn ${currentMode === 'wasm' ? 'up-control-btn-active' : ''}`}
        onClick={() => setShowPopover(!showPopover)}
        title="解码器"
      >
        <Cpu size={20} />
      </button>
      {showPopover && (
        <div className="up-popover up-decoder-popover">
          <button
            className={`up-popover-item ${currentMode === 'native' ? 'up-popover-item-active' : ''}`}
            onClick={() => handleSelect('native')}
          >
            硬解
          </button>
          <button
            className={`up-popover-item ${currentMode === 'wasm' ? 'up-popover-item-active' : ''}`}
            onClick={() => handleSelect('wasm')}
          >
            软解
          </button>
        </div>
      )}
    </div>
  );
}

export function DecoderSwitchMenuItem({ currentMode, onChange, visible }: DecoderSwitchProps) {
  if (!visible) return null;

  return (
    <>
      <button
        className={`up-popover-item ${currentMode === 'native' ? 'up-popover-item-active' : ''}`}
        onClick={() => onChange('native')}
      >
        <Cpu size={16} />
        <span>硬解</span>
        {currentMode === 'native' && <span className="up-popover-item-check" />}
      </button>
      <button
        className={`up-popover-item ${currentMode === 'wasm' ? 'up-popover-item-active' : ''}`}
        onClick={() => onChange('wasm')}
      >
        <Cpu size={16} />
        <span>软解</span>
        {currentMode === 'wasm' && <span className="up-popover-item-check" />}
      </button>
    </>
  );
}