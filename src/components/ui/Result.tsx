import type { ReactNode } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Clock, Info } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'

type ResultStatus = 'success' | 'error' | 'warning' | 'waiting' | 'info'

interface ResultProps {
  status: ResultStatus
  title?: string
  description?: ReactNode
}

const statusConfig: Record<ResultStatus, { icon: typeof CheckCircle2; colorVar: string }> = {
  success: { icon: CheckCircle2, colorVar: 'var(--color-success)' },
  error: { icon: XCircle, colorVar: 'var(--color-error)' },
  warning: { icon: AlertTriangle, colorVar: 'var(--color-warning)' },
  waiting: { icon: Clock, colorVar: 'var(--color-text-tertiary)' },
  info: { icon: Info, colorVar: 'var(--color-primary)' },
}

function Result({ status, title, description }: ResultProps) {
  const { icon: StatusIcon, colorVar } = statusConfig[status]

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <Icon icon={StatusIcon} size="3xl" style={{ color: colorVar }} />
      {title && (
        <div className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
          {title}
        </div>
      )}
      {description && (
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
        </div>
      )}
    </div>
  )
}

export default Result
export type { ResultProps, ResultStatus }
