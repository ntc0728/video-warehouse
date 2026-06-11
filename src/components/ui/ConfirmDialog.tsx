import { useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';

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
}: ConfirmDialogProps) {
  const handleCancel = useCallback(() => {
    onCancel?.();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  const handleConfirm = useCallback(() => {
    onConfirm();
    onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="confirm-overlay" />
        <Dialog.Content className="confirm-content">
          <div className="confirm-icon">
            <AlertTriangle size={24} />
          </div>
          <Dialog.Title className="confirm-title">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="confirm-description">{description}</Dialog.Description>
          )}
          <div className="confirm-actions">
            <Dialog.Close asChild>
              <button type="button" className="confirm-btn confirm-btn--cancel" onClick={handleCancel}>
                {cancelText}
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={`confirm-btn confirm-btn--confirm ${variant === 'danger' ? 'confirm-btn--danger' : ''}`}
              onClick={handleConfirm}
            >
              {confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
