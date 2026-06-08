import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useToastQueue, dequeue, markVisible, type ToastItem } from './toastBus';

function ToastContainer({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const removeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setVisible(true);
      markVisible(item.id);
    });

    timerRef.current = setTimeout(() => {
      setVisible(false);
      removeTimerRef.current = setTimeout(() => {
        onDone(item.id);
      }, 300);
    }, item.duration);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timerRef.current);
      clearTimeout(removeTimerRef.current);
    };
  }, [item.id, item.duration, onDone]);

  return (
    <div
      className={`
        fixed left-1/2 -translate-x-1/2 z-[9999]
        px-[var(--space-md)] py-[var(--space-sm)]
        rounded-[var(--radius-md)]
        shadow-[var(--shadow-card)]
        max-w-[80vw] text-center
        whitespace-pre-line break-words
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100' : 'opacity-0'}
        bottom-[env(safe-area-inset-bottom,16px)+2rem] md:bottom-auto md:top-6
        ${visible ? 'translate-y-0' : 'translate-y-4 md:-translate-y-4'}
      `}
      style={{
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text)',
      }}
    >
      <span className="text-sm leading-5">{item.content}</span>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const items = useToastQueue();

  const handleDone = useCallback((id: number) => {
    dequeue(id);
  }, []);

  const activeItem = items.length > 0 ? items[0] : null;

  if (!activeItem) return <>{children}</>;

  return (
    <>
      {children}
      {createPortal(
        <div data-theme={document.documentElement.getAttribute('data-theme') ?? undefined}>
          <ToastContainer item={activeItem} onDone={handleDone} />
        </div>,
        document.body,
      )}
    </>
  );
}
