/**
 * 应用设置状态管理
 * 管理视频源索引、IPTV源索引、主题模式、CORS代理和翻译API等全局配置
 * 主题支持 light/dark/system 三种模式，system 模式跟随系统偏好
 *
 * [批次3合并] 原 useSubtitleStore 的翻译 API 配置（translationAppId/translationApiKey/autoTranslate/targetLang）已合并到此 store
 * [数据迁移] 旧 localStorage key `subtitle-store` 的 translation API 数据会在首次加载时自动迁移到 `app-settings`
 * [安全] 敏感字段（tmdbAccessToken、translationApiKey）使用 AES-GCM 加密存储
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  setVideoSourceIndex: (index: number) => void;
  setVideoSourceIndices: (indices: number[]) => void;
  setIPTVSourceIndex: (index: number) => void;
  setIPTVSourceIndices: (indices: number[]) => void;
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
  videoSourceIndex: 0,
  videoSourceIndices: [0] as number[],
  iptvSourceIndex: 0,
  iptvSourceIndices: [0] as number[],
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
  tvOverscan: 3,
  username: '',
  avatar: '',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      videoSourceIndex: 0,
      videoSourceIndices: [0],
      iptvSourceIndex: 0,
      iptvSourceIndices: [0],
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
  tvOverscan: 3,
  username: '',
  avatar: '',

  setVideoSourceIndex: (index) => set({ videoSourceIndex: index }),
      setVideoSourceIndices: (indices) => set({ videoSourceIndices: indices }),
      setIPTVSourceIndex: (index) => set({ iptvSourceIndex: index }),
      setIPTVSourceIndices: (indices) => set({ iptvSourceIndices: indices }),
      setTheme: (theme) => set({ theme }),
      setSkin: (skin) => set({ skin }),
      setCorsProxy: (url) => set({ corsProxy: url }),
      setEpgUrls: (urls) => set({ epgUrls: urls }),
      setEpgUpdateInterval: (hours) => set({ epgUpdateInterval: Math.min(24, Math.max(1, hours)) }),
      setRememberVolume: (value) => set({ rememberVolume: value }),
      setTMDBToken: (token) => {
        // 明文存储供内存立即使用
        set({ tmdbAccessToken: token });
        // 异步加密以供持久化存储
        encryptText(token).then((encrypted) => {
          // 更新为加密后的值以便持久化存储
          useSettingsStore.setState({ tmdbAccessToken: encrypted });
        });
      },
      setTMDBLanguage: (lang) => set({ tmdbLanguage: lang }),
      setTranslationAppId: (translationAppId) => set({ translationAppId }),
      setTranslationApiKey: (translationApiKey) => {
        set({ translationApiKey });
        encryptText(translationApiKey).then((encrypted) => {
          useSettingsStore.setState({ translationApiKey: encrypted });
        });
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
        for (const key of SENSITIVE_FIELDS) {
          const value = state[key as keyof typeof state];
          if (typeof value === 'string' && value) {
            const decrypted = await decryptText(value);
            (state as unknown as Record<string, unknown>)[key] = decrypted;
          }
        }
      },
    }
  )
);
