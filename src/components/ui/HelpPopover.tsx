/**
 * HelpPopover 组件
 * 带问号图标的弹出帮助框，用于设置项的富文本上下文帮助
 * 基于 @radix-ui/react-popover（shadcn/ui 模式）
 */
import * as Popover from '@radix-ui/react-popover';
import { HelpCircle } from 'lucide-react';
import './HelpPopover.css';

interface HelpPopoverProps {
  title: string;
  content: string;
  className?: string;
}

export default function HelpPopover({ title, content, className = '' }: HelpPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={`help-popover-trigger ${className}`}
          type="button"
          aria-label={title}
        >
          <HelpCircle size={14} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="help-popover-content"
          sideOffset={4}
          side="top"
          align="center"
        >
          <div className="help-popover-header">
            <span className="help-popover-title">{title}</span>
            <Popover.Close className="help-popover-close" aria-label="关闭">
              ×
            </Popover.Close>
          </div>
          <div className="help-popover-body">
            {content}
          </div>
          <Popover.Arrow className="help-popover-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
