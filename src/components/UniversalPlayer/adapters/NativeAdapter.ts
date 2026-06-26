import { BasePlayerAdapter } from './PlayerAdapter';

export class NativeAdapter extends BasePlayerAdapter {
  attach(video: HTMLVideoElement): void {
    super.attach(video);
    if (this.video) {
      this.video.src = this.url;
    }
  }

  async play(): Promise<void> {
    await this.video?.play();
  }

  pause(): void {
    this.video?.pause();
  }

  seek(time: number): void {
    if (!this.video) return;
    // 边界校验
    const seekable = this.video.seekable;
    if (seekable.length > 0) {
      const start = seekable.start(0);
      const end = seekable.end(seekable.length - 1);
      time = Math.max(start, Math.min(end, time));
    } else if (isFinite(this.video.duration) && this.video.duration > 0) {
      time = Math.max(0, Math.min(this.video.duration, time));
    }
    this.video.currentTime = time;
  }

  switchSource(url: string, options?: Record<string, unknown>): void {
    super.switchSource(url, options);
    if (this.video) {
      this.video.src = url;
      this.video.play().catch(() => {});
    }
  }

  destroy(): void {
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      // 不调用 load()，保留最后一帧避免切频道时闪黑屏
    }
    this.detach();
  }
}
