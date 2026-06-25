/**
 * 应用设置状态管理
 * 管理视频源索引、IPTV源索引、主题模式、CORS代理和翻译API等全局配置
 * 主题支持 light/dark/system 三种模式，system 模式跟随系统偏好
 *
 * [批次3合并] 原 useSubtitleStore 的翻译 API 配置（translationAppId/translationApiKey/autoTranslate/targetLang）已合并到此 store
 * [数据迁移] 旧 localStorage key `subtitle-store` 的 translation API 数据会在首次加载时自动迁移到 `app-settings`
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  getEffectiveTheme: () => 'light' | 'dark';
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      videoSourceIndex: 0,
      videoSourceIndices: [0],
      iptvSourceIndex: 0,
      iptvSourceIndices: [0],
      theme: 'light' as const,
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

      setVideoSourceIndex: (index) => set({ videoSourceIndex: index }),
      setVideoSourceIndices: (indices) => set({ videoSourceIndices: indices }),
      setIPTVSourceIndex: (index) => set({ iptvSourceIndex: index }),
      setIPTVSourceIndices: (indices) => set({ iptvSourceIndices: indices }),
      setTheme: (theme) => set({ theme }),
      setCorsProxy: (url) => set({ corsProxy: url }),
      setEpgUrls: (urls) => set({ epgUrls: urls }),
      setEpgUpdateInterval: (hours) => set({ epgUpdateInterval: Math.min(24, Math.max(1, hours)) }),
      setRememberVolume: (value) => set({ rememberVolume: value }),
      setTMDBToken: (token) => set({ tmdbAccessToken: token }),
      setTMDBLanguage: (lang) => set({ tmdbLanguage: lang }),
      setTranslationAppId: (translationAppId) => set({ translationAppId }),
      setTranslationApiKey: (translationApiKey) => set({ translationApiKey }),
      setAutoTranslate: (autoTranslate) => set({ autoTranslate }),
      setTargetLang: (targetLang) => set({ targetLang }),
      setSkipIntro: (skipIntro) => set({ skipIntro }),
      setSkipOutro: (skipOutro) => set({ skipOutro }),
      setSkipIntroDuration: (skipIntroDuration) => set({ skipIntroDuration: Math.max(10, Math.min(300, skipIntroDuration)) }),
      setSkipOutroDuration: (skipOutroDuration) => set({ skipOutroDuration: Math.max(10, Math.min(300, skipOutroDuration)) }),
      setAutoPlay: (autoPlay) => set({ autoPlay }),

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
        // Migrate old subtitle-store translation API config if exists
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
    }
  )
);
