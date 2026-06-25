import type React from 'react';
import type { SourceType } from '@/types/video';
import type { IPTVChannel, IPTVGroup } from '@/types/iptv';

export type PlayerMode = 'video' | 'iptv' | 'live';
export type PlatformType = 'tv' | 'mobile' | 'desktop';
export type DecoderMode = 'native' | 'wasm';
export type LoopMode = 'none' | 'single' | 'list';

export interface PlayerLevel {
  width: number;
  height: number;
  bitrate: number;
  name?: string;
}

export interface PlayerAdapter {
  attach(video: HTMLVideoElement): void;
  detach(): void;
  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  getDuration(): number;
  getCurrentTime(): number;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  getLevels(): PlayerLevel[];
  setCurrentLevel(level: number): void;
  getCurrentLevel(): number;
  destroy(): void;
}

export interface PlayerAdapterConstructor {
  new (url: string, options?: Record<string, unknown>): PlayerAdapter;
}

export interface ControlBarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  content?: React.ReactNode;
  visible?: boolean;
}

export interface UniversalPlayerProps {
  url: string;
  type: SourceType;
  mode?: PlayerMode;
  platform?: PlatformType;
  title?: string;
  videoId?: string;
  episodeId?: string;
  skipHistory?: boolean;
  channelName?: string;
  channels?: IPTVChannel[];
  groups?: IPTVGroup[];
  onProgress?: (progress: number, duration: number) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: Error) => void;
  onBack?: () => void;
  onRefresh?: () => void;
  onChannelChange?: (channel: IPTVChannel) => void;
  onSkipIntro?: () => void;
  onSkipOutro?: () => void;
  controlBarSlots?: {
    left?: React.ReactNode;
    center?: React.ReactNode;
    right?: React.ReactNode;
  };
}
