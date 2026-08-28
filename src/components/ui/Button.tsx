import * as React from 'react';

type ButtonVariant = 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-primary text-text-inverse hover:opacity-90',
  outline:
    'bg-transparent text-text-primary border border-border hover:bg-surface-hover',
  destructive:
    'bg-error text-text-inverse hover:opacity-90',
  secondary:
    'bg-surface-hover text-text-primary hover:opacity-80',
  ghost:
    'hover:bg-surface-hover text-text-primary',
  link:
    'text-primary underline-offset-4 hover:underline',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'px-4 py-2 text-base',
  sm: 'px-3 py-1 text-sm',
  lg: 'px-6 py-3 text-lg',
  icon: 'h-10 w-10',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'default',
      onClick,
      disabled = false,
      className = '',
      children,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    // 若调用方通过 className 显式指定圆角（rounded-*），则不加默认 rounded-md，
    // 避免原子类顺序导致 rounded-md 覆盖 rounded-full（如弹窗胶囊按钮）
    const rounded = /rounded-\S+/.test(className) ? '' : 'rounded-md';
    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={[
          'inline-flex items-center justify-center font-medium',
          rounded,
          'min-h-[var(--comp-btn-min-width)]',
          'transition-[color,transform] duration-150 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
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
