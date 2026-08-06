import { useCallback } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import Button from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel?: () => void;
  className?: string;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger',
  onConfirm,
  onCancel,
  className,
}: ConfirmDialogProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  const handleCancel = useCallback(() => {
    onCancel?.();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  const handleConfirm = useCallback(() => {
    onConfirm();
    onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  // 移动端禁止弹窗打开时自动聚焦输入框（避免拉起键盘）
  const handleOpenAutoFocus = useCallback((e: Event) => {
    if (isMobile) {
      e.preventDefault();
    }
  }, [isMobile]);

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="modal-overlay-animate" />
        <AlertDialog.Content
          className={`confirm-dialog-content ${className ?? ''}`}
          onOpenAutoFocus={handleOpenAutoFocus}
        >
          <AlertDialog.Title className="text-[var(--text-lg)] font-semibold text-[var(--color-text)] mb-[var(--space-md)]">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="text-[var(--text-base)] text-[var(--color-text-secondary)] leading-relaxed mb-[var(--space-lg)]">
              {description}
            </AlertDialog.Description>
          )}
          <div className="flex justify-center gap-[var(--space-sm)]">
            <AlertDialog.Cancel asChild>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                {cancelText}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button size="sm" variant={variant === 'danger' ? 'destructive' : 'default'} onClick={handleConfirm}>
                {confirmText}
              </Button>
            </AlertDialog.Action>
          </div>
          {/* 关闭按钮：仅关闭对话框，不触发 onCancel */}
          <button
            className="absolute top-[var(--space-sm)] right-[var(--space-sm)] flex items-center justify-center w-[var(--icon-lg)] h-[var(--icon-lg)] rounded-[var(--radius-sm)] bg-transparent text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-colors"
            aria-label="关闭"
            onClick={() => onOpenChange(false)}
          >
            <svg style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
