/**
 * 应用设置状态管理
 * 管理视频源索引、IPTV源索引、主题模式、CORS代理和翻译API等全局配置
 * 主题支持 light/dark/system 三种模式，system 模式跟随系统偏好
 *
 * [批次3合并] 原 useSubtitleStore 的翻译 API 配置（translationAppId/translationApiKey/autoTranslate/targetLang）已合并到此 store
 * [数据迁移] 旧 localStorage key `subtitle-store` 的 translation API 数据会在首次加载时自动迁移到 `app-settings`
 * [安全] 敏感字段（tmdbAccessToken、translationApiKey）使用 AES-GCM 加密存储
 *
 * [H1 修复 2026-08-05] 内存始终为明文、持久化层才加密：
 *   - setter 只写内存明文，不再异步加密后 setState 覆盖内存（旧实现导致保存 Token 后同一会话
 *     内所有 TMDB 请求携带密文 → 401）。
 *   - 加密收敛到自定义异步 storage：setItem 写 localStorage 前对敏感字段 AES-GCM 加密；
 *     getItem 原样返回密文；onRehydrateStorage 读入时解密为内存明文。
 *   - 兼容旧密文数据：rehydrate 对「疑似密文」解密，对明文原样返回（decryptText 内兼容）。
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { encryptText, decryptText } from '@/lib/crypto';
import type { AppSettings } from '@/types';

interface SettingsState extends AppSettings {
  corsProxy: string;
  epgUrls: string[];
  epgUpdateInterval: number;
  rememberVolume: boolean;
  tmdbAccessToken: string;
  tmdbLanguage: string;
  translationAppId: string;
  translationApiKey: string;
  autoTranslate: boolean;
  targetLang: string;
  setVideoSourceIds: (ids: string[]) => void;
  setIPTVSourceIds: (ids: string[]) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setSkin: (skin: 'default' | 'cartoon' | 'mechanical' | 'retro') => void;
  setCorsProxy: (url: string) => void;
  setEpgUrls: (urls: string[]) => void;
  setEpgUpdateInterval: (hours: number) => void;
  setRememberVolume: (value: boolean) => void;
  setTMDBToken: (token: string) => void;
  setTMDBLanguage: (lang: string) => void;
  setTranslationAppId: (id: string) => void;
  setTranslationApiKey: (key: string) => void;
  setAutoTranslate: (auto: boolean) => void;
  setTargetLang: (lang: string) => void;
  setSkipIntro: (value: boolean) => void;
  setSkipOutro: (value: boolean) => void;
  setSkipIntroDuration: (seconds: number) => void;
  setSkipOutroDuration: (seconds: number) => void;
  setAutoPlay: (value: boolean) => void;
  /** 强制 TV 模式（用于在非 TV 设备上体验遥控器交互） */
  setTvMode: (value: boolean) => void;
  /** TV 过扫描安全区大小（0–10） */
  setTvOverscan: (value: number) => void;
  setUsername: (username: string) => void;
  setAvatar: (avatar: string) => void;
  resetToDefaults: () => void;
  getEffectiveTheme: () => 'light' | 'dark';
}

const SENSITIVE_FIELDS = ['tmdbAccessToken', 'translationApiKey'] as const;

/** zustand persist 落 localStorage 的键名（persist name / 跨页签 storage 监听共用） */
const APP_SETTINGS_PERSIST_KEY = 'app-settings';

/** 设置项默认值（用于"恢复默认配置"） */
export const DEFAULT_SETTINGS = {
  videoSourceIds: [] as string[],
  iptvSourceIds: [] as string[],
  theme: 'light' as const,
  skin: 'default' as const,
  corsProxy: '',
  epgUrls: ['http://epg.51zmt.top:8000/e.xml'],
  epgUpdateInterval: 6,
  rememberVolume: false,
  tmdbAccessToken: '',
  tmdbLanguage: 'zh-CN',
  translationAppId: '',
  translationApiKey: '',
  autoTranslate: true,
  targetLang: 'zh',
  skipIntro: false,
  skipOutro: false,
  skipIntroDuration: 90,
  skipOutroDuration: 90,
  autoPlay: true,
  tvMode: false,
  tvOverscan: 5,
  username: '',
  avatar: '',
};

/**
 * 自定义持久化 storage：写 localStorage 前对敏感字段 AES-GCM 加密，读时原样返回密文
 * （由 onRehydrateStorage 解密为内存明文）。
 *
 * H1 修复：旧实现是 setter 内「先 set 明文 → 异步 encryptText 完成后 setState 密文」，
 * 导致内存值被密文覆盖、同一会话 TMDB 请求 401。现在内存恒为明文，加密只发生在持久化层。
 *
 * 说明：
 * - persist.setItem 接收 `{ state, version }`，此处异步加密后写盘；即使 persist 不 await
 *   返回的 Promise，也不影响内存值（内存始终是明文）。
 * - 解密失败（兼容旧明文数据）时按明文原样写回，行为与 decryptText 兜底一致。
 */
const encryptedStorage = createJSONStorage<SettingsState>(() => {
  const storage: {
    getItem: (name: string) => string | null;
    setItem: (name: string, value: string) => void;
    removeItem: (name: string) => void;
  } = {
    getItem: (name) => {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        const parsed = JSON.parse(value) as { state?: Record<string, unknown>; version?: number };
        if (parsed?.state) {
          const state = { ...parsed.state };
          const next = { ...parsed, state };
          // 异步加密后写盘（不阻塞 persist 调用方）
          void (async () => {
            const tasks: Promise<void>[] = [];
            for (const key of SENSITIVE_FIELDS) {
              const raw = state[key as keyof typeof state];
              if (typeof raw === 'string' && raw) {
                tasks.push(
                  encryptText(raw).then((enc) => {
                    next.state![key as string] = enc;
                  }),
                );
              }
            }
            await Promise.all(tasks);
            try {
              localStorage.setItem(name, JSON.stringify(next));
            } catch {
              /* 写盘失败时保持内存值，不抛出 */
            }
          })();
        } else {
          localStorage.setItem(name, value);
        }
      } catch {
        try {
          localStorage.setItem(name, value);
        } catch {
          /* ignore */
        }
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
  return storage;
});

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      videoSourceIds: [],
      iptvSourceIds: [],
      theme: 'light' as const,
      skin: 'default' as const,
      corsProxy: '',
      epgUrls: ['http://epg.51zmt.top:8000/e.xml'],
      epgUpdateInterval: 6,
      rememberVolume: false,
      tmdbAccessToken: '',
      tmdbLanguage: 'zh-CN',
      translationAppId: '',
      translationApiKey: '',
      autoTranslate: true,
      targetLang: 'zh',
      skipIntro: false,
      skipOutro: false,
      skipIntroDuration: 90,
      skipOutroDuration: 90,
  autoPlay: true,
  tvMode: false,
  tvOverscan: 5,
  username: '',
  avatar: '',

  setVideoSourceIds: (ids) => set({ videoSourceIds: ids }),
      setIPTVSourceIds: (ids) => set({ iptvSourceIds: ids }),
      setTheme: (theme) => set({ theme }),
      setSkin: (skin) => set({ skin }),
      setCorsProxy: (url) => set({ corsProxy: url }),
      setEpgUrls: (urls) => set({ epgUrls: urls }),
      setEpgUpdateInterval: (hours) => set({ epgUpdateInterval: Math.min(24, Math.max(1, hours)) }),
      setRememberVolume: (value) => set({ rememberVolume: value }),
      setTMDBToken: (token) => {
        // 内存始终明文；加密在自定义 storage.setItem 层完成（H1 修复，不再异步覆盖内存）
        set({ tmdbAccessToken: token });
      },
      setTMDBLanguage: (lang) => set({ tmdbLanguage: lang }),
      setTranslationAppId: (translationAppId) => set({ translationAppId }),
      setTranslationApiKey: (translationApiKey) => {
        // 内存始终明文；加密在自定义 storage.setItem 层完成（H1 修复）
        set({ translationApiKey });
      },
      setAutoTranslate: (autoTranslate) => set({ autoTranslate }),
      setTargetLang: (targetLang) => set({ targetLang }),
      setSkipIntro: (skipIntro) => set({ skipIntro }),
      setSkipOutro: (skipOutro) => set({ skipOutro }),
      setSkipIntroDuration: (skipIntroDuration) => set({ skipIntroDuration: Math.max(10, Math.min(300, skipIntroDuration)) }),
      setSkipOutroDuration: (skipOutroDuration) => set({ skipOutroDuration: Math.max(10, Math.min(300, skipOutroDuration)) }),
      setAutoPlay: (autoPlay) => set({ autoPlay }),
      setTvMode: (tvMode) => set({ tvMode }),
      setTvOverscan: (tvOverscan) => set({ tvOverscan }),
      setUsername: (username) => set({ username }),
      setAvatar: (avatar) => set({ avatar }),
      resetToDefaults: () => set({ ...DEFAULT_SETTINGS }),

      getEffectiveTheme: () => {
        const { theme } = get();
        if (theme === 'system') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return theme;
      },
    }),
    {
      name: APP_SETTINGS_PERSIST_KEY,
      storage: encryptedStorage,
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Record<string, unknown>;
        // 如果存在则迁移旧版 subtitle-store 的翻译 API 配置
        let migratedTranslation = {
          translationAppId: '',
          translationApiKey: '',
          autoTranslate: true,
          targetLang: 'zh',
        };
        try {
          const oldSubtitleData = localStorage.getItem('subtitle-store');
          if (oldSubtitleData) {
            const parsed = JSON.parse(oldSubtitleData);
            if (parsed.state) {
              migratedTranslation = {
                translationAppId: parsed.state.translationAppId || '',
                translationApiKey: parsed.state.translationApiKey || '',
                autoTranslate: parsed.state.autoTranslate ?? true,
                targetLang: parsed.state.targetLang || 'zh',
              };
            }
            localStorage.removeItem('subtitle-store');
          }
        } catch { /* ignore */ }

        return {
          ...currentState,
          ...persisted,
          translationAppId: migratedTranslation.translationAppId || (persisted?.translationAppId as string) || '',
          translationApiKey: migratedTranslation.translationApiKey || (persisted?.translationApiKey as string) || '',
          autoTranslate: migratedTranslation.autoTranslate ?? ((persisted?.autoTranslate as boolean) ?? true),
          targetLang: migratedTranslation.targetLang || (persisted?.targetLang as string) || 'zh',
        } as SettingsState;
      },
      onRehydrateStorage: () => async (state) => {
        if (!state) return;
        // 解密敏感字段。zustand v5 的 onRehydrateStorage 回调原地 mutate state
        // 不会触发 setState / 通知订阅者（编辑弹窗预填、状态标签、tmdbService 同步读取
        // 都会拿到密文）；同时若某个 setter 在解密完成前抢先触发 persist 写盘，
        // 自定义 storage.setItem 会把密文再加密一次（双重加密）持久化到 localStorage。
        // 这里解密后调用 setState：① 通知订阅者刷新 UI；② 让自定义 storage.setItem
        // 重新写盘为单层密文，规避双重加密。null/空值直接跳过。
        const patch: Record<string, unknown> = {};
        for (const key of SENSITIVE_FIELDS) {
          const value = state[key as keyof typeof state];
          if (typeof value === 'string' && value) {
            const decrypted = await decryptText(value);
            patch[key] = decrypted;
            // 同步原地写一份，保留旧实现里同步读取能拿到正确值的语义
            (state as unknown as Record<string, unknown>)[key] = decrypted;
          }
        }
        if (Object.keys(patch).length > 0) {
          useSettingsStore.setState(patch);
        }
      },
    }
  )
);

// ── 跨页签实时同步（2026-09-02）─────────────────────────────
// 静态配置（主题/皮肤/视频源选择/代理/EPG/token 等）经 zustand persist 落
// localStorage（键 APP_SETTINGS_PERSIST_KEY）。同源其它页签写入自动触发本页签
// window 'storage' 事件，此处做**白名单受控合并**让设置跨页签实时一致。
//
// ⚠️ 为什么不能用「storage 事件 → persist.rehydrate()」（iptv-store 的做法）：
//   ① encryptText 每次生成随机 IV → 同一明文每次密文都不同。rehydrate 的解密
//      onRehydrateStorage 必然 setState → persist 自动写盘 = 全新密文 → 其它页签
//      再收到事件再 rehydrate → **敏感字段非空时无限事件循环**；
//   ② persist 水合期自身的 setState 会写盘，而合并值里敏感字段是密文 → 自定义
//      setItem 对密文再加密 = 双重加密，会污染持久化数据。
//   所以这里不复用 persist 通道：直接解析事件载荷，逐键解密+比对后才 setState。
//   收敛性：接收页签仅在「值确实变化」时 set；set 后 persist 写回的内容与自身
//   内存一致 → 对端再收到事件时逐键比对全相等 → 不再 set → 环自动断裂。
//
// 白名单排除（CROSS_TAB_EXCLUDED_KEYS）：tvMode / tvOverscan 属「播放布局类」，
// 实时灌入会突变另一页签正在播放页的布局（TV 导航框架 + 过扫描安全区），不同步。
// 每页签保留自己的值；excluded 键永远不会被写回覆盖，也不参与收敛。
let settingsCrossTabSyncAttached = false;
const CROSS_TAB_EXCLUDED_KEYS = new Set(['tvMode', 'tvOverscan']);

/** 解析另一页签写入的持久化载荷，白名单逐键比对合并（含敏感字段解密） */
async function mergeSettingsFromCrossTab(raw: string): Promise<void> {
  let parsed: { state?: Record<string, unknown> };
  try {
    parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
  } catch {
    return;
  }
  const incoming = parsed?.state;
  if (!incoming || typeof incoming !== 'object') return;

  const patch: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(incoming)) {
    if (CROSS_TAB_EXCLUDED_KEYS.has(key)) continue; // 播放布局类：本页签保留自己的值
    if ((SENSITIVE_FIELDS as readonly string[]).includes(key)) {
      if (typeof rawValue !== 'string' || !rawValue) continue; // 空值跳过（无明文可同步）
      const decrypted = await decryptText(rawValue);
      const cur = useSettingsStore.getState()[key as keyof SettingsState] as unknown;
      if (decrypted !== cur) patch[key] = decrypted;
      continue;
    }
    const cur = useSettingsStore.getState()[key as keyof SettingsState] as unknown;
    // JSON 比对兼容数组（epgUrls 等）：同内容不同引用不触发无谓写盘
    if (JSON.stringify(cur) !== JSON.stringify(rawValue)) patch[key] = rawValue;
  }

  if (Object.keys(patch).length > 0) {
    useSettingsStore.setState(patch as Partial<SettingsState>);
  }
}

function initSettingsCrossTabSync(): void {
  if (typeof window === 'undefined' || import.meta.env?.MODE === 'test') return;
  if (settingsCrossTabSyncAttached) return; // 幂等：模块被多路径 import / HMR 时只挂一次
  settingsCrossTabSyncAttached = true;

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== APP_SETTINGS_PERSIST_KEY || e.storageArea !== localStorage) return;
    if (e.newValue === null) return; // removeItem 无独立归零入口（resetToDefaults 走整写），保持本页内存
    void mergeSettingsFromCrossTab(e.newValue);
  });
}
initSettingsCrossTabSync();
