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
  /** 切换播放源（复用现有实例避免 destroy+recreate 导致的黑屏闪烁） */
  switchSource(url: string, options?: Record<string, unknown>): void;
  /** 流是否为直播（非点播） */
  isLive(): boolean;
  /** 落后实时边缘的延迟（秒），非直播返回 0 */
  getLiveLatency(): number;
  /** 最早可 seek 的时间（DVR/时移窗口起点） */
  getSeekableStart(): number;
  /** 最晚可 seek 的时间（实时边缘） */
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

  switchSource(url: string, _options?: Record<string, unknown>): void {
    this.url = url;
    this.resetErrorCount();
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
    // 默认：检查 video 元素是否报告无限时长
    if (this.video && this.video.duration && isFinite(this.video.duration) && this.video.duration > 0) {
      return false;
    }
    // 如果时长为 Infinity 或 NaN，则可能是直播
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
