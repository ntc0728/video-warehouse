import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

interface RadioProps {
  value: string;
  children?: React.ReactNode;
}

const RadioItem = React.forwardRef<HTMLButtonElement, RadioProps>(
  ({ value, children }, ref) => {
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <RadioGroupPrimitive.Item
          ref={ref}
          value={value}
          className={[
            'h-[var(--radio-size)] w-[var(--radio-size)] rounded-full',
            'border-2 border-gray-300 bg-white',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
            'hover:border-[var(--color-primary)]',
            'data-[state=checked]:border-[var(--color-primary)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:bg-gray-800 dark:border-gray-600',
          ].join(' ')}
        >
          <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
            <div className="h-[var(--radio-dot-size)] w-[var(--radio-dot-size)] rounded-full bg-[var(--color-primary)]" />
          </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
        {children && (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {children}
          </span>
        )}
      </label>
    );
  }
);

RadioItem.displayName = 'Radio';

interface RadioGroupProps {
  value?: string;
  onChange?: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, onChange, children, className = '' }, ref) => {
    return (
      <RadioGroupPrimitive.Root
        ref={ref}
        value={value}
        onValueChange={onChange}
        className={['flex flex-col gap-2', className].join(' ')}
      >
        {children}
      </RadioGroupPrimitive.Root>
    );
  }
);

RadioGroup.displayName = 'Radio.Group';

const Radio = Object.assign(RadioItem, { Group: RadioGroup });

export default Radio;
