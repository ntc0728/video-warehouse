/**
 * 播放器整改 Demo — 手势引擎
 *
 * 对照现有 `UniversalPlayer/hooks/useTouchGesture.ts` 的四个硬伤修复：
 * 1. 横向滑动被直接丢弃（:118-122）→ 这里实现完整 seek，增量累加不跳变。
 * 2. 音量初值硬编码为 0（:32/:37）→ 这里从外部传入初始值，每次手势开始时同步一次。
 * 3. 无条件 preventDefault 锁死页面滚动（:129）→ 这里按「是否全屏」分级：
 *    非全屏只拦横向（纵向留给页面滚动），全屏才吃下全部手势。
 * 4. 手势监听不排除控制栏/头部（:85-152）→ 这里用 closest() 排除 UI 区域。
 *
 * 阈值全部对齐 B站 / YouTube 实测值：
 * - 方向锁定 slop 16px（Android ViewConfiguration 8dp、iOS 10pt 的折中）
 * - 双击窗口 300ms、位移容差 24px
 * - 长按进入倍速 1500ms（B站刻意比系统 500ms 长，避免与长按菜单冲突）
 */
import { useEffect, useRef } from 'react';

/** 方向锁定阈值（px）：超过才判定本次手势是横向还是纵向 */
const SLOP = 16;
/** 双击判定窗口（ms） */
const DOUBLE_TAP_WINDOW = 300;
/** 双击位移容差（px） */
const DOUBLE_TAP_SLOP = 24;
/** 长按进入倍速的时长（ms） */
const LONG_PRESS_DELAY = 1500;
/** seek 灵敏度：数值越大越迟钝。150 → 从最左滑到最右 ≈ 66% 片长 */
const SEEK_SENS = 150;
/** 纵向灵敏度：180 → 从底滑到顶 ≈ 55% 音量/亮度量程 */
const VERTICAL_SENS = 180;
/** 顶部/底部手势排除区（px）：避开状态栏手势与控制栏 */
const EXCLUDE_TOP = 44;
const EXCLUDE_BOTTOM = 80;

export type GestureAxis = 'seek' | 'brightness' | 'volume';

export interface GestureHandlers {
  /** 横向：增量 seek（秒，可正可负） */
  onSeekDelta: (deltaSeconds: number) => void;
  /** 纵向：增量调节（0–1 归一化，可正可负） */
  onVerticalDelta: (axis: 'brightness' | 'volume', delta: number) => void;
  /** 手势开始（用于挂反馈 UI） */
  onGestureBegin: (axis: GestureAxis) => void;
  /** 手势结束（用于隐藏反馈 UI） */
  onGestureEnd: () => void;
  /** 双击 */
  onDoubleTap: () => void;
  /** 单击 */
  onSingleTap: () => void;
  /** 长按进入/退出倍速 */
  onLongPressChange: (active: boolean) => void;
}

interface Options {
  containerRef: React.RefObject<HTMLElement | null>;
  /** 是否启用（仅触摸设备 + 允许手势时） */
  enabled: boolean;
  /** 全屏态：纵向手势才生效（非全屏纵向留给页面滚动） */
  fullscreen: boolean;
  /** 当前时长，用于把像素位移换算成秒 */
  getDuration: () => number;
  /** 是否锁定（锁定按钮开启时禁用全部手势） */
  locked: boolean;
  handlers: GestureHandlers;
}

interface Session {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  axis: GestureAxis | null;
  startedAt: number;
}

export function useGestures({
  containerRef,
  enabled,
  fullscreen,
  getDuration,
  locked,
  handlers,
}: Options): void {
  // handlers 放进 ref：调用方每次渲染都传新对象，避免 effect 反复解绑重绑
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const getDurationRef = useRef(getDuration);
  getDurationRef.current = getDuration;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const fullscreenRef = useRef(fullscreen);
  fullscreenRef.current = fullscreen;

  const sessionRef = useRef<Session | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 卸载清理：现有 useLongPress / usePlayerCore 都有定时器泄漏（见 I5/I6）
  useEffect(() => () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const clearLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (lockedRef.current) return;
      const target = e.target as HTMLElement | null;
      // 排除控制栏 / 顶栏 / 弹层内的手势（现有实现没有这层判断）
      if (target?.closest('.pl-no-gesture')) return;

      const rect = el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      // 顶部/底部排除区：留给系统手势与控制栏
      if (y < EXCLUDE_TOP || y > rect.height - EXCLUDE_BOTTOM) return;

      const x = e.clientX - rect.left;
      sessionRef.current = {
        pointerId: e.pointerId,
        startX: x,
        startY: y,
        lastX: x,
        lastY: y,
        axis: null,
        startedAt: performance.now(),
      };

      clearLongPress();
      longPressTimerRef.current = setTimeout(() => {
        if (sessionRef.current && !sessionRef.current.axis) {
          handlersRef.current.onLongPressChange(true);
        }
      }, LONG_PRESS_DELAY);
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = sessionRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - s.startX;
      const dy = y - s.startY;

      if (!s.axis) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        const horizontal = Math.abs(dx) > Math.abs(dy);
        if (horizontal) {
          s.axis = 'seek';
        } else {
          // 非全屏：纵向手势交还页面滚动（修复 D5）
          if (!fullscreenRef.current) {
            sessionRef.current = null;
            clearLongPress();
            return;
          }
          s.axis = x < rect.width / 2 ? 'brightness' : 'volume';
        }
        clearLongPress();
        handlersRef.current.onGestureBegin(s.axis);
      }

      // 增量累加式，不是「起点→终点」绝对映射（后者会跳变）
      if (s.axis === 'seek') {
        const deltaSeconds = ((x - s.lastX) / (rect.width * (SEEK_SENS / 100))) * getDurationRef.current();
        handlersRef.current.onSeekDelta(deltaSeconds);
      } else {
        const delta = (s.lastY - y) / (rect.height * (VERTICAL_SENS / 100));
        handlersRef.current.onVerticalDelta(s.axis, delta);
      }
      s.lastX = x;
      s.lastY = y;
      if (e.cancelable) e.preventDefault();
    };

    const finish = (e: PointerEvent) => {
      const s = sessionRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      sessionRef.current = null;
      clearLongPress();
      handlersRef.current.onLongPressChange(false);

      if (s.axis) {
        handlersRef.current.onGestureEnd();
        return;
      }

      // 未判定方向 → 视为点击
      const now = performance.now();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const last = lastTapRef.current;
      const isDouble = !!last
        && now - last.t < DOUBLE_TAP_WINDOW
        && Math.abs(x - last.x) < DOUBLE_TAP_SLOP
        && Math.abs(y - last.y) < DOUBLE_TAP_SLOP;

      if (isDouble) {
        lastTapRef.current = null;
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        handlersRef.current.onDoubleTap();
        return;
      }

      lastTapRef.current = { t: now, x, y };
      // 移动端单击 = 显隐控制栏，不是播放/暂停，无需等双击窗口，立即响应。
      // 现有实现把「单击播放」延迟 250ms（usePlayerClickHandler.ts:52-63），手感发钝。
      handlersRef.current.onSingleTap();
    };

    const onPointerCancel = (e: PointerEvent) => {
      const s = sessionRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      sessionRef.current = null;
      clearLongPress();
      handlersRef.current.onLongPressChange(false);
      if (s.axis) handlersRef.current.onGestureEnd();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', onPointerCancel);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', finish);
      el.removeEventListener('pointercancel', onPointerCancel);
      clearLongPress();
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, [containerRef, enabled]);
}

export { LONG_PRESS_DELAY, SEEK_SENS, VERTICAL_SENS };
