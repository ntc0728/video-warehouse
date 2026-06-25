/**
 * HelpPopover 组件
 * 带问号图标的弹出帮助框，用于设置项的富文本上下文帮助
 * 使用 Portal 渲染到 body，基于触发元素视口坐标计算位置
 * 同时处理水平和垂直方向的视口边界检测
 */
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import './HelpPopover.css';

interface HelpPopoverProps {
  title: string;
  content: string;
  className?: string;
}

interface PopoverPosition {
  top: number;
  left: number;
  placement: 'above' | 'below';
  arrowLeft: number;
}

function getPopoverGap(): number {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--space-xs')) || 4;
}

export default function HelpPopover({ title, content, className = '' }: HelpPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const calcPosition = useCallback((popHeight: number) => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;
    const trigger = triggerEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = getPopoverGap();

    const spaceAbove = trigger.top;
    const spaceBelow = vh - trigger.bottom;

    let placement: 'above' | 'below';
    if (spaceAbove >= popHeight + gap) {
      placement = 'above';
    } else if (spaceBelow >= popHeight + gap) {
      placement = 'below';
    } else {
      placement = spaceAbove >= spaceBelow ? 'above' : 'below';
    }

    const top = placement === 'above'
      ? trigger.top - gap - popHeight
      : trigger.bottom + gap;

    const triggerCenterX = trigger.left + trigger.width / 2;
    const popoverWidth = contentRef.current?.offsetWidth || 300;
    let left = triggerCenterX - popoverWidth / 2;
    const safePad = 8;
    if (left < safePad) left = safePad;
    else if (left + popoverWidth > vw - safePad) left = vw - safePad - popoverWidth;

    setPosition({ top, left, placement, arrowLeft: triggerCenterX - left });
  }, []);

  const handleOpen = useCallback(() => {
    if (!triggerRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = getPopoverGap();
    const estimatedHeight = 100;

    const spaceAbove = trigger.top;
    const spaceBelow = vh - trigger.bottom;

    let placement: 'above' | 'below';
    if (spaceAbove >= estimatedHeight + gap) {
      placement = 'above';
    } else if (spaceBelow >= estimatedHeight + gap) {
      placement = 'below';
    } else {
      placement = spaceAbove >= spaceBelow ? 'above' : 'below';
    }

    const top = placement === 'above'
      ? trigger.top - gap - estimatedHeight
      : trigger.bottom + gap;

    const triggerCenterX = trigger.left + trigger.width / 2;
    const popoverWidth = 300;
    let left = triggerCenterX - popoverWidth / 2;
    const safePad = 8;
    if (left < safePad) left = safePad;
    else if (left + popoverWidth > vw - safePad) left = vw - safePad - popoverWidth;

    setIsOpen(true);
    setPosition({ top, left, placement, arrowLeft: triggerCenterX - left });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !position) return;
    const el = contentRef.current;
    if (!el) return;
    const h = el.offsetHeight;
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;
    const trigger = triggerEl.getBoundingClientRect();
    const gap = getPopoverGap();

    const expectedTop = position.placement === 'above'
      ? trigger.top - gap - h
      : trigger.bottom + gap;

    if (Math.abs(expectedTop - position.top) > 1) {
      calcPosition(h);
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const el = contentRef.current;
      if (el) calcPosition(el.offsetHeight);
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen, calcPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        contentRef.current && !contentRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const contentClass = [
    'help-popover-content',
    position?.placement === 'below' ? 'help-popover-content--below' : '',
  ].filter(Boolean).join(' ');

  return (
    <span className={`help-popover-container ${className}`}>
      <button
        ref={triggerRef}
        className="help-popover-trigger"
        onClick={handleOpen}
        aria-label={title}
        type="button"
      >
        <HelpCircle size={14} />
      </button>
      {isOpen && position && createPortal(
        <div
          ref={contentRef}
          className={contentClass}
          style={{ top: position.top, left: position.left }}
          role="dialog"
          aria-label={title}
        >
          <div className="help-popover-header">
            <span className="help-popover-title">{title}</span>
            <button
              className="help-popover-close"
              onClick={() => setIsOpen(false)}
              type="button"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
          <div className="help-popover-body">
            {content}
          </div>
          <div className="help-popover-arrow" style={{ left: position.arrowLeft }} />
        </div>,
        document.body,
      )}
    </span>
  );
}
