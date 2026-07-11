/**
 * Toast 工具 API
 *
 * 单独拆分以满足 react-refresh/only-export-components 约束。
 * 文件命名避开 Toast.tsx（Windows 文件系统不区分大小写）。
 * 提供 toast.show() 命令式调用与内部状态管理（enqueue / dequeue / markVisible / useToastQueue），
 * 实际 UI 渲染由 Toast.tsx 中的 ToastProvider 完成。
 */
import { useEffect, useState } from 'react';

export type ToastOptions = {
  content: string;
  duration?: number;
};

export interface ToastItem {
  id: number;
  content: string;
  duration: number;
  visible: boolean;
}

let toastId = 0;
const queue: ToastItem[] = [];
const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((fn) => fn());
}

function enqueue(options: ToastOptions) {
  const item: ToastItem = {
    id: ++toastId,
    content: options.content,
    duration: options.duration ?? 2000,
    visible: false,
  };
  queue.push(item);
  emitChange();
}

/** 替换当前队列：清空已有项后入队新 toast，适用于快速连续提示场景 */
function replaceCurrent(options: ToastOptions) {
  queue.length = 0;
  const item: ToastItem = {
    id: ++toastId,
    content: options.content,
    duration: options.duration ?? 2000,
    visible: false,
  };
  queue.push(item);
  emitChange();
}

function dequeue(id: number) {
  const idx = queue.findIndex((t) => t.id === id);
  if (idx !== -1) {
    queue.splice(idx, 1);
    emitChange();
  }
}

function markVisible(id: number) {
  const item = queue.find((t) => t.id === id);
  if (item) {
    item.visible = true;
    emitChange();
  }
}

export const toast = {
  show(options: string | ToastOptions) {
    const opts: ToastOptions =
      typeof options === 'string' ? { content: options } : options;
    enqueue(opts);
  },
  /** 替换当前 toast（清空队列后立即显示新内容，不等旧 toast 超时） */
  replace(options: string | ToastOptions) {
    const opts: ToastOptions =
      typeof options === 'string' ? { content: options } : options;
    replaceCurrent(opts);
  },
};

export function useToastQueue(): ToastItem[] {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const fn = () => setVersion((v) => v + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return queue;
}

export { dequeue, enqueue, replaceCurrent, markVisible };
