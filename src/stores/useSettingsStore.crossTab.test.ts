import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 解密按载荷里的 ms 延迟完成：用于构造「旧载荷后完成」的乱序场景。
 * 加密只做恒等映射（合并路径不消费密文格式）。
 */
vi.mock('@/lib/crypto', () => ({
  encryptText: vi.fn(async (plain: string) => plain),
  decryptText: vi.fn(async (cipher: string) => {
    const { value, ms } = JSON.parse(cipher) as { value: string; ms: number };
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    return value;
  }),
}));

import { mergeSettingsFromCrossTab, useSettingsStore } from './useSettingsStore';

/** 构造另一页签写入的持久化载荷（state 里敏感字段是密文 -> 解密成 value） */
function payload(theme: string, token: string, decryptMs: number, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    state: {
      theme,
      tmdbAccessToken: JSON.stringify({ value: token, ms: decryptMs }),
      ...extra,
    },
  });
}

describe('mergeSettingsFromCrossTab（跨页签设置合并）', () => {
  beforeEach(() => {
    useSettingsStore.setState({ theme: 'system', tvMode: false, tmdbAccessToken: '' });
  });

  it('按到达顺序合并：后到的载荷生效', async () => {
    await mergeSettingsFromCrossTab(payload('dark', 'tok-1', 0));
    expect(useSettingsStore.getState().theme).toBe('dark');

    await mergeSettingsFromCrossTab(payload('light', 'tok-2', 0));
    expect(useSettingsStore.getState().theme).toBe('light');
    expect(useSettingsStore.getState().tmdbAccessToken).toBe('tok-2');
  });

  it('解密乱序完成时，旧载荷不得覆盖新载荷（旧的后完成也要丢弃）', async () => {
    // 旧载荷解密慢 60ms，新载荷立即完成 —— 无代际闸门时旧值会最后写回
    const oldMerge = mergeSettingsFromCrossTab(payload('dark', 'tok-old', 60));
    const newMerge = mergeSettingsFromCrossTab(payload('light', 'tok-new', 0));

    await Promise.all([oldMerge, newMerge]);

    expect(useSettingsStore.getState().theme).toBe('light');
    expect(useSettingsStore.getState().tmdbAccessToken).toBe('tok-new');
  });

  it('播放布局类键（tvMode）不参与跨页签同步', async () => {
    useSettingsStore.setState({ tvMode: true });

    await mergeSettingsFromCrossTab(payload('light', 'tok-3', 0, { tvMode: false }));

    expect(useSettingsStore.getState().theme).toBe('light');
    expect(useSettingsStore.getState().tvMode).toBe(true);
  });
});
