import { describe, expect, it } from 'vitest';
import { reviveFrozenVideo } from './usePlayerCore';

describe('reviveFrozenVideo（Issue2 解冻）', () => {
  function makeVideo(): HTMLVideoElement {
    const el = document.createElement('video');
    Object.defineProperty(el, 'duration', { value: 100, configurable: true });
    return el;
  }

  it('直播流走 display 翻转重建（不 seek），返回 rebuild-layer', () => {
    const v = makeVideo();
    v.currentTime = 10;
    const result = reviveFrozenVideo(v, true);
    expect(result).toBe('rebuild-layer');
    expect(v.style.display).toBe('none'); // 触发重建；还原由 rAF 回调完成
    expect(v.currentTime).toBe(10); // 未 seek
  });

  it('点播且 currentTime 可微推 → 走 seek-nudge，先推 +0.1s', () => {
    const v = makeVideo();
    v.currentTime = 30;
    const result = reviveFrozenVideo(v, false);
    expect(result).toBe('seek-nudge');
    expect(v.currentTime).toBeCloseTo(30.1, 5);
    expect(v.style.display).toBe(''); // 未动 display
  });

  it('currentTime=0 不可微推 → 退回 display 翻转且不 seek', () => {
    const v = makeVideo();
    v.currentTime = 0;
    const result = reviveFrozenVideo(v, false);
    expect(result).toBe('rebuild-layer');
    expect(v.style.display).toBe('none');
    expect(v.currentTime).toBe(0);
  });

  it('rVFC 可用时：新帧提交触发立即恢复原位置', () => {
    const v = makeVideo();
    v.currentTime = 50;
    const callbacks: Array<() => void> = [];
    (v as unknown as {
      requestVideoFrameCallback: (cb: () => void) => number;
    }).requestVideoFrameCallback = (cb: () => void) => {
      callbacks.push(cb);
      return 42;
    };
    reviveFrozenVideo(v, false);
    expect(v.currentTime).toBeCloseTo(50.1, 5); // 先微推

    callbacks[0]?.(); // 模拟 rVFC 回调（新帧提交）
    expect(v.currentTime).toBe(50); // 立即恢复原位置
  });
});
