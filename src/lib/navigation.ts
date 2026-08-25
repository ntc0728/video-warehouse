/**
 * 导航层基础工具
 *
 * 治理"回退地狱"：
 * 1. useSmartBack — 智能回退
 *    - 优先按 location.state.from 跳回
 *    - 否则按 options.fallback 跳
 *    - 否则用 navigate(-1)（仅在 navigationType === 'POP' 时）
 *    - 兜底跳首页 /
 *
 * 2. navTo — 跳转到目标路径时附带 from 来源
 *
 * 3. NAV_FALLBACK_HOME — 深链无历史可回时的兜底
 */
import { useCallback } from 'react';
import {
  useNavigate,
  useLocation,
  useNavigationType,
  type NavigateFunction,
  type NavigateOptions,
  type To,
} from 'react-router-dom';

/** 深链无历史可回时的兜底 */
export const NAV_FALLBACK_HOME = '/';

// ─────────────────────────────────────────────────────────────
// 当前 / 上一跳路径追踪（供 useScrollRestore 判定「从哪个页面进入」）
//
// - _currentPathname：当前展示中的页面路径（由 AppLayout 的 layout effect 每路由同步更新）。
// - _previousPathname：进入「当前页面」之前所在的页面路径。
//   · 编程式导航（useCustomNavigate）：在 navigate 之前记录 = 当前展示页。
//   · 浏览器前进/后退（popstate）：在 popstate 回调里记录 = 当前展示页（此时新页尚未提交）。
// 页面（如收藏/历史）据此决定「恢复滚动位置」还是「重置到顶部」。
// ─────────────────────────────────────────────────────────────
let _currentPathname = typeof window !== 'undefined' ? window.location.pathname : '';
let _previousPathname: string | null = null;

/** 读取进入当前页面之前的来源路径 */
export function getPreviousPathname(): string | null {
  return _previousPathname;
}

/** AppLayout 每路由同步当前展示路径 */
export function setCurrentPathname(path: string): void {
  _currentPathname = path;
}

/** popstate（浏览器前进/后退）时记录来源 = 当前展示页（新页尚未提交） */
export function recordPopPrevious(): void {
  _previousPathname = _currentPathname;
}

/** 导航 state 形状，扩展自 React Router 的 unknown state */
export interface NavState {
  /** 显式来源路径（按此路径回退） */
  from?: string;
  /** 显式兜底路径（state.fallback 优先于 options.fallback） */
  fallback?: string;
  /** 可选：来源页标题（用于回退时 toast 提示） */
  title?: string;
  /** 预留：Modal 栈，扩展用 */
  modalStack?: string[];
}

// ─────────────────────────────────────────────────────────────
// 强约束导航 API
//
// 二次进入「先空白再出现数据」的闪烁，由 AppLayout 的 .page-transition[data-revisit]
// 门控在 animations.css 中抑制「已访问路由」的进入动画（opacity:0 起播）来根治——
// 已挂载页面直接以 opacity:1 呈现，无空白帧。
//
// 注意：View Transitions（document.startViewTransition 交叉淡入）曾在此启用，但实测
// 在方案 B（每次重新挂载）下会产生两个问题：(1) 首次进入因 flushSync 提交引发布局抖动；
// (2) 二次进入时新页（缓存命中本应瞬间可见）在 VT 交叉淡入期间被拍成空白快照，反而把
// 白色间隙时长拉长。故已移除 VT，仅保留 data-revisit 门控（方案 A）。首页 HeroBanner
// 等专属过渡不受影响（其 .home-page__content 在 CSS 中被 :not() 排除）。
// ─────────────────────────────────────────────────────────────
export type CustomNavigateOptions = NavigateOptions;

export type CustomNavigateFunction = {
  (to: To, options?: CustomNavigateOptions): void;
  (delta: number): void;
};

/** 业务导航统一入口：一律走 react-router 原生 navigate（不启用 View Transitions）。 */
export function useCustomNavigate(): CustomNavigateFunction {
  const navigate = useNavigate();
  return useCallback(
    ((to: To | number, options?: CustomNavigateOptions) => {
      // 记录「来源路径」：navigate 之前 window.location 仍是当前展示页，
      // 供 useScrollRestore 判定进入目标页前的来源（如 detail/play）。
      _previousPathname = _currentPathname;
      if (typeof to === 'number') {
        navigate(to);
      } else {
        navigate(to, options);
      }
    }) as CustomNavigateFunction,
    [navigate],
  );
}

/**
 * 智能回退 Hook
 *
 * 回退策略分两类：
 *
 * A. 应用内导航进入的页面（location.state 存在，即由 VideoCard / Banner /
 *    <Link state={{from}}> 等带 state 的入口进入；或 navigationType 为
 *    PUSH / REPLACE）：优先用浏览器原生 `navigate(-1)`。
 *    - 这样多级跳转链（详情→详情→详情、收藏/历史→/iptv/play）能逐级正确回退，
 *      而不是被显式 `from` 一次性跳走、并在 `replace` 时丢失中间页线索
 *      （旧实现会在二次返回时直接跳首页）。
 *    - 由于全程不依赖 `from`，`from` 字段不会被 `replace` 抹掉。
 * B. 深链 / 首屏直达（navigationType === 'POP' 且 location.state 为空）：
 *    没有真实历史可回，回落到 state.from / state.fallback / 参数 fallback / 首页。
 *
 * @example
 *   const smartBack = useSmartBack(`/detail/${id}`);
 *   <button onClick={smartBack}>返回</button>
 */
export function useSmartBack(fallback?: string): () => void {
  const navigate = useCustomNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();

  return useCallback(() => {
    const state = (location.state ?? {}) as NavState;

    // 应用内导航（带 state 的入口，或 PUSH/REPLACE 进入）且存在真实历史 →
    // 直接用浏览器原生后退，逐级回退。
    if (window.history.length > 1 && (location.state || navigationType !== 'POP')) {
      navigate(-1);
      return;
    }

    if (state.from) {
      navigate(state.from, { replace: true });
      return;
    }

    if (state.fallback) {
      navigate(state.fallback, { replace: true });
      return;
    }

    if (fallback) {
      navigate(fallback, { replace: true });
      return;
    }

    navigate(NAV_FALLBACK_HOME, { replace: true });
  }, [navigate, location.state, navigationType, fallback]);
}

/**
 * 跳转到目标路径时附带 from 来源
 *
 * @example
 *   const navigate = useNavigate();
 *   const location = useLocation();
 *   navTo(navigate, `/detail/${id}`, location.pathname + location.search);
 */
export function navTo(
  navigate: NavigateFunction,
  to: string,
  from?: string,
  extra?: Partial<NavState>
): void {
  if (from || extra) {
    navigate(to, { state: { from, ...extra } });
  } else {
    navigate(to);
  }
}

/** 读取当前 location 的 from 字段（如有） */
export function readFrom(state: unknown): string | undefined {
  if (state && typeof state === 'object' && 'from' in state) {
    const from = (state as NavState).from;
    return typeof from === 'string' ? from : undefined;
  }
  return undefined;
}
