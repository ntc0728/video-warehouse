/**
 * HelpTooltip 组件
 * 带问号图标的提示工具，用于设置项的上下文帮助
 */
import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import './HelpTooltip.css';

interface HelpTooltipProps {
  content: string;
  className?: string;
}

export default function HelpTooltip({ content, className = '' }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible]);

  return (
    <span
      ref={containerRef}
      className={`help-tooltip-container ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <button
        className="help-tooltip-trigger"
        onClick={() => setIsVisible(!isVisible)}
        aria-label="帮助"
        type="button"
      >
        <HelpCircle size={14} />
      </button>
      {isVisible && (
        <div ref={tooltipRef} className="help-tooltip-content" role="tooltip">
          {content}
        </div>
      )}
    </span>
  );
}
