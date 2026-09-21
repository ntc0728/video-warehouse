/**
 * IPTV 取流链单测 —— 代理列表归一 / 代理轮换 / 单源多代理兜底 / 竞速窗口 / 跨源合并。
 *
 * 为什么走公开 API（fetchAndParsePlaylist）而不直接测内部函数：
 * `settleWithWindow`(iptvService.ts:493) 与 `fetchWithProxyFallback`(:417) 均未导出，但都被
 * fetchAndParsePlaylist(:571) 消费；二者的网络出口只有 httpClient.getText(:11,45) 一处，
 * mock 该模块即可从外部精确观测「1500ms 收尾窗口 / 8000ms 兜底 / 放弃等待 ≠ 真实失败 /
 * 多代理逐个兜底顺序」——**无需为可测性给 src 加 export**（加 export 属 src 改动，按
 * docs/agents/testing.md:199 的分级门禁会触发全量 E2E，纯测试补充不值这个代价）。
 *
 * 刻意不写的用例：窗口关闭后的 late-fulfill/late-reject「不覆写」由 :525/:534 的 done 守卫实现，
 * 但它发生在上层已消费完返回数组之后 → 对外不可观测，写了也只能是恒过用例（假绿）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./httpClient', () => ({ getText: vi.fn() }));

import { getText } from './httpClient';
import {
  fetchAndParsePlaylist,
  getIptvProxyList,
  getActiveIptvProxy,
  advanceIptvProxy,
  buildSourceProxyUrlWith,
} from './iptvService';
import { PlaylistSourceType } from '@/types/iptv';

const mockGetText = vi.mocked(getText);

/** 单频道 M3U（分组固定，便于断言去重口径 name+group） */
const m3u = (name: string, group = '央视') =>
  `#EXTM3U\n#EXTINF:-1 group-title="${group}",${name}\nhttp://cdn.example.com/${name}.m3u8`;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  mockGetText.mockReset();
});

describe('getIptvProxyList（代理列表归一）', () => {
  it('按 ; 分隔，去首尾空白 / 空段 / 尾部斜杠', () => {
    expect(getIptvProxyList(' https://p1.dev/ ; https://p2.dev ;; https://p3.dev// ')).toEqual([
      'https://p1.dev',
      'https://p2.dev',
      'https://p3.dev',
    ]);
  });

  it('未配置 / 空串返回空列表', () => {
    expect(getIptvProxyList(undefined)).toEqual([]);
    expect(getIptvProxyList('')).toEqual([]);
    expect(getIptvProxyList('  ;  ')).toEqual([]);
  });
});

describe('advanceIptvProxy（仅确认当前代理不可用时推进）', () => {
  it('推进到下一个代理并在列表内循环', () => {
    const cfg = 'https://p1.dev;https://p2.dev;https://p3.dev';
    const start = getActiveIptvProxy(cfg);
    const next = advanceIptvProxy(cfg);
    expect(next).not.toBe(start);
    expect(getActiveIptvProxy(cfg)).toBe(next);
    advanceIptvProxy(cfg);
    expect(advanceIptvProxy(cfg)).toBe(start); // 推满一轮（3 个）回到起点
  });

  it('单代理 / 未配置时为 no-op', () => {
    expect(advanceIptvProxy('https://only.dev/')).toBe('https://only.dev');
    expect(advanceIptvProxy(undefined)).toBe('');
    expect(advanceIptvProxy('')).toBe('');
  });
});

describe('buildSourceProxyUrlWith（源接口强制走 /m3u8-proxy）', () => {
  it('未配置代理时原样返回（直连兜底）', () => {
    expect(buildSourceProxyUrlWith('http://src/live.m3u8', '')).toBe('http://src/live.m3u8');
  });

  it('拼接 /m3u8-proxy?url= 并对内层 URL 编码', () => {
    expect(buildSourceProxyUrlWith('http://src/live.m3u8', 'https://p1.dev')).toBe(
      `https://p1.dev/m3u8-proxy?url=${encodeURIComponent('http://src/live.m3u8')}`
    );
  });

  it('已被「别的代理」包装过的地址先解包再包装（避免代理嵌套）', () => {
    const inner = 'http://src/live.m3u8';
    const thirdPartyWrapped = `https://other.dev/m3u8-proxy?url=${encodeURIComponent(inner)}`;
    expect(buildSourceProxyUrlWith(thirdPartyWrapped, 'https://p1.dev')).toBe(
      `https://p1.dev/m3u8-proxy?url=${encodeURIComponent(inner)}`
    );
  });
});

describe('fetchAndParsePlaylist · 单源多代理兜底链', () => {
  it('主代理失败 → 按配置顺序切备用代理（首个成功即返回）', async () => {
    const calls: string[] = [];
    mockGetText.mockImplementation(async (url: string) => {
      calls.push(url);
      if (url.startsWith('https://p1.dev')) throw new Error('p1 不可用');
      return m3u('CCTV1');
    });

    const res = await fetchAndParsePlaylist({
      aggregatorUrls: ['http://src/a.m3u8'],
      proxyUrl: 'https://p1.dev;https://p2.dev',
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('https://p1.dev/m3u8-proxy?url=');
    expect(calls[1]).toContain('https://p2.dev/m3u8-proxy?url=');
    expect(res.channels.map((c) => c.name)).toEqual(['CCTV1']);
    expect(res.sourceErrors).toEqual([]);
  });

  it('全部代理失败 → 计入 sourceErrors，错误信息取最后一个代理的错误', async () => {
    mockGetText.mockImplementation(async (url: string) => {
      throw new Error(url.startsWith('https://p1') ? 'p1 不可用' : 'p2 不可用');
    });

    const res = await fetchAndParsePlaylist({
      aggregatorUrls: ['http://src/a.m3u8'],
      proxyUrl: 'https://p1.dev;https://p2.dev',
    });

    expect(res.channels).toEqual([]);
    expect(res.sourceErrors).toEqual([{ index: 0, url: 'http://src/a.m3u8', error: 'p2 不可用' }]);
  });

  it('未配置代理时直连，且请求口径固定为 6s 超时 / 不重试', async () => {
    mockGetText.mockResolvedValue(m3u('CCTV1'));

    await fetchAndParsePlaylist({ aggregatorUrls: ['http://src/a.m3u8'] });

    expect(mockGetText).toHaveBeenCalledWith('http://src/a.m3u8', { timeout: 6000, retries: 0 });
  });
});

describe('fetchAndParsePlaylist · 竞速窗口（首个成功 + 1.5s 收尾 / 8s 兜底）', () => {
  it('首个成功到达后 1500ms 内到达的慢源仍被合并', async () => {
    vi.useFakeTimers();
    const slow = deferred<string>();
    mockGetText.mockImplementation(async (url: string) =>
      url.includes('slow') ? slow.promise : m3u('FAST')
    );

    const pending = fetchAndParsePlaylist({
      aggregatorUrls: ['http://src/fast.m3u8', 'http://src/slow.m3u8'],
    });
    await vi.advanceTimersByTimeAsync(0); // 快源落地，收尾窗口启动
    slow.resolve(m3u('SLOW'));
    await vi.advanceTimersByTimeAsync(1500);

    const res = await pending;
    expect(res.channels.map((c) => c.name).sort()).toEqual(['FAST', 'SLOW']);
    expect(res.sourceErrors).toEqual([]);
    expect(Object.keys(res.bySource).sort()).toEqual(['source-0', 'source-1']);
  });

  it('未完成源在窗口关闭时被放弃：不计入 sourceErrors（放弃 ≠ 真实失败）', async () => {
    vi.useFakeTimers();
    const never = deferred<string>();
    mockGetText.mockImplementation(async (url: string) =>
      url.includes('never') ? never.promise : m3u('FAST')
    );

    const pending = fetchAndParsePlaylist({
      aggregatorUrls: ['http://src/fast.m3u8', 'http://src/never.m3u8'],
    });
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1499);
    expect(settled).toBe(false); // 窗口未到点，不提前返回

    await vi.advanceTimersByTimeAsync(1);
    const res = await pending;

    expect(res.sourceErrors).toEqual([]);
    expect(res.channels.map((c) => c.name)).toEqual(['FAST']);
    expect(res.bySource['source-1']).toBeUndefined();
  });

  it('零成功源时走 8000ms 绝对兜底（不无限拖尾），真实失败照常上报', async () => {
    vi.useFakeTimers();
    const never = deferred<string>();
    mockGetText.mockImplementation(async (url: string) => {
      if (url.includes('never')) return never.promise;
      throw new Error('源站 500');
    });

    const pending = fetchAndParsePlaylist({
      aggregatorUrls: ['http://src/bad.m3u8', 'http://src/never.m3u8'],
    });
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(7999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const res = await pending;

    expect(res.channels).toEqual([]);
    expect(res.sourceErrors).toEqual([{ index: 0, url: 'http://src/bad.m3u8', error: '源站 500' }]);
  });

  it('所有源都已在窗口内 settle 时立即返回，不空等收尾窗口', async () => {
    vi.useFakeTimers();
    mockGetText.mockImplementation(async (url: string) => {
      if (url.includes('bad')) throw new Error('源站 500');
      return m3u('CCTV1');
    });

    const pending = fetchAndParsePlaylist({
      aggregatorUrls: ['http://src/a.m3u8', 'http://src/bad.m3u8'],
    });
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true); // 未推进到 1500ms 就已返回

    const res = await pending;
    expect(res.channels.map((c) => c.name)).toEqual(['CCTV1']);
    expect(res.sourceErrors).toHaveLength(1);
  });
});

describe('fetchAndParsePlaylist · 跨源合并口径', () => {
  it('id 带源序号前缀、标注 sourceId、跨源同名同组去重、bySource 保留源自身频道', async () => {
    mockGetText.mockImplementation(async (url: string) =>
      url.includes('/a.') ? m3u('CCTV1') : `${m3u('CCTV1')}\n${m3u('CCTV5')}`
    );

    const res = await fetchAndParsePlaylist({
      aggregatorUrls: ['http://src/a.m3u8', 'http://src/b.m3u8'],
    });

    // 跨源去重后只保留先到的 source-0 的 CCTV1
    expect(res.channels.map((c) => c.id)).toEqual(['0-channel-0', '1-channel-1']);
    expect(res.channels.map((c) => c.sourceId)).toEqual(['source-0', 'source-1']);
    expect(res.sourceType).toBe(PlaylistSourceType.MULTI_CHANNEL);
    // 「更多台」数据源：按源保留自身全部频道（仅源内去重）
    expect(res.bySource['source-0']).toHaveLength(1);
    expect(res.bySource['source-1']).toHaveLength(2);
    expect(res.sourceErrors).toEqual([]);
  });

  it('未配置任何源时直接抛错（不静默返回空列表）', async () => {
    await expect(fetchAndParsePlaylist({ aggregatorUrls: [] })).rejects.toThrow('IPTV 源未配置');
    expect(mockGetText).not.toHaveBeenCalled();
  });
});
