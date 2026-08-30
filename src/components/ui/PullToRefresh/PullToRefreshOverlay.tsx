import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useScrollContainer } from '@/hooks/useScrollContext';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { PTRActionsContext, PTRSnapshotContext, type PullPhase } from './PullToRefreshContext';
import { PullIndicator } from './PullIndicator';

// ── 手感参数 ──
const THRESHOLD = 52; // 指示器越过此位移（px）松手即触发刷新
const MAX_PULL = 110; // 位移渐近上限：橡皮筋「到底」的软停止点，避免指示器飞出屏幕
const DAMP = 0.85; // 阻尼：初始跟手斜率（手指位移 → 指示器位移），越拉越重
const SUCCESS_HOLD_MS = 600; // 成功态停留

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

/**
 * 全局下拉刷新浮层（应用级，仅挂载于 AppLayout 一次）。
 * - 不向任何页面注入 DOM：页面仅通过 usePullToRefresh 钩子注册刷新回调。
 * - 手势监听全局滚动容器（app-shell__scroll）；仅在 scrollTop<=0 且向下拖时接管。
 * - 关键约束：页面内容绝不发生位移（用户明确要求），仅浮层指示器随手势做入场 / 位移动画。
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
  const startYRef = useRef(0);
  const draggingRef = useRef(false);
  const metaTextRef = useRef<string | undefined>(undefined);
  // 手势起点快照：按下时记录 y / 当时滚动位置 / 命中的滚动容器（含 portal 子页）
  const startRef = useRef<{ y: number; scrollTop: number; scEl: HTMLElement | null }>({
    y: 0,
    scrollTop: 0,
    scEl: null,
  });

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

  useEffect(() => {
    // 桌面端不接管下拉手势：鼠标拖拽不应触发下拉刷新浮层
    if (isDesktop) return;
    const fallbackSc = scrollCtx.current;
    const getHandler = () => ptrActions?.getHandler() ?? null;

    // 解析手势命中的滚动容器：若命中 portal 到 body 的子页（.sub-page，如移动端源检测 /
    // 设置子页），取其真正滚动的元素 .sub-page__body；否则回退到全局滚动容器。
    // 这样浮层即便挂在 .app-shell__scroll 上，也能兜住渲染在 body 层、事件不冒泡进
    // 全局滚动容器的页面。
    const resolveScrollEl = (target: EventTarget | null): HTMLElement | null => {
      const el = target instanceof Element ? target : null;
      const sub = el?.closest?.('.sub-page') as HTMLElement | null;
      if (sub) {
        const body = sub.querySelector('.sub-page__body') as HTMLElement | null;
        if (body) return body;
      }
      return fallbackSc;
    };

    const onPointerDown = (e: PointerEvent) => {
      // 仅记录起点，不立即接管 —— 避免误吞点击 / 轻触
      const scEl = resolveScrollEl(e.target);
      startRef.current = { y: e.clientY, scrollTop: scEl ? scEl.scrollTop : 0, scEl };
    };

    const onPointerMove = (e: PointerEvent) => {
      const start = startRef.current;
      if (!draggingRef.current) {
        // 未进入下拉态：仅在「按住 + 自顶部向下超过阈值」时接管；
        // 轻触 / 点击 / 横向或向上微移一律放行，不干扰正常交互（含子页 head 按钮）
        if (!e.buttons) return;
        if (e.pointerType === 'mouse' && e.buttons !== 1) return;
        if (phaseRef.current === 'refreshing' || phaseRef.current === 'success') return;
        if (!start.scEl || start.scrollTop > 0) return;
        const h = getHandler();
        if (!h || h.enabled === false) return;
        const dy = e.clientY - start.y;
        if (dy <= 6) return;
        draggingRef.current = true;
        startYRef.current = start.y;
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        // 继续向下执行下拉逻辑
      }
      if (!draggingRef.current) return;
      const dy = e.clientY - startYRef.current;
      if (dy <= 0) {
        // 向上回移：把进度收敛回 0（不主动触发刷新）
        if (pullRef.current > 0) {
          const y = Math.max(0, damp(dy));
          setPullBoth(y);
          if (y === 0) setPhaseBoth('idle');
        }
        return;
      }
      const y = damp(dy);
      setPullBoth(y);
      setPhaseBoth(y >= THRESHOLD ? 'armed' : 'pulling');
      const m = getHandler()?.meta?.();
      if (m !== metaTextRef.current) {
        metaTextRef.current = m;
        setMetaText(m);
      }
    };

    const finish = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const y = pullRef.current;
      const h = getHandler();
      if (y >= THRESHOLD && h && h.enabled !== false) {
        setPhaseBoth('refreshing');
        const meta = h.meta?.();
        metaTextRef.current = meta;
        setMetaText(meta);
        const settle = () => {
          setPhaseBoth('success');
          window.setTimeout(() => {
            setPhaseBoth('idle');
            metaTextRef.current = undefined;
            setMetaText(undefined);
          }, SUCCESS_HOLD_MS);
        };
        // 无论 Promise 成功/失败，都进入成功态并回弹（失败由页面自行提示）
        Promise.resolve()
          .then(() => h.onRefresh())
          .then(settle, settle);
      } else {
        setPullBoth(0);
        setPhaseBoth('idle');
      }
    };

    const onPointerUp = () => finish();
    const onPointerCancel = () => finish();

    // 挂到 window：portal 到 body 的子页（.sub-page）事件不冒泡进 .app-shell__scroll，
    // 只有挂 window 才能兜住「所有页面（含子页）」的下拉手势
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    // 向下拖拽时第一帧 touchmove 即 preventDefault，抢在浏览器把该手势判定为原生滚动之前
    // 接管（真实移动端 + DevTools 设备模拟均走此路径）。仅向下位移（dy>0）拦截；
    // 向上回移 / 横向滑动仍交还原生处理。cancelable=false 时跳过，避免触发
    // "[Intervention] Ignored attempt to cancel a touchmove event" 警告。
    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current || !e.cancelable) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startYRef.current;
      if (dy > 0) e.preventDefault();
    };
    window.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [scrollCtx, ptrActions, setPhaseBoth, setPullBoth, isDesktop]);

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
      {/* 方案 C 的 SVG 光晕 filter：全局仅渲染一次，供 default 变体小电视引用（url(#ptr-halo)）。
          feMorphology 膨胀 SourceAlpha → 白色 flood 填充轮廓 → 与原始线稿合并，得到柔白光晕。 */}
      <svg className="ptr-halo-defs" width="0" height="0" aria-hidden="true">
        <defs>
          <filter id="ptr-halo" x="-40%" y="-40%" width="180%" height="180%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="d" />
            <feFlood floodColor="#ffffff" floodOpacity="0.95" result="w" />
            <feComposite in="w" in2="d" operator="in" result="ring" />
            <feMerge>
              <feMergeNode in="ring" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
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
