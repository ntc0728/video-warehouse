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

type Pos = { top?: number; bottom?: number; left?: number; right?: number };

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

  // 计算弹窗定位（fixed），避开 .up-universal-player 的 overflow:hidden 裁剪
  useLayoutEffect(() => {
    if (!isOpen) return;
    const compute = () => {
      const t = triggerRef.current;
      const p = popRef.current;
      if (!t || !p) return;
      const rect = t.getBoundingClientRect();
      const pop = p.getBoundingClientRect();
      const gap = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const next: Pos = {};
      // 优先向上展开；顶部空间不足则翻到按钮下方
      if (rect.top - gap - pop.height < 8) {
        next.top = rect.bottom + gap;
      } else {
        next.bottom = vh - rect.top + gap;
      }
      // 优先右对齐按钮右缘；左侧越界则左对齐按钮左缘
      if (vw - rect.right - pop.width < 8) {
        next.left = rect.left;
      } else {
        next.right = vw - rect.right;
      }
      setPos(next);
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
    bottom: pos?.bottom ?? 'auto',
    left: pos?.left ?? 'auto',
    right: pos?.right ?? 'auto',
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
