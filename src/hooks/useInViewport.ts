/**
 * 通用「元素是否进入视口」Hook（IntersectionObserver）
 *
 * 用途：模块级视口懒加载——页面下部区块只有接近视口时才发请求（Detail 剧照 / Home 内容行）。
 *
 * 用法：
 *   const { ref, inView } = useInViewport<HTMLDivElement>({ rootMargin: '200px' });
 *   return <div ref={ref}>{inView ? <Heavy /> : <Skeleton />}</div>;
 *
 * 设计要点：
 * - **回调式 ref（而非 useRef 对象）**：元素可能在「条件渲染」下晚于 Hook 挂载（例如 Detail 剧照
 *   哨兵在 tab 内容里）。若用 useRef 对象，effect 只在挂载那次读 `ref.current`，此时若为 null
 *   就永久不建 observer —— 元素后续出现也不会触发。改用 `useState<Element|null>` + 稳定回调 ref，
 *   把「节点连接/断开」变成 effect 依赖，节点一挂上即建 observer。
 * - **滚动根部默认取 `useScrollContainer()` 的容器**（AppLayout 的 `.app-shell__scroll`），
 *   不是 window —— 全站滚动发生在该容器内，显式指定 root 才能拿到准确的相交判定。
 *   容器缺失（如 IPTVPlayer 独立路由）时自动退化为 viewport。
 * - **首帧主动判定**：`observe()` 不会立刻回调，元素已在视口内（首屏区块）时必须靠
 *   rAF 里的 rect 判定抢先置位，否则要等到用户滚动才加载。
 * - **隐藏期守卫**：容器不可见（`clientHeight === 0`，如 Keep-Alive `display:none`）时
 *   rect 全 0 无意义，跳过首帧判定（镜像 `useInfiniteScroll.ts` 的既有处理）。
 * - **deps 只放结构性参数**（node / disabled / rootMargin / threshold / once）：
 *   `inView` 与业务布尔量绝不进 deps —— 否则 re-observe 会与下游状态互相触发，
 *   形成自放大循环（`useInfiniteScroll.ts` 的 `hasMore` 就是这个坑，见 2026-09-16 评审）。
 */
import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useScrollContainer } from './useScrollContext';

export interface UseInViewportOptions {
  /** 提前多少像素触发（默认 200px；支持 '200px 0px' 这类 IO 语法） */
  rootMargin?: string;
  /** 相交阈值（默认 0.01，即露出 1% 即算命中） */
  threshold?: number | number[];
  /** 外部禁用：为真时不创建 observer，`inView` 恒为 false */
  disabled?: boolean;
  /** 首次命中后即断开并不再变化（默认 true）；false 时持续跟随可见性 */
  once?: boolean;
  /** 自定义滚动容器；不传则用 `useScrollContainer()` 提供的 AppLayout 容器 */
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

export function useInViewport<T extends HTMLElement = HTMLDivElement>({
  rootMargin = '200px',
  threshold = 0.01,
  disabled = false,
  once = true,
  scrollContainerRef,
}: UseInViewportOptions = {}) {
  // 滚动容器 ref（Context 兜底对象每次渲染都是新引用，故 deps 里刻意不包含它；
  // 其 current 在 effect 内读取即可 —— 容器在 AppLayout 挂载后即稳定）
  const ctxRootRef = useScrollContainer();
  const rootRef = scrollContainerRef ?? ctxRootRef;

  // 回调式 ref：节点连接/断开 → setNode → effect 重跑（解决条件渲染下 ref.current 为 null 的问题）
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((n: T | null) => setNode(n), []);

  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (disabled || !node) return;
    const root = rootRef.current;

    const hit = () => setInView(true);

    const io = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((e) => e.isIntersecting);
        if (intersecting) {
          hit();
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { root, rootMargin, threshold },
    );
    io.observe(node);

    // 首帧判定：元素已在视口内（首屏区块 / 滚动恢复后落点）时立刻置位
    const raf = requestAnimationFrame(() => {
      if (!node.isConnected) return;
      // 隐藏期守卫：容器不可见时 rect 全 0，判定无意义
      if (root && root.clientHeight === 0) return;
      const rect = node.getBoundingClientRect();
      const rootEl: HTMLElement | null = root ?? null;
      const rootTop = rootEl ? rootEl.getBoundingClientRect().top : 0;
      const rootHeight = rootEl ? rootEl.clientHeight : window.innerHeight;
      const margin = parseInt(rootMargin, 10) || 0;
      const relTop = rect.top - rootTop;
      if (relTop < rootHeight + margin && rect.bottom - rootTop > -margin) {
        hit();
        if (once) io.disconnect();
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
    // ⚠️ deps 只允许结构性参数：inView / 业务布尔量进来会形成 re-observe 自放大循环；
    //    rootRef 是 Context ref（或调用方传入的稳定 ref），其 current 在 effect 内读取即可。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, disabled, rootMargin, threshold, once]);

  return { ref, inView };
}

export default useInViewport;
