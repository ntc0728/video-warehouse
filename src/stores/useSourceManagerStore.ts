/**
 * useSourceManagerStore — 设置页源管理 store
 *
 * [2026-08-07 源管理整改]
 * - 统一管理视频源 / IPTV 源 / EPG 源（builtin 内置 + custom 自建）
 * - 明文 localStorage 持久化（key `managed-sources`）
 * - 启用状态同步：builtin+custom 合并成「消费数组」→ 通过 sourceService.setAttachedSources
 *   注入（getVideoSources 返回内置+附加，下标覆盖 custom），并把启用的源回写为消费 indices。
 * - 沿用上限：视频源最多启用 6 个；IPTV/EPG 最多 3 个
 * - custom 源可删除；builtin 可停用不可删除
 * - 每个源可配 timeout(ms) / retries（应用层：videoService 请求时读取）
 * - 测速只测启用源；sortByLatency 只对启用源排序（未启用保持相对顺序排尾）
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  ManagedVideoSource,
  ManagedIPTVSource,
  ManagedEPGSource,
  VideoSourceConfig,
  IPTVSourceConfig,
  EPGSourceConfig,
} from '@/types/source';
import { getVideoSources, getIPTVSources, getEPGSources, setAttachedSources } from '@/services/sourceService';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useIPTVStore } from '@/stores/useIPTVStore';

/** 场景对应的启用数量上限 */
export const MAX_ENABLED: Record<'video' | 'iptv' | 'epg', number> = {
  video: 6,
  iptv: 3,
  epg: 3,
};

/** 自定义源 id 生成 */
function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 测速结果显示文案 */
export function formatLatency(latency: number | null): string {
  if (latency == null) return '—';
  return `${latency}ms`;
}

type Scene = 'video' | 'iptv' | 'epg';

/** 模块级一次性 guard：bootstrap 只在当前会话执行一次（防止多 tab/多挂载重复注入） */
let bootstrapStarted = false;
let bootstrapPromise: Promise<void> | null = null;

interface SourceStatusLike {
  enabled: boolean;
  latency: number | null;
  latencyCheckedAt: number | null;
  /** 该源是否正在测速（用于列表项显示旋转图标） */
  measuring?: boolean;
}

interface SourceManagerState {
  video: ManagedVideoSource[];
  iptv: ManagedIPTVSource[];
  epg: ManagedEPGSource[];
  _bootstrapped: { video: boolean; iptv: boolean; epg: boolean };

  setEnabled: (scene: Scene, id: string, enabled: boolean) => void;
  setAllEnabled: (scene: Scene, enabled: boolean) => void;
  setLatencies: (scene: Scene, map: Record<string, number | null>) => void;
  /** 标记一批源开始测速（设置 measuring=true，latency 清空为 null 表示「正在检测」） */
  setMeasuring: (scene: Scene, ids: string[], measuring: boolean) => void;

  addCustomVideoSource: (input: { name: string; api: string; detail: string; enabled?: boolean; timeoutMs?: number; retries?: number }) => ManagedVideoSource;
  updateVideoSource: (id: string, patch: Partial<Omit<ManagedVideoSource, 'id' | 'kind' | 'addedAt'>>) => void;
  deleteCustomVideoSource: (id: string) => void;

  addCustomIPTVSource: (input: { name: string; url: string; enabled?: boolean }) => ManagedIPTVSource;
  updateIPTVSource: (id: string, patch: Partial<Omit<ManagedIPTVSource, 'id' | 'kind' | 'addedAt'>>) => void;
  deleteCustomIPTVSource: (id: string) => void;

  addCustomEPGSource: (input: { name: string; url: string; enabled?: boolean }) => ManagedEPGSource;
  updateEPGSource: (id: string, patch: Partial<Omit<ManagedEPGSource, 'id' | 'kind' | 'addedAt'>>) => void;
  deleteCustomEPGSource: (id: string) => void;

  sortByLatency: (scene: Scene) => void;
  resetToDefaults: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

/* ── 消费同步（核心） ────────────────────────── */

/** 计算「启用的源」并把它们注入消费链路（setAttachedSources + 回写 settings indices） */
function syncConsumers(s: SourceManagerState, scene: Scene) {
  if (scene === 'video') {
    const enabled = s.video.filter((v) => v.status.enabled).sort((a, b) => a.order - b.order);
    const attached: VideoSourceConfig[] = enabled.map((v) => {
      const meta = v as ManagedVideoSource & { timeoutMs?: number; retries?: number };
      return {
        id: v.id,
        name: v.name,
        api: v.api,
        detail: v.detail,
        timeoutMs: meta.timeoutMs,
        retries: meta.retries,
      };
    });
    setAttachedSources('video', attached);
    void (async () => {
      const merged = await getVideoSources();
      const idxMap = new Map<string, number>();
      merged.forEach((v, i) => idxMap.set(v.id, i));
      const indices = enabled.map((v) => idxMap.get(v.id)).filter((i): i is number => i != null);
      const settings = useSettingsStore.getState();
      if (indices.length > 0) settings.setVideoSourceIndices(indices.slice(0, MAX_ENABLED.video));
    })();
  } else if (scene === 'iptv') {
    const enabled = s.iptv.filter((v) => v.status.enabled).sort((a, b) => a.order - b.order);
    const attached: IPTVSourceConfig[] = enabled.map((v) => ({ name: v.name, url: v.url }));
    setAttachedSources('iptv', attached);
    void (async () => {
      const merged = await getIPTVSources();
      const idxMap = new Map<string, number>();
      merged.forEach((m, i) => idxMap.set(m.url, i));
      const indices = enabled.map((v) => idxMap.get(v.url)).filter((i): i is number => i != null);
      const settings = useSettingsStore.getState();
      if (indices.length > 0) settings.setIPTVSourceIndices(indices.slice(0, MAX_ENABLED.iptv));
      // 同时直接同步 useIPTVStore 的 aggregatorUrls（不依赖 IPTV 页面挂载），
      // 确保在设置页启用 IPTV 源后立即生效、能正确加载频道。
      const urls = enabled.map((v) => v.url);
      const names = enabled.map((v) => v.name || `源 ${idxMap.get(v.url)! + 1}`);
      const iptv = useIPTVStore.getState();
      const cur = iptv.settings;
      const urlsChanged =
        urls.length !== (cur.aggregatorUrls?.length ?? 0) ||
        urls.some((u, i) => u !== cur.aggregatorUrls?.[i]);
      if (urlsChanged) {
        iptv.setSettings({
          aggregatorUrl: urls[0] || '',
          aggregatorUrls: urls,
          sourceNames: names,
        });
        // 源变更后触发频道刷新，避免「启用了新源但 IPTV 页仍显示旧数据」（含旧缓存误命中）。
        iptv.refreshChannels();
      }
    })();
  } else if (scene === 'epg') {
    const enabled = s.epg.filter((v) => v.status.enabled).sort((a, b) => a.order - b.order);
    const attached: EPGSourceConfig[] = enabled.map((v) => ({ name: v.name, url: v.url }));
    setAttachedSources('epg', attached);
    const settings = useSettingsStore.getState();
    if (enabled.length > 0) settings.setEpgUrls(enabled.map((v) => v.url).slice(0, MAX_ENABLED.epg));
  }
}

/* ── builtin 构造 ────────────────────────────── */

function toManagedVideo(c: { id: string; name: string; api: string; detail: string }, idx: number, addedAt: number, enabled: boolean): ManagedVideoSource {
  return {
    id: c.id,
    name: c.name,
    api: c.api,
    detail: c.detail,
    kind: 'builtin' as SourceKindType,
    addedAt,
    order: idx,
    status: { enabled, latency: null, latencyCheckedAt: null },
  };
}

function toManagedIPTV(c: { name: string; url: string }, idx: number, addedAt: number, enabled: boolean): ManagedIPTVSource {
  const id = `iptv:${c.name}`;
  return {
    id,
    name: c.name,
    url: c.url,
    kind: 'builtin' as SourceKindType,
    addedAt,
    order: idx,
    status: { enabled, latency: null, latencyCheckedAt: null },
  };
}

function toManagedEPG(c: { name: string; url: string }, idx: number, addedAt: number, enabled: boolean): ManagedEPGSource {
  const id = `epg:${c.name}`;
  return {
    id,
    name: c.name,
    url: c.url,
    kind: 'builtin' as SourceKindType,
    addedAt,
    order: idx,
    status: { enabled, latency: null, latencyCheckedAt: null },
  };
}

type SourceKindType = 'builtin' | 'custom';

export const useSourceManagerStore = create<SourceManagerState>()(
  persist(
    (set, get) => ({
      video: [],
      iptv: [],
      epg: [],
      _bootstrapped: { video: false, iptv: false, epg: false },

      setEnabled: (scene, id, enabled) => {
        const list = get()[scene] as Array<{ id: string; status: SourceStatusLike }>;
        if (enabled) {
          const enabledCount = list.filter((s) => s.status.enabled).length;
          const target = list.find((s) => s.id === id);
          if (target && !target.status.enabled && enabledCount >= MAX_ENABLED[scene]) {
            console.warn(`启用源数量已达上限 ${MAX_ENABLED[scene]}`);
            return;
          }
        } else {
          // 至少一个源兜底：IPTV/EPG 停用最后一个已启用源时拒绝（避免无源可加载）
          if (scene === 'iptv' || scene === 'epg') {
            const target = list.find((s) => s.id === id);
            const enabledCount = list.filter((s) => s.status.enabled).length;
            if (target?.status.enabled && enabledCount <= 1) {
              console.warn(`至少需要保留一个${scene === 'iptv' ? 'IPTV' : '节目单'}源`);
              return;
            }
          }
        }
        set({
          [scene]: list.map((s) => (s.id === id ? { ...s, status: { ...s.status, enabled } } : s)),
        } as Pick<SourceManagerState, Scene>);
        syncConsumers(get(), scene);
      },

      setAllEnabled: (scene, enabled) => {
        const list = get()[scene] as Array<{ status: SourceStatusLike }>;
        // 至少一个源兜底：全部停用 IPTV/EPG 时拒绝（保留至少一个已启用源）
        if (!enabled && (scene === 'iptv' || scene === 'epg')) {
          const hasAny = list.some((s) => s.status.enabled);
          if (hasAny && list.length > 0) {
            // 拒绝全部停用：改为只保留第一个源启用
            set({
              [scene]: list.map((s, i) => ({ ...s, status: { ...s.status, enabled: i === 0 } })),
            } as Pick<SourceManagerState, Scene>);
            syncConsumers(get(), scene);
            return;
          }
        }
        set({
          [scene]: list.map((s) => ({ ...s, status: { ...s.status, enabled } })),
        } as Pick<SourceManagerState, Scene>);
        syncConsumers(get(), scene);
      },

      setLatencies: (scene, map) => {
        const list = get()[scene] as Array<{ id: string; status: SourceStatusLike }>;
        const now = Date.now();
        set({
          [scene]: list.map((s) => {
            if (!(s.id in map)) return s;
            const latency = map[s.id];
            return { ...s, status: { ...s.status, latency, latencyCheckedAt: latency == null ? null : now, measuring: false } };
          }),
        } as Pick<SourceManagerState, Scene>);
      },

      setMeasuring: (scene, ids, measuring) => {
        const idSet = new Set(ids);
        const list = get()[scene] as Array<{ id: string; status: SourceStatusLike }>;
        set({
          [scene]: list.map((s) => {
            if (!idSet.has(s.id)) return s;
            if (measuring) {
              // 开始测速：清空 latency 为 null（隐藏数值），置 measuring=true
              return { ...s, status: { ...s.status, measuring: true, latency: null, latencyCheckedAt: null } };
            }
            return { ...s, status: { ...s.status, measuring: false } };
          }),
        } as Pick<SourceManagerState, Scene>);
      },

      addCustomVideoSource: (input) => {
        const list = get().video;
        const now = Date.now();
        const next = {
          id: genId(),
          name: input.name,
          api: input.api,
          detail: input.detail || input.api,
          kind: 'custom' as SourceKindType,
          addedAt: now,
          order: list.length,
          status: { enabled: input.enabled ?? true, latency: null, latencyCheckedAt: null },
          timeoutMs: input.timeoutMs,
          retries: input.retries,
        };
        set({ video: [...list, next] as ManagedVideoSource[] });
        syncConsumers(get(), 'video');
        return next as ManagedVideoSource;
      },

      updateVideoSource: (id, patch) => {
        set({ video: get().video.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
        syncConsumers(get(), 'video');
      },

      deleteCustomVideoSource: (id) => {
        set({ video: get().video.filter((s) => !(s.id === id && s.kind === 'custom')) });
        syncConsumers(get(), 'video');
      },

      addCustomIPTVSource: (input) => {
        const list = get().iptv;
        const now = Date.now();
        const next: ManagedIPTVSource = {
          id: genId(),
          name: input.name,
          url: input.url,
          kind: 'custom',
          addedAt: now,
          order: list.length,
          status: { enabled: input.enabled ?? true, latency: null, latencyCheckedAt: null },
        };
        set({ iptv: [...list, next] });
        syncConsumers(get(), 'iptv');
        return next;
      },

      updateIPTVSource: (id, patch) => {
        set({ iptv: get().iptv.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
        syncConsumers(get(), 'iptv');
      },

      deleteCustomIPTVSource: (id) => {
        set({ iptv: get().iptv.filter((s) => !(s.id === id && s.kind === 'custom')) });
        syncConsumers(get(), 'iptv');
      },

      addCustomEPGSource: (input) => {
        const list = get().epg;
        const now = Date.now();
        const next: ManagedEPGSource = {
          id: genId(),
          name: input.name,
          url: input.url,
          kind: 'custom',
          addedAt: now,
          order: list.length,
          status: { enabled: input.enabled ?? true, latency: null, latencyCheckedAt: null },
        };
        set({ epg: [...list, next] });
        syncConsumers(get(), 'epg');
        return next;
      },

      updateEPGSource: (id, patch) => {
        set({ epg: get().epg.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
        syncConsumers(get(), 'epg');
      },

      deleteCustomEPGSource: (id) => {
        set({ epg: get().epg.filter((s) => !(s.id === id && s.kind === 'custom')) });
        syncConsumers(get(), 'epg');
      },

      sortByLatency: (scene) => {
        const list = (get()[scene] as Array<{ id: string; status: SourceStatusLike }>).slice();
        list.sort((a, b) => {
          const ae = a.status.enabled;
          const be = b.status.enabled;
          if (ae !== be) return ae ? -1 : 1;
          if (!ae) return 0;
          const la = a.status.latency;
          const lb = b.status.latency;
          if (la == null && lb == null) return 0;
          if (la == null) return 1;
          if (lb == null) return -1;
          return la - lb;
        });
        set({
          [scene]: list.map((s, i) => ({ ...s, order: i })) as unknown as SourceManagerState[Scene],
        } as unknown as Pick<SourceManagerState, Scene>);
        syncConsumers(get(), scene);
      },

      resetToDefaults: async () => {
        set({
          video: [],
          iptv: [],
          epg: [],
          _bootstrapped: { video: false, iptv: false, epg: false },
        });
        await get().bootstrap();
      },

      bootstrap: async () => {
        // 模块级 guard：同一会话只执行一次（并发调用共享同一 promise，幂等）
        if (bootstrapStarted) {
          if (bootstrapPromise) await bootstrapPromise;
          return;
        }
        bootstrapStarted = true;
        bootstrapPromise = (async () => {
          const now = Date.now();
          const updates: Partial<SourceManagerState> = {};
          // 关键：仅当持久化列表为空时才注入默认源（不覆盖已持久化的启用状态，保证回显）。
          // _bootstrapped 未持久化，每次刷新重置；用「列表是否已有内容」判断是否已初始化。
          if (get().video.length === 0) {
            const vids = await getVideoSources();
            updates.video = vids.length > 0 ? vids.map((v, i) => toManagedVideo(v, i, now, i === 0)) : get().video;
          }
          if (get().iptv.length === 0) {
            const ipts = await getIPTVSources();
            updates.iptv = ipts.length > 0 ? ipts.map((c, i) => toManagedIPTV(c, i, now, i === 0)) : get().iptv;
          }
          if (get().epg.length === 0) {
            const epgs = await getEPGSources();
            updates.epg = epgs.length > 0 ? epgs.map((c, i) => toManagedEPG(c, i, now, i === 0)) : get().epg;
          }
          if (Object.keys(updates).length > 0) {
            set(updates as SourceManagerState);
          }
          // 每次 bootstrap 都同步消费（从持久化的启用状态回写 indices/attached）
          syncConsumers(get(), 'video');
          syncConsumers(get(), 'iptv');
          syncConsumers(get(), 'epg');
        })();
        await bootstrapPromise;
      },
    }),
    {
      name: 'managed-sources',
      storage: createJSONStorage(() => ({
        getItem: (k) => {
          try {
            return localStorage.getItem(k);
          } catch {
            return null;
          }
        },
        setItem: (k, v) => {
          try {
            localStorage.setItem(k, v);
          } catch {
            /* ignore quota */
          }
        },
        removeItem: (k) => {
          try {
            localStorage.removeItem(k);
          } catch {
            /* ignore */
          }
        },
      })),
      partialize: (s) => ({ video: s.video, iptv: s.iptv, epg: s.epg }) as SourceManagerState,
    },
  ),
);
