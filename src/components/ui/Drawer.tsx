'use client'

import React, { useCallback, useEffect, useRef } from 'react'
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
  /**
   * 固定在面板底部、**不参与滚动**的操作区。
   * 必须走这个插槽而不是当 children 传：children 会落进 `.drawer-body`（滚动容器），
   * 用 sticky 只能「粘」在滚动容器末端——内容不足一屏时 sticky 完全不生效，
   * 滚到底时又会被 body 的 padding-bottom 顶开（用户反馈「重置/完成没有真正固定」）。
   */
  footer?: React.ReactNode
}

const DRAWER_EXIT_MS = 260; // 与 CSS drawer-slide-out 时长一致

const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, children, fullscreen, onReset, footer }) => {
  const isClosingRef = useRef(false);

  // 2026-09-12 方案B：Radix 模态链上的 react-remove-scroll 会在 Dialog 打开期间往
  // document 挂 wheel/touchmove/touchstart 三个非 passive 监听（@2.7.2 SideEffect.js L139-141），
  // 非 passive 使每帧触摸滚动都必须过主线程（含面板内滚动）——移动端筛选面板滑动系统性卡顿。
  // modal={false} 让 RemoveScroll 整个不挂载（DialogOverlay 在非模态恒 null），滚动锁自理：
  // 打开期间 html/body overflow:hidden（无监听）+ 面板 overscroll-behavior:contain（Drawer.css）。
  useEffect(() => {
    if (!open) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [open]);

  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o && !isClosingRef.current) {
        isClosingRef.current = true;
        onClose();
        setTimeout(() => { isClosingRef.current = false; }, DRAWER_EXIT_MS);
      }
    },
    [onClose],
  )

  return (
    // modal={false}：见上方 useEffect 注释（绕开 react-remove-scroll 的 document 级非 passive 监听）
    <Dialog.Root modal={false} open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        {/* 非模态下 Radix Dialog.Overlay 恒渲染 null（RemoveScroll 随之不挂载）→ 遮罩自绘。
            data-state 手动透传以保留进出场动画；Portal 给每个子节点单独包 Presence，
            会等 [data-state='closed'] 的退出动画播完再卸载，时序与原 Dialog.Overlay 一致。 */}
        <div className="drawer-overlay" data-state={open ? 'open' : 'closed'} />
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
                  onClick={handleOpenChange.bind(null, false)}
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
                <button type="button" className="drawer-close" onClick={handleOpenChange.bind(null, false)} aria-label="关闭">
                  <Icon icon={X} size="md" />
                </button>
              </>
            )}
          </div>
          <div className="drawer-body">{children}</div>
          {footer && <div className="drawer-footer">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default Drawer
