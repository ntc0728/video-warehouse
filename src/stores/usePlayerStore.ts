/**
 * 播放器状态管理
 * 管理视频播放状态、解码模式、画质切换、画中画等核心播放器功能
 * 使用 Zustand + persist 中间件，仅持久化用户偏好设置（音量、播放速率、解码模式）
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VideoSource, SourceType } from '@/types/video';
import type { PlayerMode, PlatformType, LoopMode } from '@/types/player';

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
  isPiP: boolean;
  subtitleUrl: string | null;
  mode: PlayerMode;
  platform: PlatformType;
  isControlsVisible: boolean;
  isChannelListVisible: boolean;
  loopMode: LoopMode;
  bandwidthEstimate: number;

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
  setIsPiP: (isPiP: boolean) => void;
  setSubtitleUrl: (url: string | null) => void;
  setMode: (mode: PlayerMode) => void;
  setPlatform: (platform: PlatformType) => void;
  setControlsVisible: (visible: boolean) => void;
  setChannelListVisible: (visible: boolean) => void;
  setLoopMode: (mode: LoopMode) => void;
  setBandwidthEstimate: (bps: number) => void;
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
  isPiP: false,
  subtitleUrl: null as string | null,
  mode: 'video' as PlayerMode,
  platform: 'desktop' as PlatformType,
  isControlsVisible: false,
  isChannelListVisible: false,
  loopMode: 'none' as LoopMode,
  bandwidthEstimate: 0,
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
      setIsPiP: (isPiP) => set({ isPiP }),
      setSubtitleUrl: (subtitleUrl) => set({ subtitleUrl }),
      setMode: (mode) => set({ mode }),
      setPlatform: (platform) => set({ platform }),
      setControlsVisible: (isControlsVisible) => set({ isControlsVisible }),
      setChannelListVisible: (isChannelListVisible) => set({ isChannelListVisible }),
      setLoopMode: (loopMode) => set({ loopMode }),
      setBandwidthEstimate: (bandwidthEstimate) => set({ bandwidthEstimate }),
      reset: () => set(initialState),
    }),
    {
      name: 'player-store',
      // 仅持久化用户偏好，播放进度等运行时状态不持久化
      partialize: (state) => ({
        volume: state.volume,
        playbackRate: state.playbackRate,
        decoderMode: state.decoderMode,
      }),
    }
  )
);
