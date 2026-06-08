import * as ProgressPrimitive from '@radix-ui/react-progress'

function ProgressBar() {
  return (
    <ProgressPrimitive.Root className="relative h-[var(--space-2xs)] w-full overflow-hidden rounded-[var(--space-2xs)] bg-[var(--color-border-light)]">
      <ProgressPrimitive.Indicator
        className="progress-bar-indicator h-full w-[40%] rounded-[var(--space-2xs)]"
        style={{ background: 'var(--color-primary)' }}
      />
      <style>{`
        @keyframes progress-bar-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes progress-bar-stripes {
          0% { background-position: 0 0; }
          100% { background-position: 20px 0; }
        }
        .progress-bar-indicator {
          animation: progress-bar-slide 1.5s ease-in-out infinite;
          background-image: linear-gradient(
            -45deg,
            var(--color-progress-stripe) 25%,
            transparent 25%,
            transparent 50%,
            var(--color-progress-stripe) 50%,
            var(--color-progress-stripe) 75%,
            transparent 75%,
            transparent
          );
          background-size: 20px 20px;
          animation: progress-bar-slide 1.5s ease-in-out infinite, progress-bar-stripes 0.75s linear infinite;
        }
      `}</style>
    </ProgressPrimitive.Root>
  )
}

export default ProgressBar
