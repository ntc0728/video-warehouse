/**
 * Toast 工具 API
 *
 * 基于 Sonner 的兼容层，保持与旧 API 兼容：
 * - toast.show(content | { content, type?, duration? })  默认类型 default、统一 3s
 * - toast.replace(content | { content, type?, duration? }) 清空队列立即显示
 * - toast.success / toast.warning / toast.error(msg, duration?) 带语义色图标
 *
 * 类型与图标：
 * - success → 绿色对勾（--color-success）
 * - warning → 橙色三角（--color-warning）
 * - error   → 红色圆环感叹号（--color-error）
 * - default → 无图标
 */
import { createElement } from 'react';
import { toast as sonnerToast } from 'sonner';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { Icon } from './Icon';

export type ToastType = 'default' | 'success' | 'warning' | 'error';

export type ToastOptions = {
  content: string;
  type?: ToastType;
  duration?: number;
};

/** 统一显示时长：3s */
export const TOAST_DURATION = 3000;

// .ts 文件不能写 JSX，用 createElement 构建图标元素
const TYPE_ICONS: Record<Exclude<ToastType, 'default'>, React.ReactNode> = {
  success: createElement(Icon, { icon: CheckCircle2, size: 'md', style: { color: 'var(--color-success)' } }),
  warning: createElement(Icon, { icon: AlertTriangle, size: 'md', style: { color: 'var(--color-warning)' } }),
  error: createElement(Icon, { icon: AlertCircle, size: 'md', style: { color: 'var(--color-error)' } }),
};

function push(message: string, type: ToastType, duration?: number, replace = false) {
  const opts: { duration: number; icon?: React.ReactNode } = {
    duration: duration ?? TOAST_DURATION,
  };
  if (type !== 'default') {
    opts.icon = TYPE_ICONS[type];
  }
  if (replace) {
    sonnerToast.dismiss();
    // 延迟 50ms 确保 dismiss 动画完成后再显示新 toast
    setTimeout(() => sonnerToast(message, opts), 50);
  } else {
    sonnerToast(message, opts);
  }
}

export const toast = {
  show(options: string | ToastOptions) {
    const message = typeof options === 'string' ? options : options.content;
    const type = typeof options === 'string' ? 'default' : (options.type ?? 'default');
    const duration = typeof options === 'string' ? undefined : options.duration;
    push(message, type, duration, false);
  },
  /** 替换当前 toast（清空已有 toast 后立即显示新内容） */
  replace(options: string | ToastOptions) {
    const message = typeof options === 'string' ? options : options.content;
    const type = typeof options === 'string' ? 'default' : (options.type ?? 'default');
    const duration = typeof options === 'string' ? undefined : options.duration;
    push(message, type, duration, true);
  },
  success(msg: string, duration?: number) {
    push(msg, 'success', duration, false);
  },
  warning(msg: string, duration?: number) {
    push(msg, 'warning', duration, false);
  },
  error(msg: string, duration?: number) {
    push(msg, 'error', duration, false);
  },
};
