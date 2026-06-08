import * as React from 'react';

type ButtonSize = 'small' | 'middle' | 'large';
type ButtonColor = 'default' | 'primary';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  color?: ButtonColor;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
}

const sizeClasses: Record<ButtonSize, string> = {
  small: 'px-3 py-1 text-sm',
  middle: 'px-4 py-2 text-base',
  large: 'px-6 py-3 text-lg',
};

const colorClasses: Record<ButtonColor, string> = {
  default:
    'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600',
  primary:
    'bg-[var(--color-primary)] text-[var(--color-text-inverse)] hover:opacity-90 dark:bg-[var(--color-primary)]',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      size = 'middle',
      color = 'default',
      onClick,
      disabled = false,
      className = '',
      children,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={[
          'inline-flex items-center justify-center rounded-md font-medium',
          'min-h-[var(--comp-btn-min-width)]',
          'transition-colors duration-150 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          sizeClasses[size],
          colorClasses[color],
          className,
        ].join(' ')}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
