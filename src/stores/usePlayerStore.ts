/**
 * 播放器状态管理
 * 管理视频播放状态、解码模式、画质切换、画中画、字幕样式等核心播放器功能
 * 使用 Zustand + persist 中间件，仅持久化用户偏好设置（音量、播放速率、解码模式、字幕样式）
 *
 * [批次3合并] 原 useSubtitleStore 的 subtitleSettings 功能已合并到此 store
 * [数据迁移] 旧 localStorage key `subtitle-store` 的 settings 数据会在首次加载时自动迁移到 `player-store`
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VideoSource, SourceType } from '@/types/video';
import type { PlayerMode, PlatformType, LoopMode } from '@/types/player';
import type { SubtitleSettings } from '@/types/subtitle';

const defaultSubtitleSettings: SubtitleSettings = {
  fontSize: 24,
  fontColor: '#ffffff',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  position: 'bottom',
  opacity: 1,
};

interface PlayerState {
  currentSrc: string | null;
  currentType: SourceType | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  playbackRate: number;
  sources: VideoSource[];
  decoderMode: 'native' | 'wasm';
  currentLevel: number;
  levels: { width: number; height: number; bitrate: number; name?: string }[];
  audioTracks: { id: number; name: string; language: string; default: boolean }[];
  currentAudioTrack: number;
  isPiP: boolean;
  subtitleUrl: string | null;
  subtitleSettings: SubtitleSettings;
  mode: PlayerMode;
  platform: PlatformType;
  isControlsVisible: boolean;
  isChannelListVisible: boolean;
  loopMode: LoopMode;
  bandwidthEstimate: number;
  isBuffering: boolean;

  setSource: (src: string, type: SourceType) => void;
  setSources: (sources: VideoSource[]) => void;
  setPlaying: (isPlaying: boolean) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  setDecoderMode: (mode: 'native' | 'wasm') => void;
  setCurrentLevel: (level: number) => void;
  setLevels: (levels: { width: number; height: number; bitrate: number; name?: string }[]) => void;
  setAudioTracks: (tracks: { id: number; name: string; language: string; default: boolean }[]) => void;
  setCurrentAudioTrack: (trackId: number) => void;
  setIsPiP: (isPiP: boolean) => void;
  setSubtitleUrl: (url: string | null) => void;
  updateSubtitleSettings: (settings: Partial<SubtitleSettings>) => void;
  setMode: (mode: PlayerMode) => void;
  setPlatform: (platform: PlatformType) => void;
  setControlsVisible: (visible: boolean) => void;
  setChannelListVisible: (visible: boolean) => void;
  setLoopMode: (mode: LoopMode) => void;
  setBandwidthEstimate: (bps: number) => void;
  setBuffering: (isBuffering: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentSrc: null,
  currentType: null,
  isPlaying: false,
  progress: 0,
  duration: 0,
  volume: 1,
  playbackRate: 1,
  sources: [],
  decoderMode: 'native' as const,
  currentLevel: -1,
  levels: [] as { width: number; height: number; bitrate: number; name?: string }[],
  audioTracks: [] as { id: number; name: string; language: string; default: boolean }[],
  currentAudioTrack: -1,
  isPiP: false,
  subtitleUrl: null as string | null,
  subtitleSettings: defaultSubtitleSettings,
  mode: 'video' as PlayerMode,
  platform: 'desktop' as PlatformType,
  isControlsVisible: false,
  isChannelListVisible: false,
  loopMode: 'none' as LoopMode,
  bandwidthEstimate: 0,
  isBuffering: false,
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      ...initialState,

      setSource: (src, type) => set({ currentSrc: src, currentType: type }),
      setSources: (sources) => set({ sources }),
      setPlaying: (isPlaying) => set({ isPlaying }),
      setProgress: (progress) => set({ progress }),
      setDuration: (duration) => set({ duration }),
      setVolume: (volume) => set({ volume }),
      setPlaybackRate: (playbackRate) => set({ playbackRate }),
      setDecoderMode: (decoderMode) => set({ decoderMode }),
      setCurrentLevel: (currentLevel) => set({ currentLevel }),
      setLevels: (levels) => set({ levels }),
      setAudioTracks: (audioTracks) => set({ audioTracks }),
      setCurrentAudioTrack: (currentAudioTrack) => set({ currentAudioTrack }),
      setIsPiP: (isPiP) => set({ isPiP }),
      setSubtitleUrl: (subtitleUrl) => set({ subtitleUrl }),
      updateSubtitleSettings: (settings) =>
        set((state) => ({
          subtitleSettings: { ...state.subtitleSettings, ...settings },
        })),
      setMode: (mode) => set({ mode }),
      setPlatform: (platform) => set({ platform }),
      setControlsVisible: (isControlsVisible) => set({ isControlsVisible }),
      setChannelListVisible: (isChannelListVisible) => set({ isChannelListVisible }),
      setLoopMode: (loopMode) => set({ loopMode }),
      setBandwidthEstimate: (bandwidthEstimate) => set({ bandwidthEstimate }),
      setBuffering: (isBuffering) => set({ isBuffering }),
      reset: () => set(initialState),
    }),
    {
      name: 'player-store',
      // 仅持久化用户偏好，播放进度等运行时状态不持久化
      partialize: (state) => ({
        volume: state.volume,
        playbackRate: state.playbackRate,
        decoderMode: state.decoderMode,
        subtitleSettings: state.subtitleSettings,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Record<string, unknown>;
        // Migrate old subtitle-store settings if exists
        let migratedSubtitleSettings = (currentState as { subtitleSettings: SubtitleSettings }).subtitleSettings;
        try {
          const oldSubtitleData = localStorage.getItem('subtitle-store');
          if (oldSubtitleData) {
            const parsed = JSON.parse(oldSubtitleData);
            if (parsed.state?.settings) {
              migratedSubtitleSettings = parsed.state.settings;
            }
            localStorage.removeItem('subtitle-store');
          }
        } catch { /* ignore */ }

        return {
          ...currentState,
          ...persisted,
          subtitleSettings: migratedSubtitleSettings,
        } as PlayerState;
      },
    }
  )
);
