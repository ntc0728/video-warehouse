import * as ProgressPrimitive from '@radix-ui/react-progress'

function ProgressBar() {
  return (
    <ProgressPrimitive.Root className="progress-bar-root relative h-[var(--space-2xs)] w-full overflow-hidden rounded-[var(--space-2xs)] bg-[var(--color-border-light)]">
      <ProgressPrimitive.Indicator className="progress-bar-indicator h-full w-[40%] rounded-[var(--space-2xs)]" />
    </ProgressPrimitive.Root>
  )
}

export default ProgressBar
