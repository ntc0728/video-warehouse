import { createContext, useContext, useCallback } from 'react';
import { toast } from '@/components/ui/toastBus';

interface ToastContextValue {
  show: (msg: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function usePlayerToast() {
  return useContext(ToastContext);
}

/**
 * 播放器内提示（兼容层）：转发到全局 toastBus（sonner）。
 * 位置由全局样式统一控制——播放器页面 body[data-player-toast] 时中间靠上展示，
 * 时长统一 3s。保留原 context API 避免改动 ToastTrigger / UniversalPlayer 调用点。
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const show = useCallback((msg: string, duration?: number) => {
    toast.show({ content: msg, duration });
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
    </ToastContext.Provider>
  );
}
