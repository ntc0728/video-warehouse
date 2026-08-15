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
      name: 'app-settings',
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
