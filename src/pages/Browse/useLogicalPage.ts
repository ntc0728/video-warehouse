/**
 * 逻辑分页组装层（2026-09-12 用户拍板）：
 * 「每页恒定 cols×5 行、页行数不随余量波动、页数按每页条数折算」。
 *
 * 背景：TMDB 合并页大小固定（discover/top：电影 20 + 剧集 20 = 40；search：≤20），
 * 不支持自定义每页条数；列数随视口 3~8 列变化 → 固定 40 条直接渲染必出「最后一行占不满」，
 * 跨页结转又会让每页条数波动（35/42 交替）。唯一两全 = 逻辑分页：
 *
 *   逻辑页 L 覆盖全局条目 [ (L-1)·P, L·P )，P = cols × LOGICAL_ROWS(5) ≤ 40；
 *   按算术定位所需 TMDB 页：tStart = floor(start / M) + 1，offset = start − (tStart−1)·M，
 *   offset + P > M 时多取一页 —— 每次跳页至多 2 个请求，无跨页累积状态，跳页/回退均支持。
 *
 * TMDB 页结果按 (contextKey, t) 缓存（上下文切换清空），翻回上一页零请求。
 * 末页条目 = 总数 − (L−1)·P，可能不满一行 —— 列表尽头，顺其自然。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** 每个逻辑页的行数（页条数 = 当前列数 × 5） */
const LOGICAL_ROWS = 5;

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

interface UseLogicalPageOptions<T> {
  /** 当前列数（决定每页条数 P = cols × 5） */
  cols: number;
  /** TMDB 单合并页条数：discover/top = 40（电影 20 + 剧集 20）；search = 20 */
  mergedPageSize: number;
  /** 上下文标识（模式+关键词+筛选）：变化即清缓存、回页 1 */
  contextKey: string;
  /** 取一个 TMDB 合并页（落地后 resolve 该页条目） */
  fetchPage: (t: number) => Promise<T[]>;
  /** 该上下文命中总数（建议用钉定后的值，保证页数稳定） */
  total: number;
}

export function useLogicalPage<T>({ cols, mergedPageSize, contextKey, fetchPage, total }: UseLogicalPageOptions<T>) {
  const P = Math.max(1, cols * LOGICAL_ROWS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map<string, Map<number, T[]>>());
  const ctxRef = useRef(contextKey);
  const seqRef = useRef(0);

  // 总页数 = ceil(总数 / P)，并钳到 TMDB 可达范围：discover/search 实际最多返回
  // 500 个 TMDB 页（× 合并页大小 = 可达条目上限），超出部分请求只会拿到空结果。
  const TMDB_PAGE_CAP = 500;
  const totalPages = Math.max(
    1,
    Math.min(
      Math.ceil(total / P),
      Math.ceil((TMDB_PAGE_CAP * mergedPageSize) / P),
    ),
  );

  // 上下文变化：清缓存、回页 1、清空展示（首屏由调用方触发 goto(1)）
  useEffect(() => {
    if (ctxRef.current === contextKey) return;
    ctxRef.current = contextKey;
    cacheRef.current = new Map();
    setPage(1);
    setItems([]);
    setLoading(false);
  }, [contextKey]);

  const goto = useCallback(
    async (L: number) => {
      const target = Math.min(Math.max(1, L), totalPages);
      const seq = ++seqRef.current;
      setLoading(true);
      try {
        let cache = cacheRef.current.get(ctxRef.current);
        if (!cache) {
          cache = new Map();
          cacheRef.current.set(ctxRef.current, cache);
        }
    const start = (target - 1) * P;
    let t = Math.floor(start / mergedPageSize) + 1;
    let offset = start - (t - 1) * mergedPageSize;
    // 逐条消费 + 按 id 去重：真实 TMDB 按流行度排序，相邻页请求间序会漂移，
    // 两个缓冲区可能出现相同条目（mock 静态数据测不出）——去重避免 duplicate key。
    const seen = new Set<unknown>();
    const collected: T[] = [];
    // P ≤ 40 = M 时至多 2 页；guard=4 兜底（短页/漂移去重时向后多走）
    for (let guard = 0; guard < 4; guard++) {
      let buf = cache.get(t);
      if (!buf) {
        buf = await fetchPage(t);
        if (seq !== seqRef.current) return; // 期间用户又切换了目标页：本次作废
        cache.set(t, buf);
      }
      for (let i = offset; i < buf.length; i++) {
        const item = buf[i];
        const key = (item as { id?: unknown })?.id;
        if (key !== undefined && key !== null) {
          if (seen.has(key)) continue;
          seen.add(key);
        }
        collected.push(item);
        if (collected.length >= P) break;
      }
      offset = 0;
      if (collected.length >= P || buf.length === 0) break;
      t += 1;
    }
    if (seq !== seqRef.current) return;
    setItems(collected.slice(0, P));
    setPage(target);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [P, mergedPageSize, totalPages, fetchPage],
  );

  // 列数跨档（P 变）：用缓存重切当前页（无新请求）
  const prevPRef = useRef(P);
  useEffect(() => {
    const changed = prevPRef.current !== P;
    prevPRef.current = P;
    if (changed && !loading) void goto(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅响应 P 变化
  }, [P]);

  return { items, page, totalPages, loading, goto };
}
