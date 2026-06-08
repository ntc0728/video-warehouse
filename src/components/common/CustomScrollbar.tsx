import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import './CustomScrollbar.css';

/**
 * CustomScrollbar — 原生滚动容器薄包装
 *
 * 设计：
 * 1. 改用浏览器原生 overflow: auto 滚动，由浏览器主线程合成器 60fps 处理。
 *    相比旧版的 transform 平移方案，根除了 wheel/touch 事件 JS 处理、rAF
 *    调度、MutationObserver 监听等带来的卡顿。
 * 2. 滚动条外观使用浏览器原生（不应用 ::-webkit-scrollbar 覆盖），
 *    与系统原生滚动条外观一致，无自定义开销。
 * 3. 保留 forwardRef + ref 暴露容器 DOM，调用方可通过 ref 直接读 scrollTop
 *    或调用 scrollTo。
 * 4. props 中保留旧版的 thumbMinRatio / autoHide / autoHideDelay /
 *    hideDelayAfterDrag / wheelLineHeight 等字段以兼容调用方，但不再有副作用。
 *
 * 关于 `headerOffset`：
 * - 历史上曾用 `paddingTop` 推内部内容，**但 thumb 起点仍在 CustomScrollbar 顶部**，
 *   被父容器的 fixed StickyHeader 覆盖（视觉上"被切掉一部分"）。
 * - 修复方案：把物理偏移放到 AppLayout 父容器（`paddingTop`），让 CustomScrollbar
 *   整体从 StickyHeader 下方开始，thumb 真实起点 = CustomScrollbar 顶部。
 * - 此 prop 现在仅作为 API 占位（不再注入 paddingTop），调用方应在外层处理偏移。
 */
interface CustomScrollbarProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** 滚动方向 */
  direction?: 'vertical' | 'horizontal' | 'both';
  /**
   * @deprecated 已被父容器 paddingTop 替代（沉浸式页面：StickyHeader 浮起时，
   * 把 CustomScrollbar 整体下推）。保留 prop 仅为 API 兼容，**不再注入 paddingTop**。
   * - number: 像素值
   * - string: CSS 长度表达式（如 'var(--header-height)'）
   * - 0 或 undefined: 无偏移
   */
  headerOffset?: number | string;
  /** 兼容字段：旧版的 thumb 最小长度占比，不再使用 */
  thumbMinRatio?: number;
  /** 兼容字段：是否自动隐藏滚动条（原生滚动条无需此选项） */
  autoHide?: boolean;
  /** 兼容字段：自动隐藏延迟（ms） */
  autoHideDelay?: number;
  /** 兼容字段：拖动后保留时间（ms） */
  hideDelayAfterDrag?: number;
  /** 兼容字段：滚轮一次行高（px） */
  wheelLineHeight?: number;
}

const CustomScrollbar = forwardRef<HTMLDivElement, CustomScrollbarProps>(function CustomScrollbar(
  {
    children,
    className = '',
    style,
    direction = 'vertical',
    // headerOffset prop 保留以兼容旧调用，但不再应用 paddingTop
    headerOffset: _headerOffset = 0,
  },
  ref: Ref<HTMLDivElement>,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 暴露容器 DOM（API 向后兼容）
  useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(
    ref,
    () => containerRef.current as HTMLDivElement,
    [],
  );

  // 根据 direction 决定 overflow
  const overflowStyle = useMemo<CSSProperties>(() => {
    switch (direction) {
      case 'vertical':
        return { overflowX: 'hidden', overflowY: 'auto' };
      case 'horizontal':
        return { overflowX: 'auto', overflowY: 'hidden' };
      case 'both':
      default:
        return { overflow: 'auto' };
    }
  }, [direction]);

  return (
    <div
      ref={containerRef}
      className={`custom-scrollbar-container ${className}`}
      data-direction={direction}
      style={{ ...overflowStyle, ...style }}
    >
      {children}
    </div>
  );
});

export default CustomScrollbar;
