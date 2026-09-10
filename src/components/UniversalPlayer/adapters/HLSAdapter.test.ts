/**
 * HLSAdapter D1 裸流识别单元测试
 *
 * 覆盖：manifestParsingError（内容非 HLS 清单）→ 上报带 BARE_STREAM 标记的错误；
 *       manifestLoadError（网络层失败）→ 维持「频道源不可用」不带标记（走 A3 兜底）。
 * 通过 mock hls.js 动态 import，验证 hls.js ERROR 事件到 onError 的映射。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HLSAdapter, ERROR_CODE_BARE_STREAM } from './HLSAdapter';

/* ─── Mock hls.js（vi.hoisted 供 vi.mock 工厂引用） ─── */

const hls = vi.hoisted(() => {
  const instance = {
    on: vi.fn(),
    startLoad: vi.fn(),
    loadSource: vi.fn(),
    attachMedia: vi.fn(),
    destroy: vi.fn(),
    levels: [],
    audioTracks: [],
    maxBufferLength: 0,
    maxMaxBufferLength: 0,
    backBufferLength: 0,
  };
  // 必须用纯 function 而非 vi.fn 包装：vitest 对 `new vi.fn(...)` 一律返回通用 mock
  // 实例（事件注册会落到错误对象上导致 "ERROR handler not registered"）。
  // 纯 function + 显式返回对象，`new` 语义返回闭包内的 instance，可靠复现 hls.js 实例。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctor = function hlsCtor(): any {
    return instance;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctor as any).isSupported = () => true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctor as any).Events = {
    LEVEL_LOADED: 'LEVEL_LOADED',
    MANIFEST_PARSED: 'MANIFEST_PARSED',
    LEVEL_SWITCHED: 'LEVEL_SWITCHED',
    FRAG_LOADED: 'FRAG_LOADED',
    ERROR: 'ERROR',
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctor as any).ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };
  return { ctor, instance };
});

vi.mock('hls.js', () => ({ default: hls.ctor }));

/* ─── Mock PerformanceObserver（BasePlayerAdapter estimator.start 依赖） ─── */

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as unknown as { PerformanceObserver: unknown }).PerformanceObserver = class {
    observe(): void {}
    disconnect(): void {}
  };
  hls.instance.on.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** 获取 hls 实例上注册的 ERROR 事件处理函数 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getErrorHandler(): (event: unknown, data: any) => void {
  const call = hls.instance.on.mock.calls.find((c: unknown[]) => c[0] === 'ERROR');
  if (!call) throw new Error('ERROR handler not registered');
  return call[1] as (event: unknown, data: { fatal?: boolean; type?: string; details?: string }) => void;
}

/** 挂载 adapter 并等待 hls.js 动态 import / 初始化完成 */
async function mountAdapter(onError: (error: Error) => void) {
  const adapter = new HLSAdapter('http://example.com/live', { onError });
  const video = document.createElement('video');
  adapter.attach(video);
  // 等待 initHls 的异步动态 import 与事件注册完成
  await new Promise((resolve) => setTimeout(resolve, 0));
  // 确认走了 hls.js（mock）分支并完成事件注册（而非原生 HLS / isSupported 失败分支）
  expect(hls.instance.on).toHaveBeenCalled();
  return adapter;
}

describe('HLSAdapter D1 裸流识别', () => {
  it('manifestParsingError → 上报 BARE_STREAM 标记错误（裸流信号）', async () => {
    const onError = vi.fn();
    const adapter = await mountAdapter(onError);
    getErrorHandler()({}, { fatal: true, type: 'networkError', details: 'manifestParsingError' });
    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0] as Error & { code?: string };
    expect(err.code).toBe(ERROR_CODE_BARE_STREAM);
    adapter.destroy();
  });

  it('manifestLoadError → 维持「频道源不可用」且不带 BARE_STREAM（走 A3 兜底）', async () => {
    const onError = vi.fn();
    const adapter = await mountAdapter(onError);
    getErrorHandler()({}, { fatal: true, type: 'networkError', details: 'manifestLoadError' });
    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0] as Error & { code?: string };
    expect(err.message).toBe('频道源不可用');
    expect(err.code).toBeUndefined();
    adapter.destroy();
  });
});

describe('HLSAdapter 切源与初始化竞态', () => {
  it('initHls 未落定（动态 import 期间）切源不得落回原生分支', async () => {
    hls.instance.loadSource.mockClear();
    const adapter = new HLSAdapter('http://example.com/a.m3u8', { onError: vi.fn() });
    const video = document.createElement('video');
    adapter.attach(video);

    // 此刻动态 import 尚未 resolve，this.hls 仍为 null
    adapter.switchSource('http://example.com/b.m3u8');
    // 关键断言：不能走原生分支给 video.src 赋值——桌面 Chrome / Android WebView 上
    // 原生分支正是 net::ERR_CONTENT_DECODING_FAILED 的失败路径
    expect(video.src).toBe('');

    // 等动态 import 与事件注册完成，新源应已交给 hls.js
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hls.instance.loadSource).toHaveBeenCalledWith('http://example.com/b.m3u8');
    adapter.destroy();
  });

  it('初始化落定后切源由 hls.js 接管', async () => {
    const adapter = await mountAdapter(vi.fn());
    hls.instance.loadSource.mockClear();
    adapter.switchSource('http://example.com/c.m3u8');
    expect(hls.instance.loadSource).toHaveBeenCalledWith('http://example.com/c.m3u8');
    adapter.destroy();
  });
});
