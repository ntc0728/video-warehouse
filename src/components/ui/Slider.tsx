import * as React from 'react';
import './Slider.css';

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange?: (value: number) => void;
  'aria-label'?: string;
  className?: string;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      onChange,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
    return (
      <input
        ref={ref}
        type="range"
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className={`ui-slider ${className}`}
        style={{ ['--slider-pct' as string]: `${pct}%` } as React.CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(Number(e.target.value))}
        {...rest}
      />
    );
  },
);

Slider.displayName = 'Slider';

export default Slider;
