/**
 * usePlayerStore 单元测试
 *
 * 覆盖：播放器核心状态管理（音量/倍速/解码/清晰度/循环/镜像/比例）、
 *       reset 与 resetRuntime 的语义区分（保留用户偏好 vs 全量重置）、
 *       updateSubtitleSettings 合并、persist 仅持久化用户偏好。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { usePlayerStore } from './usePlayerStore';

describe('usePlayerStore', () => {
  beforeEach(() => {
    localStorage.clear();
    usePlayerStore.getState().reset();
  });

  afterEach(() => {
    localStorage.clear();
    usePlayerStore.getState().reset();
  });

  it('setSource / setPlaying / setProgress 基础状态', () => {
    usePlayerStore.getState().setSource('http://example.com/v.m3u8', 'm3u8');
    usePlayerStore.getState().setPlaying(true);
    usePlayerStore.getState().setProgress(42);
    const s = usePlayerStore.getState();
    expect(s.currentSrc).toBe('http://example.com/v.m3u8');
    expect(s.currentType).toBe('m3u8');
    expect(s.isPlaying).toBe(true);
    expect(s.progress).toBe(42);
  });

  it('音量 / 倍速 / 解码模式持久化偏好', () => {
    usePlayerStore.getState().setVolume(0.6);
    usePlayerStore.getState().setPlaybackRate(1.5);
    usePlayerStore.getState().setDecoderMode('wasm');
    const s = usePlayerStore.getState();
    expect(s.volume).toBe(0.6);
    expect(s.playbackRate).toBe(1.5);
    expect(s.decoderMode).toBe('wasm');
  });

  it('清晰度 levels / currentLevel / 音频轨', () => {
    usePlayerStore.getState().setLevels([
      { width: 1920, height: 1080, bitrate: 5000, name: '1080p' },
      { width: 1280, height: 720, bitrate: 2500, name: '720p' },
    ]);
    usePlayerStore.getState().setCurrentLevel(0);
    usePlayerStore.getState().setAudioTracks([{ id: 0, name: '国语', language: 'zh', default: true }]);
    usePlayerStore.getState().setCurrentAudioTrack(0);
    const s = usePlayerStore.getState();
    expect(s.levels).toHaveLength(2);
    expect(s.levels[0].name).toBe('1080p');
    expect(s.currentLevel).toBe(0);
    expect(s.currentAudioTrack).toBe(0);
  });

  it('updateSubtitleSettings 只合并传入字段', () => {
    usePlayerStore.getState().updateSubtitleSettings({ fontSize: 30 });
    const s = usePlayerStore.getState();
    expect(s.subtitleSettings.fontSize).toBe(30);
    expect(s.subtitleSettings.fontColor).toBe('#ffffff'); // 未改字段保留
  });

  it('循环 / 镜像 / 宽高比 / PiP', () => {
    usePlayerStore.getState().setLoopMode('list');
    usePlayerStore.getState().setMirror(true);
    usePlayerStore.getState().setAspectRatio('16:9');
    usePlayerStore.getState().setIsPiP(true);
    const s = usePlayerStore.getState();
    expect(s.loopMode).toBe('list');
    expect(s.mirror).toBe(true);
    expect(s.aspectRatio).toBe('16:9');
    expect(s.isPiP).toBe(true);
  });

  it('reset 重置所有状态（含用户偏好）', () => {
    usePlayerStore.getState().setVolume(0.3);
    usePlayerStore.getState().setPlaybackRate(2);
    usePlayerStore.getState().setDecoderMode('wasm');
    usePlayerStore.getState().setSource('http://x.com/v.m3u8', 'm3u8');
    usePlayerStore.getState().reset();
    const s = usePlayerStore.getState();
    expect(s.volume).toBe(1);
    expect(s.playbackRate).toBe(1);
    expect(s.decoderMode).toBe('native');
    expect(s.currentSrc).toBeNull();
  });

  it('resetRuntime 保留用户偏好、清空运行时状态', () => {
    // 设置用户偏好
    usePlayerStore.getState().setVolume(0.4);
    usePlayerStore.getState().setPlaybackRate(1.25);
    usePlayerStore.getState().setDecoderMode('wasm');
    // 设置运行时状态
    usePlayerStore.getState().setSource('http://x.com/v.m3u8', 'm3u8');
    usePlayerStore.getState().setPlaying(true);
    usePlayerStore.getState().setProgress(80);
    usePlayerStore.getState().setIsPiP(true);

    usePlayerStore.getState().resetRuntime();
    const s = usePlayerStore.getState();
    // 运行时清空
    expect(s.currentSrc).toBeNull();
    expect(s.isPlaying).toBe(false);
    expect(s.progress).toBe(0);
    expect(s.isPiP).toBe(false);
    // 用户偏好保留
    expect(s.volume).toBe(0.4);
    expect(s.playbackRate).toBe(1.25);
    expect(s.decoderMode).toBe('wasm');
  });

  it('persist 仅持久化用户偏好（partialize），运行时字段不入 localStorage', async () => {
    usePlayerStore.getState().setSource('http://x.com/run.m3u8', 'm3u8');
    usePlayerStore.getState().setPlaying(true);
    usePlayerStore.getState().setVolume(0.55);
    // persist 写入是同步的（partialize 同步），但为保险等待一帧
    await new Promise((r) => setTimeout(r, 100));
    const raw = localStorage.getItem('player-store');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { state: Record<string, unknown> };
    expect(parsed.state.volume).toBe(0.55);
    // 运行时字段不持久化
    expect(parsed.state.currentSrc).toBeUndefined();
    expect(parsed.state.isPlaying).toBeUndefined();
  });
});
