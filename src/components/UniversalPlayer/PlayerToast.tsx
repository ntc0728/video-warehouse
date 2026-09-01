import { useState, useEffect, useLayoutEffect, useCallback, createContext, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { getOverlayPortalTarget } from './lib/overlayPortal';

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

/** 命令式 API（播放器内重要提示——屏幕居中，独立于全局 sonner 的视口级居中） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const playerToastCenterRef: { current: ((msg: string, duration?: number, type?: PlayerToastType) => void) | null } = { current: null };

export function playerToastCenter(msg: string, duration?: number, type?: PlayerToastType) {
  playerToastCenterRef.current?.(msg, duration, type);
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
export function ToastProvider({
  children,
  mobileCenter = false,
  containerRef,
}: {
  children: React.ReactNode;
  mobileCenter?: boolean;
  containerRef?: React.RefObject<HTMLElement | null>;
}) {
  const [item, setItem] = useState<{ msg: string; type: PlayerToastType } | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [centerItem, setCenterItem] = useState<{ msg: string; type: PlayerToastType } | null>(null);
  const [centerIsExiting, setCenterIsExiting] = useState(false);
  const centerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 当前居中提示的内容引用：用于 showCenter 去重——相同内容连续调用只重置定时器，
  // 不触发 setCenterItem 重渲染（避免 ToastTrigger 与 mobileSettingsToast 重复调用导致动画重播/闪烁）
  const centerItemRef = useRef<{ msg: string; type: PlayerToastType } | null>(null);
  const [centerPos, setCenterPos] = useState<{ x: number; y: number }>(() => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }));

  /**
   * 测量居中提示的目标位置：
   * - 水平：播放器容器水平居中
   * - 垂直：播放器高度约 30% 处（居中靠上，不遮挡视频主体）
   * - 避让 up-player-header（header 可见时）：提示完整落在 header 下方。
   *   ⚠️ 提示以 top 为中心（translate(-50%,-50%)），余量必须 ≥ 提示半高（~18px）
   *   才不会与 header 重叠（历史 bug：余量 12px 时提示上半截伸进 header 区域）。
   */
  const measureCenterPos = useCallback(() => {
    const el = containerRef?.current;
    if (!el) {
      setCenterPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      return;
    }
    const rect = el.getBoundingClientRect();
    // 居中靠上：播放器高度 30% 处
    let y = rect.top + rect.height * 0.3;
    // 避让 up-player-header（返回栏 + 右上角操作组）：仅 header 可见时；
    // 隐藏态（.up-player-header-hidden，opacity:0）不遮挡任何内容，无需避让
    const header = el.querySelector<HTMLElement>('.up-player-header');
    if (header && !header.classList.contains('up-player-header-hidden')) {
      const headerH = header.getBoundingClientRect().height;
      if (headerH > 0) {
        // 余量 = 提示半高(~18px) + 间距，确保提示完整在 header 之下
        y = Math.max(y, rect.top + headerH + 36);
      }
    }
    // 兜底：容器滚出视口时（如用户滚到剧集列表后触发错误提示），
    // rect.top 为负会把提示带到视口外（曾实测 centerY=-422 不可见），
    // 夹取到视口内保证任何滚动状态下提示都可见
    const EDGE_MARGIN = 48;
    y = Math.min(Math.max(y, EDGE_MARGIN), window.innerHeight - EDGE_MARGIN);
    setCenterPos({
      x: rect.left + rect.width / 2,
      y,
    });
  }, [containerRef]);

  const showCenter = useCallback((msg: string, duration = 1800, type: PlayerToastType = 'default') => {
    // 显示前重新测量：header 可见性/尺寸可能刚变化（如触摸后控制栏弹出），
    // 确保提示位置避让最新的 up-player-header
    measureCenterPos();
    if (centerTimerRef.current) clearTimeout(centerTimerRef.current);
    // 去重：与当前提示内容相同时只重置定时器，不触发 setCenterItem 重渲染，
    // 避免 ToastTrigger（store 订阅）与 mobileSettingsToast 连续调用相同内容导致动画重播/闪烁
    const sameAsCurrent = centerItemRef.current?.msg === msg && centerItemRef.current?.type === type;
    if (!sameAsCurrent) {
      setCenterIsExiting(false);
      setCenterItem({ msg, type });
      centerItemRef.current = { msg, type };
    }
    centerTimerRef.current = setTimeout(() => {
      setCenterIsExiting(true);
      setTimeout(() => {
        setCenterItem(null);
        setCenterIsExiting(false);
        centerItemRef.current = null;
        centerTimerRef.current = null;
      }, 180);
    }, duration);
  }, [measureCenterPos]);

  const show = useCallback((msg: string, duration = 3000, type: PlayerToastType = 'default') => {
    if (mobileCenter) {
      showCenter(msg, duration, type);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsExiting(false);
    setItem({ msg, type });
    timerRef.current = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setItem(null);
        setIsExiting(false);
        timerRef.current = null;
      }, 180);
    }, duration);
  }, [mobileCenter, showCenter]);

  // 将 show 暴露给命令式 playerToast()（render 期间更新 ref 是常见模式）
  playerToastRef.current = show;
  // 将 showCenter 暴露给命令式 mobileSettingsToast() / playerToastCenter()
  mobileSettingsToastRef.current = showCenter;
  playerToastCenterRef.current = showCenter;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (centerTimerRef.current) clearTimeout(centerTimerRef.current);
  }, []);

  // 居中提示位置：基于 containerRef 实时测量播放器容器（viewport 坐标），
  // 垂直方向居中靠上（30%），移动端避让 up-player-header
  useLayoutEffect(() => {
    measureCenterPos();
    window.addEventListener('resize', measureCenterPos);
    window.addEventListener('scroll', measureCenterPos, true);
    return () => {
      window.removeEventListener('resize', measureCenterPos);
      window.removeEventListener('scroll', measureCenterPos, true);
    };
  }, [measureCenterPos]);

  // 全部提示的 portal 目标动态选择（center / 右上角通用）——
  // 全屏（top layer / 伪全屏 z-index:9998）时必须 portal 进 container 才可见，
  // 非全屏 portal 到 body（逃出 .app-shell__scroll 的 contain:layout 劫持 fixed 包含块）。
  // 详见 lib/overlayPortal.ts。
  const getToastPortalTarget = (): HTMLElement =>
    getOverlayPortalTarget(containerRef?.current);

  // 屏幕居中提示
  const renderCenterToast = (msg: string, type: PlayerToastType, isExiting: boolean) =>
    createPortal(
      <div
        className={`up-player-center-toast${isExiting ? ' up-player-center-toast--exiting' : ''}${type !== 'default' ? ` up-player-center-toast--${type}` : ''}`}
        style={{ top: centerPos.y, left: centerPos.x }}
      >
        {type !== 'default' && (
          <span className="up-player-center-toast__icon" style={{ color: TOAST_ICONS[type].color }}>
            <Icon icon={TOAST_ICONS[type].icon} size="md" />
          </span>
        )}
        <span className="up-player-center-toast__text">{msg}</span>
      </div>,
      getToastPortalTarget()
    );

  // 右上角操作类提示（桌面端）：同为视口级元素，全屏时同样需 portal 进 container 才可见
  const renderCornerToast = (node: React.ReactNode) => createPortal(node, getToastPortalTarget());

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* 操作类提示：桌面端 → 右上角；移动端 → 屏幕居中 */}
      {item && !isExiting && renderCornerToast(
        <div className={`up-player-toast${item.type !== 'default' ? ` up-player-toast--${item.type}` : ''}`}>
          {item.type !== 'default' && (
            <span className="up-player-toast__icon" style={{ color: TOAST_ICONS[item.type].color }}>
              <Icon icon={TOAST_ICONS[item.type].icon} size="md" />
            </span>
          )}
          <span className="up-player-toast__text">{item.msg}</span>
        </div>
      )}
      {isExiting && item && renderCornerToast(
        <div className={`up-player-toast up-player-toast--exiting${item.type !== 'default' ? ` up-player-toast--${item.type}` : ''}`}>
          {item.type !== 'default' && (
            <span className="up-player-toast__icon" style={{ color: TOAST_ICONS[item.type].color }}>
              <Icon icon={TOAST_ICONS[item.type].icon} size="md" />
            </span>
          )}
          <span className="up-player-toast__text">{item.msg}</span>
        </div>
      )}
      {centerItem && renderCenterToast(centerItem.msg, centerItem.type, centerIsExiting)}
    </ToastContext.Provider>
  );
}
