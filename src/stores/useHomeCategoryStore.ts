/**
 * useHomeCategoryStore — 首页内容类目状态
 *
 * 职责：
 * - activeCategory：当前首页右侧内容类目（home / movie / tv / variety / anime / documentary / top）
 * - data：每个内容类目的缓存数据（hero + 7 行），带 10 分钟 TTL，避免反复请求
 *
 * 与 useTMDBStore 的关系：
 * - 'home'（默认发现页）数据由 useTMDBStore + usePrefetch 负责（启动预取 + 长缓存）
 * - 其余 6 个内容类目的数据在此 store 内按需拉取（首次点击类目时 fetch，之后走缓存）
 *
 * Keep-Alive 兼容：Home 页常驻挂载，activeCategory 变化即触发 Home 重新渲染对应内容，不跳页。
 */
import { create } from 'zustand';
import type { TMDBVideoItem } from '@/types/tmdb';
import { CATEGORY_CONFIG, type HomeCategoryKey } from '@/pages/Home/categoryConfig';

/** 类目数据缓存有效期：10 分钟 */
const CACHE_TTL = 10 * 60 * 1000;

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

function emptyRows(): RowState[] {
  return Array.from({ length: 7 }, () => ({ items: [], loading: false, error: null }));
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : '加载失败';
}

export const useHomeCategoryStore = create<HomeCategoryState>()((set, get) => ({
  activeCategory: 'home',
  data: {},

  setActiveCategory: (c) => set({ activeCategory: c }),

  loadCategory: async (c) => {
    if (c === 'home') return;
    const def = CATEGORY_CONFIG[c];
    if (!def) return;

    const existing = get().data[c];
    // 缓存有效则跳过请求（避免反复点击类目时重复打 TMDB）
    if (existing?.fetchedAt && Date.now() - existing.fetchedAt < CACHE_TTL) return;

    // 标记 loading（保留已有数据，展示骨架而非清空）
    set((s) => ({
      data: {
        ...s.data,
        [c]: {
          hero: existing?.hero ?? [],
          heroLoading: true,
          heroError: null,
          rows: (existing?.rows ?? emptyRows()).map((r) => ({ ...r, loading: true, error: null })),
          fetchedAt: existing?.fetchedAt ?? null,
          loading: true,
        },
      },
    }));

    try {
      const heroP = def
        .hero()
        .then((items) => ({ items, error: null }))
        .catch((e) => ({ items: [] as TMDBVideoItem[], error: errMsg(e) }));

      const rowPs = def.rows.map((r) =>
        r.fetch()
          .then((items) => ({ items, error: null }))
          .catch((e) => ({ items: [] as TMDBVideoItem[], error: errMsg(e) })),
      );

      const [heroRes, ...rowRes] = await Promise.all([heroP, ...rowPs]);

      set((s) => ({
        data: {
          ...s.data,
          [c]: {
            hero: heroRes.items,
            heroLoading: false,
            heroError: heroRes.error,
            rows: rowRes.map((r) => ({ items: r.items, loading: false, error: r.error })),
            fetchedAt: Date.now(),
            loading: false,
          },
        },
      }));
    } catch {
      // 兜底：逐行 catch 已保证不会整体 reject，这里仅关闭 loading 标记
      set((s) => {
        const d = s.data[c];
        if (!d) return {};
        return { data: { ...s.data, [c]: { ...d, loading: false, heroLoading: false } } };
      });
    }
  },
}));
