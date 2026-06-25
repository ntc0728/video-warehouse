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

  destroy(): void {
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
    }
    this.detach();
  }
}
