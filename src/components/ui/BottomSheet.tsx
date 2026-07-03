'use client'

import React, { useRef, useCallback, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import './BottomSheet.css'

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  className,
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ y: number; time: number } | null>(null)
  const currentTranslateRef = useRef(0)
  const isMobile = useMediaQuery('(max-width: 767px)')

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { y: touch.clientY, time: Date.now() }
    currentTranslateRef.current = 0
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !contentRef.current) return
    const touch = e.touches[0]
    const deltaY = touch.clientY - touchStartRef.current.y

    if (deltaY <= 0) {
      touchStartRef.current = null
      return
    }

    currentTranslateRef.current = deltaY
    contentRef.current.style.transform = `translateY(${deltaY}px)`
    contentRef.current.style.transition = 'none'
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !contentRef.current) return

    const el = contentRef.current
    const deltaY = currentTranslateRef.current
    const threshold = el.offsetHeight * 0.25

    if (deltaY > threshold) {
      onClose()
    } else {
      el.style.transition = 'transform 0.2s ease'
      el.style.transform = 'translateY(0)'
    }

    touchStartRef.current = null
    currentTranslateRef.current = 0
  }, [onClose])

  useEffect(() => {
    if (!visible && contentRef.current) {
      contentRef.current.style.transform = ''
      contentRef.current.style.transition = ''
    }
  }, [visible])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose()
    },
    [onClose],
  )

  // 移动端禁止弹窗打开时自动聚焦输入框（避免拉起键盘）
  const handleOpenAutoFocus = useCallback((e: Event) => {
    if (isMobile) {
      e.preventDefault()
    }
  }, [isMobile])

  return (
    <Dialog.Root open={visible} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bottomsheet-overlay" />
        <Dialog.Content
          ref={contentRef}
          className={`bottomsheet-content${className ? ` ${className}` : ''}`}
          onOpenAutoFocus={handleOpenAutoFocus}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-describedby={undefined}
        >
          <Dialog.Title className="bottomsheet__sr-title">
            {title || '面板'}
          </Dialog.Title>
          <div className="bottomsheet__handle" aria-hidden="true" />
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default BottomSheet
