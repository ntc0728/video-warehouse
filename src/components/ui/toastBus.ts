/**
 * Toast 工具 API
 *
 * 基于 Sonner 的兼容层，保持与旧 API 兼容：
 * - toast.show(content | { content, duration })
 * - toast.replace(content | { content, duration })
 */
import { toast as sonnerToast } from 'sonner';

export type ToastOptions = {
  content: string;
  duration?: number;
};

/**
 * 兼容旧 API 的 toast 对象
 * 内部使用 Sonner 实现
 */
export const toast = {
  show(options: string | ToastOptions) {
    const message = typeof options === 'string' ? options : options.content;
    const duration = typeof options === 'string' ? undefined : options.duration;
    sonnerToast(message, { duration });
  },
  /** 替换当前 toast（清空已有 toast 后立即显示新内容） */
  replace(options: string | ToastOptions) {
    const message = typeof options === 'string' ? options : options.content;
    const duration = typeof options === 'string' ? undefined : options.duration;
    sonnerToast.dismiss();
    // 延迟 50ms 确保 dismiss 动画完成后再显示新 toast
    setTimeout(() => sonnerToast(message, { duration }), 50);
  },
};
