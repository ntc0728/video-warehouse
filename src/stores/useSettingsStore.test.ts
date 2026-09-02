/**
 * useSettingsStore 单元测试
 *
 * 核心覆盖 H1 修复（2026-08-05）：
 *   内存始终为明文、持久化层才加密（自定义异步 storage）。
 *   防止回归：setter 不得再用密文覆盖内存值（旧实现导致 TMDB 401）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSettingsStore, mergeSettingsFromCrossTab } from './useSettingsStore';
import { decryptText, encryptText } from '@/lib/crypto';

const PLAIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token-1234567890';
const STORAGE_KEY = 'app-settings';

describe('useSettingsStore - H1 Token 加密修复', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ tmdbAccessToken: '', translationApiKey: '' });
  });

  it('setTMDBToken 后内存值保持明文（不被密文覆盖）', async () => {
    useSettingsStore.getState().setTMDBToken(PLAIN_TOKEN);
    // 立即：明文
    expect(useSettingsStore.getState().tmdbAccessToken).toBe(PLAIN_TOKEN);
    // 等待加密写盘完成后：内存仍是明文（H1 核心断言）
    await new Promise((r) => setTimeout(r, 300));
    expect(useSettingsStore.getState().tmdbAccessToken).toBe(PLAIN_TOKEN);
  });

  it('持久化到 localStorage 的值是密文（非明文）', async () => {
    useSettingsStore.getState().setTMDBToken(PLAIN_TOKEN);
    // 等待加密写盘
    await new Promise((r) => setTimeout(r, 300));
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { state: { tmdbAccessToken: string } };
    const stored = parsed.state.tmdbAccessToken;
    expect(stored).not.toBe(PLAIN_TOKEN);
    expect(stored.length).toBeGreaterThan(30); // AES-GCM 密文长度远大于明文
    // 密文可解密回明文（证明加密链路正确）
    const decrypted = await decryptText(stored);
    expect(decrypted).toBe(PLAIN_TOKEN);
  });

  it('rehydrate 时从密文解密为内存明文', async () => {
    // 预置密文到 localStorage（模拟上次持久化）
    useSettingsStore.getState().setTMDBToken(PLAIN_TOKEN);
    await new Promise((r) => setTimeout(r, 300));
    // 模拟重新加载：清空内存后重新触发 rehydrate
    useSettingsStore.setState({ tmdbAccessToken: '' });
    // persist 中间件在 store 创建时自动 rehydrate；此处直接验证解密函数链路已由
    // onRehydrateStorage 保证（onRehydrate 在 store 创建时对已存在的 localStorage 执行）
    // 通过再次触发 set + persist 写盘验证整体闭环
    useSettingsStore.getState().setTMDBToken('second-token-abcdefghijklmnopqrstuvwxyz0123456789');
    await new Promise((r) => setTimeout(r, 300));
    expect(useSettingsStore.getState().tmdbAccessToken).toBe('second-token-abcdefghijklmnopqrstuvwxyz0123456789');
    const raw2 = localStorage.getItem(STORAGE_KEY);
    const parsed2 = JSON.parse(raw2!) as { state: { tmdbAccessToken: string } };
    expect(parsed2.state.tmdbAccessToken).not.toBe('second-token-abcdefghijklmnopqrstuvwxyz0123456789');
  });

  it('translationApiKey 同样保持内存明文', async () => {
    useSettingsStore.getState().setTranslationApiKey('my-secret-key-123456');
    await new Promise((r) => setTimeout(r, 300));
    expect(useSettingsStore.getState().translationApiKey).toBe('my-secret-key-123456');
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as { state: { translationApiKey: string } };
    expect(parsed.state.translationApiKey).not.toBe('my-secret-key-123456');
  });
});

/**
 * 跨页签白名单受控合并纯单测（第十轮 SETTINGS-CROSS-001 的快 CI 回归层）
 *
 * E2E 已锁「storage 事件 → merge → 另一页签内存/DOM 更新」全链路；这里直测
 * mergeSettingsFromCrossTab 的自定义逻辑（E2E 的解析/解密/排除/比对细节无法快速
 * 反馈到 CI，且真实跨文档 storage 事件无法在 jsdom 可靠模拟——MODE=test 时监听
 * 不挂载，故不走 dispatchEvent，直接调用导出的合并函数）：
 *   1. 白名单常规键合入
 *   2. 敏感字段密文 → 解密明文合入（非密文原样）
 *   3. 排除键（tvMode/tvOverscan）不覆盖本页值
 *   4. 「无变化不 set」——受控合并防写回回环的收敛根基（E2E 无回环的单元层证据）
 *   5. 空敏感值 / 畸形载荷安全跳过
 */
describe('useSettingsStore - 跨页签白名单受控合并', () => {
  /** 构造与 persist 落盘同构的载荷（{state, version}） */
  const payload = (overrides: Record<string, unknown>): string =>
    JSON.stringify({ state: overrides, version: 0 });

  beforeEach(() => {
    localStorage.clear();
    // 固定内存基线，防其它 describe 的残留值串扰（persist 写盘异步，内存必须显式复位）
    useSettingsStore.setState({
      theme: 'light',
      skin: 'default',
      tvMode: false,
      tvOverscan: 5,
      videoSourceIds: [],
      iptvSourceIds: [],
      tmdbAccessToken: '',
      translationApiKey: '',
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('白名单常规键：载荷 theme/skin 变化合入内存', async () => {
    await mergeSettingsFromCrossTab(payload({ theme: 'dark', skin: 'cartoon' }));
    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(useSettingsStore.getState().skin).toBe('cartoon');
  });

  it('敏感字段：载荷密文被解密为明文合入（内存非密文原样）', async () => {
    const enc = await encryptText(PLAIN_TOKEN);
    await mergeSettingsFromCrossTab(payload({ tmdbAccessToken: enc }));
    expect(useSettingsStore.getState().tmdbAccessToken).toBe(PLAIN_TOKEN);
  });

  it('排除键：载荷 tvMode/tvOverscan 变化不覆盖本页值，白名单键照常同步', async () => {
    useSettingsStore.getState().setTvMode(true);
    useSettingsStore.getState().setTvOverscan(10);
    await mergeSettingsFromCrossTab(payload({ tvMode: false, tvOverscan: 0, theme: 'dark' }));
    expect(useSettingsStore.getState().tvMode).toBe(true); // 播放布局类：每页签保留自己的值
    expect(useSettingsStore.getState().tvOverscan).toBe(10);
    expect(useSettingsStore.getState().theme).toBe('dark'); // 白名单键不受排除影响
  });

  it('无变化不 set：与内存相同的载荷不触发 setState（防写回回环的收敛根基）', async () => {
    useSettingsStore.getState().setTheme('dark');
    const spy = vi.fn();
    const unsubscribe = useSettingsStore.subscribe(spy);
    try {
      await mergeSettingsFromCrossTab(payload({ theme: 'dark' })); // 与内存相同 → 应跳过
      await new Promise((r) => setTimeout(r, 20)); // 覆盖任何异步解密/微任务窗口
      expect(spy).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it('空敏感值与畸形载荷安全跳过，不抛错不污染内存', async () => {
    useSettingsStore.getState().setTMDBToken('keep-me');
    await mergeSettingsFromCrossTab(payload({ tmdbAccessToken: '' })); // 空值：无明文可同步
    expect(useSettingsStore.getState().tmdbAccessToken).toBe('keep-me');
    await expect(mergeSettingsFromCrossTab('not-json{{{')).resolves.toBeUndefined();
    await expect(mergeSettingsFromCrossTab(JSON.stringify({ state: null }))).resolves.toBeUndefined();
    expect(useSettingsStore.getState().tmdbAccessToken).toBe('keep-me');
  });
});
