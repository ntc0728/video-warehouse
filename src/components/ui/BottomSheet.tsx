'use client'

import React, { useRef, useCallback, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useIsMobileLayout } from '@/hooks/useMediaQuery'

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  /**
   * Portal 容器（Radix Dialog.Portal container）。默认 body。
   * 播放器全屏场景必须传入播放器容器：fullscreen-api 档下 container 处于浏览器
   * top layer，body 下的弹窗会被完全盖住；伪全屏 container z-index 9998 同样盖住。
   * （Radix Portal 仅在 open 时挂载，届时传入的 DOM 节点必然已存在。）
   */
  portalContainer?: HTMLElement | null
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  className,
  portalContainer,
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ y: number; time: number } | null>(null)
  const currentTranslateRef = useRef(0)
  // 9.1：布局判断统一 useIsMobileLayout（app 端恒真，横屏不误判桌面）
  const isMobile = useIsMobileLayout()

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
      <Dialog.Portal container={portalContainer ?? undefined}>
        <Dialog.Overlay className="modal-overlay-animate" />
        <Dialog.Content
          ref={contentRef}
          className={`bottomsheet-content-animate ${className ?? ''}`}
          style={{ padding: 'var(--space-sm) var(--space-md) calc(var(--space-lg) + env(safe-area-inset-bottom))' }}
          onOpenAutoFocus={handleOpenAutoFocus}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-describedby={undefined}
        >
          <Dialog.Title className="absolute w-[1px] h-[1px] m-[-1px] p-0 border-0 overflow-hidden clip-path-[inset(50%)]">
            {title || '面板'}
          </Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default BottomSheet
