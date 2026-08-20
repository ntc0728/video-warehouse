/**
 * useSourceManagerStore 单元测试
 *
 * 核心覆盖 2026-08-07 源管理收敛（ADR-019）的关键业务规则：
 *   1) 至少一个源兜底：IPTV/EPG 停用最后一个已启用源被拒
 *   2) 启用数量上限：MAX_ENABLED（video=6 / iptv=3 / epg=3）
 *   3) bootstrap 幂等 + 仅空列表注入（保证设置页启用状态回显）
 *   4) 自定义源增删：deleteCustom* 仅删 custom、不删 builtin
 *   5) sortByLatency：启用源按延迟升序、未启用排尾
 *   6) reorder：拖拽排序更新顺序并重排 order
 *
 * 依赖隔离：mock sourceService（getVideoSources 等）+ mock useIPTVStore（避免真实网络）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSourceManagerStore, MAX_ENABLED, mergeBuiltinSources } from './useSourceManagerStore';
import type { ManagedVideoSource, ManagedIPTVSource } from '@/types/source';

/* ── mock 依赖（模块级提升，store import 前生效） ── */

vi.mock('@/services/sourceService', () => {
  const builtinVideo = [
    { id: 'v1', name: 'V1', api: 'https://v1/api.php', detail: 'd1' },
    { id: 'v2', name: 'V2', api: 'https://v2/api.php', detail: 'd2' },
    { id: 'v3', name: 'V3', api: 'https://v3/api.php', detail: 'd3' },
    { id: 'v4', name: 'V4', api: 'https://v4/api.php', detail: 'd4' },
    { id: 'v5', name: 'V5', api: 'https://v5/api.php', detail: 'd5' },
    { id: 'v6', name: 'V6', api: 'https://v6/api.php', detail: 'd6' },
    { id: 'v7', name: 'V7', api: 'https://v7/api.php', detail: 'd7' },
  ];
  const builtinIptv = [
    { name: 'I1', url: 'https://i1/list.m3u8' },
    { name: 'I2', url: 'https://i2/list.m3u8' },
    { name: 'I3', url: 'https://i3/list.m3u8' },
  ];
  const builtinEpg = [
    { name: 'E1', url: 'https://e1/epg.xml' },
    { name: 'E2', url: 'https://e2/epg.xml' },
  ];
  return {
    getVideoSources: vi.fn(async () => builtinVideo),
    getIPTVSources: vi.fn(async () => builtinIptv),
    getEPGSources: vi.fn(async () => builtinEpg),
    setAttachedSources: vi.fn(),
  };
});

vi.mock('@/stores/useIPTVStore', () => {
  const state = {
    settings: { aggregatorUrl: '', aggregatorUrls: [] as string[], sourceNames: [] as string[] },
    setSettings: vi.fn(),
    refreshChannels: vi.fn(),
  };
  return { useIPTVStore: { getState: () => state } };
});

/* ── fixture 构造 ── */

function mkVideo(id: string, order: number, enabled: boolean, latency: number | null = null): ManagedVideoSource {
  return {
    id, name: `V-${id}`, api: `https://${id}/api.php`, detail: 'd', kind: 'builtin',
    status: { enabled, latency, latencyCheckedAt: latency == null ? null : Date.now() },
    addedAt: 1, order,
  };
}

function mkIptv(id: string, order: number, enabled: boolean): ManagedIPTVSource {
  return {
    id, name: `I-${id}`, url: `https://${id}/list.m3u8`, kind: 'builtin',
    status: { enabled, latency: null, latencyCheckedAt: null },
    addedAt: 1, order,
  };
}

/** 重置 store 状态（绕过 persist / bootstrap guard，纯内存构造） */
function reset(scene: 'video' | 'iptv' | 'epg' = 'video') {
  useSourceManagerStore.setState({
    video: [],
    iptv: [],
    epg: [],
    _bootstrapped: { video: false, iptv: false, epg: false },
  } as never);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void scene;
}

describe('useSourceManagerStore', () => {
  beforeEach(() => {
    reset();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('setEnabled：达到视频源启用上限后拒绝继续启用', () => {
    // 构造 6 个已启用 + 1 个未启用（video 上限 6）
    useSourceManagerStore.setState({
      video: Array.from({ length: 6 }, (_, i) => mkVideo(`v${i}`, i, true)).concat([mkVideo('vExtra', 6, false)]),
    } as never);
    const before = useSourceManagerStore.getState().video.filter((s) => s.status.enabled).length;
    expect(before).toBe(MAX_ENABLED.video);

    // 尝试启用第 7 个 → 被拒，仍保持 6 个启用
    useSourceManagerStore.getState().setEnabled('video', 'vExtra', true);
    const enabledCount = useSourceManagerStore.getState().video.filter((s) => s.status.enabled).length;
    expect(enabledCount).toBe(MAX_ENABLED.video);
    expect(useSourceManagerStore.getState().video.find((s) => s.id === 'vExtra')?.status.enabled).toBe(false);
  });

  it('setEnabled：IPTV 停用最后一个已启用源被拒（至少一个源兜底）', () => {
    useSourceManagerStore.setState({ iptv: [mkIptv('i1', 0, true)] } as never);
    useSourceManagerStore.getState().setEnabled('iptv', 'i1', false);
    // 仍保持启用
    expect(useSourceManagerStore.getState().iptv[0].status.enabled).toBe(true);
  });

  it('setEnabled：IPTV 存在多个源时允许停用其中一个', () => {
    useSourceManagerStore.setState({ iptv: [mkIptv('i1', 0, true), mkIptv('i2', 1, true)] } as never);
    useSourceManagerStore.getState().setEnabled('iptv', 'i1', false);
    const list = useSourceManagerStore.getState().iptv;
    expect(list.find((s) => s.id === 'i1')?.status.enabled).toBe(false);
    expect(list.find((s) => s.id === 'i2')?.status.enabled).toBe(true);
  });

  it('setEnabled：video 无「至少一个源」兜底，可全部停用', () => {
    useSourceManagerStore.setState({ video: [mkVideo('v1', 0, true)] } as never);
    useSourceManagerStore.getState().setEnabled('video', 'v1', false);
    expect(useSourceManagerStore.getState().video[0].status.enabled).toBe(false);
  });

  it('reorder：将 index 0 移到 index 2，其余顺延且 order 重排', () => {
    useSourceManagerStore.setState({
      video: [mkVideo('v1', 0, true), mkVideo('v2', 1, true), mkVideo('v3', 2, false), mkVideo('v4', 3, true)],
    } as never);
    useSourceManagerStore.getState().reorder('video', 0, 2);
    const list = useSourceManagerStore.getState().video;
    expect(list.map((s) => s.id)).toEqual(['v2', 'v3', 'v1', 'v4']);
    expect(list.map((s) => s.order)).toEqual([0, 1, 2, 3]);
  });

  it('reorder：将 index 3 移到 index 1，其余顺延且 order 重排', () => {
    useSourceManagerStore.setState({
      video: [mkVideo('v1', 0, true), mkVideo('v2', 1, true), mkVideo('v3', 2, true), mkVideo('v4', 3, true)],
    } as never);
    useSourceManagerStore.getState().reorder('video', 3, 1);
    const list = useSourceManagerStore.getState().video;
    expect(list.map((s) => s.id)).toEqual(['v1', 'v4', 'v2', 'v3']);
  });

  it('reorder：相同下标或越界时保持原样', () => {
    useSourceManagerStore.setState({
      video: [mkVideo('v1', 0, true), mkVideo('v2', 1, true)],
    } as never);
    useSourceManagerStore.getState().reorder('video', 0, 0);
    useSourceManagerStore.getState().reorder('video', 0, 99);
    expect(useSourceManagerStore.getState().video.map((s) => s.id)).toEqual(['v1', 'v2']);
  });

  it('addCustomVideoSource：追加自定义源且默认启用', () => {
    useSourceManagerStore.setState({ video: [mkVideo('v1', 0, true)] } as never);
    const added = useSourceManagerStore.getState().addCustomVideoSource({
      name: 'MySource', api: 'https://my/api.php', detail: 'custom',
    });
    const list = useSourceManagerStore.getState().video;
    expect(list).toHaveLength(2);
    expect(added.kind).toBe('custom');
    expect(added.status.enabled).toBe(true);
    expect(added.order).toBe(1);
  });

  it('deleteCustomVideoSource：仅删除 custom，builtin 不受影响', () => {
    // 构造 builtin + custom 各一
    useSourceManagerStore.setState({
      video: [
        mkVideo('builtin-1', 0, true),
        { ...mkVideo('custom-1', 1, true), kind: 'custom' as const },
      ],
    } as never);
    useSourceManagerStore.getState().deleteCustomVideoSource('custom-1');
    const list = useSourceManagerStore.getState().video;
    expect(list.some((s) => s.id === 'custom-1')).toBe(false);
    expect(list.some((s) => s.id === 'builtin-1')).toBe(true);

    // 尝试删除 builtin → 被拒（保持存在）
    useSourceManagerStore.getState().deleteCustomVideoSource('builtin-1');
    expect(useSourceManagerStore.getState().video.some((s) => s.id === 'builtin-1')).toBe(true);
  });

  it('sortByLatency：启用源按延迟升序、未启用排尾', () => {
    useSourceManagerStore.setState({
      video: [
        mkVideo('vSlow', 0, true, 200),
        mkVideo('vOff', 1, false, 50),
        mkVideo('vFast', 2, true, 80),
        mkVideo('vNone', 3, true, null),
      ],
    } as never);
    useSourceManagerStore.getState().sortByLatency('video');
    const ids = useSourceManagerStore.getState().video.map((s) => s.id);
    // 启用在前：vFast(80) 先于 vSlow(200)；未测速(vNone)排启用末；未启用(vOff)排最后
    expect(ids[0]).toBe('vFast');
    expect(ids[1]).toBe('vSlow');
    expect(ids[2]).toBe('vNone');
    expect(ids[3]).toBe('vOff');
  });

  it('bootstrap：幂等，仅空列表时注入默认源，且只启用第一个', async () => {
    // 首次 bootstrap：三个场景列表为空 → 注入内置源，仅 index 0 启用
    await useSourceManagerStore.getState().bootstrap();
    const st = useSourceManagerStore.getState();
    expect(st.video.length).toBeGreaterThan(0);
    expect(st.iptv.length).toBeGreaterThan(0);
    expect(st.epg.length).toBeGreaterThan(0);
    const enabledVideos = st.video.filter((s) => s.status.enabled);
    expect(enabledVideos).toHaveLength(1);

    // 再次 bootstrap：列表已有内容，不重复注入（长度不变）→ 保证回显不被覆盖
    const beforeLen = st.video.length;
    await useSourceManagerStore.getState().bootstrap();
    expect(useSourceManagerStore.getState().video.length).toBe(beforeLen);
  });

  it('bootstrap：持久化的启用状态不被覆盖（回显）', async () => {
    // 模拟用户已持久化：手动构造「v1 停用、v2 启用」的内存状态
    useSourceManagerStore.setState({ video: [mkVideo('v1', 0, false), mkVideo('v2', 1, true)] } as never);
    await useSourceManagerStore.getState().bootstrap();
    const list = useSourceManagerStore.getState().video;
    // 列表已有内容 → bootstrap 不注入默认源 → 保留用户设置
    expect(list).toHaveLength(2);
    expect(list.find((s) => s.id === 'v1')?.status.enabled).toBe(false);
    expect(list.find((s) => s.id === 'v2')?.status.enabled).toBe(true);
  });
});

describe('mergeBuiltinSources（内置源增量合并）', () => {
  it('空列表：全量返回内置源（首次初始化）', () => {
    const builtin = [mkVideo('v1', 0, true), mkVideo('v2', 1, false)];
    const merged = mergeBuiltinSources([], builtin, (s) => s.id, MAX_ENABLED.video);
    expect(merged).toEqual(builtin);
  });

  it('无缺失：原样返回（不产生新引用/不追加）', () => {
    const existing = [mkVideo('v1', 0, true), mkVideo('v2', 1, false)];
    const builtin = [mkVideo('v1', 0, true), mkVideo('v2', 1, false)];
    expect(mergeBuiltinSources(existing, builtin, (s) => s.id, MAX_ENABLED.video)).toBe(existing);
  });

  it('缺失追加：老用户持久化旧列表时，JSON 新增内置源追加到末尾', () => {
    const existing = [mkIptv('i1', 0, true)];
    const builtin = [
      { ...mkIptv('i1', 0, true) },
      mkIptv('i2', 1, false),
      mkIptv('i3', 2, false),
    ];
    const merged = mergeBuiltinSources(existing, builtin, (s) => s.url, MAX_ENABLED.iptv);
    expect(merged.map((s) => s.url)).toEqual([
      'https://i1/list.m3u8',
      'https://i2/list.m3u8',
      'https://i3/list.m3u8',
    ]);
    // 已有源保持原顺序/启用状态
    expect(merged[0].status.enabled).toBe(true);
    // 新源 order 接续末尾
    expect(merged[1].order).toBe(1);
    expect(merged[2].order).toBe(2);
  });

  it('启用补足：新源默认启用填满上限，超出上限保持停用（不挤掉用户已启用）', () => {
    // IPTV 上限 3：已有 1 个启用 → 新源补 2 个启用；构造第 4 个新源 → 停用
    const existing = [mkIptv('i1', 0, true)];
    const builtin = [
      mkIptv('i1', 0, true),
      mkIptv('i2', 1, false),
      mkIptv('i3', 2, false),
      mkIptv('i4', 3, false),
    ];
    const merged = mergeBuiltinSources(existing, builtin, (s) => s.url, MAX_ENABLED.iptv);
    const enabled = merged.filter((s) => s.status.enabled).map((s) => s.url);
    expect(enabled).toEqual([
      'https://i1/list.m3u8',
      'https://i2/list.m3u8',
      'https://i3/list.m3u8',
    ]);
    expect(merged[3].status.enabled).toBe(false);
  });

  it('启用已满：新源全部保持停用', () => {
    // video 上限 6：已有 6 个启用 → 新源 v7 不启用
    const existing = Array.from({ length: 6 }, (_, i) => mkVideo(`v${i}`, i, true));
    const builtin = [...existing.map((s) => ({ ...s })), mkVideo('v7', 6, false)];
    const merged = mergeBuiltinSources(existing, builtin, (s) => s.id, MAX_ENABLED.video);
    expect(merged).toHaveLength(7);
    expect(merged[6].status.enabled).toBe(false);
    // 原有 6 个启用状态不变
    expect(merged.filter((s) => s.status.enabled)).toHaveLength(6);
  });
});
