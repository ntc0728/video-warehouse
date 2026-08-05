import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';

export type PlayerToastType = 'default' | 'success' | 'warning' | 'error';

interface ToastContextValue {
  show: (msg: string, duration?: number, type?: PlayerToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function usePlayerToast() {
  return useContext(ToastContext);
}

/** 命令式 API（供组件顶层 hooks 使用——hooks 在 ToastProvider 外，无法 useContext） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const playerToastRef: { current: ((msg: string, duration?: number, type?: PlayerToastType) => void) | null } = { current: null };

export function playerToast(msg: string, duration?: number, type?: PlayerToastType) {
  playerToastRef.current?.(msg, duration, type);
}

const TOAST_ICONS: Record<Exclude<PlayerToastType, 'default'>, { icon: LucideIcon; color: string }> = {
  success: { icon: CheckCircle2, color: 'var(--color-success)' },
  warning: { icon: AlertTriangle, color: 'var(--color-warning)' },
  error: { icon: AlertCircle, color: 'var(--color-error)' },
};

/**
 * 播放器内提示（右上角）：播放/暂停、音量、切线路、切频道、频道号等**操作类**提示。
 * 独立渲染于播放器右上角（.up-player-toast），与全局 sonner toast（中间靠上）区分。
 * 统一 3s 自动消失；show(msg, duration, type) 支持语义色图标。
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<{ msg: string; type: PlayerToastType } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, duration = 3000, type: PlayerToastType = 'default') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setItem({ msg, type });
    timerRef.current = setTimeout(() => {
      setItem(null);
      timerRef.current = null;
    }, duration);
  }, []);

  // 将 show 暴露给命令式 playerToast()（render 期间更新 ref 是常见模式）
  playerToastRef.current = show;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {item && (
        <div className={`up-player-toast${item.type !== 'default' ? ` up-player-toast--${item.type}` : ''}`}>
          {item.type !== 'default' && (
            <span className="up-player-toast__icon" style={{ color: TOAST_ICONS[item.type].color }}>
              <Icon icon={TOAST_ICONS[item.type].icon} size="md" />
            </span>
          )}
          <span className="up-player-toast__text">{item.msg}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}
