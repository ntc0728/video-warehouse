/**
 * HelpTooltip 组件
 * 带问号图标的提示工具，用于设置项的上下文帮助
 * 基于 @radix-ui/react-tooltip（shadcn/ui 模式）
 */
import * as Tooltip from '@radix-ui/react-tooltip';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  content: string;
  className?: string;
}

export default function HelpTooltip({ content, className = '' }: HelpTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          className={`help-tooltip-trigger ${className}`}
          type="button"
          aria-label="帮助"
        >
          <HelpCircle size={14} />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="help-tooltip-content"
          sideOffset={4}
          side="top"
        >
          {content}
          <Tooltip.Arrow className="help-tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
