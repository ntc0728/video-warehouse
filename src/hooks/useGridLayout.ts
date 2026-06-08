// 网格布局计算 Hook，根据容器宽度动态计算每行列数和页面容量
import { useState, useEffect, useCallback, useRef } from 'react';

interface GridLayoutOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  minCardWidth: number;
  gap: number;
  defaultRows: number;
  padding?: number;
}

interface GridLayoutReturn {
  cardsPerRow: number;
  pageSize: number;
  containerWidth: number;
  actualRows: number;
}

export function useGridLayout({
  containerRef,
  minCardWidth,
  gap,
  defaultRows = 4,
  padding = 0
}: GridLayoutOptions): GridLayoutReturn {
  const [layout, setLayout] = useState<GridLayoutReturn>({
    cardsPerRow: 2,
    pageSize: 8,
    containerWidth: 0,
    actualRows: defaultRows
  });
  // 记录上次计算的宽度，避免微小变化触发重算
  const lastWidthRef = useRef(0);

  const calculateLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth - padding * 2;
    if (containerWidth <= 0) return;

    // 宽度变化小于 10px 时跳过重算
    if (Math.abs(containerWidth - lastWidthRef.current) < 10) return;
    lastWidthRef.current = containerWidth;

    // 根据最小卡片宽度和间距计算每行可容纳的卡片数
    const cardsPerRow = Math.max(1, Math.floor((containerWidth + gap) / (minCardWidth + gap)));
    const pageSize = cardsPerRow * defaultRows;

    setLayout({
      cardsPerRow,
      pageSize: Math.max(cardsPerRow, pageSize),
      containerWidth,
      actualRows: defaultRows
    });
  }, [containerRef, minCardWidth, gap, defaultRows, padding]);

  useEffect(() => {
    calculateLayout();

    // 监听容器尺寸变化
    const ro = new ResizeObserver(() => {
      calculateLayout();
    });

    if (containerRef.current) {
      ro.observe(containerRef.current);
    }

    window.addEventListener('resize', calculateLayout);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', calculateLayout);
    };
  }, [calculateLayout, containerRef]);

  return layout;
}

// 计算实际需要显示的行数，限制最大行数避免页面过长
export function calculateDisplayRows(
  totalItems: number,
  cardsPerRow: number,
  defaultRows: number,
  maxRows: number = 6
): number {
  if (totalItems <= cardsPerRow * defaultRows) {
    return Math.ceil(totalItems / cardsPerRow);
  }
  const remainingItems = totalItems - cardsPerRow * defaultRows;
  const extraRows = Math.ceil(remainingItems / cardsPerRow);
  return Math.min(defaultRows + extraRows, maxRows);
}
