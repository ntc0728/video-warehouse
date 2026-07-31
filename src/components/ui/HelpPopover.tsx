/**
 * HelpPopover 组件
 * 带问号图标的弹出帮助框，用于设置项的富文本上下文帮助
 * 基于 @radix-ui/react-popover（shadcn/ui 模式）
 */
import * as Popover from '@radix-ui/react-popover';
import { HelpCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import './HelpPopover.css';

interface HelpPopoverProps {
  title: string;
  content: string;
  className?: string;
}

export default function HelpPopover({ title, content, className = '' }: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  // 标记本次关闭是否由点击「?」本身触发（用于桌面端 hover 模式下忽略该关闭）
  const triggerClickRef = useRef(false);
  // 可 hover 设备（桌面，鼠标/触控板）：以悬停显隐为主；
  // 触屏设备（移动端）：以点击/轻触切换为主。
  const hoverable = useMediaQuery('(hover: hover) and (pointer: fine)');

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        // 桌面端由 hover 控制：忽略点击「?」本身触发的关闭，避免悬停阅读时被误关；
        // 移动端（不可 hover）则由点击/轻触正常切换，Esc 与外部点击始终可关闭。
        if (hoverable && !next && triggerClickRef.current) {
          triggerClickRef.current = false;
          return;
        }
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          className={`help-popover-trigger ${className}`}
          type="button"
          aria-label={title}
          aria-expanded={open}
          onClick={() => {
            if (hoverable) triggerClickRef.current = true;
          }}
          onMouseEnter={() => {
            if (hoverable) setOpen(true);
          }}
          onMouseLeave={() => {
            if (hoverable) setOpen(false);
          }}
        >
          <HelpCircle size={14} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="help-popover-content"
          sideOffset={6}
          side="top"
          align="start"
          collisionPadding={8}
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
