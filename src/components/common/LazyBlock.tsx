/**
 * 视口懒加载区块包装器
 *
 * 用途：页面下部「进页面不必立刻取数」的模块 —— 只有区块接近视口（或按需预加载）时才
 * 触发 `onEnter`（由调用方发起该模块的接口请求），从而把首屏请求数压到最小。
 *
 * 契约：
 * - `enabled=false`（首屏档区块）→ 不创建 observer，直接以 `entered=true` 渲染，不调 `onEnter`。
 * - 触发一次即**永久保持**（`entered` 只由 false→true），不回退、不再收起 —— 避免
 *   「滚回去又变回骨架」的闪动，也避免滚动恢复（`useScrollRestore`）时高度反复变化。
 * - `onEnter` 必须**幂等**：数据已在 / 正在请求时自行跳过（见 `useTMDBStore.ensureHomeBlock`）。
 * - `preload`（如 TV 端「焦点行 ±1 行」）不依赖视口直接触发。
 *
 * ⚠️ children 是**渲染函数**（`(entered) => ReactNode`）而非节点：未触发的区块需要渲染
 * 与真实内容**等高**的骨架（否则滚动恢复会因高度塌陷而错位），只有调用方知道骨架怎么写。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useInViewport } from '@/hooks/useInViewport';

export interface LazyBlockProps {
  /** 是否启用懒加载；false = 立即渲染并立即触发（首屏档） */
  enabled: boolean;
  /** 预加载：为真时不依赖视口直接触发（TV 端焦点行 ±1 行） */
  preload?: boolean;
  /** 提前多少像素触发（默认 200px） */
  rootMargin?: string;
  /** 首次触发时调用（须幂等） */
  onEnter: () => void;
  /** 内部元素获得焦点时上报（TV 端用于计算焦点行 ±1 行预加载） */
  onFocusRow?: () => void;
  /** 渲染函数：`entered` 表示本区块是否已解锁（已解锁才渲染真实数据与请求） */
  children: (entered: boolean) => ReactNode;
}

export default function LazyBlock({
  enabled,
  preload = false,
  rootMargin = '200px',
  onEnter,
  onFocusRow,
  children,
}: LazyBlockProps) {
  // 首屏档：初始即解锁；懒加载档：等待视口/预加载触发
  const [entered, setEntered] = useState(!enabled);
  const { ref, inView } = useInViewport<HTMLDivElement>({
    disabled: !enabled || entered,
    rootMargin,
  });
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  useEffect(() => {
    if (entered || (!inView && !preload)) return;
    setEntered(true);
    // 立即触发（不等下一轮渲染），请求与骨架切换并行
    onEnterRef.current();
  }, [entered, inView, preload]);

  return (
    <div ref={ref} onFocus={onFocusRow}>
      {children(entered)}
    </div>
  );
}
