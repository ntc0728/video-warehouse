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

/** 视频色彩调整（CSS filter 参数；1 = 原始值），Issue4 色彩调整弹窗 */
export interface ColorFilter {
  brightness: number;
  saturation: number;
  contrast: number;
}

/** 音效预设（常见播放器音效；off = 关闭/透传），Issue4 音效调节弹窗 */
export type AudioPreset =
  | 'off' | 'pop' | 'rock' | 'classical' | 'bass' | 'vocal' | 'treble' | '3d';

/** 视频音效调节状态 */
export interface AudioEffectState {
  preset: AudioPreset;
  /** 声道平衡：-1 左声道 … 1 右声道 */
  balance: number;
  /** 音量增强倍数：0.5 – 2 */
  gain: number;
}

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
  /** 字幕是否启用（移动端更多设置里开关；关闭时隐藏字幕及字幕设置入口） */
  subtitleEnabled: boolean;
  /** 后台听视频开关（App 端依赖 Android 前台服务/媒体会话实现，Web 端仅标记） */
  backgroundPlay: boolean;
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
  /** 最近一次「由用户手动发起」的播放标记（点击播放按钮/切集后手动播放）。
   * 用于 ToastTrigger 区分「用户手动播放」（显示『播放』提示）与
   * 「自动缓冲播放」（切集/恢复时 canplay 自动播，不重复提示）。 */
  userPlayRequested: boolean;
  /** 最近一次「由用户手动发起」的暂停标记（点击暂停按钮）。
   * 用于 ToastTrigger 区分「用户手动暂停」（显示『暂停』提示）与
   * 「拖拽进度条触发的自动 pause」（不提示『暂停』，改显示最新进度）。 */
  userPauseRequested: boolean;
  /** 播放错误的具体文案（P1-3）：native error / adapter error 时写入，PlayerCore 覆盖层透传显示 */
  errorMessage: string | null;
  /** 续播恢复目标时间（P1-4/P1-10）：loadProgress 找到历史进度时写入，
   * 驱动「已从上次位置继续」卡片（从头播放入口）；null 表示本次无续播 */
  resumeAt: number | null;
  /** 视频色彩调整（CSS filter）：亮度/饱和度/对比度，1 为原始值（Issue4 色彩调整弹窗） */
  colorFilter: ColorFilter;
  /** 视频音效调节状态（Issue4 音效调节弹窗）：预设 + 声道平衡 + 音量增强 */
  audioEffect: AudioEffectState;

  setSource: (src: string, type: SourceType) => void;
  setSources: (sources: VideoSource[]) => void;
  setPlaying: (isPlaying: boolean) => void;
  setUserPlayRequested: (requested: boolean) => void;
  setUserPauseRequested: (requested: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  setResumeAt: (time: number | null) => void;
  setColorFilter: (patch: Partial<ColorFilter>) => void;
  setAudioEffect: (patch: Partial<AudioEffectState>) => void;
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
  setSubtitleEnabled: (enabled: boolean) => void;
  setBackgroundPlay: (enabled: boolean) => void;
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
  subtitleEnabled: true,
  backgroundPlay: false,
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
  userPlayRequested: false,
  userPauseRequested: false,
  errorMessage: null as string | null,
  resumeAt: null as number | null,
  colorFilter: { brightness: 1, saturation: 1, contrast: 1 },
  audioEffect: { preset: 'off', balance: 0, gain: 1 } as AudioEffectState,
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      ...initialState,

      setSource: (src, type) => set({ currentSrc: src, currentType: type }),
      setSources: (sources) => set({ sources }),
      setPlaying: (isPlaying) => set({ isPlaying }),
      setUserPlayRequested: (userPlayRequested) => set({ userPlayRequested }),
      setUserPauseRequested: (userPauseRequested) => set({ userPauseRequested }),
      setErrorMessage: (errorMessage) => set({ errorMessage }),
      setResumeAt: (resumeAt) => set({ resumeAt }),
  setColorFilter: (patch) => set((state) => ({ colorFilter: { ...state.colorFilter, ...patch } })),
  setAudioEffect: (patch) => set((state) => ({ audioEffect: { ...state.audioEffect, ...patch } })),
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
      setSubtitleEnabled: (subtitleEnabled) => set({ subtitleEnabled }),
      setBackgroundPlay: (backgroundPlay) => set({ backgroundPlay }),
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
        subtitleEnabled: true,
        backgroundPlay: false,
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
        userPlayRequested: false,
        userPauseRequested: false,
        errorMessage: null,
        resumeAt: null,
        // 保留用户偏好
        volume: state.volume,
        mutedVolume: state.mutedVolume,
        playbackRate: state.playbackRate,
        decoderMode: state.decoderMode,
        subtitleSettings: state.subtitleSettings,
        currentLevel: state.currentLevel,
        loopMode: state.loopMode,
        colorFilter: { brightness: 1, saturation: 1, contrast: 1 },
        audioEffect: { preset: 'off', balance: 0, gain: 1 } as AudioEffectState,
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
