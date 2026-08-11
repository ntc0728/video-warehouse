/**
 * sourceService 并发去重与缓存单测
 * 覆盖：in-flight promise 共享（并发调用只发一次 fetch，修复「多页面同时获取
 * sources.json」的重复请求）、完成态缓存命中、失败后可重试、附加源合成
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock HTTP 客户端（getJSON 调用次数即 fetch 次数）。
// 用 vi.hoisted 固定 mock 实例：vi.resetModules 后模块重新加载时，mock 工厂
// 若重新执行会创建新 vi.fn()，导致 sourceService 实际调用与断言对象错位。
const { getJSON } = vi.hoisted(() => ({ getJSON: vi.fn() }));
vi.mock('./httpClient', () => ({ getJSON }));

// 每次用例重新加载模块，隔离模块级缓存 / in-flight promise 状态
let loadService: () => Promise<typeof import('./sourceService')>;

beforeEach(async () => {
  vi.resetModules();
  getJSON.mockReset();
  loadService = () => import('./sourceService');
});

describe('getVideoSources', () => {
  it('并发调用共享同一 in-flight fetch（只发一次请求）', async () => {
    getJSON.mockImplementation(async () => ({ api_site: { a: { name: 'A', api: 'x' } } }));
    const svc = await loadService();
    const [r1, r2] = await Promise.all([svc.getVideoSources(), svc.getVideoSources()]);
    expect(getJSON).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it('完成态缓存：后续调用不再请求', async () => {
    getJSON.mockImplementation(async () => ({ api_site: { a: { name: 'A', api: 'x' } } }));
    const svc = await loadService();
    await svc.getVideoSources();
    await svc.getVideoSources();
    await svc.getVideoSources();
    expect(getJSON).toHaveBeenCalledTimes(1);
  });

  it('失败后可重试（不缓存失败结果）', async () => {
    getJSON.mockRejectedValueOnce(new Error('network'));
    getJSON.mockResolvedValueOnce({ api_site: { a: { name: 'A', api: 'x' } } });
    const svc = await loadService();
    const r1 = await svc.getVideoSources();
    expect(r1).toEqual([]); // 失败时返回空（仅附加源）
    const r2 = await svc.getVideoSources();
    expect(getJSON).toHaveBeenCalledTimes(2);
    expect(r2).toHaveLength(1);
  });

  it('附加源合成：内置源 + custom 源', async () => {
    getJSON.mockResolvedValue({ api_site: { a: { name: 'A', api: 'x' } } });
    const svc = await loadService();
    svc.setAttachedSources('video', [{ id: 'c1', name: 'C1', api: 'y', detail: '' }]);
    const r = await svc.getVideoSources();
    expect(r.map((s) => s.id)).toEqual(['a', 'c1']);
  });
});

describe('getIPTVSources', () => {
  it('并发调用共享同一 in-flight fetch', async () => {
    getJSON.mockImplementation(async () => [{ name: 'S1', url: 'http://x.m3u' }]);
    const svc = await loadService();
    const [r1, r2] = await Promise.all([svc.getIPTVSources(), svc.getIPTVSources()]);
    expect(getJSON).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });
});
