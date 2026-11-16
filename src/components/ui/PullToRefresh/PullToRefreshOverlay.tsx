import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import {
  PTRActionsContext,
  PTRSnapshotContext,
  type PTRHandler,
  type PullPhase,
} from './PullToRefreshContext';
import { resolvePtrOwner } from './pullGesture';
import { PullIndicator } from './PullIndicator';

// ── 手感参数 ──
const THRESHOLD = 52; // 指示器越过此位移（px）松手即触发刷新
const MAX_PULL = 110; // 位移渐近上限：橡皮筋「到底」的软停止点，避免指示器飞出屏幕
const DAMP = 0.85; // 阻尼：初始跟手斜率（手指位移 → 指示器位移），越拉越重
const SUCCESS_HOLD_MS = 600; // 成功态停留
// 手势起步宽限：位移未超过此值不接管，避免误吞轻触 / 点击
const START_SLOP = 6;
// 轴向锁：纵向位移必须明显大于横向才接管。Hero / 灯箱 / 横向 chips 的斜滑
// 常带几像素纵向抖动，仅靠 dy>6 会把「翻页」同时判成「下拉刷新」。
const AXIS_LOCK_RATIO = 1.15;

/**
 * 渐进阻尼（iOS/ B 站同款橡皮筋）：位移趋近 MAX_PULL 但永不到达。
 * - dy → 0 时斜率 ≈ DAMP（起步跟手，不粘滞）
 * - dy 越大增量越小（越拉越重），无硬截断的「撞墙感」
 * - 奇函数：向上回移对称收敛，pull 平滑回到 0
 */
function damp(dy: number): number {
  const sign = dy < 0 ? -1 : 1;
  const abs = Math.abs(dy);
  return sign * MAX_PULL * (1 - Math.exp(-abs / (MAX_PULL / DAMP)));
}

/** 已按下、尚未判定归属的手势（不接管就丢弃，避免误吞点击） */
interface PendingGesture {
  pointerId: number;
  startX: number;
  startY: number;
  owner: HTMLElement;
}

/** 已接管的手势：handler 在 claim 时钉住，松手不再回读（页面切走也不会刷到新页） */
interface ActiveGesture extends PendingGesture {
  handler: PTRHandler;
}

/**
 * 全局下拉刷新浮层（应用级，仅挂载于 AppLayout 一次）。
 * - 不向任何页面注入 DOM：页面仅通过 usePullToRefresh 钩子注册刷新回调。
 * - 手势归属：pointerdown 时由 `resolvePtrOwner` 一次性判定（浮层/输入框/内滚容器一律放行），
 *   之后锁轴、锁指针、锁 handler；pointercancel 视为中止而非松手。
 * - 关键约束：页面内容绝不发生位移，仅浮层指示器随手势做入场 / 位移动画。
 * - 变体：default=顶部导航栏下方居中指示器；settings=页面中间位移出现刷新按钮。
 */
export function PullToRefreshOverlay() {
  const isDesktop = useIsDesktop();
  const scrollCtx = useScrollContainer();
  const ptrActions = useContext(PTRActionsContext);
  const snapshot = useContext(PTRSnapshotContext);
  const [phase, setPhase] = useState<PullPhase>('idle');
  const [pull, setPull] = useState(0);
  const [metaText, setMetaText] = useState<string | undefined>();

  const phaseRef = useRef<PullPhase>('idle');
  const pullRef = useRef(0);
  const metaTextRef = useRef<string | undefined>(undefined);
  /** 未判定归属的手势 */
  const pendingRef = useRef<PendingGesture | null>(null);
  /** 已接管的手势 */
  const gestureRef = useRef<ActiveGesture | null>(null);
  /** 当前按下的指针集合：第二根手指按下即中止下拉（多指/捏合归浏览器） */
  const activePointersRef = useRef<Set<number>>(new Set());
  /** 刷新代际：页面切走 / 新刷新开始时旧 Promise 的 settle 自动作废 */
  const refreshTokenRef = useRef(0);

  const setPhaseBoth = useCallback(
    (p: PullPhase) => {
      phaseRef.current = p;
      setPhase(p);
      ptrActions?.emitPhase({ phase: p, pull: pullRef.current });
    },
    [ptrActions],
  );
  const setPullBoth = useCallback(
    (v: number) => {
      pullRef.current = v;
      setPull(v);
      ptrActions?.emitPhase({ phase: phaseRef.current, pull: v });
    },
    [ptrActions],
  );

  const clearMeta = useCallback(() => {
    if (metaTextRef.current === undefined) return;
    metaTextRef.current = undefined;
    setMetaText(undefined);
  }, []);

  /** 中止未完成的手势（回弹但不刷新）；不触碰 refreshing/success */
  const abortGesture = useCallback(() => {
    pendingRef.current = null;
    gestureRef.current = null;
    if (pullRef.current !== 0) setPullBoth(0);
    if (phaseRef.current === 'pulling' || phaseRef.current === 'armed') {
      setPhaseBoth('idle');
    }
  }, [setPhaseBoth, setPullBoth]);

  /** 页面实例变化（切页 / 卸载 / 软刷新重挂载）：作废手势与在飞刷新的视觉结算 */
  const cancelVisual = useCallback(() => {
    refreshTokenRef.current += 1;
    pendingRef.current = null;
    gestureRef.current = null;
    activePointersRef.current.clear();
    setPullBoth(0);
    setPhaseBoth('idle');
    clearMeta();
  }, [clearMeta, setPhaseBoth, setPullBoth]);

  // 订阅「当前页面实例 id」：变化即切页 → 旧手势/旧刷新不得延续到新页
  const ownerId = snapshot?.ownerId ?? null;
  const prevOwnerIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevOwnerIdRef.current === ownerId) return;
    prevOwnerIdRef.current = ownerId;
    cancelVisual();
  }, [ownerId, cancelVisual]);

  useEffect(() => {
    // 桌面端不接管下拉手势：鼠标拖拽不应触发下拉刷新浮层
    if (isDesktop) return;
    const activePointers = activePointersRef.current;
    const getHandler = () => ptrActions?.getHandler() ?? null;

    const clearPending = (pointerId: number) => {
      if (pendingRef.current?.pointerId === pointerId) pendingRef.current = null;
    };

    /** 进入下拉态后：跟手更新位移 / 阶段 / 参数摘要 */
    const applyPull = (dy: number, handler: PTRHandler) => {
      const y = damp(dy);
      setPullBoth(y);
      setPhaseBoth(y >= THRESHOLD ? 'armed' : 'pulling');
      const m = handler.meta?.();
      if (m !== metaTextRef.current) {
        metaTextRef.current = m;
        setMetaText(m);
      }
    };

    const startRefresh = (handler: PTRHandler) => {
      const token = refreshTokenRef.current + 1;
      refreshTokenRef.current = token;
      setPhaseBoth('refreshing');
      const meta = handler.meta?.();
      metaTextRef.current = meta;
      setMetaText(meta);
      const settle = () => {
        // 页面已切走 / 新一轮刷新已开始：本次结果不再驱动浮层
        if (token !== refreshTokenRef.current) return;
        setPhaseBoth('success');
        window.setTimeout(() => {
          if (token !== refreshTokenRef.current) return;
          setPhaseBoth('idle');
          clearMeta();
        }, SUCCESS_HOLD_MS);
      };
      // 无论 Promise 成功/失败，都进入成功态并回弹（失败由页面自行提示）
      Promise.resolve()
        .then(() => handler.onRefresh())
        .then(settle, settle);
    };

    const finish = (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g || e.pointerId !== g.pointerId) return;
      gestureRef.current = null;
      const y = pullRef.current;
      // 只认 claim 时钉住的 handler；页面若是通过同实例重新注册（enabled/variant 变化），
      // getHandler 会返回新对象 → 按「上下文已变」中止，避免刷到不该刷的页面状态。
      const usable = getHandler() === g.handler && g.handler.enabled !== false;
      if (y >= THRESHOLD && usable) {
        startRefresh(g.handler);
      } else {
        setPullBoth(0);
        setPhaseBoth('idle');
        clearMeta();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      activePointers.add(e.pointerId);
      if (activePointers.size > 1) {
        // 多指：取消本次下拉，把捏合/双指滚动交还浏览器
        abortGesture();
        return;
      }
      // 新的单指序列开始：清掉上一轮可能残留的手势
      abortGesture();
      if (phaseRef.current === 'refreshing' || phaseRef.current === 'success') return;

      const { owner } = resolvePtrOwner(e.composedPath(), scrollCtx.current);
      if (!owner || owner.scrollTop > 0) return;
      pendingRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        owner,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      // 多指期间不参与下拉计算（任一指针的移动都不应拖动指示器）
      if (activePointers.size > 1) return;

      const g = gestureRef.current;
      if (g) {
        if (e.pointerId !== g.pointerId) return;
        const dy = e.clientY - g.startY;
        if (dy <= 0) {
          // 向上回移：把进度收敛回 0（不主动触发刷新）
          if (pullRef.current > 0) {
            setPullBoth(0);
            setPhaseBoth('idle');
            clearMeta();
          }
          return;
        }
        applyPull(dy, g.handler);
        return;
      }

      const p = pendingRef.current;
      if (!p || e.pointerId !== p.pointerId) return;
      // 未进入下拉态：仅在「按住 + 自顶部向下超过起步宽限」时接管；
      // 轻触 / 点击 / 横向或向上微移一律放行，不干扰正常交互（含子页 head 按钮）
      if (!e.buttons) return;
      if (e.pointerType === 'mouse' && e.buttons !== 1) return;
      if (phaseRef.current === 'refreshing' || phaseRef.current === 'success') {
        pendingRef.current = null;
        return;
      }
      const dx = e.clientX - p.startX;
      const dy = e.clientY - p.startY;
      if (dy <= START_SLOP) return;
      if (Math.abs(dy) <= Math.abs(dx) * AXIS_LOCK_RATIO) return;
      // claim 时复核滚动位置：按下瞬间可能在顶部，但过程中被程序滚动过
      if (p.owner.scrollTop > 0) {
        pendingRef.current = null;
        return;
      }
      const h = getHandler();
      if (!h || h.enabled === false) {
        pendingRef.current = null;
        return;
      }
      pendingRef.current = null;
      gestureRef.current = {
        pointerId: e.pointerId,
        startX: p.startX,
        startY: p.startY,
        owner: p.owner,
        handler: h,
      };
      applyPull(dy, h);
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      clearPending(e.pointerId);
      finish(e);
    };

    const onPointerCancel = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      clearPending(e.pointerId);
      // 浏览器接管手势（原生滚动 / 系统边缘手势）≠ 用户松手：只回弹，不刷新
      if (gestureRef.current?.pointerId === e.pointerId) abortGesture();
    };

    // 挂到 window：portal 到 body 的子页/浮层事件不冒泡进 .app-shell__scroll，
    // 只有挂 window 才能看见「所有页面（含 portal）」的指针序列；归属由 resolvePtrOwner 判定。
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    // 向下拖拽时第一帧 touchmove 即 preventDefault，抢在浏览器把该手势判定为原生滚动之前
    // 接管（真实移动端 + DevTools 设备模拟均走此路径）。仅向下位移（dy>0）拦截；
    // 向上回移 / 横向滑动仍交还原生处理。cancelable=false 时跳过，避免触发
    // "[Intervention] Ignored attempt to cancel a touchmove event" 警告。
    const onTouchMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g || !e.cancelable) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - g.startY;
      if (dy > 0) e.preventDefault();
    };
    window.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('touchmove', onTouchMove);
      activePointers.clear();
      abortGesture();
    };
  }, [abortGesture, clearMeta, isDesktop, ptrActions, scrollCtx, setPhaseBoth, setPullBoth]);

  // 桌面端不渲染下拉刷新浮层（与上面的手势门控配对）
  if (isDesktop) return null;

  // 读取响应式快照（随 register 实时更新），保证「中间按钮/顶部指示」切换立即生效
  const variant = snapshot?.variant ?? 'default';
  const progress = Math.min(pull / THRESHOLD, 1);
  // enter：指示器入场/位移进度。idle=0；刷新/成功=1（完全呈现）；下拉中=随拉拽进度 0→1
  const enter =
    phase === 'idle'
      ? 0
      : phase === 'refreshing' || phase === 'success'
        ? 1
        : progress;

  const indicatorStyle =
    variant === 'settings'
      ? {
          transform: `translate(-50%, calc(-50% + ${(1 - enter) * 64}px)) scale(${0.8 + 0.2 * enter})`,
          opacity: enter,
        }
      : {
          transform: `translateX(-50%) translateY(${(1 - enter) * -18}px) scale(${0.72 + 0.28 * enter})`,
          opacity: enter,
        };

  return (
    <div className="ptr-overlay" aria-hidden={phase === 'idle'}>
      {/* 原 SVG 光晕 filter（#ptr-halo）已删除：引用式滤镜在高 DPR 手机上低分辨率
 栅格化再放大 → 光晕发糊。白轮廓改由 PullIndicator 的
 .ptr-tv-halo 白色剪影垫底副本承担（纯矢量，任意 DPR 锐利）。 */}
      <div
        className={`ptr-overlay__indicator ptr-overlay__indicator--${variant}`}
        style={indicatorStyle}
        data-drag={phase === 'pulling' || phase === 'armed' ? 'true' : undefined}
      >
        <PullIndicator
          phase={phase}
          progress={progress}
          variant={variant}
          meta={metaText}
        />
      </div>
    </div>
  );
}

export default PullToRefreshOverlay;
