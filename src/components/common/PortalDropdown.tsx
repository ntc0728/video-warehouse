import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface PortalDropdownProps {
  isOpen: boolean;
  position: { top: number; left: number; width: number; maxHeight: number } | null;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}

/**
 * Portal 下拉框组件
 * 将下拉内容渲染到 body 层级，避免影响页面滚动容器的 scrollHeight。
 */
export function PortalDropdown({ isOpen, position, onClose, triggerRef, children }: PortalDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
      triggerRef.current && !triggerRef.current.contains(e.target as Node)
    ) {
      onClose();
    }
  }, [onClose, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;

    const raf = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside);
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClickOutside]);

  if (!isOpen || !position) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className="portal-dropdown"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
        zIndex: 9999,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
