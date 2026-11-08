/**
 * Browse 逻辑分页组装层：
 * **每页恒定 cols × 4 行、行数不随余量波动、页数按每页条数折算**（由 5 行改为 4 行）。
 *
 * 背景：TMDB 单路每页恒定 20 条，不支持自定义每页条数；列数随视口 3~8 列变化
 * → 直接把 20 条怼到网格上会出「最后一行不满」（1440 宽 7 列时 2 行 + 6 张）。
 * 唯一两全 = 逻辑分页：
 *
 * 逻辑页 L 覆盖全局条目 [ (L-1)·P, L·P )，P = cols × LOGICAL_ROWS(4)；
 * 定位到 TMDB 页：t = floor(start / M) + 1，offset = start − (t−1)·M；
 * offset + P > M 时向后多取几页 —— 单路 M=20 恒定，算术精确、无跨页累积状态。
 *
 * 「排行榜」是两路合并，故定位用**分段线性前缀**（`prefix(t) = Σ min(items_i, perPage_i·(t−1))`），
 * 对均匀/稀疏区都成立。
 *
 * TMDB 页结果按 (contextKey, t) 缓存（上下文切换清空），翻回上一页零请求。
 * 末页条目 = 可达条目 − (L−1)·P，可能不满一行 —— 列表尽头，顺其自然。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TMDB_PAGE_CAP, TMDB_PAGE_SIZE, type TMDBReachEntry } from '@/services/tmdbService';

/** 每个逻辑页的行数（页条数 = 当前列数 × 4； 由 5 改 4） */
const LOGICAL_ROWS = 4;

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
  /** 当前列数（每页条数 P = cols × 4） */
  cols: number;
  /** 上下文标识（模式+关键词+筛选）：变化即清缓存、回页 1 */
  contextKey: string;
  /** 取一个 TMDB 页（落地后 resolve 该页条目）；force=true 表示必须真实请求 */
  fetchPage: (t: number, force?: boolean) => Promise<T[]>;
  /** 该上下文命中总数（钉定后的值，保证页数稳定） */
  total: number;
  /**
 * 各取页路的**真实可达量**（store 的 `discoverPagination.reach`），
 * 字段全部由接口返回值推导（`tmdbService.toReachEntry`）。
 *
 * 两条硬约束：
 * 1. `total_results` **不是可达条目** —— TMDB `page` 硬顶 500（501 直接 HTTP 400
 * `status_code:22`）。实测 movie 自报 20001 条，500 页只能拿到 10000 条。
 * 2. 多路合并（排行榜）时 `total_pages` 取各路 **min**：合并页要求两路都在，
 * 取 max 会给短的那一端发越界入参（TMDB 返回 200 + `results:[]`，不报错更隐蔽）。
 */
  reach?: TMDBReachEntry[];
  /** 装载/重切成功提交（与 setItems 同批）或失败时调用，供调用方关闭 loading 遮罩 */
  onCommit?: () => void;
}

export function useLogicalPage<T>({ cols, contextKey, fetchPage, total, reach, onCommit }: UseLogicalPageOptions<T>) {
  const P = Math.max(1, cols * LOGICAL_ROWS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  /**
 * 目标页（已钳制）的状态化镜像：翻页时 `targetPage !== page` → 骨架顶替旧网格
 * ；刷新/换筛选时二者相等 → 保持「旧内容变淡」反馈。
 */
  const [targetPage, setTargetPage] = useState(1);
  const cacheRef = useRef(new Map<string, Map<number, T[]>>());
  const ctxRef = useRef(contextKey);
  const seqRef = useRef(0);
  /** 最近一次取页的目标逻辑页（已钳制），跨档重切据此进行而非用已生效的 page */
  const targetPageRef = useRef(1);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // ── 分页几何（全部来自接口返回值，不写死业务数字）──
  const reachNorm = (reach ?? []).filter((g) => g.pages > 0 && g.items > 0);
  /** 允许请求的最大 TMDB 页号 = 各路可达页数的 min */
  const tMax = reachNorm.length > 0
    ? Math.min(...reachNorm.map((g) => g.pages))
    : TMDB_PAGE_CAP;
  /**
 * 单路时每 TMDB 页条数（由接口值推导）；合并路时用前缀定位。
 * ⚠️ reach 未落地（首屏 goto(1) 早于接口响应）不能退化成「取一页就停」——
 * 那会让首屏只显示 20 张、末行不满。默认按单路 TMDB_PAGE_SIZE 均匀算术，
 * 接口响应回来后再用真实 perPage 重切。
 */
  const uniformM = reachNorm.length === 1 ? reachNorm[0].perPage
    : reachNorm.length === 0 ? TMDB_PAGE_SIZE
    : 0;
  /** 真实可达条目总数（不是接口自报的 total_results） */
  const reachableItems = reachNorm.length > 0
    ? reachNorm.reduce((n, g) => n + Math.min(g.items, g.perPage * tMax), 0)
    : Math.min(total, TMDB_PAGE_SIZE * TMDB_PAGE_CAP);
  /** 每页 P 条 → 总页数；恒定满行（末页余量除外） */
  const totalPages = Math.max(1, Math.ceil(reachableItems / P));
  /** 分段线性前缀：前 t−1 个 TMDB 页累计的可达条目数（合并路稀疏区也成立） */
  const prefix = useCallback(
    (t: number) => reachNorm.reduce((n, g) => n + Math.min(g.items, g.perPage * (t - 1)), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(reachNorm)],
  );

  // 上下文变化：清缓存、回页 1、清空展示（首屏由调用方触发 goto(1)）
  useEffect(() => {
    if (ctxRef.current === contextKey) return;
    ctxRef.current = contextKey;
    cacheRef.current = new Map();
    targetPageRef.current = 1;
    setPage(1);
    setTargetPage(1);
    setItems([]);
    setLoading(false);
  }, [contextKey]);

  const goto = useCallback(
    /**
 * 装载逻辑页 L（覆盖全局条目 [(L−1)·P, L·P)）。
 * @returns true = 本次取页生效；false = 被更晚的 goto 取代，本次作废。
 * @throws fetchPage 抛错时原样穿出，items 保留旧页、该页不被记成空。
 */
    async (L: number, opts?: { force?: boolean; onCommit?: () => void }): Promise<boolean> => {
      const force = opts?.force === true;
      const target = Math.min(Math.max(1, L), totalPages);
      targetPageRef.current = target;
      setTargetPage(target);
      const seq = ++seqRef.current;
      setLoading(true);
      try {
        let cache = cacheRef.current.get(ctxRef.current);
        if (!cache) {
          cache = new Map();
          cacheRef.current.set(ctxRef.current, cache);
        }
        if (force) cache.clear();
        const start = (target - 1) * P;

        // 全局条目序号 → (TMDB 页号, 页内偏移)。
        // 单路（电影/剧集/综艺/动漫/纪录片/搜索）：M 恒定，算术精确定位 ——
        // t = floor(start / M) + 1，offset = start − (t−1)·M。
        // 合并路（排行榜）：两路页数可能不同，尾部页会变稀疏，改用前缀二分。
        let t: number;
        let offset: number;
        if (uniformM > 0) {
          t = Math.floor(start / uniformM) + 1;
          offset = start - (t - 1) * uniformM;
        } else {
          let lo = 1;
          let hi = tMax;
          while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (prefix(mid) <= start) lo = mid;
            else hi = mid - 1;
          }
          t = lo;
          offset = start - prefix(lo);
        }

        // 逐条消费 + 按 id 去重：真实 TMDB 按流行度排序，相邻页请求间序会漂移，
        // 两个缓冲区可能出现相同条目（mock 静态数据测不出）——去重避免 duplicate key。
        const seen = new Set<unknown>();
        const collected: T[] = [];
        // P ≤ 40 时单路至多 2~3 页；guard=6 兜底（短页/漂移去重时向后多走）。
        // 额外钳到 tMax：真实 TMDB 501 页直接 HTTP 400，越界请求会被抛错。
        for (let guard = 0; guard < 6 && t <= tMax; guard++) {
          let buf = cache.get(t);
          if (!buf) {
            buf = await fetchPage(t, force);
            if (seq !== seqRef.current) return false; // 期间用户又切换了目标页
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
        opts?.onCommit?.();
        return true;
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [P, totalPages, tMax, uniformM, prefix, fetchPage],
  );

  // 列数跨档（P 变）：用缓存重切当前页（无新请求）。边沿触发，不做 loading 守卫；
  // 用 targetPageRef 而非 page，避免把用户的目标页悄悄退回上一页。
  const prevPRef = useRef(P);
  useEffect(() => {
    const changed = prevPRef.current !== P;
    prevPRef.current = P;
    if (!changed) return;
    void goto(targetPageRef.current, { onCommit: onCommitRef.current }).catch(() => {
      onCommitRef.current?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [P]);

  // reachableItems 供「共 N 条」展示：TMDB 自报的 total_results 远超 page≤500 能取到的量，
  // 直接显示会与「末页 = ceil(可达/P)」自相矛盾。
  return { items, page, targetPage, totalPages, reachableItems, loading, goto };
}
