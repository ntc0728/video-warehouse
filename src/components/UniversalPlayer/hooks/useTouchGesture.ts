import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTouchGestureOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  initialBrightness: number;
  onBrightnessChange: (value: number) => void;
  onVolumeChange: (value: number) => void;
  /** P0-4：手势开始时同步真实音量（此前硬编码 0，气泡与实际音量脱节） */
  getInitialVolume: () => number;
  /** 纵向手势主导后置 true，通知 useLongPress 取消长按（G8 防手势冲突） */
  verticalGestureActiveRef?: React.MutableRefObject<boolean>;
}

/** 纵向滑动主导判定阈值（px）：超过则锁定滑动方向 */
const VERTICAL_LOCK_THRESHOLD = 8;
/** 亮度调节范围（filter brightness） */
const MIN_BRIGHTNESS = 0.1;
const MAX_BRIGHTNESS = 2;
/** 手势结束后指示器自动隐藏延迟 */
const INDICATOR_HIDE_DELAY = 1200;
/** 手势增量灵敏度：位移 1px 对应的值变化（亮度/音量） */
const SENSITIVITY = 1 / 200;
/**
 * P0-5：容器高度覆盖视口达到该比例才视为「全屏形态」，纵向手势才接管（preventDefault）。
 * 不依赖 document.fullscreenElement——App 端是 CSS 全屏布局，不触发该 API。
 * 嵌入/可滚动页面（覆盖不足）时纵向滑动交还页面滚动。
 */
const VIEWPORT_COVERAGE_RATIO = 0.85;
/** P0-6：手势排除区（与 useLongPress 同名单 + 移动端弹层），触摸这些区域不触发亮度/音量手势 */
const GESTURE_EXCLUDE_SELECTOR = [
  '.up-control-bar',
  '.up-player-header',
  '.up-channel-list-overlay',
  '.iptv-osd-bar',
  '.iptv-volume-popup',
  '.up-ms-sheet',
  '.up-cast-sheet',
  '.up-subtitle-settings',
  '.up-program-guide-overlay',
  '.up-player-error',
  '.up-error-actions',
  '.up-player-play-button',
].join(', ');

export function useTouchGesture({
  containerRef,
  enabled,
  initialBrightness,
  onBrightnessChange,
  onVolumeChange,
  getInitialVolume,
  verticalGestureActiveRef,
}: UseTouchGestureOptions) {
  const [brightness, setBrightness] = useState(initialBrightness);
  const [volume, setVolume] = useState(0);
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const [axis, setAxis] = useState<'brightness' | 'volume' | null>(null);

  const brightnessRef = useRef(initialBrightness);
  const volumeRef = useRef(0);
  const onBrightnessChangeRef = useRef(onBrightnessChange);
  const onVolumeChangeRef = useRef(onVolumeChange);
  const getInitialVolumeRef = useRef(getInitialVolume);
  const verticalGestureActiveRefRef = useRef(verticalGestureActiveRef);

  onBrightnessChangeRef.current = onBrightnessChange;
  onVolumeChangeRef.current = onVolumeChange;
  getInitialVolumeRef.current = getInitialVolume;
  verticalGestureActiveRefRef.current = verticalGestureActiveRef;

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureRef = useRef<{
    pointerId: number;
    baseY: number;
    baseBrightness: number;
    baseVolume: number;
    startX: number;
    startY: number;
    axis: 'brightness' | 'volume' | null;
    /** P0-5：本手势开始时容器是否覆盖视口（≥85% 视为全屏形态，纵向手势才接管） */
    coversViewport: boolean;
  } | null>(null);

  const applyBrightness = useCallback((value: number) => {
    const clamped = Math.min(MAX_BRIGHTNESS, Math.max(MIN_BRIGHTNESS, value));
    brightnessRef.current = clamped;
    setBrightness(clamped);
    onBrightnessChangeRef.current(clamped);
  }, []);

  const applyVolume = useCallback((value: number) => {
    const clamped = Math.min(1, Math.max(0, value));
    volumeRef.current = clamped;
    setVolume(clamped);
    onVolumeChangeRef.current(clamped);
  }, []);

  const hideIndicatorSoon = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIndicatorVisible(false);
      setAxis(null);
    }, INDICATOR_HIDE_DELAY);
  }, []);

  const showIndicator = useCallback((a: 'brightness' | 'volume') => {
    setAxis(a);
    setIndicatorVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    // 原生 touch 监听（passive:false 以便 preventDefault），React 合成 touchmove 在 root passive 下无法阻止滚动
    const onTouchStart = (e: TouchEvent) => {
      // P0-6：控制栏/头部/弹层内的触摸不触发手势（与 useLongPress 同名单）
      const target = e.target as HTMLElement | null;
      if (target?.closest(GESTURE_EXCLUDE_SELECTOR)) return;
      const touch = e.touches[0];
      if (!touch) return;
      const rect = el.getBoundingClientRect();
      const relX = touch.clientX - rect.left;
      // P0-4：手势开始时从真实音量同步一次（此前 volumeRef 恒 0，气泡显示失真）
      const realVolume = getInitialVolumeRef.current();
      volumeRef.current = realVolume;
      setVolume(realVolume);
      // 左半屏=亮度、右半屏=音量
      gestureRef.current = {
        pointerId: touch.identifier,
        baseY: touch.clientY,
        baseBrightness: brightnessRef.current,
        baseVolume: volumeRef.current,
        startX: touch.clientX,
        startY: touch.clientY,
        axis: relX < rect.width / 2 ? 'brightness' : 'volume',
        // P0-5：容器几何覆盖视口 ≥85% 才视为全屏形态
        coversViewport: rect.height >= window.innerHeight * VIEWPORT_COVERAGE_RATIO,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      const touch = Array.from(e.touches).find(t => t.identifier === g.pointerId);
      if (!touch) return;

      // 纵轴锁定：位移超过阈值前不判定方向，避免横向滑动（长按 seek / 边缘进度）误触发
      const dy = touch.clientY - g.startY;
      const dx = touch.clientX - g.startX;
      if (Math.abs(dy) < VERTICAL_LOCK_THRESHOLD && Math.abs(dx) < VERTICAL_LOCK_THRESHOLD) {
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) {
        // 横向主导：非本手势，放弃（交给滑动 seek）
        gestureRef.current = null;
        return;
      }

      // P0-5：非全屏形态（嵌入/可滚动页面）纵向滑动交还页面滚动，不接管
      if (!g.coversViewport) {
        gestureRef.current = null;
        return;
      }

      // 纵向主导锁定：通知 useLongPress 取消长按（G8 防冲突）
      if (verticalGestureActiveRefRef.current) {
        verticalGestureActiveRefRef.current.current = true;
      }
      // 阻止页面滚动/默认行为
      if (e.cancelable) e.preventDefault();

      const delta = -(touch.clientY - g.baseY) * SENSITIVITY;
      if (g.axis === 'brightness') {
        applyBrightness(g.baseBrightness + delta);
      } else {
        applyVolume(g.baseVolume + delta);
      }
      if (g.axis) showIndicator(g.axis);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      const touch = Array.from(e.changedTouches).find(t => t.identifier === g.pointerId);
      if (!touch) return;
      gestureRef.current = null;
      hideIndicatorSoon();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [containerRef, enabled, applyBrightness, applyVolume, hideIndicatorSoon, showIndicator]);

  return {
    brightness,
    volume,
    indicatorVisible,
    axis,
  };
}