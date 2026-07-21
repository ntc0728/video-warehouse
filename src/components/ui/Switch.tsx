import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onChange, disabled = false, className = '' }, ref) => {
    return (
      <SwitchPrimitive.Root
        ref={ref}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className={`peer inline-flex h-[var(--switch-track-height)] w-[var(--switch-track-width)] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-[var(--color-primary)]' : 'bg-gray-300 dark:bg-gray-600'} ${className}`}
      >
        <SwitchPrimitive.Thumb
          className={`pointer-events-none block h-[var(--switch-thumb-size)] w-[var(--switch-thumb-size)] rounded-full bg-[var(--color-text-inverse)] shadow-lg ring-0 transition-transform duration-200 switch-thumb-spring ${checked ? 'translate-x-[var(--switch-thumb-offset)]' : 'translate-x-[var(--space-2xs)]'}`}
        />
      </SwitchPrimitive.Root>
    );
  }
);

Switch.displayName = 'Switch';

export default Switch;
