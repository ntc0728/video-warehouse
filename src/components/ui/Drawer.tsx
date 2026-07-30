'use client'

import React, { useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import './Drawer.css'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, children }) => {
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
        <Dialog.Content className="drawer-content" aria-describedby={undefined}>
          <div className="drawer-header">
            <Dialog.Title className="drawer-title">{title || '筛选'}</Dialog.Title>
            <button type="button" className="drawer-close" onClick={onClose} aria-label="关闭">
              <X size={20} />
            </button>
          </div>
          <div className="drawer-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default Drawer
