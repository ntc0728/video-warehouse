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
// 从 React Router 的 NavigateOptions 中剔除 viewTransition（及其早期的
// unstable_viewTransition 别名），任何传入 viewTransition 的调用都会在编译期
// 报错。目的是从类型层面彻底封死 View Transitions —— 见提交 a567107：
// Keep-Alive 的瞬时 display 切换与 View Transitions 整页快照冲突，会在移动端
// 造成 ≈500ms 切换卡顿。业务代码应一律使用 useCustomNavigate，禁止用
// react-router 原生 useNavigate 直接传 viewTransition。
// ─────────────────────────────────────────────────────────────
export type CustomNavigateOptions = Omit<
  NavigateOptions,
  'viewTransition' | 'unstable_viewTransition'
>;

export type CustomNavigateFunction = {
  (to: To, options?: CustomNavigateOptions): void;
  (delta: number): void;
};

/** 业务导航统一入口：返回的函数不接受 viewTransition，从类型上杜绝回归。 */
export function useCustomNavigate(): CustomNavigateFunction {
  const navigate = useNavigate();
  return useCallback(
    ((to: To | number, options?: CustomNavigateOptions) => {
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
