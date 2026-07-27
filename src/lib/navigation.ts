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
 * 优先级：
 * 1. location.state.from → navigate(from, { replace: true })
 * 2. location.state.fallback → navigate(fallback, { replace: true })
 * 3. fallback（参数）→ navigate(fallback, { replace: true })
 * 4. navigationType === 'POP' → navigate(-1)
 * 5. 兜底 → navigate(NAV_FALLBACK_HOME, { replace: true })
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

    if (navigationType === 'POP' && window.history.length > 1) {
      navigate(-1);
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
