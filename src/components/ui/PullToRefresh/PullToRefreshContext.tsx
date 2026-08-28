import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type PullPhase = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'success';

export interface PTRHandler {
  /** 触发刷新：返回 Promise，resolve 后浮层自动回弹 */
  onRefresh: () => void | Promise<void>;
  /** 是否启用（默认 true） */
  enabled?: boolean;
  /**
   * 刷新时展示的参数摘要（如「搜索: 动作」「分类: 电影」），用于浮层提示
   * 「记录参数」——证明刷新保留了当前页面的搜索/筛选状态。
   */
  meta?: () => string | undefined;
  /**
   * 浮层视觉变体：
   * - 'default'（默认）：顶部导航栏下方居中的指示器
   * - 'settings'：页面中间位移出现的圆形刷新按钮（设置页专用）
   */
  variant?: 'default' | 'settings';
}

/** 浮层当前活跃处理器的「响应式快照」——用于实时驱动浮层重渲染 */
export interface PTRHandlerInfo {
  variant: 'default' | 'settings';
  enabled: boolean;
}

/** 浮层阶段广播：phase + 当前指示器位移（px） */
export interface PTRPhaseState {
  phase: PullPhase;
  pull: number;
}

type PhaseListener = (state: PTRPhaseState) => void;

/**
 * 稳定动作集合（引用永不变化）。
 *
 * 必须与「handlerInfo 快照」分成两个 Context：若快照与动作同在一个 value 里，
 * 页面 effect（依赖 ctx）会在 register→setState→value 变→effect 重跑 之间震荡：
 * effect 重跑先 cleanup（register(null)）再 register(handler)，快照在 null↔对象 间
 * 反复翻转，形成同步死循环（实测直接挂死 vitest worker）。拆开后页面 effect 只跑一次。
 */
interface PTRActions {
  register: (handler: PTRHandler | null) => void;
  getHandler: () => PTRHandler | null;
  /** 订阅浮层阶段（浮层内部在每次 phase/pull 变化时同步广播），返回退订函数 */
  subscribe: (listener: PhaseListener) => () => void;
  /** 浮层内部调用：向订阅者同步广播阶段（不经过 React 状态，避免浮层自身重渲染） */
  emitPhase: (state: PTRPhaseState) => void;
}

export const PTRActionsContext = createContext<PTRActions | null>(null);
/** 活跃 handler 的变体/启用态快照：仅浮层消费，驱动变体实时切换 */
export const PTRSnapshotContext = createContext<PTRHandlerInfo | null>(null);

export function PullToRefreshProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<PTRHandler | null>(null);
  const [handlerInfo, setHandlerInfo] = useState<PTRHandlerInfo | null>(null);
  const listenersRef = useRef(new Set<PhaseListener>());
  const register = useCallback((h: PTRHandler | null) => {
    handlerRef.current = h;
    setHandlerInfo(
      h ? { variant: h.variant ?? 'default', enabled: h.enabled ?? true } : null,
    );
  }, []);
  const getHandler = useCallback(() => handlerRef.current, []);
  const subscribe = useCallback((listener: PhaseListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);
  /** 浮层内部调用：同步广播阶段（不进 React 状态，避免浮层自身重渲染） */
  const emitPhase = useCallback((state: PTRPhaseState) => {
    listenersRef.current.forEach((l) => l(state));
  }, []);
  const actions = useMemo(
    () => ({ register, getHandler, subscribe, emitPhase }),
    [register, getHandler, subscribe, emitPhase],
  );
  return (
    <PTRActionsContext.Provider value={actions}>
      <PTRSnapshotContext.Provider value={handlerInfo}>{children}</PTRSnapshotContext.Provider>
    </PTRActionsContext.Provider>
  );
}

/**
 * 订阅浮层当前阶段（供页面做联动，如「刷新中禁用某些交互」或 Demo 状态回显）。
 * 未订阅者零开销；订阅者在手势移动期间会按帧收到回调。
 */
export function usePullPhase(): PTRPhaseState {
  const actions = useContext(PTRActionsContext);
  const [state, setState] = useState<PTRPhaseState>({ phase: 'idle', pull: 0 });
  useEffect(() => {
    if (!actions) return;
    return actions.subscribe(setState);
  }, [actions]);
  return state;
}

/**
 * 页面级下拉刷新注册钩子。
 *
 * 关键约束：本钩子**不渲染任何 DOM**，满足「页面本体不新增元素」的要求；
 * 它只把当前页面的刷新回调注册进全局浮层（AppLayout 内的 PullToRefreshOverlay）。
 *
 * 参数保留：onRefresh 通过闭包捕获页面当前状态（如 Browse 从 URL 读取的搜索/筛选），
 * 因此刷新天然复用当前参数——这正是「相关页面记录搜索参数」的实现方式。
 *
 * 单活跃页面假设：AppLayout 同一时刻只渲染一个路由组件（方案 B：无 Keep-Alive），
 * 故浮层始终取「当前挂载页面」注册的处理器；路由切换时旧页 register(null) 后新页注册。
 */
export function usePullToRefresh(
  onRefresh: () => void | Promise<void>,
  options?: { enabled?: boolean; meta?: () => string | undefined; variant?: 'default' | 'settings' },
) {
  const actions = useContext(PTRActionsContext);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const optsRef = useRef(options);
  optsRef.current = options;
  // 每个钩子实例一个稳定 id，仅用于占位依赖，确保挂载时注册一次
  const idRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!actions) return;
    const handler: PTRHandler = {
      get onRefresh() {
        return () => onRefreshRef.current();
      },
      get enabled() {
        return optsRef.current?.enabled ?? true;
      },
      get meta() {
        return optsRef.current?.meta;
      },
      get variant() {
        return optsRef.current?.variant ?? 'default';
      },
    };
    actions.register(handler);
    return () => actions.register(null);
    // 依赖 variant/enabled 原语：变体或启用态变化时重新注册，驱动浮层快照更新并实时重渲染
  }, [actions, idRef, options?.enabled, options?.variant]);

  return null;
}

export default PullToRefreshProvider;
