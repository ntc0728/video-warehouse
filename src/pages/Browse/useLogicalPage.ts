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
  /**
   * 取一个 TMDB 合并页（落地后 resolve 该页条目）。
   * `force = true` 表示「绕过 store 的当日缓存回显、必须真实请求」。
   */
  fetchPage: (t: number, force?: boolean) => Promise<T[]>;
  /** 该上下文命中总数（建议用钉定后的值，保证页数稳定） */
  total: number;
  /**
   * 装载/重切成功提交（与 setItems 同批）或失败时调用，供调用方关闭 loading 遮罩。
   * 调用方传入的 `goto(..., { onCommit })` 只覆盖它自己那次取页；本 hook 内部的
   * 隐式取页（列数跨档重切）走这里，否则它会成为「接管了在飞取页却不收尾」的黑洞。
   */
  onCommit?: () => void;
}

export function useLogicalPage<T>({ cols, mergedPageSize, contextKey, fetchPage, total, onCommit }: UseLogicalPageOptions<T>) {
  const P = Math.max(1, cols * LOGICAL_ROWS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map<string, Map<number, T[]>>());
  const ctxRef = useRef(contextKey);
  const seqRef = useRef(0);
  /**
   * 最近一次取页的**目标**逻辑页（已按 totalPages 钳制）。
   * 跨档重切据此进行，而不是用 `page`（已生效页）：二者只在「取页飞行中」有差异，
   * 此时若用 page 重切会把用户的目标页悄悄退回上一页（例如点了第 5 页/下拉刷新回
   * 第 1 页途中改窗口宽度 → 会退回原页，刷新意图丢失）。
   */
  const targetPageRef = useRef(1);
  // onCommit 走 ref：调用方通常传内联箭头函数，进 deps 会让跨档 effect 每渲染必重跑
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

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
    targetPageRef.current = 1;
    setPage(1);
    setItems([]);
    setLoading(false);
  }, [contextKey]);

  const goto = useCallback(
    /**
     * 装载逻辑页 L。
     * @param opts.force 强制刷新（下拉刷新 / 分类导航进入）：丢弃该上下文已缓冲的
     *   TMDB 页并绕过 store 缓存回显，必定真实请求。
     * @param opts.onCommit 内容提交回调：与 setItems 同一批更新里调用，调用方据此
     *   关闭「无内容期」的 loading 遮罩 —— 收尾若晚于内容提交一个微任务，
     *   会露出「items 已就位但遮罩未关」的一帧空窗。
     * @returns true = 本次取页生效并已写 items；false = 期间被更晚的 goto 取代，
     *   本次作废（调用方据此决定是否收尾 loading，避免旧请求关掉新请求的 loading）。
     * @throws fetchPage 抛错时**原样穿出**（2026-09-14）：不 setItems / 不 setPage /
     *   不写页缓存 —— items 保留旧页、该页不被记成空。调用方必须自行收尾 loading。
     */
    async (L: number, opts?: { force?: boolean; onCommit?: () => void }): Promise<boolean> => {
      const force = opts?.force === true;
      const target = Math.min(Math.max(1, L), totalPages);
      targetPageRef.current = target;
      const seq = ++seqRef.current;
      setLoading(true);
      try {
        let cache = cacheRef.current.get(ctxRef.current);
        if (!cache) {
          cache = new Map();
          cacheRef.current.set(ctxRef.current, cache);
        }
        // 强制刷新：该上下文已缓冲的 TMDB 页与 store 缓存一并作废
        if (force) cache.clear();
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
            buf = await fetchPage(t, force);
            if (seq !== seqRef.current) return false; // 期间用户又切换了目标页：本次作废
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
        if (seq !== seqRef.current) return false;
        setItems(collected.slice(0, P));
        setPage(target);
        // 与 setItems 同批提交收尾（调用方关 loading 遮罩）：晚一个微任务就会多一帧空窗
        opts?.onCommit?.();
        return true;
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [P, mergedPageSize, totalPages, fetchPage],
  );

  // 列数跨档（P 变）：用缓存重切当前页（无新请求）。
  //
  // ⚠️ 不做 loading 守卫（2026-09-14 修）：P 变化是**边沿触发**（只在值变的那一刻
  // 触发一次），旧版 `if (changed && !loading)` 若恰好命中在飞取页就永久跳过 ——
  // items 会一直保持旧列数的切片条数，网格最后一行永远占不满（正是本模块要解决的
  // 原始问题），且没有任何后续机会补上（P 不再变化 → effect 不再跑）。
  // 现在允许重切抢占在飞取页：由 goto 的 seq 机制裁决后发者胜，被抢占者的响应被丢弃、
  // 不写页缓存，其调用方（runGoto）返回 false 后按约定放弃收尾 → **本路径就是那个接管者**，
  // 所以成功（onCommit）与失败（catch 兜底）都必须收尾调用方的 loading 遮罩。
  const prevPRef = useRef(P);
  useEffect(() => {
    const changed = prevPRef.current !== P;
    prevPRef.current = P;
    if (!changed) return;
    // 失败静默：跨档是隐式触发（用户没点任何东西），旧 items 已保留、页面不空，
    // 弹 toast 突兀。catch 同时兜住 goto 的 rethrow（防 unhandled rejection）。
    // 用 targetPageRef 而非 page：重切要保住用户的目标页（见该 ref 的注释）。
    void goto(targetPageRef.current, { onCommit: onCommitRef.current }).catch(() => {
      onCommitRef.current?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅响应 P 变化
  }, [P]);

  return { items, page, totalPages, loading, goto };
}
