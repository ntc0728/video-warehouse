import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTouchGestureOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  initialBrightness: number;
  onBrightnessChange: (value: number) => void;
  onVolumeChange: (value: number) => void;
  /** P0-4：手势开始时同步真实音量（此前硬编码 0，气泡与实际音量脱节） */
  getInitialVolume: () => number;
  /** P0-1：横向滑动 seek 是否可用（调用方按 hasError/模式判定） */
  canSeek: boolean;
  /** P0-1：视频时长（秒），把像素位移换算成 seek 秒数 */
  getDuration: () => number;
  /** P0-1：手势起点时的当前播放时间（seek 累计基准） */
  getSeekBaseTime: () => number;
  /** P0-1：seek 目标时间回调（移动中节流触发，松手时最终触发一次） */
  onSeekTarget: (targetTime: number) => void;
  /** 纵向手势主导后置 true，通知 useLongPress 取消长按（G8 防手势冲突） */
  verticalGestureActiveRef?: React.MutableRefObject<boolean>;
}

/** 锁定轴类型：null = 未锁定（位移未过阈值），锁定后不再改变 */
type GestureAxis = 'brightness' | 'volume' | 'seek';

/** 纵向滑动主导判定阈值（px）：超过则锁定滑动方向 */
const VERTICAL_LOCK_THRESHOLD = 8;
/** 亮度调节范围（filter brightness） */
const MIN_BRIGHTNESS = 0.1;
const MAX_BRIGHTNESS = 2;
/** 手势结束后指示器自动隐藏延迟 */
const INDICATOR_HIDE_DELAY = 1200;
/** 手势增量灵敏度：位移 1px 对应的值变化（亮度/音量） */
const SENSITIVITY = 1 / 200;
/** P0-1：seek 灵敏度——横向滑过 15% 容器宽度 ≈ 全片长（对齐 B站手感） */
const SEEK_SENS_FRACTION = 0.15;
/** P0-1：拖动中 onSeekTarget 回调节流（ms） */
const SEEK_CB_THROTTLE = 100;
/**
 * P0-5：容器高度覆盖视口达到该比例才视为「全屏形态」，纵向手势才接管（preventDefault）。
 * 不依赖 document.fullscreenElement——App 端是 CSS 全屏布局，不触发该 API。
 * 嵌入/可滚动页面（覆盖不足）时纵向滑动交还页面滚动。横向 seek 不受此限制（B站竖屏同样支持）。
 */
const VIEWPORT_COVERAGE_RATIO = 0.85;
/** P0-6：手势排除区（与 useLongPress 同名单 + 移动端弹层），触摸这些区域不触发任何手势 */
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

/** P0-1：横向滑动 seek 的 HUD 状态（跟随手指的目标时间偏移） */
export interface SeekHudState {
  active: boolean;
  /** 相对手势起点的累计偏移（秒，负 = 快退） */
  deltaSeconds: number;
}

export function useTouchGesture({
  containerRef,
  enabled,
  initialBrightness,
  onBrightnessChange,
  onVolumeChange,
  getInitialVolume,
  canSeek,
  getDuration,
  getSeekBaseTime,
  onSeekTarget,
  verticalGestureActiveRef,
}: UseTouchGestureOptions) {
  const [brightness, setBrightness] = useState(initialBrightness);
  const [volume, setVolume] = useState(0);
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const [axis, setAxis] = useState<'brightness' | 'volume' | null>(null);
  const [seekHud, setSeekHud] = useState<SeekHudState>({ active: false, deltaSeconds: 0 });

  const brightnessRef = useRef(initialBrightness);
  const volumeRef = useRef(0);
  const onBrightnessChangeRef = useRef(onBrightnessChange);
  const onVolumeChangeRef = useRef(onVolumeChange);
  const getInitialVolumeRef = useRef(getInitialVolume);
  const canSeekRef = useRef(canSeek);
  const getDurationRef = useRef(getDuration);
  const getSeekBaseTimeRef = useRef(getSeekBaseTime);
  const onSeekTargetRef = useRef(onSeekTarget);
  const verticalGestureActiveRefRef = useRef(verticalGestureActiveRef);

  onBrightnessChangeRef.current = onBrightnessChange;
  onVolumeChangeRef.current = onVolumeChange;
  getInitialVolumeRef.current = getInitialVolume;
  canSeekRef.current = canSeek;
  getDurationRef.current = getDuration;
  getSeekBaseTimeRef.current = getSeekBaseTime;
  onSeekTargetRef.current = onSeekTarget;
  verticalGestureActiveRefRef.current = verticalGestureActiveRef;

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureRef = useRef<{
    pointerId: number;
    baseY: number;
    baseBrightness: number;
    baseVolume: number;
    startX: number;
    startY: number;
    /** 半屏候选轴（左半屏亮度 / 右半屏音量），仅纵向锁定后生效 */
    candidate: 'brightness' | 'volume';
    /** 锁定轴：锁定后不再改变 */
    locked: GestureAxis | null;
    /** P0-5：手势开始时容器是否覆盖视口（≥85% 视为全屏形态，纵向手势才接管） */
    coversViewport: boolean;
    // ── seek 轴状态 ──
    seekBaseTime: number;
    seekAccum: number;
    lastMoveX: number;
    lastSeekCbAt: number;
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

  /** seek 目标时间钳制 + 累计回写（贴边后反向滑动无死区） */
  const clampSeekTarget = (base: number, accum: number): { target: number; accum: number } => {
    const dur = getDurationRef.current();
    if (!Number.isFinite(dur) || dur <= 0) return { target: base, accum: 0 };
    const target = Math.max(0, Math.min(dur, base + accum));
    return { target, accum: target - base };
  };

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
      gestureRef.current = {
        pointerId: touch.identifier,
        baseY: touch.clientY,
        baseBrightness: brightnessRef.current,
        baseVolume: volumeRef.current,
        startX: touch.clientX,
        startY: touch.clientY,
        candidate: relX < rect.width / 2 ? 'brightness' : 'volume',
        locked: null,
        // P0-5：容器几何覆盖视口 ≥85% 才视为全屏形态
        coversViewport: rect.height >= window.innerHeight * VIEWPORT_COVERAGE_RATIO,
        seekBaseTime: 0,
        seekAccum: 0,
        lastMoveX: touch.clientX,
        lastSeekCbAt: 0,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      const touch = Array.from(e.touches).find(t => t.identifier === g.pointerId);
      if (!touch) return;

      // ── 已锁定：按轴分发 ──
      if (g.locked === 'seek') {
        const dur = getDurationRef.current();
        if (!Number.isFinite(dur) || dur <= 0) return;
        const rect = el.getBoundingClientRect();
        const deltaSeconds = ((touch.clientX - g.lastMoveX) / (rect.width * SEEK_SENS_FRACTION)) * dur;
        g.lastMoveX = touch.clientX;
        const { target, accum } = clampSeekTarget(g.seekBaseTime, g.seekAccum + deltaSeconds);
        g.seekAccum = accum;
        setSeekHud({ active: true, deltaSeconds: accum });
        if (e.cancelable) e.preventDefault();
        const now = performance.now();
        if (now - g.lastSeekCbAt >= SEEK_CB_THROTTLE) {
          g.lastSeekCbAt = now;
          onSeekTargetRef.current(target);
        }
        return;
      }
      if (g.locked === 'brightness' || g.locked === 'volume') {
        if (e.cancelable) e.preventDefault();
        const delta = -(touch.clientY - g.baseY) * SENSITIVITY;
        if (g.locked === 'brightness') applyBrightness(g.baseBrightness + delta);
        else applyVolume(g.baseVolume + delta);
        showIndicator(g.locked);
        return;
      }

      // ── 未锁定：方向判定 ──
      const dy = touch.clientY - g.startY;
      const dx = touch.clientX - g.startX;
      if (Math.abs(dy) < VERTICAL_LOCK_THRESHOLD && Math.abs(dx) < VERTICAL_LOCK_THRESHOLD) {
        return;
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        // 横向主导 → 锁定 seek 轴（P0-1）；seek 不可用（错误态/无时长）才放弃
        if (!canSeekRef.current) {
          gestureRef.current = null;
          return;
        }
        const dur = getDurationRef.current();
        if (!Number.isFinite(dur) || dur <= 0) {
          gestureRef.current = null;
          return;
        }
        g.locked = 'seek';
        g.seekBaseTime = getSeekBaseTimeRef.current();
        g.seekAccum = 0;
        g.lastMoveX = touch.clientX;
        g.lastSeekCbAt = 0;
        setSeekHud({ active: true, deltaSeconds: 0 });
        return;
      }

      // 纵向主导
      // P0-5：非全屏形态（嵌入/可滚动页面）纵向滑动交还页面滚动，不接管
      if (!g.coversViewport) {
        gestureRef.current = null;
        return;
      }
      // 纵向锁定：通知 useLongPress 取消长按（G8 防冲突）
      if (verticalGestureActiveRefRef.current) {
        verticalGestureActiveRefRef.current.current = true;
      }
      g.locked = g.candidate;
      if (e.cancelable) e.preventDefault();
      const delta = -(touch.clientY - g.baseY) * SENSITIVITY;
      if (g.locked === 'brightness') applyBrightness(g.baseBrightness + delta);
      else applyVolume(g.baseVolume + delta);
      showIndicator(g.locked);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      const touch = Array.from(e.changedTouches).find(t => t.identifier === g.pointerId);
      if (!touch) return;
      gestureRef.current = null;
      if (g.locked === 'seek') {
        // 松手最终触发一次 seek（不受节流影响，保证落点与 HUD 一致）
        const { target } = clampSeekTarget(g.seekBaseTime, g.seekAccum);
        onSeekTargetRef.current(target);
        setSeekHud(s => ({ ...s, active: false }));
        return;
      }
      if (g.locked === 'brightness' || g.locked === 'volume') {
        hideIndicatorSoon();
      }
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
      setSeekHud(s => ({ ...s, active: false }));
    };
  }, [containerRef, enabled, applyBrightness, applyVolume, hideIndicatorSoon, showIndicator]);

  return {
    brightness,
    volume,
    indicatorVisible,
    axis,
    seekHud,
  };
}
