'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CustomScrollbar } from '@/components/common'

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

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && onClose) {
        onClose()
      }
    },
    [onClose]
  )

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
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          ref={contentRef}
          className={`modal-content${className ? ` ${className}` : ''}`}
          onEscapeKeyDown={closeOnAction ? undefined : (e) => e.preventDefault()}
          onPointerDownOutside={closeOnAction ? undefined : (e) => e.preventDefault()}
          onInteractOutside={closeOnAction ? undefined : (e) => e.preventDefault()}
        >
          {title && <Dialog.Title className="modal-title">{title}</Dialog.Title>}
          {body && (
            <CustomScrollbar className="modal-body" direction="vertical" autoHideDelay={800}>
              {body}
            </CustomScrollbar>
          )}
          <Dialog.Close asChild>
            <button className="modal-close" aria-label="Close">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15 5L5 15M5 5l10 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default Modal
