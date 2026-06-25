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
  resetErrorCount(): void;
  /** Whether the stream is live (not VoD) */
  isLive(): boolean;
  /** Latency behind the live edge in seconds, or 0 if not live */
  getLiveLatency(): number;
  /** Earliest seekable time (for DVR/timeshift window) */
  getSeekableStart(): number;
  /** Latest seekable time (live edge) */
  getSeekableEnd(): number;
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

  resetErrorCount(): void {}

  isLive(): boolean {
    // Default: check if video element reports infinite duration
    if (this.video && this.video.duration && isFinite(this.video.duration) && this.video.duration > 0) {
      return false;
    }
    // If duration is Infinity or NaN, likely live
    return !this.video?.duration || !isFinite(this.video.duration);
  }

  getLiveLatency(): number {
    if (!this.video) return 0;
    const seekable = this.video.seekable;
    if (seekable.length > 0) {
      const liveEdge = seekable.end(seekable.length - 1);
      return Math.max(0, liveEdge - this.video.currentTime);
    }
    return 0;
  }

  getSeekableStart(): number {
    if (!this.video) return 0;
    const seekable = this.video.seekable;
    return seekable.length > 0 ? seekable.start(0) : 0;
  }

  getSeekableEnd(): number {
    if (!this.video) return 0;
    const seekable = this.video.seekable;
    return seekable.length > 0 ? seekable.end(seekable.length - 1) : 0;
  }
}
