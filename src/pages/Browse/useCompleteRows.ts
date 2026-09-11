/**
 * 分页整行收整（2026-09-12 用户需求）：Browse 已改分页制（替换式翻页），
 * TMDB 每页固定 20 条（电影+TV 合并后 40）、CMS 为各源 pg=n 聚合——都**不支持
 * 自定义每页条数**，而网格列数随视口 3~8 列变化（--card-cols），单页直接渲染
 * 必出「最后一行占不满」。
 *
 * 等价实现 = 跨页余量结转：第 N 页展示「carry(N-1) + 本页条目」的 cols 整数倍
 * 前缀，余量结转到第 N+1 页前置拼入（条目全局顺序不变、不重复）；仅末页
 * （hasNext=false）全量展示，末行顺其自然。结转只在「连续下一页」（同 resetKey
 * 且 page = prev + 1）时沿用；跳页 / 回退 / 换关键词 / 换筛选一律重新截断，杜绝跨页重复。
 *
 * 时序要点：结算（effect）把 seq 推进到当前页后，本页随后的重渲染（如 isRefreshing
 * 收起、localStorage 写回等）若重新计算会误判「非连续」而丢 carry——所以结算时把
 * {page, items 身份, 展示集} 存入 appliedRef，渲染期命中即直接复用，不再重算。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** 读取与 .video-card-grid 同源的 --card-cols（:root 级定义，variables.css 分档 3~8） */
function readCardCols(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--card-cols').trim();
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 6;
}

/** 当前卡片列数（视口跨档 / 旋转 / 缩放时自动重算） */
export function useCardCols(): number {
  const [cols, setCols] = useState(readCardCols);
  useLayoutEffect(() => {
    const update = () => setCols(readCardCols());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return cols;
}

interface Applied<T> {
  page: number;
  items: T[];
  displayed: T[];
}

/** 单页整行收整：返回本页应展示的条目（cols 整数倍前缀），余量结转下一页 */
export function useCompleteRowsPage<T>(
  items: T[],
  cols: number,
  page: number,
  hasNext: boolean,
  resetKey: string,
): T[] {
  const carryRef = useRef<T[]>([]);
  const seqRef = useRef<{ key: string; page: number }>({ key: resetKey, page });
  const appliedRef = useRef<Applied<T> | null>(null);
  const lastItemsRef = useRef<T[] | null>(null);

  // 已结算过本页（同页码 + 同数据身份）→ 直接复用展示集。
  // ⚠️ 所有 hook 必须无条件调用（Rules of Hooks），分流只用标记，不能提前 return。
  const applied = appliedRef.current;
  const appliedHit = !!(applied && applied.page === page && applied.items === items);

  // 未结算：渲染期按当前 refs 现算一版（effect 随后以相同输入落账）
  const seq = seqRef.current;
  const sequential = seq.key === resetKey && page === seq.page + 1;
  const carry = appliedHit ? [] : sequential ? carryRef.current : [];
  const merged = appliedHit
    ? applied!.displayed
    : carry.length > 0 ? [...carry, ...items] : items;
  const trim = cols > 1 && hasNext;
  const complete = appliedHit
    ? 0
    : trim ? Math.floor(merged.length / cols) * cols : merged.length;
  const displayed = appliedHit
    ? applied!.displayed
    : complete > 0 ? merged.slice(0, complete) : merged;

  useEffect(() => {
    // 翻页加载间隙（items 为空）：不动 seq/carry——否则上一页余量被提前清掉；
    // 新页码已置、旧数据未清的过渡帧（items 身份未变）：不结算——否则 seq 被提前推进，
    // 新数据落地时「连续下一页」判定失效、结转被误清。
    if (items.length === 0 || items === lastItemsRef.current) return;
    lastItemsRef.current = items;

    const s = seqRef.current;
    const seqOK = s.key === resetKey && page === s.page + 1;
    const carryUsed = seqOK ? carryRef.current : [];
    const m = carryUsed.length > 0 ? [...carryUsed, ...items] : items;
    const cut = cols > 1 && hasNext ? Math.floor(m.length / cols) * cols : m.length;
    appliedRef.current = { page, items, displayed: m.slice(0, cut > 0 ? cut : m.length) };
    carryRef.current = cut > 0 ? m.slice(cut) : [];
    seqRef.current = { key: resetKey, page };
  });

  return displayed;
}
