import type { ReactNode } from 'react'

interface BadgeProps {
  content?: string | number
  className?: string
  children?: ReactNode
}

function Badge({ content, className = '', children }: BadgeProps) {
  if (!children) {
    if (content === undefined || content === null) return null
    return (
      <span
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] px-[var(--space-xs)] py-0 text-[var(--text-xs)] leading-none text-[var(--color-text-inverse)]"
        style={{ background: 'var(--color-primary)' }}
      >
        {content}
      </span>
    )
  }

  return (
    <span className={`relative inline-flex ${className}`}>
      {children}
      {content !== undefined && content !== null && content !== '' && (
        <span
          className="absolute -right-2 -top-2 inline-flex items-center justify-center rounded-[var(--radius-md)] px-[var(--space-xs)] py-0 text-[var(--text-xs)] leading-none text-[var(--color-text-inverse)]"
          style={{ background: 'var(--color-primary)' }}
        >
          {content}
        </span>
      )}
    </span>
  )
}

export default Badge
