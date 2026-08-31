import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, MoreHorizontal } from 'lucide-react';
import { DuoIcon } from '@/components/ui/DuoIcon';

interface MoreMenuProps {
  children: ReactNode;
  activePopover: string | null;
  onPopoverChange: (id: string | null) => void;
}

const POPOVER_ID = 'more';

type Pos = { top?: number; left?: number };

/**
 * 更多设置弹窗。
 * 原实现挂在控制栏内、position:absolute，被 .up-universal-player 的 overflow:hidden 裁剪。
 * 现改为 portal 到 body + position:fixed 按触发按钮 getBoundingClientRect 计算坐标，
 * 彻底逃离播放器容器的裁剪；并保留「悬停打开 / 悬停离开延迟关闭」语义（按钮与弹窗之间加桥接）。
 */
export default function MoreMenu({ children, activePopover, onPopoverChange }: MoreMenuProps) {
  const isOpen = activePopover === POPOVER_ID;
  const [isExiting, setIsExiting] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const clearClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setIsExiting(false);
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setIsExiting(true);
    closeTimer.current = window.setTimeout(() => {
      onPopoverChange(null);
      setIsExiting(false);
      closeTimer.current = null;
    }, 160);
  }, [onPopoverChange]);

  const handleButtonTouch = useCallback(() => {
    clearClose();
    if (isOpen) scheduleClose();
    else onPopoverChange(POPOVER_ID);
  }, [isOpen, onPopoverChange, clearClose, scheduleClose]);

  const openFromHover = useCallback(() => {
    clearClose();
    if (!isOpen) onPopoverChange(POPOVER_ID);
  }, [isOpen, onPopoverChange, clearClose]);

  // 计算弹窗定位（fixed）：显示在「更多」图标正上方、右对齐图标，并夹紧在播放器容器内
  useLayoutEffect(() => {
    if (!isOpen) return;
    const compute = () => {
      const t = triggerRef.current;
      const p = popRef.current;
      if (!t || !p) return;
      const iconRect = t.getBoundingClientRect();
      const popRect = p.getBoundingClientRect();
      const popW = popRect.width;
      const popH = popRect.height;
      const gap = 8;
      const margin = 4;
      // 以播放器容器为边界（找不到则退化为视口），避免弹窗超出播放器
      const playerEl = t.closest('.up-universal-player') as HTMLElement | null;
      const bound = playerEl
        ? playerEl.getBoundingClientRect()
        : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };

      // 默认在图标正上方水平居中，再在容器内水平夹紧
      let left = iconRect.left + iconRect.width / 2 - popW / 2;
      left = Math.max(bound.left + margin, Math.min(left, bound.right - popW - margin));

      // 默认显示在图标正上方；上方空间不足则翻到图标下方
      let top = iconRect.top - gap - popH;
      if (top < bound.top + margin) {
        top = iconRect.bottom + gap;
        // 下方仍放不下则夹紧到容器内
        if (top + popH > bound.bottom - margin) {
          top = Math.max(bound.top + margin, bound.bottom - popH - margin);
        }
      }
      setPos({ top, left });
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [isOpen, children]);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: PointerEvent) => {
      const tgt = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(tgt) &&
        popRef.current && !popRef.current.contains(tgt)
      ) {
        onPopoverChange(null);
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [isOpen, onPopoverChange]);

  const style: CSSProperties = {
    position: 'fixed',
    top: pos?.top ?? 'auto',
    bottom: 'auto',
    left: pos?.left ?? 'auto',
    right: 'auto',
    // 位置未计算好前隐藏：首帧 pos=null 时弹窗以 top:auto/left:auto 渲染在视口左上角，
    // useLayoutEffect 测量后 setPos 才移到正确位置——中间帧若被 paint 会看到「弹窗移动一次」。
    // visibility:hidden 不影响布局测量（getBoundingClientRect 仍返回真实尺寸），
    // 等位置就绪后再显示，消除跳变。
    visibility: pos ? 'visible' : 'hidden',
  };

  return (
    <div
      className="up-popover-control up-more-menu"
      ref={triggerRef}
      onMouseEnter={openFromHover}
      onMouseLeave={scheduleClose}
    >
      <button title="更多" onTouchStart={handleButtonTouch} onClick={handleButtonTouch}>
        <DuoIcon primary={MoreVertical} secondary={MoreHorizontal} size="md" />
      </button>
      {(isOpen || isExiting) &&
        createPortal(
          <div
            ref={popRef}
            className={`up-popover up-more-popover${isExiting ? ' up-more-popover--exiting' : ''}`}
            style={style}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={clearClose}
            onMouseLeave={scheduleClose}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}
