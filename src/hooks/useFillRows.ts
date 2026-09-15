/**
 * 视口填充：骨架首帧渲染后测量根容器底边，未到「视口高 − 预留」就
 * 追加 extra+1 份列组（调用方渲染 cols × (ROWS + extra) 张卡），
 * 步进式收敛，最多 maxRows 行。
 *
 * 为什么量渲染结果而不在 JS 里估行高：行高真源是 CSS（封面宽高比 /
 * 文本行高 / 间距都在样式层），JS 另估一套必然漂移。这里只测
 * getBoundingClientRect().bottom —— CSS 改了骨架自动跟随，与
 * useGridCols「只读不估」同一哲学。
 *
 * 收敛方式：useLayoutEffect 无依赖数组，每次渲染后同步量一次，
 * 不够就 setExtra(extra + 1) —— 布局读写在同一次绘制前完成，
 * 中间态不会闪屏；有 maxRows 兜底，异常视口（0 高 / 隐藏）下有界。
 * cols 变化（视口跨断点）时重置 extra，按新列数重新收敛。
 */
import { useLayoutEffect, useState, type RefObject } from 'react';

export function useFillRows(
  ref: RefObject<HTMLElement | null>,
  cols: number,
  maxRows = 6,
  reserve = 24,
): number {
  const [extra, setExtra] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || cols <= 0 || extra >= maxRows) return;
    if (el.getBoundingClientRect().bottom < window.innerHeight - reserve) {
      setExtra(extra + 1);
    }
    // 显式依赖：extra 变化驱动下一轮测量收敛；ref 形参虽是稳定 ref 对象，仍按规则列出
  }, [ref, extra, cols, maxRows, reserve]);

  // 视口跨断点 / 设备档切换 → 列数变化 → 按新列数重新推导行数
  useLayoutEffect(() => {
    setExtra(0);
  }, [cols]);

  return extra;
}
