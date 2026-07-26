/**
 * useHomeCategoryStore — 首页内容类目状态
 *
 * 职责：
 * - activeCategory：当前首页右侧内容类目（home / movie / tv / variety / anime / documentary / top）
 * - data：每个内容类目的缓存数据（hero + 7 行），带 10 分钟 TTL，避免反复请求
 *
 * 与 useTMDBStore 的关系：
 * - 'home'（默认发现页）数据由 useTMDBStore 负责（HomePage 挂载时按需拉取 + store 长缓存）
 * - 其余 6 个内容类目的数据在此 store 内按需拉取（首次点击类目时 fetch，之后走缓存）
 *
 * Keep-Alive 兼容：Home 页常驻挂载，activeCategory 变化即触发 Home 重新渲染对应内容，不跳页。
 *
 * 优化：
 * - 请求去重：快速切换类目时，前序未完成的 fetch 结果不会写入 store（generation 校验）
 * - 类目持久化：activeCategory 写入 sessionStorage，页面刷新后恢复
 * - 过期检查：Keep-Alive 切回时自动检测缓存是否过期，过期则重新加载
 * - localStorage 持久化：类目数据写入 localStorage，刷新后立即显示旧数据（stale-while-revalidate）
 * - 分层加载：hero + 首行立即加载，其余行 requestIdleCallback 延迟加载
 * - 骨架防闪烁：骨架延迟 200ms 显示，快速加载时不出现骨架
 */
import { create } from 'zustand';
import type { TMDBVideoItem } from '@/types/tmdb';
import { CATEGORY_CONFIG, type HomeCategoryKey } from '@/pages/Home/categoryConfig';

/** 内存缓存有效期：10 分钟 */
const CACHE_TTL = 10 * 60 * 1000;
/** localStorage 缓存有效期：24 小时（跨会话复用） */
const LS_TTL = 24 * 60 * 60 * 1000;
/** 骨架最小显示时间：200ms（防止快速加载时闪烁） */
const SKELETON_MIN_MS = 200;

/** sessionStorage key */
const STORAGE_KEY = 'home-active-category';
/** localStorage key 前缀 */
const LS_PREFIX = 'home-cat-';

// ── localStorage 读写 ──────────────────────────────

interface LSData {
  hero: TMDBVideoItem[];
  rows: { items: TMDBVideoItem[] }[];
  fetchedAt: number;
}

function lsKey(c: string): string {
  return `${LS_PREFIX}${c}`;
}

function readLS(c: string): CategoryData | null {
  try {
    const raw = localStorage.getItem(lsKey(c));
    if (!raw) return null;
    const parsed: LSData = JSON.parse(raw);
    if (!parsed.fetchedAt || Date.now() - parsed.fetchedAt > LS_TTL) return null;
    return {
      hero: parsed.hero,
      heroLoading: false,
      heroError: null,
      rows: parsed.rows.map((r) => ({ items: r.items, loading: false, error: null })),
      fetchedAt: parsed.fetchedAt,
      loading: false,
    };
  } catch { return null; }
}

function writeLS(c: string, data: CategoryData): void {
  try {
    const toStore: LSData = {
      hero: data.hero,
      rows: data.rows.map((r) => ({ items: r.items })),
      fetchedAt: data.fetchedAt ?? Date.now(),
    };
    localStorage.setItem(lsKey(c), JSON.stringify(toStore));
  } catch { /* 存储满或不可用时忽略 */ }
}

// ── sessionStorage（activeCategory）──────────────────

function restoreCategory(): HomeCategoryKey {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved && saved !== 'home' && CATEGORY_CONFIG[saved as Exclude<HomeCategoryKey, 'home'>]) {
      return saved as HomeCategoryKey;
    }
  } catch { /* ignore */ }
  return 'home';
}

// ── 类型 ────────────────────────────────────────────

interface RowState {
  items: TMDBVideoItem[];
  loading: boolean;
  error: string | null;
}

interface CategoryData {
  hero: TMDBVideoItem[];
  heroLoading: boolean;
  heroError: string | null;
  rows: RowState[];
  fetchedAt: number | null;
  loading: boolean;
}

interface HomeCategoryState {
  activeCategory: HomeCategoryKey;
  data: Partial<Record<HomeCategoryKey, CategoryData>>;
  setActiveCategory: (c: HomeCategoryKey) => void;
  loadCategory: (c: HomeCategoryKey) => Promise<void>;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : '加载失败';
}

/** 请求代次：每次 loadCategory 调用递增，用于丢弃过期请求的结果 */
let _loadGeneration = 0;
/** 骨架延迟显示定时器 */
let _skeletonTimer: ReturnType<typeof setTimeout> | null = null;

function clearSkeletonTimer(): void {
  if (_skeletonTimer !== null) {
    clearTimeout(_skeletonTimer);
    _skeletonTimer = null;
  }
}

export const useHomeCategoryStore = create<HomeCategoryState>()((set, get) => {
  // 启动时从 localStorage 预加载所有类目数据（stale-while-revalidate 的 "stale" 阶段）
  const initialData: Partial<Record<HomeCategoryKey, CategoryData>> = {};
  for (const key of Object.keys(CATEGORY_CONFIG) as Exclude<HomeCategoryKey, 'home'>[]) {
    const cached = readLS(key);
    if (cached) initialData[key] = cached;
  }

  return {
  activeCategory: restoreCategory(),
  data: initialData,

  setActiveCategory: (c) => {
    try {
      if (c === 'home') {
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        sessionStorage.setItem(STORAGE_KEY, c);
      }
    } catch { /* ignore */ }
    set({ activeCategory: c });
  },

  loadCategory: async (c) => {
    if (c === 'home') return;
    const def = CATEGORY_CONFIG[c];
    if (!def) return;

    const existing = get().data[c];

    // ── 第一步：内存缓存有效 → 完全跳过 ──
    if (existing?.fetchedAt && Date.now() - existing.fetchedAt < CACHE_TTL) return;

    // ── 第二步：准备显示数据（旧数据或骨架） ──
    if (!existing) {
      const lsData = readLS(c);
      if (lsData) {
        // 有 localStorage → 立即显示旧数据（无骨架），后台静默刷新
        set((s) => ({ data: { ...s.data, [c]: lsData } }));
      } else {
        // 无任何缓存 → 延迟 200ms 显示骨架（防止快速加载时闪烁）
        clearSkeletonTimer();
        const genWhenScheduled = _loadGeneration;
        _skeletonTimer = setTimeout(() => {
          _skeletonTimer = null;
          if (genWhenScheduled !== _loadGeneration) return;
          const skeletonRows = Array.from({ length: def.rows.length }, () => ({ items: [] as TMDBVideoItem[], loading: true, error: null }));
          set((s) => ({
            data: {
              ...s.data,
              [c]: {
                hero: [], heroLoading: true, heroError: null,
                rows: skeletonRows,
                fetchedAt: null, loading: true,
              },
            },
          }));
        }, SKELETON_MIN_MS);
      }
    } else {
      // 有内存数据但过期 → 显示旧数据 + loading 标记
      set((s) => ({
        data: {
          ...s.data,
          [c]: {
            ...existing,
            heroLoading: true,
            rows: existing.rows.map((r) => ({ ...r, loading: true })),
            loading: true,
          },
        },
      }));
    }

    // ── 第三步：后台获取新数据 ──
    const generation = ++_loadGeneration;

    try {
      const promiseCache = new Map<() => Promise<TMDBVideoItem[]>, Promise<TMDBVideoItem[]>>();
      const dedupFetch = (fn: () => Promise<TMDBVideoItem[]>): Promise<TMDBVideoItem[]> => {
        if (!promiseCache.has(fn)) {
          promiseCache.set(fn, fn().catch(() => [] as TMDBVideoItem[]));
        }
        return promiseCache.get(fn)!;
      };

      const heroP = dedupFetch(def.hero)
        .then((items) => ({ items, error: null }))
        .catch((e) => ({ items: [] as TMDBVideoItem[], error: errMsg(e) }));

      const restRowPs = def.rows.slice(1).map((r) =>
        dedupFetch(r.fetch)
          .then((items) => ({ items, error: null }))
          .catch((e) => ({ items: [] as TMDBVideoItem[], error: errMsg(e) })),
      );

      const [heroRes, firstRowRes] = await Promise.all([
        heroP,
        dedupFetch(def.rows[0].fetch)
          .then((items) => ({ items, error: null }))
          .catch((e) => ({ items: [] as TMDBVideoItem[], error: errMsg(e) })),
      ]);

      if (generation !== _loadGeneration) { clearSkeletonTimer(); return; }

      // 部分更新：hero + 首行就绪，其余行保留旧数据并标记 loading。
      // 注意：其余行绝不能设为 loading:false + items:[] —— 那会让 TMDBMovieRow
      // 整行卸载（return null），页面高度骤减导致浏览器把 scrollTop 钳位到顶部，
      // 待其余行返回后用户滚动位置已丢失（滚动条被"强制复位"）。
      set((s) => {
        const prev = s.data[c];
        const restRows = def.rows.slice(1).map((_, i) => ({
          items: prev?.rows[i + 1]?.items ?? ([] as TMDBVideoItem[]),
          loading: true,
          error: null,
        }));
        return {
          data: {
            ...s.data,
            [c]: {
              hero: heroRes.items,
              heroLoading: false,
              heroError: null,
              rows: [{ items: firstRowRes.items, loading: false, error: firstRowRes.error }, ...restRows],
              fetchedAt: prev?.fetchedAt ?? null,
              loading: true,
            },
          },
        };
      });

      const idle =
        typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
          ? (cb: () => void) => window.requestIdleCallback(cb)
          : (cb: () => void) => setTimeout(cb, 0);

      await new Promise<void>((r) => idle(() => r()));
      if (generation !== _loadGeneration) { clearSkeletonTimer(); return; }

      const restResults = await Promise.all(restRowPs);
      if (generation !== _loadGeneration) { clearSkeletonTimer(); return; }

      const allRowResults = [firstRowRes, ...restResults];
      const hasAnyData = heroRes.items.length > 0 || allRowResults.some((r) => r.items.length > 0);

      const finalData: CategoryData = {
        hero: heroRes.items,
        heroLoading: false,
        heroError: null,
        rows: allRowResults.map((r) => ({ items: r.items, loading: false, error: r.error })),
        fetchedAt: hasAnyData ? Date.now() : existing?.fetchedAt ?? null,
        loading: false,
      };

      set((s) => ({ data: { ...s.data, [c]: finalData } }));
      if (hasAnyData) writeLS(c, finalData);

    } catch {
      if (generation !== _loadGeneration) { clearSkeletonTimer(); return; }
      set((s) => {
        const d = s.data[c];
        if (!d) return {};
        return { data: { ...s.data, [c]: { ...d, loading: false, heroLoading: false } } };
      });
    } finally {
      clearSkeletonTimer();
    }
  },
  };
});
