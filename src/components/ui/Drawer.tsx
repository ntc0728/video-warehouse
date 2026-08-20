'use client'

import React, { useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, ChevronLeft } from 'lucide-react'
import './Drawer.css'
import { Icon } from "@/components/ui/Icon";

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  /** 全屏覆盖（移动端筛选）：inset:0 覆盖整个视口含顶部导航栏，顶栏与导航栏同高 */
  fullscreen?: boolean
  /** 顶栏「重置」按钮（仅 fullscreen 下渲染：顶栏三栏布局——左返回箭头、中标题、右重置） */
  onReset?: () => void
}

const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, children, fullscreen, onReset }) => {
  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o) onClose()
    },
    [onClose],
  )

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content
          className={`drawer-content${fullscreen ? ' drawer-content--fullscreen' : ''}`}
          aria-describedby={undefined}
        >
          <div className="drawer-header">
            {fullscreen ? (
              <>
                <button
                  type="button"
                  className="drawer-close drawer-close--back"
                  onClick={onClose}
                  aria-label="返回"
                >
                  <Icon icon={ChevronLeft} size="lg" />
                </button>
                <Dialog.Title className="drawer-title">{title || '筛选'}</Dialog.Title>
                <div className="drawer-header-actions">
                  {onReset && (
                    <button type="button" className="drawer-reset" onClick={onReset} aria-label="重置">
                      重置
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <Dialog.Title className="drawer-title">{title || '筛选'}</Dialog.Title>
                <button type="button" className="drawer-close" onClick={onClose} aria-label="关闭">
                  <Icon icon={X} size="md" />
                </button>
              </>
            )}
          </div>
          <div className="drawer-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default Drawer
