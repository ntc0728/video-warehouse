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
 
const playerToastRef: { current: ((msg: string, duration?: number, type?: PlayerToastType) => void) | null } = { current: null };

export function playerToast(msg: string, duration?: number, type?: PlayerToastType) {
  playerToastRef.current?.(msg, duration, type);
}

/** 命令式 API（移动端更多设置操作提示——顶部居中，与 HTML 定位一致） */
 
const mobileSettingsToastRef: { current: ((msg: string, duration?: number, type?: PlayerToastType) => void) | null } = { current: null };

export function mobileSettingsToast(msg: string, duration?: number, type?: PlayerToastType) {
  mobileSettingsToastRef.current?.(msg, duration, type);
}

/** 命令式 API（播放器内重要提示——屏幕居中，独立于全局 sonner 的视口级居中） */
 
const playerToastCenterRef: { current: ((msg: string, duration?: number, type?: PlayerToastType) => void) | null } = { current: null };

export function playerToastCenter(msg: string, duration?: number, type?: PlayerToastType) {
  playerToastCenterRef.current?.(msg, duration, type);
}

/** 居中提示与可见播放器边缘的最小留白（提示半高约 18px + 间距） */
const EDGE_MARGIN = 48;

/** 播放器可见高度低于该值时不再显示居中提示——播放器已滚出视口就不要再悬停着提示 */
const MIN_TOAST_ROOM = 96;

const TOAST_ICONS: Record<Exclude<PlayerToastType, 'default'>, { icon: LucideIcon; color: string }> = {
  success: { icon: CheckCircle2, color: 'var(--color-success)' },
  warning: { icon: AlertTriangle, color: 'var(--color-warning)' },
  error: { icon: AlertCircle, color: 'var(--color-error)' },
};

/**
 * 播放器内提示：操作类（播放/暂停、音量、切线路、切频道、频道号等）+ 更多设置操作类。
 * - 桌面端：操作类提示渲染于播放器右上角（.up-player-toast），紧贴右上角（top: space-lg）——
 * IPTV 播放页全屏按钮已移至右下角，头部右上角无控件可避让；与全局 sonner toast（中间靠上）区分。
 * - 移动端（mobileCenter = 真实移动设备 ∪ 移动端布局，由 UniversalPlayer 传入）：
 * 操作类提示改为顶部胶囊（.up-player-center-toast--top，portal 到 body，锚定 header 下沿），
 * 与更多设置提示汇入同一槽位——单槽后到覆盖先到，杜绝双通道同时上屏叠加；
 * 桌面窄窗（视口 <768 但非移动设备）仍走右上角 .up-player-toast。
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
  /** 播放器是否还有足够可见区域承载居中提示（滚走后为 false，提示不再渲染） */
  const [centerVisible, setCenterVisible] = useState(true);
  /** 当前提示是否为「视口兜底锚定」（触发时播放器就已在视口外）——这类提示不随滚动隐藏 */
  const viewportAnchoredRef = useRef(false);
  /** 移动端顶部锚点偏移（相对播放器顶缘），弹出瞬间一次测定：
   * header 实高（隐藏态按 0）与可见续播卡取 max，各 +36（半高 18 + 18px 间距）。
   * 滚动重测只跟随 rect.top 不重查显隐——header 自动显隐（y 在 +36/+84 间跳）与
   * 续播卡中途出现/消失是提示「抽搐」根因，冻结后消除（2026-11-11）。 */
  const topAnchorOffsetRef = useRef(36);

  /**
 * 测量居中提示的目标锚点：
 * - `roomy`：播放器在视口内还留有足够可见高度（≥ MIN_TOAST_ROOM）
   * - 移动端（mobileCenter，顶部胶囊）：水平居中于播放器，
 * 垂直 = 播放器顶缘 + topAnchorOffsetRef（header 下沿 / 可见续播卡下沿取 max，
 * 弹出瞬间一次测定，滚动重测不重查显隐防抽搐）。顶部是唯一无争抢区带
 * （中央=播放按钮+seek HUD，底部=控制栏+字幕）。y 为提示中心
 * （translate(-50%,-50%)），36 = 提示半高 (~18px) + 18px 视觉间距。
 * - 桌面端（截图类提示）：维持原「播放器高度 30% 处（居中靠上）」锚点不动，
 * 同样避让 up-player-header。⚠️ 余量必须 ≥ 提示半高（历史 bug：12px 时提示
 * 上半截伸进 header 区域）。
 * - 播放器完全滚出视口时：退回视口定位（居中靠上），由调用方决定是否显示。
 *
 * @param remeasureOffset true = 提示弹出瞬间，重测顶部锚点偏移（header/续播卡当下
 * 的实际占位）；false = 滚动/resize 重测，只跟随播放器位置，沿用已冻结的偏移。
 */
  const resolveCenterAnchor = useCallback((remeasureOffset: boolean): { x: number; y: number; roomy: boolean } => {
    const el = containerRef?.current;
    const viewportFallback = {
      x: window.innerWidth / 2,
      y: Math.min(Math.max(window.innerHeight * 0.3, EDGE_MARGIN), window.innerHeight - EDGE_MARGIN),
      roomy: false,
    };
    if (!el) return viewportFallback;
    const rect = el.getBoundingClientRect();
    // 提示必须落在「播放器 ∩ 视口」的可见交集内。只按视口夹取会让播放器滚走之后提示
    // 仍停在视口顶部（移动端下滑后提示像跟着浏览器顶部定位，且 fixed 层级
    // 反而浮在播放器上方）。
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, window.innerHeight);
    if (visibleBottom - visibleTop < MIN_TOAST_ROOM) return viewportFallback;
    // header 实际高度：可见时取实测值；隐藏态（.up-player-header-hidden，opacity:0）
    // 按 0 计——移动端提示退回播放器顶缘，桌面端 30% 锚点无需避让
    const header = el.querySelector<HTMLElement>('.up-player-header');
    const headerH = header && !header.classList.contains('up-player-header-hidden')
      ? header.getBoundingClientRect().height
      : 0;
    if (mobileCenter) {
      if (remeasureOffset) {
        // 弹出瞬间测定锚点偏移：header 下沿，续播卡可见时让位到其下沿（同锚带
        // 两枚胶囊可能同时存在），取更靠下者
        let offset = headerH + 36;
        const resumeCard = el.querySelector<HTMLElement>('.up-resume-card');
        if (resumeCard) {
          const cardRect = resumeCard.getBoundingClientRect();
          if (cardRect.height > 0) offset = Math.max(offset, cardRect.bottom - rect.top + 36);
        }
        topAnchorOffsetRef.current = offset;
      }
      const y = rect.top + topAnchorOffsetRef.current;
      const minY = visibleTop + EDGE_MARGIN;
      const maxY = visibleBottom - EDGE_MARGIN;
      const clampedY = maxY > minY ? Math.min(Math.max(y, minY), maxY) : (visibleTop + visibleBottom) / 2;
      return { x: rect.left + rect.width / 2, y: clampedY, roomy: true };
    }
    // 桌面端（截图类提示）：居中靠上，播放器高度 30% 处
    let y = rect.top + rect.height * 0.3;
    // 避让 up-player-header（返回栏 + 右上角操作组）：仅 header 可见时
    if (headerH > 0) {
      // 余量 = 提示半高(~18px) + 间距，确保提示完整在 header 之下
      y = Math.max(y, rect.top + headerH + 36);
    }
    // 夹取到可见交集内：容器滚到只剩一条时（如用户滚到剧集列表后触发错误提示）
    // rect.top 为负，不夹取会把提示带到视口外
    const minY = visibleTop + EDGE_MARGIN;
    const maxY = visibleBottom - EDGE_MARGIN;
    y = maxY > minY ? Math.min(Math.max(y, minY), maxY) : (visibleTop + visibleBottom) / 2;
    return { x: rect.left + rect.width / 2, y, roomy: true };
  }, [containerRef, mobileCenter]);

  /** 滚动 / 尺寸变化时重测：播放器一旦滚出视口，跟随播放器的提示就不再显示 */
  const measureCenterPos = useCallback(() => {
    const anchor = resolveCenterAnchor(false);
    if (!anchor.roomy && !viewportAnchoredRef.current) {
      setCenterVisible(false);
      return;
    }
    setCenterVisible(true);
    setCenterPos({ x: anchor.x, y: anchor.y });
  }, [resolveCenterAnchor]);

  const showCenter = useCallback((msg: string, duration = 1800, type: PlayerToastType = 'default') => {
    // 显示前重新测量：header 可见性/尺寸可能刚变化（如触摸后控制栏弹出），
    // 重测顶部锚点偏移（header + 可见续播卡），确保提示落在两者之下
    const anchor = resolveCenterAnchor(true);
    // 触发时播放器已在视口外（典型：设置弹窗 / 抽屉把页面滚下去了）——这是本次操作的
    // 直接反馈，不能因为播放器不在视野里就吞掉，退回视口定位显示。
    // 这种「视口兜底锚定」的提示此后不随滚动自动隐藏；而播放器可见时锚定的提示，
    // 一旦被滚走就隐藏（下滑后提示不该悬在已滑过去的播放器上方）。
    viewportAnchoredRef.current = !anchor.roomy;
    setCenterVisible(true);
    setCenterPos({ x: anchor.x, y: anchor.y });
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
        // 提示结束后复位锚定模式，避免影响下一条提示的滚动隐藏判定
        viewportAnchoredRef.current = false;
      }, 180);
    }, duration);
  }, [resolveCenterAnchor]);

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
        className={`up-player-center-toast${mobileCenter ? ' up-player-center-toast--top' : ''}${isExiting ? ' up-player-center-toast--exiting' : ''}${type !== 'default' ? ` up-player-center-toast--${type}` : ''}`}
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
      {centerItem && centerVisible && renderCenterToast(centerItem.msg, centerItem.type, centerIsExiting)}
    </ToastContext.Provider>
  );
}
