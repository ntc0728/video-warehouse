import type { PlayerLevel } from '@/types/player';

export interface AudioTrack {
  id: number;
  name: string;
  language: string;
  default: boolean;
}

export interface IPlayerAdapter {
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
  getBandwidthEstimate(): number;
  getAudioTracks(): AudioTrack[];
  setCurrentAudioTrack(trackId: number): void;
  getCurrentAudioTrack(): number;
  destroy(): void;
}

export abstract class BasePlayerAdapter implements IPlayerAdapter {
  protected video: HTMLVideoElement | null = null;
  protected url: string;

  constructor(url: string) {
    this.url = url;
  }

  attach(video: HTMLVideoElement): void {
    this.video = video;
  }

  detach(): void {
    this.video = null;
  }

  abstract play(): Promise<void>;
  abstract pause(): void;
  abstract seek(time: number): void;
  abstract destroy(): void;

  setVolume(volume: number): void {
    if (this.video) this.video.volume = volume;
  }

  getDuration(): number {
    return this.video?.duration ?? 0;
  }

  getCurrentTime(): number {
    return this.video?.currentTime ?? 0;
  }

  setPlaybackRate(rate: number): void {
    if (this.video) this.video.playbackRate = rate;
  }

  getPlaybackRate(): number {
    return this.video?.playbackRate ?? 1;
  }

  getLevels(): PlayerLevel[] {
    return [];
  }

  setCurrentLevel(_level: number): void {}

  getCurrentLevel(): number {
    return -1;
  }

  getBandwidthEstimate(): number {
    return 0;
  }

  getAudioTracks(): AudioTrack[] {
    return [];
  }

  setCurrentAudioTrack(_trackId: number): void {}

  getCurrentAudioTrack(): number {
    return -1;
  }
}
