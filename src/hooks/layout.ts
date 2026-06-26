// 布局计算相关 Hook，提供网格布局的列数、行数动态计算
import { useState, useEffect } from 'react';

/** 布局模式类型 */
export type LayoutMode = 'video' | 'iptv';

/** 网格布局配置 */
export interface LayoutConfig {
  columns: number;
  rows: number;
}

/**
 * 根据窗口宽度和布局模式计算网格列数和行数
 * @param mode 布局模式，默认 'video'
 */
export function getLayout(mode: LayoutMode = 'video'): LayoutConfig {
  const w = window.innerWidth;

  if (mode === 'iptv') {
    if (w < 768) return { columns: 3, rows: 5 };
    if (w < 1024) return { columns: 4, rows: 4 };
    if (w < 1440) return { columns: 5, rows: 4 };
    if (w < 1920) return { columns: 6, rows: 4 };
    return { columns: 7, rows: 4 };
  }

  if (w < 1024) return { columns: 3, rows: 4 };
  if (w < 1440) return { columns: 4, rows: 3 };
  if (w < 1920) return { columns: 5, rows: 3 };
  return { columns: 6, rows: 4 };
}

const IPTV_CARD_HEIGHT_FALLBACK_DESKTOP = 72;
const IPTV_CARD_HEIGHT_FALLBACK_MOBILE = 60;

/**
 * 动态读取 CSS grid-template-columns 获取当前网格列数
 * @param element 网格容器 DOM 元素
 */
export function useGridColumns(element: HTMLElement | null): number {
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    if (!element) return;

    const updateColumns = () => {
      const gridStyle = window.getComputedStyle(element);
      const gridCols = gridStyle.gridTemplateColumns;
      if (gridCols && gridCols !== 'none') {
        // grid-template-columns 返回空格分隔的列宽值，数量即为列数
        const colCount = gridCols.split(' ').length;
        if (colCount > 0) setColumns(colCount);
      }
    };

    updateColumns();

    // 监听容器尺寸变化，实时更新列数
    const ro = new ResizeObserver(() => updateColumns());
    ro.observe(element);

    return () => ro.disconnect();
  }, [element]);

  return columns;
}

/**
 * 根据容器高度和卡片高度动态计算可显示的行数
 * @param element 网格容器 DOM 元素
 * @param mode 布局模式，影响卡片高度的兜底值
 */
export function useGridRows(element: HTMLElement | null, mode: LayoutMode = 'iptv'): number {
  const [rows, setRows] = useState(4);

  useEffect(() => {
    if (!element) return;

    let rafId = 0;

    const updateRows = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const containerHeight = element.clientHeight;
        if (containerHeight <= 0) return;

        const gridStyle = window.getComputedStyle(element);
        const gap = parseFloat(gridStyle.gap) || 12;
        // 优先使用实际卡片高度，无子元素时使用兜底值
        const cardHeight = element.children.length > 0
          ? (element.children[0] as HTMLElement).offsetHeight
          : (mode === 'iptv'
            ? (window.innerWidth < 768 ? IPTV_CARD_HEIGHT_FALLBACK_MOBILE : IPTV_CARD_HEIGHT_FALLBACK_DESKTOP)
            : 240);
        const rowCount = Math.max(1, Math.floor((containerHeight + gap) / (cardHeight + gap)));
        setRows(rowCount);
      });
    };

    updateRows();

    const ro = new ResizeObserver(() => updateRows());
    ro.observe(element);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [element, mode]);

  return rows;
}
