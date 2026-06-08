import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value?: number | number[];
  onChange?: (value: number | number[]) => void;
  disabled?: boolean;
  className?: string;
}

const Slider = React.forwardRef<HTMLSpanElement, SliderProps>(
  (
    {
      min = 0,
      max = 100,
      step = 1,
      value = [0],
      onChange,
      disabled = false,
      className = '',
    },
    ref
  ) => {
    const sliderValue = Array.isArray(value) ? value : [value];

    const handleChange = (newValue: number[]) => {
      if (!onChange) return;
      if (Array.isArray(value)) {
        onChange(newValue);
      } else {
        onChange(newValue[0]);
      }
    };

    return (
      <SliderPrimitive.Root
        ref={ref}
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        onValueChange={handleChange}
        disabled={disabled}
        className={[
          'relative flex w-full touch-none select-none items-center',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        ].join(' ')}
      >
        <SliderPrimitive.Track className="relative h-[var(--space-xs)] w-full grow overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <SliderPrimitive.Range className="absolute h-full bg-[var(--color-primary)]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={[
            'block h-[var(--comp-thumb-size)] w-[var(--comp-thumb-size)] rounded-full',
            'bg-[var(--color-text-inverse)] shadow-md border-2 border-[var(--color-primary)]',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
            'hover:border-[var(--color-primary)]',
            'disabled:cursor-not-allowed',
          ].join(' ')}
        />
      </SliderPrimitive.Root>
    );
  }
);

Slider.displayName = 'Slider';

export default Slider;
