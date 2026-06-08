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
    if (this.video) this.video.currentTime = time;
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
