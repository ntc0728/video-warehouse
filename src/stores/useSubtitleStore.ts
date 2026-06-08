import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SubtitleSettings } from '@/types/subtitle';

interface SubtitleState {
  /** 字幕显示样式（字号/颜色/位置/透明度） */
  settings: SubtitleSettings;
  /** 百度翻译 API App ID */
  translationAppId: string;
  /** 百度翻译 API Key */
  translationApiKey: string;
  /** 是否在导入字幕时自动翻译 */
  autoTranslate: boolean;
  /** 翻译目标语言 */
  targetLang: string;

  updateSettings: (settings: Partial<SubtitleSettings>) => void;
  setAppId: (id: string) => void;
  setApiKey: (key: string) => void;
  setAutoTranslate: (auto: boolean) => void;
  setTargetLang: (lang: string) => void;
}

const defaultSettings: SubtitleSettings = {
  fontSize: 24,
  fontColor: '#ffffff',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  position: 'bottom',
  opacity: 1,
};

/**
 * 字幕设置 Store
 *
 * 仅持久化"用户偏好 + 翻译 API 配置"，不涉及任何识别/翻译业务逻辑。
 * - 翻译逻辑：用户在 UniversalPlayer 导入字幕时按需调用 translator 服务
 * - 字幕样式：在 Settings 页面 + SubtitlePanel（已移除，由控制条 SubtitleSettings 替代）
 *
 * 注：原 AI 语音识别（speechRecognizer + 实时 cues 状态）已于 2026-06-06 清理。
 */
export const useSubtitleStore = create<SubtitleState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      translationAppId: '',
      translationApiKey: '',
      autoTranslate: true,
      targetLang: 'zh',

      updateSettings: (settings) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),

      setAppId: (translationAppId) => set({ translationAppId }),

      setApiKey: (translationApiKey) => set({ translationApiKey }),

      setAutoTranslate: (autoTranslate) => set({ autoTranslate }),

      setTargetLang: (targetLang) => set({ targetLang }),
    }),
    {
      name: 'subtitle-store',
      partialize: (state) => ({
        settings: state.settings,
        translationAppId: state.translationAppId,
        translationApiKey: state.translationApiKey,
        autoTranslate: state.autoTranslate,
        targetLang: state.targetLang,
      }),
    }
  )
);
