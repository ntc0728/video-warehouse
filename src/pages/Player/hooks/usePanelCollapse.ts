import { useEffect, useLayoutEffect, useRef } from 'react';

/** 展开（进入）：起步快、尾段长减速 —— 柔和但不拖沓 */
const EXPAND_MS = 260;
const EXPAND_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** 收起（退出）：前段加速、末段收住 —— 干脆不拖泥带水 */
const COLLAPSE_MS = 200;
const COLLAPSE_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 面板折叠/展开高度动画（Web Animations API，全端统一：桌面 ≥1024 / 窄屏 / App / TV）
 *
 * ── 为什么不再用纯 CSS ──────────────────────────────────────────────
 * · max-height 过渡（旧实现）：阈值恒写 80vh，内容远低于阈值时前段完全无视觉变化，
 *   表现为「停顿一下再猛地收起」，展开则提前结束 —— 这是生硬感的根因；
 * · grid-template-rows 0fr↔1fr：只在容器高度为 auto（内容驱动）时成立。桌面端面板
 *   高度由 .player-sidebar 的 1fr 行分配（容器高度固定），fr 行恒填满 → 动画无效。
 * 因此改为「测量真实高度 → from/to 关键帧」，px 精确且与布局策略无关。
 *
 * ── 与 grid 侧栏的配合 ──────────────────────────────────────────────
 * · 收起：sidebar 行 1fr→auto 瞬变，但 auto 行大小 = item 当前动画高度 → 行随动画收缩；
 * · 展开：sidebar 行 auto→1fr 后行高固定，item 在行内做高度动画，其余面板位置不动。
 *
 * ── 内容观感 ────────────────────────────────────────────────────────
 * 收起/展开过程中 body 保持自然高度（.player-panel.collapsed 只锁面板高度），
 * 内容被面板 overflow:hidden 从底部裁切/露出，而不是「瞬间消失」。
 *
 * @param collapsed 当前是否为收起态（App 端面板不可折叠时恒传 false，不产生动画）
 */
export function usePanelCollapse<T extends HTMLElement>(collapsed: boolean) {
  const ref = useRef<T>(null);
  /** 上一次「稳定」高度，作为下次切换的动画起点 */
  const stableH = useRef(0);
  const animRef = useRef<Animation | null>(null);

  // 内容自然变化（集数加载完成、CMS 源增删、窗口缩放）时同步稳定高度，
  // 避免下次切换以过期高度作起点 → 动画从错误高度起步。
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (!animRef.current) stableH.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;

    const prevAnim = animRef.current;
    // 连点时取「当前动画中间高度」作起点，避免从上一个稳定态跳变（cancel 前先读）
    const from = prevAnim ? el.getBoundingClientRect().height : stableH.current;
    prevAnim?.cancel();
    // cancel 之后再测：此时为新布局的终态高度（collapsed 态由 CSS 锁高度为 header）
    const to = el.offsetHeight;
    stableH.current = to;

    // 首次挂载 / 高度未变 / 用户要求减少动效 → 不动画
    if (!from || Math.abs(to - from) < 2 || prefersReducedMotion()) return;

    const duration = collapsed ? COLLAPSE_MS : EXPAND_MS;
    const easing = collapsed ? COLLAPSE_EASE : EXPAND_EASE;
    el.style.setProperty('--collapse-dur', `${duration}ms`);
    el.classList.add('is-collapsing');

    const anim = el.animate(
      [{ height: `${from}px` }, { height: `${to}px` }],
      { duration, easing },
    );
    animRef.current = anim;

    anim.finished
      .then(() => {
        if (animRef.current !== anim) return; // 已被新动画接管
        animRef.current = null;
        el.classList.remove('is-collapsing');
        el.style.removeProperty('--collapse-dur');
        stableH.current = el.offsetHeight;
      })
      .catch(() => { /* cancel 导致的 reject，忽略 */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  return ref;
}
