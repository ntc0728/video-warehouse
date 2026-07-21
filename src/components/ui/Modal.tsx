'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CustomScrollbar } from '@/components/common'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface ModalProps {
  visible: boolean
  title?: string
  content?: React.ReactNode
  onClose?: () => void
  closeOnAction?: boolean
  children?: React.ReactNode
  className?: string
}

const Modal: React.FC<ModalProps> = ({
  visible,
  title,
  content,
  onClose,
  closeOnAction = true,
  children,
  className,
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const isMobile = useMediaQuery('(max-width: 767px)')

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && onClose) {
        onClose()
      }
    },
    [onClose]
  )

  // 移动端禁止弹窗打开时自动聚焦输入框（避免拉起键盘）
  const handleOpenAutoFocus = useCallback((e: Event) => {
    if (isMobile) {
      e.preventDefault()
    }
  }, [isMobile])

  useEffect(() => {
    if (visible) {
      previousFocusRef.current = document.activeElement as HTMLElement
    }
  }, [visible])

  useEffect(() => {
    if (!visible && previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return

    const isTV = navigator.userAgent.includes('SmartTV') || navigator.userAgent.includes('WebOS')

    if (!isTV) return

    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const timer = setTimeout(() => {
      const container = contentRef.current
      if (!container) return

      const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector)
      if (focusableElements.length > 0) {
        focusableElements[0].focus()
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [visible])

  const body = children ?? content

  return (
    <Dialog.Root open={visible} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay-animate" />
        <Dialog.Content
          ref={contentRef}
          className={`modal-content-animate ${className ?? ''}`}
          onOpenAutoFocus={handleOpenAutoFocus}
          onEscapeKeyDown={closeOnAction ? undefined : (e) => e.preventDefault()}
          onPointerDownOutside={closeOnAction ? undefined : (e) => e.preventDefault()}
          onInteractOutside={closeOnAction ? undefined : (e) => e.preventDefault()}
        >
          {title && (
            <Dialog.Title className="text-[var(--text-lg)] font-semibold text-[var(--color-text)] mb-[var(--space-md)]">
              {title}
            </Dialog.Title>
          )}
          {body && (
            <CustomScrollbar className="text-[var(--color-text-secondary)] leading-relaxed" direction="vertical" autoHideDelay={800}>
              {body}
            </CustomScrollbar>
          )}
          <Dialog.Close asChild>
            <button className="absolute top-[var(--space-sm)] right-[var(--space-sm)] flex items-center justify-center w-[var(--icon-xl)] h-[var(--icon-xl)] rounded-full bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-colors" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default Modal
