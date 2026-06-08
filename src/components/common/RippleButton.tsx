/**
 * 水波纹按钮组件
 * 点击时在按钮内产生从点击位置扩散的水波纹动画效果
 */
import { useCallback, useRef } from 'react';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export default function RippleButton({ children, onClick, className = '', ...props }: RippleButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    if (btn && !props.disabled) {
      /** 计算水波纹尺寸和位置，以点击点为中心扩散 */
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;

      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    }

    onClick?.(e);
  }, [onClick, props.disabled]);

  return (
    <button
      ref={btnRef}
      className={`page-btn ripple-container btn-press ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}
