import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { useIsMobile } from '@/hooks/useMediaQuery';

interface DatePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (value: Date) => void;
  defaultValue?: Date;
  min?: Date;
  max?: Date;
  precision?: 'day' | 'month' | 'year';
  title?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
  visible,
  onClose,
  onConfirm,
  defaultValue,
  min,
  max,
  precision = 'day',
  title = '选择日期',
}) => {
  const [selected, setSelected] = useState<Date | undefined>(defaultValue);
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) {
      setSelected(defaultValue);
    }
  }, [visible, defaultValue]);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const focused = document.activeElement as HTMLElement;
      const index = Array.from(focusable).indexOf(focused);

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = (index + 1) % focusable.length;
        focusable[next]?.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = (index - 1 + focusable.length) % focusable.length;
        focusable[prev]?.focus();
      } else if (e.key === 'Enter' && focused) {
        e.preventDefault();
        focused.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  const handleSelect = useCallback((date: Date | undefined) => {
    setSelected(date ?? undefined);
  }, []);

  const handleConfirm = useCallback(() => {
    if (selected) {
      onConfirm(selected);
    }
    onClose();
  }, [selected, onConfirm, onClose]);

  const dayPickerProps = useMemo(() => {
    const disabledMatchers: (Date | { before: Date; after: Date })[] = [];
    if (min || max) {
      const matcher: { before?: Date; after?: Date } = {};
      if (min) matcher.before = min;
      if (max) matcher.after = max;
      disabledMatchers.push(matcher as { before: Date; after: Date });
    }

    const base = {
      mode: 'single' as const,
      selected,
      onSelect: handleSelect,
      defaultMonth: selected ?? new Date(),
      disabled: disabledMatchers.length > 0 ? disabledMatchers : undefined,
      classNames: {
        months: 'flex flex-col',
        month: 'flex flex-col',
        month_caption: 'flex items-center justify-between px-2 py-2 text-[var(--color-text)]',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center gap-1',
        button_previous: 'inline-flex items-center justify-center rounded-md p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] outline-none',
        button_next: 'inline-flex items-center justify-center rounded-md p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] outline-none',
        weekdays: 'grid grid-cols-7 text-center',
        weekday: 'text-xs text-[var(--color-text-secondary)] py-1',
        week: 'grid grid-cols-7',
        day: 'text-center',
        day_button: 'inline-flex items-center justify-center rounded-md text-sm w-8 h-8 text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] outline-none transition-colors',
        selected: 'bg-[var(--color-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-primary)] font-bold',
        today: 'font-bold text-[var(--color-primary)]',
        disabled: 'text-[var(--color-text-secondary)] opacity-40 cursor-not-allowed',
        outside: 'text-[var(--color-text-secondary)] opacity-40',
      },
    };

    if (precision === 'year') {
      return { ...base, captionLayout: 'dropdown-years' as const, fromYear: min?.getFullYear() ?? 1900, toYear: max?.getFullYear() ?? 2100 };
    }

    if (precision === 'month') {
      return { ...base, captionLayout: 'dropdown-months' as const, fromYear: min?.getFullYear() ?? 1900, toYear: max?.getFullYear() ?? 2100 };
    }

    return base;
  }, [selected, handleSelect, min, max, precision]);

  if (!visible) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      onClick={onClose}
    />
  );

  const header = (
    <div className="flex items-center justify-between border-b border-[var(--color-border-light)] px-4 py-3">
      <button
        onClick={onClose}
        className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] outline-none rounded px-2 py-1"
      >
        取消
      </button>
      <span className="text-sm font-medium text-[var(--color-text)]">{title}</span>
      <button
        onClick={handleConfirm}
        className="text-sm text-[var(--color-primary)] hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] outline-none rounded px-2 py-1"
      >
        确认
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {overlay}
        <div
          ref={panelRef}
          className="fixed bottom-0 left-0 right-0 z-50 animate-[slideUp_0.3s_ease] rounded-t-xl bg-[var(--color-surface)] shadow-lg"
        >
          {header}
          <div className="px-4 py-3">
            <DayPicker {...dayPickerProps} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {overlay}
      <div
        ref={panelRef}
        className="fixed left-1/2 top-1/2 z-50 w-[var(--layout-datepicker-width)] -translate-x-1/2 -translate-y-1/2 animate-[fadeIn_0.2s_ease] rounded-xl bg-[var(--color-surface)] shadow-xl"
      >
        {header}
        <div className="px-4 py-3">
          <DayPicker {...dayPickerProps} />
        </div>
      </div>
    </>
  );
};

export default DatePicker;
