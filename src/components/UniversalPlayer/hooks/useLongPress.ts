import { useCallback, useEffect, useRef, useState } from 'react';

interface UseLongPressOptions {
  onSeek: (direction: 'left' | 'right') => void;
  disabled?: boolean;
  /**
   * 移动端纵向滑动手势（亮度/音量）激活标记：
   * useTouchGesture 在纵向位移主导锁定后置 true，本 hook 据此立即取消
   * 长按快进/快退，避免「垂直滑动调亮度/音量」与「水平长按 seek」冲突（G7-G10）。
   */
  verticalGestureActiveRef?: React.MutableRefObject<boolean>;
}

const LONG_PRESS_DELAY = 500;
const SEEK_INTERVAL = 500;
/** 长按触发前允许的最大位移（px）：手指移动超过此值视为滑动手势，取消长按 */
const MOVE_CANCEL_THRESHOLD = 10;

export function useLongPress({ onSeek, disabled = false, verticalGestureActiveRef }: UseLongPressOptions) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLongPressedRef = useRef(false);
  /** 长按起点（用于位移判定：移动超过阈值取消 pending 长按，与纵向滑动手势区分） */
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [seekIndicator, setSeekIndicator] = useState<'left' | 'right' | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (seekIntervalRef.current) {
      clearInterval(seekIntervalRef.current);
      seekIntervalRef.current = null;
    }
    setSeekIndicator(null);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // N5：放开 mode==='iptv' 禁用，IPTV 同样支持长按快进/快退（直播 DVR 窗口内 seek）
    if (disabled) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.up-control-bar') || target.closest('.up-player-header') || target.closest('.up-channel-list-overlay') || target.closest('.iptv-osd-bar') || target.closest('.iptv-volume-popup')) {
      return;
    }

    hasLongPressedRef.current = false;
    pressOriginRef.current = { x: e.clientX, y: e.clientY };

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const isLeftSide = relX < rect.width * 0.4;
    const isRightSide = relX > rect.width * 0.6;

    if (!isLeftSide && !isRightSide) return;

    const direction = isLeftSide ? 'left' : 'right';

    // 延迟 seek + 指示器，以区分单击和长按
    longPressTimerRef.current = setTimeout(() => {
      setSeekIndicator(direction);
      hasLongPressedRef.current = true;
      onSeek(direction);
      seekIntervalRef.current = setInterval(() => onSeek(direction), SEEK_INTERVAL);
    }, LONG_PRESS_DELAY);
  }, [onSeek, disabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const origin = pressOriginRef.current;
    if (!origin) return;
    // 纵向滑动（亮度/音量）激活：立即取消长按（含已触发后的重复 seek）
    if (verticalGestureActiveRef?.current) {
      clearLongPress();
      pressOriginRef.current = null;
      return;
    }
    // 已进入长按 seek 状态：保持按住继续 seek，位移不取消（用户刻意按住）
    if (hasLongPressedRef.current) return;
    // pending 阶段位移超阈值 → 视为滑动而非长按，取消 pending 定时器
    if (Math.abs(e.clientX - origin.x) > MOVE_CANCEL_THRESHOLD || Math.abs(e.clientY - origin.y) > MOVE_CANCEL_THRESHOLD) {
      clearLongPress();
      pressOriginRef.current = null;
    }
  }, [clearLongPress, verticalGestureActiveRef]);

  const handlePointerUp = useCallback(() => {
    pressOriginRef.current = null;
    clearLongPress();
  }, [clearLongPress]);

  const handlePointerLeave = useCallback(() => {
    pressOriginRef.current = null;
    clearLongPress();
  }, [clearLongPress]);

  // P2-5：组件卸载时清掉 pending 长按定时器与 seek 循环，避免泄漏后继续触发 seek
  useEffect(() => () => clearLongPress(), [clearLongPress]);

  return {
    seekIndicator,
    hasLongPressedRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  };
}
