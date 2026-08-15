import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
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

/** 命令式 API（移动端更多设置操作提示——顶部居中，与 HTML demo 定位一致） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mobileSettingsToastRef: { current: ((msg: string, duration?: number, type?: PlayerToastType) => void) | null } = { current: null };

export function mobileSettingsToast(msg: string, duration?: number, type?: PlayerToastType) {
  mobileSettingsToastRef.current?.(msg, duration, type);
}

const TOAST_ICONS: Record<Exclude<PlayerToastType, 'default'>, { icon: LucideIcon; color: string }> = {
  success: { icon: CheckCircle2, color: 'var(--color-success)' },
  warning: { icon: AlertTriangle, color: 'var(--color-warning)' },
  error: { icon: AlertCircle, color: 'var(--color-error)' },
};

/**
 * 播放器内提示：操作类（播放/暂停、音量、切线路、切频道、频道号等）+ 更多设置操作类。
 * - 桌面端：操作类提示渲染于播放器右上角（.up-player-toast），紧贴右上角（top: space-lg）——
 *   IPTV 播放页全屏按钮已移至右下角，头部右上角无控件可避让；与全局 sonner toast（中间靠上）区分。
 * - 移动端（mobileCenter，仅真实移动设备 App / 真实手机 UA）：操作类提示改在屏幕居中渲染
 *   （.up-player-center-toast，portal 到 body），与更多设置提示一致；
 *   桌面窄窗（视口 <768 但非移动设备）仍走右上角 .up-player-toast。
 * 统一 3s 自动消失；show(msg, duration, type) 支持语义色图标。
 */
export function ToastProvider({ children, mobileCenter = false }: { children: React.ReactNode; mobileCenter?: boolean }) {
  const [item, setItem] = useState<{ msg: string; type: PlayerToastType } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [centerItem, setCenterItem] = useState<{ msg: string; type: PlayerToastType } | null>(null);
  const centerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCenter = useCallback((msg: string, duration = 1800, type: PlayerToastType = 'default') => {
    if (centerTimerRef.current) clearTimeout(centerTimerRef.current);
    setCenterItem({ msg, type });
    centerTimerRef.current = setTimeout(() => {
      setCenterItem(null);
      centerTimerRef.current = null;
    }, duration);
  }, []);

  const show = useCallback((msg: string, duration = 3000, type: PlayerToastType = 'default') => {
    // 移动端：操作类提示改走屏幕居中槽位（与 mobileSettingsToast 共用，后到者覆盖，
    // 避免「设置项改 store → ToastTrigger 与弹窗 toast 各显示一条」的叠加重复）
    if (mobileCenter) {
      showCenter(msg, duration, type);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setItem({ msg, type });
    timerRef.current = setTimeout(() => {
      setItem(null);
      timerRef.current = null;
    }, duration);
  }, [mobileCenter, showCenter]);

  // 将 show 暴露给命令式 playerToast()（render 期间更新 ref 是常见模式）
  playerToastRef.current = show;
  // 将 showCenter 暴露给命令式 mobileSettingsToast()
  mobileSettingsToastRef.current = showCenter;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (centerTimerRef.current) clearTimeout(centerTimerRef.current);
  }, []);

  // 屏幕居中提示（portal 到 body：.app-shell__scroll 的 contain:layout 会劫持 fixed 包含块，
  // 必须逃出滚动容器才能做到真正的视口居中）
  const renderCenterToast = (msg: string, type: PlayerToastType) =>
    createPortal(
      <div className={`up-player-center-toast${type !== 'default' ? ` up-player-center-toast--${type}` : ''}`}>
        {type !== 'default' && (
          <span className="up-player-center-toast__icon" style={{ color: TOAST_ICONS[type].color }}>
            <Icon icon={TOAST_ICONS[type].icon} size="md" />
          </span>
        )}
        <span className="up-player-center-toast__text">{msg}</span>
      </div>,
      document.body
    );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* 操作类提示：桌面端 → 右上角；移动端 → 屏幕居中 */}
      {item &&
        (mobileCenter
          ? renderCenterToast(item.msg, item.type)
          : (
            <div className={`up-player-toast${item.type !== 'default' ? ` up-player-toast--${item.type}` : ''}`}>
              {item.type !== 'default' && (
                <span className="up-player-toast__icon" style={{ color: TOAST_ICONS[item.type].color }}>
                  <Icon icon={TOAST_ICONS[item.type].icon} size="md" />
                </span>
              )}
              <span className="up-player-toast__text">{item.msg}</span>
            </div>
          ))}
      {centerItem && renderCenterToast(centerItem.msg, centerItem.type)}
    </ToastContext.Provider>
  );
}
