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
  /** 清空内存数据与 localStorage 缓存（保留 activeCategory），用于「清除全部缓存」 */
  clearCache: () => void;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : '加载失败';
}

/** 请求代次：每次 loadCategory 调用递增，用于丢弃过期请求的结果 */
let _loadGeneration = 0;
/** 骨架延迟显示定时器 */
let _skeletonTimer: ReturnType<typeof setTimeout> | null = null;
/** [2026-08-13] 切换分类时取消上一代所有 in-flight 请求（AbortController） */
let _activeAbortController: AbortController | null = null;
/** [2026-08-13] 模块级共享 fetch 缓存：已完成请求按 fetch 函数引用跨分类复用（接口竞价治理）。
 * 只存「已完成」结果，避免共享 in-flight 请求被 abort 连坐导致新分类拿到空数据。 */
const sharedFetchCache = new Map<
  (signal?: AbortSignal) => Promise<TMDBVideoItem[]>,
  { p: Promise<TMDBVideoItem[]>; at: number }
>();

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

  clearCache: () => {
    for (const key of Object.keys(CATEGORY_CONFIG)) {
      try { localStorage.removeItem(lsKey(key)); } catch { /* ignore */ }
    }
    sharedFetchCache.clear();
    set({ data: {} });
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
        // [2026-08-13] 无任何缓存 → 立即写入骨架数据（不再延迟 200ms）：
        // 之前延迟期间 categoryData 为 undefined，Home 页走 `return homeSkeleton`
        // 整页骨架分支 → 「内容→整页骨架→内容」闪变（切分类闪屏根因）。
        // 立即写入骨架后 Home 页走正常渲染路径：HeroBanner 骨架 + CategoryQuickAccess
        // + TMDBMovieRow 行骨架，结构固定、数据到达后原位填充，无整页闪变。
        clearSkeletonTimer();
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

    // [2026-08-13] 切换分类时取消上一代所有 in-flight 请求（接口竞态治理）。
    // 之前仅用 generation 防「写入」、不防「请求」，旧分类请求会继续飞行直到完成。
    _activeAbortController?.abort();
    const controller = new AbortController();
    _activeAbortController = controller;
    const signal = controller.signal;

    try {
      // 调用内 in-flight 去重：同一 fetch 函数在本次 loadCategory 内只发一次（hero/行复用）
      const promiseCache = new Map<(signal?: AbortSignal) => Promise<TMDBVideoItem[]>, Promise<TMDBVideoItem[]>>();
      const dedupFetch = (fn: (signal?: AbortSignal) => Promise<TMDBVideoItem[]>): Promise<TMDBVideoItem[]> => {
        // 1) 模块级共享缓存命中（已完成 + TTL 内）→ 跨分类复用，不再请求（接口竞价治理）。
        //    共享缓存只存「已完成」结果：in-flight 请求绑定本代 signal，切分类会被 abort，
        //    若共享 in-flight 会被「abort 连坐」导致新分类拿到空数据，故只缓存成功结果。
        const hit = sharedFetchCache.get(fn);
        if (hit && Date.now() - hit.at < CACHE_TTL) return hit.p;
        // 2) 调用内去重
        if (!promiseCache.has(fn)) {
          const p = fn(signal)
            .then((items) => {
              // 成功 → 写入模块级共享缓存（供其他分类复用）；失败不写（下次可重试）
              sharedFetchCache.set(fn, { p: Promise.resolve(items), at: Date.now() });
              return items;
            })
            .catch(() => [] as TMDBVideoItem[]);
          promiseCache.set(fn, p);
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

      // hero 独立就绪即写入（不与首行 Promise.all 绑定）：
      // 历史实现 Promise.all([hero, firstRow]) 让 banner/缩略图被首行拖住——
      // 首行慢时整个分类切换都慢（用户反馈「banner/缩略图/video card 三者绑定、
      // 等特定封面图全部渲染好才显示新图」）。拆开后 hero 就绪 → Home 立即切换，
      // 首行/其余行各自骨架独立填充。
      const heroRes = await heroP;

      if (generation !== _loadGeneration) { clearSkeletonTimer(); return; }

      // hero 独立部分更新：只写 hero，行保持骨架 loading（不触碰首行/其余行）
      set((s) => {
        const prev = s.data[c];
        return {
          data: {
            ...s.data,
            [c]: {
              hero: heroRes.items,
              heroLoading: false,
              heroError: heroRes.error,
              rows: prev?.rows ?? [],
              fetchedAt: prev?.fetchedAt ?? null,
              loading: true,
            },
          },
        };
      });

      // 首行独立部分更新：只替换首行，其余行保留旧数据并标记 loading。
      // 注意：其余行绝不能设为 loading:false + items:[] —— 那会让 TMDBMovieRow
      // 整行卸载（return null），页面高度骤减导致浏览器把 scrollTop 钳位到顶部，
      // 待其余行返回后用户滚动位置已丢失（滚动条被"强制复位"）。
      const firstRowRes = await dedupFetch(def.rows[0].fetch)
        .then((items) => ({ items, error: null }))
        .catch((e) => ({ items: [] as TMDBVideoItem[], error: errMsg(e) }));

      if (generation !== _loadGeneration) { clearSkeletonTimer(); return; }

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
              ...(prev ?? { hero: [], heroLoading: true, heroError: null, fetchedAt: null }),
              rows: [{ items: firstRowRes.items, loading: false, error: firstRowRes.error }, ...restRows],
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
