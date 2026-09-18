/**
 * 「填满可视高度」的骨架行数推导 —— 骨架渲染几行，由当前视口容器高度决定，不写死。
 *
 * 为什么不能用固定行数（本项目长期问题，2026-09-18 收敛）：
 * 骨架存在的意义是覆盖「真实内容尚未到达」的窗口。若固定 3 行而当前视口能放 5 行，
 * 骨架下方留一片空白，数据到达后整页高度突变 → CLS；反之在大屏下骨架又短得可怜。
 * 行数必须 = 「网格顶边到滚动容器可视底部」能容纳的行数。
 *
 * 为什么量渲染结果而不在 JS 里估行高：单行步进（卡高 + 行距）的真源在 CSS
 * （封面宽高比 / 文本行高 / --space-lg 间距），JS 另估一套必然漂移。这里只做两步算术：
 *
 *   step = (网格内容高 + rowGap) / 已渲染行数      ← 实测，与行数无关
 *   rows = clamp(ceil((可视高 + rowGap) / step))   ← 反推
 *
 * 因为 step 与「渲染了几行」无关（同一份 CSS 决定），一次就能算准 → 收敛发生在
 * 第 1~2 次提交，不出现「逐行长大的阶梯动画」（旧实现每帧 +1 行的步进式收敛）。
 *
 * 可视高来源：优先用 AppLayout 经 Context 注入的真实滚动容器（.app-shell__scroll）。
 * 旧实现假设 window 是滚动容器（用 innerHeight），而本项目的滚动发生在该容器内
 * （顶栏固定、页面在容器里滚），于是「填充到 window 底」会溢出容器底部一条 header 高度。
 * 拿不到容器时（独立挂载 / 单测）自动回退 window.innerHeight。
 *
 * 重算时机：容器尺寸变化（ResizeObserver）、视口跨断点导致列数变化（cols 依赖）、
 * 设备档切换（html[data-device]，页面重挂载/reflow 由 RO 覆盖）。
 *
 * 返回的是**总行数**（不是增量）；调用方渲染 cols × rows 个占位。
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useScrollContainer } from './useScrollContext';

export interface FillRowsOptions {
  /** 至少渲染几行（默认 2：step 需要 ≥2 行才能从已渲染结果里量出来） */
  minRows?: number;
  /** 上限，防止异常容器尺寸（0 高 / 隐藏 / 超长页）下渲染爆炸（默认 12） */
  maxRows?: number;
  /** 底部预留：留给「加载更多」哨兵 / 分页器 / 页面下内边距（默认 32） */
  reserve?: number;
}

/** 安全解析 CSS 像素值：`rowGap` 可能是 "normal" / 空串 */
function px(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function useFillRows(
  ref: RefObject<HTMLElement | null>,
  cols = 1,
  { minRows = 2, maxRows = 12, reserve = 32 }: FillRowsOptions = {},
): number {
  const scrollContainer = useScrollContainer();
  const [rows, setRows] = useState(minRows);
  // 用 ref 读「当前已渲染行数」，避免把它写进 effect 依赖导致每轮多跑一次
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useLayoutEffect(() => {
    let raf = 0;

    const measure = () => {
      const el = ref.current;
      if (!el || cols <= 0) return;

      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const rowGap = px(cs.rowGap);
      // 网格可能带纵向内边距（如 .browse-skeleton__grid 的 padding），必须从内容高里扣掉，
      // 否则 step 被 padding 抬高 → 行数偏少 → 底部仍留白
      const padY = px(cs.paddingTop) + px(cs.paddingBottom);
      const contentH = rect.height - padY;
      if (contentH <= 0) return; // 未布局 / display:none，保持现状

      const rendered = Math.max(1, rowsRef.current);
      const step = (contentH + rowGap) / rendered;
      if (!Number.isFinite(step) || step <= 0) return;

      // 滚动容器可视底边（视口坐标系）→ 网格顶边之间能放下一行行内容
      const scrollEl = scrollContainer?.current;
      const bottom = scrollEl ? scrollEl.getBoundingClientRect().bottom : window.innerHeight;
      const avail = bottom - rect.top - reserve;
      if (avail <= 0) return; // 网格已在可视区外（滚动中），不缩行

      const target = Math.min(maxRows, Math.max(minRows, Math.ceil((avail + rowGap) / step)));
      if (target !== rowsRef.current) setRows(target);
    };

    measure();

    // 容器尺寸变化（窗口缩放 / 顶栏变化 / 侧栏开合）→ 重新推导。
    // 只观察滚动容器与 window：观察网格自身会在 setRows 后自触发（网格是它的子节点）。
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    const scrollEl = scrollContainer?.current;
    if (scrollEl) ro.observe(scrollEl);
    ro.observe(document.documentElement);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };
    // rows 在依赖里：setRows 后重跑一次以确认已收敛（step 不变 → target === rows → 不再 set）
  }, [ref, scrollContainer, cols, minRows, maxRows, reserve, rows]);

  // 视口跨断点 / 设备档切换 → 列数变化 → 行高随之变化 → 回到 minRows 重新推导
  useLayoutEffect(() => {
    setRows(minRows);
  }, [cols, minRows]);

  return rows;
}
