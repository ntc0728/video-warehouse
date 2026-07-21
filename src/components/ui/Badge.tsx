import * as React from 'react';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'content'> {
  variant?: BadgeVariant;
  content?: string | number;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'bg-[var(--color-primary)] text-[var(--color-text-inverse)]',
  secondary:
    'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100',
  destructive:
    'bg-red-500 text-white',
  outline:
    'text-[var(--color-text)] border border-[var(--color-border)]',
};

function Badge({ variant = 'default', content, className = '', children, ...props }: BadgeProps) {
  const prevContentRef = React.useRef(content);
  const [animate, setAnimate] = React.useState(false);

  React.useEffect(() => {
    if (prevContentRef.current !== content && content !== undefined && content !== null) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 500);
      prevContentRef.current = content;
      return () => clearTimeout(timer);
    }
    prevContentRef.current = content;
  }, [content]);

  if (!children) {
    if (content === undefined || content === null) return null;
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[var(--radius-md)] px-[var(--space-xs)] py-0 text-[var(--text-xs)] leading-none ${variantClasses[variant]} ${animate ? 'badge-animate-pop' : ''} ${className}`}
        {...props}
      >
        {content}
      </span>
    );
  }

  return (
    <span className={`relative inline-flex ${className}`} {...props}>
      {children}
      {content !== undefined && content !== null && content !== '' && (
        <span
          className={`absolute -right-2 -top-2 inline-flex items-center justify-center rounded-[var(--radius-md)] px-[var(--space-xs)] py-0 text-[var(--text-xs)] leading-none ${variantClasses[variant]} ${animate ? 'badge-animate-pop' : ''}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

Badge.displayName = 'Badge';

export default Badge;
