import { describe, expect, it, vi } from 'vitest';
import { reviveFrozenVideo } from './usePlayerCore';

describe('reviveFrozenVideo（Issue2 解冻）', () => {
  function makeVideo(partial: Partial<HTMLVideoElement> = {}): Partial<HTMLVideoElement> & {
    style: { display: string };
    currentTime: number;
    duration: number;
    _actions: string[];
  } {
    const el = {
      style: { display: '' },
      currentTime: 10,
      duration: 100,
      _actions: [],
      ...partial,
    };
    // 让 style.display 赋值可观测
    return el;
  }

  it('直播流走 display 翻转重建（不 seek），返回 rebuild-layer', () => {
    const v = makeVideo({ duration: Infinity });
    const result = reviveFrozenVideo(v as unknown as HTMLVideoElement, true);
    expect(result).toBe('rebuild-layer');
    expect(v.style.display).toBe('none'); // 触发重建；rAF 回调用 setTimeout 模拟
  });

  it('点播且 currentTime 可微推 → 走 seek-nudge，先推 +0.1s', () => {
    const v = makeVideo({ currentTime: 30, duration: 200 });
    const result = reviveFrozenVideo(v as unknown as HTMLVideoElement, false);
    expect(result).toBe('seek-nudge');
    expect(v.currentTime).toBe(30.1);
  });

  it('currentTime=0 不可微推 → 退回 display 翻转', () => {
    const v = makeVideo({ currentTime: 0, duration: 200 });
    const result = reviveFrozenVideo(v as unknown as HTMLVideoElement, false);
    expect(result).toBe('rebuild-layer');
    expect(v.style.display).toBe('none');
    expect(v.currentTime).toBe(0); // 未 seek
  });

  it('rVFC 可用时：新帧提交触发立即恢复原位置', () => {
    const v = makeVideo({ currentTime: 50, duration: 200 });
    let frameCallback: (() => void) | null = null;
    Object.assign(v, {
      requestVideoFrameCallback: (cb: () => void) => {
        frameCallback = cb;
        return 42;
      },
    });
    reviveFrozenVideo(v as unknown as HTMLVideoElement, false);
    expect(v.currentTime).toBe(50.1); // 先微推

    // 模拟 rVFC 回调（新帧提交）
    frameCallback?.();
    expect(v.currentTime).toBe(50); // 立即恢复原位置
  });
});
