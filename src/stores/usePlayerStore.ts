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
  mutedVolume: number;
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
  bufferedProgress: number;
  isFullscreen: boolean;
  isPlayerLoading: boolean;
  isReadyToPlay: boolean;
  mirror: boolean;
  aspectRatio: 'default' | '4:3' | '16:9' | 'fill';

  setSource: (src: string, type: SourceType) => void;
  setSources: (sources: VideoSource[]) => void;
  setPlaying: (isPlaying: boolean) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setMutedVolume: (volume: number) => void;
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
  setBufferedProgress: (buffered: number) => void;
  setFullscreen: (isFullscreen: boolean) => void;
  setPlayerLoading: (loading: boolean) => void;
  setReadyToPlay: (ready: boolean) => void;
  setMirror: (mirror: boolean) => void;
  setAspectRatio: (ratio: 'default' | '4:3' | '16:9' | 'fill') => void;
  reset: () => void;
  resetRuntime: () => void;
}

const initialState = {
  currentSrc: null,
  currentType: null,
  isPlaying: false,
  progress: 0,
  duration: 0,
  volume: 1,
  mutedVolume: 1,
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
  bufferedProgress: 0,
  isFullscreen: false,
  isPlayerLoading: false,
  isReadyToPlay: false,
  mirror: false,
  aspectRatio: 'default' as const,
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
      setMutedVolume: (mutedVolume) => set({ mutedVolume }),
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
      setBufferedProgress: (bufferedProgress) => set({ bufferedProgress }),
      setFullscreen: (isFullscreen) => set({ isFullscreen }),
      setPlayerLoading: (isPlayerLoading) => set({ isPlayerLoading }),
      setReadyToPlay: (isReadyToPlay) => set({ isReadyToPlay }),
      setMirror: (mirror) => set({ mirror }),
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),
      // reset：重置所有状态（包括用户偏好），仅用于全局重置场景
      reset: () => set(initialState),
      // resetRuntime：仅重置运行时状态，保留用户偏好（音量、倍速、解码模式、字幕样式等）
      // 用于页面卸载等场景，避免清除用户保存的偏好设置
      resetRuntime: () => set((state) => ({
        currentSrc: null,
        currentType: null,
        isPlaying: false,
        progress: 0,
        duration: 0,
        sources: [],
        levels: [],
        audioTracks: [],
        currentAudioTrack: -1,
        isPiP: false,
        subtitleUrl: null,
        mode: 'video' as PlayerMode,
        platform: 'desktop' as PlatformType,
        isControlsVisible: false,
        isChannelListVisible: false,
        bandwidthEstimate: 0,
        isBuffering: false,
        bufferedProgress: 0,
        isFullscreen: false,
        isPlayerLoading: false,
        isReadyToPlay: false,
        // 保留用户偏好
        volume: state.volume,
        mutedVolume: state.mutedVolume,
        playbackRate: state.playbackRate,
        decoderMode: state.decoderMode,
        subtitleSettings: state.subtitleSettings,
        currentLevel: state.currentLevel,
        loopMode: state.loopMode,
      })),
    }),
    {
      name: 'player-store',
      // 仅持久化用户偏好，播放进度等运行时状态不持久化
      partialize: (state) => ({
        volume: state.volume,
        mutedVolume: state.mutedVolume,
        playbackRate: state.playbackRate,
        decoderMode: state.decoderMode,
        subtitleSettings: state.subtitleSettings,
        currentLevel: state.currentLevel,
        loopMode: state.loopMode,
        mirror: state.mirror,
        aspectRatio: state.aspectRatio,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Record<string, unknown>;
        // 如果存在则迁移旧版 subtitle-store 的设置
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
