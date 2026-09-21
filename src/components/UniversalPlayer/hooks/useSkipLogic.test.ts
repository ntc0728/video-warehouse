/**
 * useSkipLogic 单测 —— 跳过片头/片尾的边界与幂等。
 *
 * 该 hook 已导出且直接返回 hasSkippedIntroRef/hasSkippedOutroRef，所以**无需为可测性抽纯函数**
 * （抽函数＝改播放链结构，属行为类改动，会触发全量 E2E 门禁）。这里用最小 video 替身即可覆盖全部分支：
 *  - 跳片头条件（useSkipLogic.ts:17）：`skipIntro && !已跳 && ct < 阈值 && ct > 0.5`
 *  - 跳片尾条件（:30）：`skipOutro && !已跳 && ct > dur - 阈值 && ct < dur - 1`
 *
 * useSettingsStore 用最小替身 mock（hook 只读 getState()），避免连带加载 settings 的持久化/加密存储。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const h = vi.hoisted(() => ({
  settings: {
    skipIntro: false,
    skipOutro: false,
    skipIntroDuration: 90,
    skipOutroDuration: 90,
  },
}));

vi.mock('@/stores', () => ({
  useSettingsStore: { getState: () => h.settings },
}));

import { useSkipLogic } from './useSkipLogic';

function makeVideo(currentTime: number, duration = 100) {
  const pause = vi.fn();
  const video = { currentTime, duration, pause } as unknown as HTMLVideoElement;
  return { video, pause };
}

function setup() {
  const onSkipIntro = vi.fn();
  const onSkipOutro = vi.fn();
  const onEnded = vi.fn();
  const { result } = renderHook(() => useSkipLogic({ onSkipIntro, onSkipOutro, onEnded }));
  return { result, onSkipIntro, onSkipOutro, onEnded };
}

beforeEach(() => {
  h.settings = {
    skipIntro: false,
    skipOutro: false,
    skipIntroDuration: 90,
    skipOutroDuration: 90,
  };
});

describe('checkSkipIntro · 跳过片头', () => {
  it('开关关闭时不跳', () => {
    const { result, onSkipIntro } = setup();
    const { video } = makeVideo(1);

    expect(result.current.checkSkipIntro(video)).toBe(false);
    expect(video.currentTime).toBe(1);
    expect(onSkipIntro).not.toHaveBeenCalled();
  });

  it('播放时间不足 0.5s 时不跳（边界闭合：必须 ct > 0.5）', () => {
    h.settings.skipIntro = true;
    const { result, onSkipIntro } = setup();

    for (const ct of [0, 0.4, 0.5]) {
      const { video } = makeVideo(ct);
      expect(result.current.checkSkipIntro(video)).toBe(false);
      expect(video.currentTime).toBe(ct);
    }
    expect(onSkipIntro).not.toHaveBeenCalled();
  });

  it('越过 0.5s 且未到阈值 → 直接 seek 到阈值并回调一次', () => {
    h.settings.skipIntro = true;
    const { result, onSkipIntro } = setup();
    const { video } = makeVideo(0.6);

    expect(result.current.checkSkipIntro(video)).toBe(true);
    expect(video.currentTime).toBe(90);
    expect(onSkipIntro).toHaveBeenCalledTimes(1);
  });

  it('已到/超过阈值不再跳（避免回跳）', () => {
    h.settings.skipIntro = true;
    const { result } = setup();

    for (const ct of [90, 91.5]) {
      const { video } = makeVideo(ct);
      expect(result.current.checkSkipIntro(video)).toBe(false);
      expect(video.currentTime).toBe(ct);
    }
  });

  it('单次会话内只跳一次（幂等）', () => {
    h.settings.skipIntro = true;
    const { result, onSkipIntro } = setup();

    expect(result.current.checkSkipIntro(makeVideo(1).video)).toBe(true);
    expect(result.current.checkSkipIntro(makeVideo(1).video)).toBe(false);
    expect(onSkipIntro).toHaveBeenCalledTimes(1);
  });

  it('reset() 后可再次跳（切源/切集语义）', () => {
    h.settings.skipIntro = true;
    const { result, onSkipIntro } = setup();

    expect(result.current.checkSkipIntro(makeVideo(1).video)).toBe(true);
    result.current.reset();
    expect(result.current.checkSkipIntro(makeVideo(1).video)).toBe(true);
    expect(onSkipIntro).toHaveBeenCalledTimes(2);
  });

  it('阈值为 0 等非正配置时不跳（不 seek 回 0）', () => {
    h.settings.skipIntro = true;
    h.settings.skipIntroDuration = 0;
    const { result, onSkipIntro } = setup();
    const { video } = makeVideo(5);

    expect(result.current.checkSkipIntro(video)).toBe(false);
    expect(video.currentTime).toBe(5);
    expect(onSkipIntro).not.toHaveBeenCalled();
  });
});

describe('checkSkipOutro · 跳过片尾', () => {
  it('进入片尾区间 → 暂停并触发 onSkipOutro / onEnded', () => {
    h.settings.skipOutro = true;
    const { result, onSkipOutro, onEnded } = setup();
    const { video, pause } = makeVideo(50, 100); // 100 - 90 < 50 < 100 - 1

    expect(result.current.checkSkipOutro(video)).toBe(true);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(onSkipOutro).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('区间边界外不跳（ct === dur-1 与 ct === dur-阈值 均不触发）', () => {
    h.settings.skipOutro = true;
    const { result, onSkipOutro } = setup();

    for (const ct of [10, 99, 99.9]) {
      const { video } = makeVideo(ct, 100);
      expect(result.current.checkSkipOutro(video)).toBe(false);
    }
    expect(onSkipOutro).not.toHaveBeenCalled();
  });

  it('片头/片尾开关彼此独立', () => {
    h.settings.skipIntro = false;
    h.settings.skipOutro = true;
    const { result, onSkipIntro, onSkipOutro } = setup();

    expect(result.current.checkSkipIntro(makeVideo(1).video)).toBe(false);
    expect(result.current.checkSkipOutro(makeVideo(50, 100).video)).toBe(true);
    expect(onSkipIntro).not.toHaveBeenCalled();
    expect(onSkipOutro).toHaveBeenCalledTimes(1);
  });

  it('片尾只触发一次（幂等）', () => {
    h.settings.skipOutro = true;
    const { result, onEnded } = setup();

    expect(result.current.checkSkipOutro(makeVideo(50, 100).video)).toBe(true);
    expect(result.current.checkSkipOutro(makeVideo(50, 100).video)).toBe(false);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });
});
