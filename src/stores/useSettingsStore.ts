/**
 * 应用设置状态管理
 * 管理视频源索引、IPTV源索引、主题模式和CORS代理等全局配置
 * 主题支持 light/dark/system 三种模式，system 模式跟随系统偏好
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings } from '@/types/source';

interface SettingsState extends AppSettings {
  corsProxy: string;
  epgUrls: string[];
  epgUpdateInterval: number;
  rememberVolume: boolean;
  tmdbAccessToken: string;
  tmdbLanguage: string;
  setVideoSourceIndex: (index: number) => void;
  setVideoSourceIndices: (indices: number[]) => void;
  setIPTVSourceIndex: (index: number) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setCorsProxy: (url: string) => void;
  setEpgUrls: (urls: string[]) => void;
  setEpgUpdateInterval: (hours: number) => void;
  setRememberVolume: (value: boolean) => void;
  setTMDBToken: (token: string) => void;
  setTMDBLanguage: (lang: string) => void;
  getEffectiveTheme: () => 'light' | 'dark';
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      videoSourceIndex: 0,
      videoSourceIndices: [0],
      iptvSourceIndex: 0,
      theme: 'light' as const,
      corsProxy: '',
      epgUrls: ['http://epg.51zmt.top:8000/e.xml'],
      epgUpdateInterval: 6,
      rememberVolume: false,
      tmdbAccessToken: '',
      tmdbLanguage: 'zh-CN',

      setVideoSourceIndex: (index) => set({ videoSourceIndex: index }),
      setVideoSourceIndices: (indices) => set({ videoSourceIndices: indices }),
      setIPTVSourceIndex: (index) => set({ iptvSourceIndex: index }),
      setTheme: (theme) => set({ theme }),
      setCorsProxy: (url) => set({ corsProxy: url }),
      setEpgUrls: (urls) => set({ epgUrls: urls }),
      setEpgUpdateInterval: (hours) => set({ epgUpdateInterval: Math.min(24, Math.max(1, hours)) }),
      setRememberVolume: (value) => set({ rememberVolume: value }),
      setTMDBToken: (token) => set({ tmdbAccessToken: token }),
      setTMDBLanguage: (lang) => set({ tmdbLanguage: lang }),

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
    }
  )
);
