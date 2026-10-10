/**
 * 源检测页面
 * 检测 5 个维度：网速、IPTV 源、视频源、IPTV 代理、视频代理
 * 布局（2026-10-10 落地「己 · 三栏 + 健康带」）：
 *   顶部健康带（健康环=域通过率 + 延迟对比条形 + 五域磁贴）
 *   + 左分组导航 / 中单列源列表 / 右详情坞（选中才展开，未选中 mid 撑满，对齐真实 is-rail 语义）
 *   详情坞支持「重测该源」（单源探测，2026-10-10 新增）与「重测本组」。
 *   移除项（对齐 demo、去未实现）：近 5 次历史柱、行级「最近」时间列（全局时间复制到每行，易误读）。
 */
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BackToTopButton } from '@/components/common';
import SubPage from '@/components/common/SubPage/SubPage';
import { useIsMobileLayout } from '@/hooks/useMediaQuery';
import { getIPTVSources, getVideoSources } from '@/services/sourceService';
import { getText, getJSON } from '@/services/httpClient';
import { buildSourceProxyUrl } from '@/services/iptvService';
import { mapWithConcurrency } from '@/lib/concurrency';
import { useSettingsStore } from '@/stores';
import { useIPTVStore } from '@/stores/useIPTVStore';
import type { VideoSourceConfig, IPTVSourceConfig } from '@/types/source';

import './SourceChecker.css';
import { usePullToRefresh } from '@/components/ui/PullToRefresh';

/**
 * 源探测并发上限（2026-09-16）。原实现逐个 for+await，N 个源 = N×超时易像卡死；
 * 取 4 并行降到约 1/4，同时避免瞬时对自建站开满连接被限流。
 */
const SOURCE_CHECK_CONCURRENCY = 4;

type TabKey = 'network' | 'iptv' | 'video' | 'iptvProxy' | 'videoProxy';
type SegKey = 'all' | 'network' | 'iptv' | 'video' | 'proxy' | 'bad';

interface NetworkNodeResult {
  name: string;
  url: string;
  available: boolean;
  latency: number | null;
  speed: string | null;
  error?: string;
}

interface NetworkResult {
  latency: number | null;
  speed: string | null;
  error: string | null;
  nodes: NetworkNodeResult[];
}

interface SourceCheckItem {
  name: string;
  url: string;
  available: boolean;
  latency: number;
  error?: string;
  details?: string;
}

interface ProxyCheckResult {
  configured: boolean;
  url: string;
  available: boolean | null;
  latency?: number;
  error?: string;
}

interface CacheData {
  network: NetworkResult | null;
  iptv: SourceCheckItem[];
  video: SourceCheckItem[];
  iptvProxy: ProxyCheckResult | null;
  videoProxy: ProxyCheckResult | null;
  timestamp: number;
}

const SPEED_TEST_URLS = [
  { name: '阿里云 CDN', url: 'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js' },
  { name: 'Cloudflare', url: 'https://cdnjs.cloudflare.com/ajax/libs/vue/3.3.4/vue.global.prod.min.js' },
];

const CACHE_KEY = 'source-checker-cache';

/** 格式化相对时间 */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

/** 从 localStorage 读取缓存 */
function loadCache(): CacheData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheData;
  } catch {
    return null;
  }
}

/** 保存缓存到 localStorage */
function saveCache(data: Omit<CacheData, 'timestamp'>): void {
  const cache: CacheData = { ...data, timestamp: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 存储失败静默忽略
  }
}

export default function SourceCheckerPage() {
  const { corsProxy } = useSettingsStore();
  const { settings: iptvSettings } = useIPTVStore();

  // 移动端：整页 portal 为全屏子页（SubPage，对齐设置页 SettingsSubPage），顶栏替代全局导航栏。
  const isMobile = useIsMobileLayout();

  const pageRef = useRef<HTMLDivElement>(null);

  // 左分组导航筛选（含「异常」待办档）
  const [segTab, setSegTab] = useState<SegKey>('all');
  // 详情坞选中行 key
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [checkingTabs, setCheckingTabs] = useState<Set<TabKey>>(new Set());
  const [recheckingKey, setRecheckingKey] = useState<string | null>(null);
  const [videoSources, setVideoSources] = useState<VideoSourceConfig[]>([]);
  const [iptvSources, setIptvSources] = useState<IPTVSourceConfig[]>([]);

  useEffect(() => {
    getVideoSources().then(setVideoSources);
    getIPTVSources().then(setIptvSources);
  }, []);

  const [networkResult, setNetworkResult] = useState<NetworkResult | null>(null);
  const [iptvResults, setIptvResults] = useState<SourceCheckItem[]>([]);
  const [videoResults, setVideoResults] = useState<SourceCheckItem[]>([]);
  const [iptvProxyResult, setIptvProxyResult] = useState<ProxyCheckResult | null>(null);
  const [videoProxyResult, setVideoProxyResult] = useState<ProxyCheckResult | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<number | null>(null);
  const [iptvProgress, setIptvProgress] = useState({ current: 0, total: 0 });
  const [videoProgress, setVideoProgress] = useState({ current: 0, total: 0 });
  const [isBatchChecking, setIsBatchChecking] = useState(false);

  // 使用 useRef 跟踪最新状态，用于缓存保存
  const stateRef = useRef({
    network: networkResult,
    iptv: iptvResults,
    video: videoResults,
    iptvProxy: iptvProxyResult,
    videoProxy: videoProxyResult,
  });

  // 同步状态到 ref
  useEffect(() => {
    stateRef.current = {
      network: networkResult,
      iptv: iptvResults,
      video: videoResults,
      iptvProxy: iptvProxyResult,
      videoProxy: videoProxyResult,
    };
  }, [networkResult, iptvResults, videoResults, iptvProxyResult, videoProxyResult]);

  // 页面加载时从缓存恢复
  useEffect(() => {
    const cache = loadCache();
    if (cache) {
      setNetworkResult(cache.network);
      setIptvResults(cache.iptv);
      setVideoResults(cache.video);
      setIptvProxyResult(cache.iptvProxy);
      setVideoProxyResult(cache.videoProxy);
      setLastCheckTime(cache.timestamp);
    }
  }, []);

  const isChecking = (tab: TabKey) => checkingTabs.has(tab);

  const checkNetwork = useCallback(async (): Promise<NetworkResult> => {
    const nodes: NetworkNodeResult[] = await Promise.all(
      SPEED_TEST_URLS.map(async (point): Promise<NetworkNodeResult> => {
        const start = performance.now();
        try {
          const response = await fetch(point.url, { cache: 'no-store' });
          await response.text();
          const latency = Math.round(performance.now() - start);
          const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
          const speed = contentLength > 0
            ? `${((contentLength / 1024) / (latency / 1000)).toFixed(1)} KB/s`
            : null;
          return { name: point.name, url: point.url, available: true, latency, speed };
        } catch (error) {
          return {
            name: point.name,
            url: point.url,
            available: false,
            latency: null,
            speed: null,
            error: error instanceof Error ? error.message : '连接失败',
          };
        }
      })
    );

    const okNodes = nodes.filter((n) => n.available);
    if (okNodes.length === 0) {
      return { latency: null, speed: null, error: '所有测试节点连接失败', nodes };
    }
    const latency = Math.round(
      okNodes.reduce((sum, n) => sum + (n.latency ?? 0), 0) / okNodes.length
    );
    const speed = okNodes.find((n) => n.speed)?.speed ?? null;
    return { latency, speed, error: null, nodes };
  }, []);

  // 探测口径统一（2026-09-16）：复用 buildSourceProxyUrl，让检测结果与真实取流一致。
  // 抽出单源探测 probeIPTVSource / probeVideoSource，供「组探测 mapWithConcurrency」与「单源重测」共用。
  const probeIPTVSource = useCallback(async (source: IPTVSourceConfig): Promise<SourceCheckItem> => {
    const proxyUrl = iptvSettings?.proxyUrl;
    const start = performance.now();
    try {
      await getText(buildSourceProxyUrl(source.url, proxyUrl), { timeout: 8000 });
      return { name: source.name, url: source.url, available: true, latency: Math.round(performance.now() - start) };
    } catch (error) {
      return {
        name: source.name,
        url: source.url,
        available: false,
        latency: Math.round(performance.now() - start),
        error: error instanceof Error ? error.message : '请求失败',
      };
    }
  }, [iptvSettings?.proxyUrl]);

  const probeVideoSource = useCallback(async (source: VideoSourceConfig): Promise<SourceCheckItem> => {
    const start = performance.now();
    try {
      const data = await getJSON<{ list?: unknown[] }>(source.api, { useProxy: true, timeout: 10000 });
      const videoCount = data?.list?.length;
      return {
        name: source.name,
        url: source.api,
        available: true,
        latency: Math.round(performance.now() - start),
        details: videoCount !== undefined ? `${videoCount} 个视频` : undefined,
      };
    } catch (error) {
      return {
        name: source.name,
        url: source.api,
        available: false,
        latency: Math.round(performance.now() - start),
        error: error instanceof Error ? error.message : '请求失败',
      };
    }
  }, []);

  const checkIPTVSources = useCallback(async (): Promise<SourceCheckItem[]> => {
    const sources = iptvSources;
    const arrived: SourceCheckItem[] = [];
    let done = 0;

    const results = await mapWithConcurrency(sources, SOURCE_CHECK_CONCURRENCY, async (source) => {
      const item = await probeIPTVSource(source);
      done += 1;
      setIptvProgress({ current: done, total: sources.length });
      arrived.push(item);
      setIptvResults([...arrived]);
      return item;
    });

    return results;
  }, [iptvSources, probeIPTVSource]);

  const checkVideoSources = useCallback(async (): Promise<SourceCheckItem[]> => {
    const sources = videoSources;
    const arrived: SourceCheckItem[] = [];
    let done = 0;

    const results = await mapWithConcurrency(sources, SOURCE_CHECK_CONCURRENCY, async (source) => {
      const item = await probeVideoSource(source);
      done += 1;
      setVideoProgress({ current: done, total: sources.length });
      arrived.push(item);
      setVideoResults([...arrived]);
      return item;
    });

    return results;
  }, [videoSources, probeVideoSource]);

  const checkIPTVProxy = useCallback(async (): Promise<ProxyCheckResult> => {
    const proxyUrl = iptvSettings?.proxyUrl || '';
    if (!proxyUrl) {
      return { configured: false, url: '', available: null };
    }
    const start = performance.now();
    try {
      const testUrl = `${proxyUrl}/m3u8-proxy?url=${encodeURIComponent('https://example.com/test.m3u8')}`;
      await getText(testUrl, { timeout: 8000 });
      return { configured: true, url: proxyUrl, available: true, latency: Math.round(performance.now() - start) };
    } catch (error) {
      return { configured: true, url: proxyUrl, available: false, latency: Math.round(performance.now() - start), error: error instanceof Error ? error.message : '代理服务不可达' };
    }
  }, [iptvSettings?.proxyUrl]);

  const checkVideoProxy = useCallback(async (): Promise<ProxyCheckResult> => {
    if (!corsProxy) {
      return { configured: false, url: '', available: null };
    }
    const start = performance.now();
    try {
      const testUrl = `${corsProxy}/proxy?url=${encodeURIComponent('https://example.com')}`;
      await getText(testUrl, { timeout: 8000 });
      return { configured: true, url: corsProxy, available: true, latency: Math.round(performance.now() - start) };
    } catch (error) {
      return { configured: true, url: corsProxy, available: false, latency: Math.round(performance.now() - start), error: error instanceof Error ? error.message : '代理服务不可达' };
    }
  }, [corsProxy]);

  // 保存当前所有状态到缓存
  const saveCurrentStateToCache = useCallback(() => {
    const cache: Omit<CacheData, 'timestamp'> = {
      network: stateRef.current.network,
      iptv: stateRef.current.iptv,
      video: stateRef.current.video,
      iptvProxy: stateRef.current.iptvProxy,
      videoProxy: stateRef.current.videoProxy,
    };
    saveCache(cache);
    setLastCheckTime(Date.now());
  }, []);

  // 一键检测所有项
  const handleCheckAll = useCallback(async () => {
    if (isBatchChecking) return;
    setIsBatchChecking(true);
    setCheckingTabs(new Set<TabKey>(['network', 'iptv', 'video', 'iptvProxy', 'videoProxy']));
    setIptvProgress({ current: 0, total: 0 });
    setVideoProgress({ current: 0, total: 0 });

    try {
      const [networkRes, iptvProxyRes, videoProxyRes] = await Promise.all([
        checkNetwork(),
        checkIPTVProxy(),
        checkVideoProxy(),
      ]);
      setNetworkResult(networkRes);
      setIptvProxyResult(iptvProxyRes);
      setVideoProxyResult(videoProxyRes);

      const iptvRes = await checkIPTVSources();
      setIptvResults(iptvRes);

      const videoRes = await checkVideoSources();
      setVideoResults(videoRes);

      const cache: Omit<CacheData, 'timestamp'> = {
        network: networkRes,
        iptv: iptvRes,
        video: videoRes,
        iptvProxy: iptvProxyRes,
        videoProxy: videoProxyRes,
      };
      saveCache(cache);
      setLastCheckTime(Date.now());
    } finally {
      setCheckingTabs(new Set<TabKey>());
      setIsBatchChecking(false);
    }
  }, [isBatchChecking, checkNetwork, checkIPTVSources, checkVideoSources, checkIPTVProxy, checkVideoProxy]);

  // 下拉刷新：一键重新检测所有源
  usePullToRefresh(() => handleCheckAll(), { meta: () => '全部检测' });

  const handleCheck = useCallback(async (tab: TabKey) => {
    setCheckingTabs((prev) => new Set(prev).add(tab));
    setIptvProgress({ current: 0, total: 0 });

    try {
      switch (tab) {
        case 'network': {
          const result = await checkNetwork();
          setNetworkResult(result);
          break;
        }
        case 'iptv': {
          const result = await checkIPTVSources();
          setIptvResults(result);
          break;
        }
        case 'video': {
          const result = await checkVideoSources();
          setVideoResults(result);
          break;
        }
        case 'iptvProxy': {
          const result = await checkIPTVProxy();
          setIptvProxyResult(result);
          break;
        }
        case 'videoProxy': {
          const result = await checkVideoProxy();
          setVideoProxyResult(result);
          break;
        }
      }
      setTimeout(() => saveCurrentStateToCache(), 100);
    } finally {
      setCheckingTabs((prev) => {
        const next = new Set(prev);
        next.delete(tab);
        return next;
      });
    }
  }, [checkNetwork, checkIPTVSources, checkVideoSources, checkIPTVProxy, checkVideoProxy, saveCurrentStateToCache]);

  // ── 单源重测（2026-10-10 新增）：只重探选中的那一个源，就地更新该行 ──
  const handleCheckOne = useCallback(async (row: RowVM) => {
    if (row.group === 'network') { void handleCheck('network'); return; }
    if (row.group === 'proxy') { void handleCheck(row.key as TabKey); return; }
    if (recheckingKey) return;
    const url = row.sourceUrl;
    if (!url) return;

    setRecheckingKey(row.key);
    try {
      if (row.group === 'iptv') {
        const src = iptvSources.find((s) => s.url === url);
        if (!src) return;
        const item = await probeIPTVSource(src);
        setIptvResults((prev) => prev.map((r) => (r.url === item.url ? item : r)));
      } else if (row.group === 'video') {
        const src = videoSources.find((s) => s.api === url);
        if (!src) return;
        const item = await probeVideoSource(src);
        setVideoResults((prev) => prev.map((r) => (r.url === item.url ? item : r)));
      }
      setTimeout(() => saveCurrentStateToCache(), 100);
    } finally {
      setRecheckingKey(null);
    }
  }, [recheckingKey, iptvSources, videoSources, probeIPTVSource, probeVideoSource, saveCurrentStateToCache, handleCheck]);

  const stats = {
    iptv: { total: iptvResults.length, available: iptvResults.filter((r) => r.available).length },
    video: { total: videoResults.length, available: videoResults.filter((r) => r.available).length },
  };

  // ── 五检查域结论（健康环数据源） ──
  const domainStates = useMemo(() => ([
    { key: 'network' as const, label: '网速', checked: networkResult !== null, ok: !!networkResult && !networkResult.error },
    { key: 'iptv' as const, label: 'IPTV 源', checked: stats.iptv.total > 0, ok: stats.iptv.total > 0 && stats.iptv.available === stats.iptv.total },
    { key: 'video' as const, label: '视频源', checked: stats.video.total > 0, ok: stats.video.total > 0 && stats.video.available === stats.video.total },
    { key: 'iptvProxy' as const, label: 'IPTV 代理', checked: iptvProxyResult !== null, ok: !!iptvProxyResult?.configured && iptvProxyResult.available === true },
    { key: 'videoProxy' as const, label: '视频代理', checked: videoProxyResult !== null, ok: !!videoProxyResult?.configured && videoProxyResult.available === true },
  ]), [networkResult, stats.iptv.total, stats.iptv.available, stats.video.total, stats.video.available, iptvProxyResult, videoProxyResult]);
  const okCount = domainStates.filter((d) => d.ok).length;
  const totalDomains = domainStates.length;
  const allChecked = domainStates.every((d) => d.checked);
  const issueLabels = domainStates.filter((d) => d.checked && !d.ok).map((d) => d.label);
  const uncheckedLabels = domainStates.filter((d) => !d.checked).map((d) => d.label);
  const verdictOk = okCount === totalDomains;
  const verdictText = verdictOk
    ? '全部检查域正常'
    : [
        issueLabels.length > 0 && `${issueLabels.join('、')}异常`,
        uncheckedLabels.length > 0 && `${uncheckedLabels.join('、')}未检测`,
      ].filter(Boolean).join(' · ') || '尚未检测';
  // 健康环弧长：r=46 → 周长 ≈ 289.03；按 okCount 占比
  const RING_C = 289.03;
  const ringDash = allChecked || okCount > 0 ? `${(okCount / totalDomains) * RING_C} ${RING_C}` : `0 ${RING_C}`;

  // ── 统一行模型（网速/源/代理 同列，供左导航筛选 + 延迟条形复用） ──
  interface RowVM {
    key: string;
    group: 'network' | 'iptv' | 'video' | 'proxy';
    type: string;
    name: string;
    sub: string;
    status: 'ok' | 'bad' | 'idle' | 'checking';
    statusText: string;
    latency: string;
    latencyMs: number | null;
    error?: string;
    details?: string;
    nodes?: NetworkNodeResult[];
    speed?: string | null;
    advice?: { text: string; toSetup?: boolean };
    /** 单源重测定位用：iptv 存 source.url、video 存 source.api（source.api === 结果 url） */
    sourceUrl?: string;
  }

  const rows: RowVM[] = useMemo(() => {
    const out: RowVM[] = [];
    // 网速
    if (checkingTabs.has('network')) {
      out.push({ key: 'network', group: 'network', type: '网速', name: '网速延迟', sub: '测试节点连通性', status: 'checking', statusText: '检测中', latency: '…', latencyMs: null });
    } else if (networkResult) {
      out.push({
        key: 'network',
        group: 'network',
        type: '网速',
        name: '网速延迟',
        sub: networkResult.error ?? (networkResult.speed ? `估算带宽 ${networkResult.speed}` : `${networkResult.nodes.length} 个测试节点`),
        status: networkResult.error ? 'bad' : 'ok',
        statusText: networkResult.error ? '异常' : '可用',
        latency: networkResult.error ? '—' : `${networkResult.latency}ms`,
        latencyMs: networkResult.error ? null : networkResult.latency,
        error: networkResult.error ?? undefined,
        nodes: networkResult.nodes,
        speed: networkResult.speed,
        advice: networkResult.error ? { text: '所有测试节点连接失败，检查本机网络后重试' } : undefined,
      });
    }
    // IPTV 源
    if (checkingTabs.has('iptv') && iptvResults.length === 0) {
      out.push({ key: 'iptv-loading', group: 'iptv', type: 'IPTV', name: 'IPTV 源', sub: `${iptvProgress.current}/${iptvProgress.total}`, status: 'checking', statusText: '检测中', latency: '…', latencyMs: null });
    }
    iptvResults.forEach((s, i) => {
      const oneChecking = recheckingKey === `iptv-${i}`;
      out.push({
        key: `iptv-${i}`,
        group: 'iptv',
        type: 'IPTV',
        name: s.name,
        sub: s.url,
        sourceUrl: s.url,
        status: checkingTabs.has('iptv') || oneChecking ? 'checking' : s.available ? 'ok' : 'bad',
        statusText: checkingTabs.has('iptv') || oneChecking ? '重测中' : s.available ? '可用' : '异常',
        latency: `${s.latency}ms`,
        latencyMs: s.available ? s.latency : null,
        error: s.error,
        advice: !s.available
          ? (iptvProxyResult?.configured
            ? { text: '已配置 IPTV 代理，请重试或更换数据源' }
            : { text: '该源直连不可达，可部署 IPTV 流代理后复检', toSetup: true })
          : undefined,
      });
    });
    // 视频源
    if (checkingTabs.has('video') && videoResults.length === 0) {
      out.push({ key: 'video-loading', group: 'video', type: '视频', name: '视频源', sub: `${videoProgress.current}/${videoProgress.total}`, status: 'checking', statusText: '检测中', latency: '…', latencyMs: null });
    }
    videoResults.forEach((s, i) => {
      const oneChecking = recheckingKey === `video-${i}`;
      out.push({
        key: `video-${i}`,
        group: 'video',
        type: '视频',
        name: s.name,
        sub: s.details ?? s.url,
        sourceUrl: s.url,
        status: checkingTabs.has('video') || oneChecking ? 'checking' : s.available ? 'ok' : 'bad',
        statusText: checkingTabs.has('video') || oneChecking ? '重测中' : s.available ? '可用' : '异常',
        latency: `${s.latency}ms`,
        latencyMs: s.available ? s.latency : null,
        error: s.error,
        details: s.details,
        advice: !s.available
          ? (corsProxy
            ? { text: '已配置 CORS 代理，请重试或更换数据源' }
            : { text: '该源可能需要 CORS 代理回退，建议一键部署', toSetup: true })
          : undefined,
      });
    });
    // 代理 ×2
    const proxyRow = (key: 'iptvProxy' | 'videoProxy', name: string, result: ProxyCheckResult | null, hint: string): RowVM => {
      if (checkingTabs.has(key)) return { key, group: 'proxy', type: '代理', name, sub: result?.url || '—', status: 'checking', statusText: '检测中', latency: '…', latencyMs: null };
      if (!result) return { key, group: 'proxy', type: '代理', name, sub: '—', status: 'idle', statusText: '未检测', latency: '—', latencyMs: null };
      if (!result.configured) return { key, group: 'proxy', type: '代理', name, sub: '—', status: 'idle', statusText: '未配置', latency: '—', latencyMs: null, advice: { text: hint, toSetup: true } };
      return {
        key, group: 'proxy', type: '代理', name, sub: result.url,
        status: result.available ? 'ok' : 'bad',
        statusText: result.available ? '运行中' : '异常',
        latency: result.available ? `${result.latency}ms` : '—',
        latencyMs: result.available ? result.latency ?? null : null,
        error: result.error,
        advice: result.available ? undefined : { text: '代理服务不可达，可前往代理配置页重新部署', toSetup: true },
      };
    };
    out.push(proxyRow('iptvProxy', 'IPTV 流代理', iptvProxyResult, '部署 IPTV 流代理后可为不可达源提供回退链路'));
    out.push(proxyRow('videoProxy', '视频 CORS 代理', videoProxyResult, '部署 CORS 代理后可恢复跨域受限的视频源'));
    return out;
  }, [networkResult, checkingTabs, recheckingKey, iptvResults, videoResults, iptvProgress, videoProgress, iptvProxyResult, videoProxyResult, corsProxy]);

  const filteredRows = segTab === 'all' || segTab === 'bad'
    ? (segTab === 'bad' ? rows.filter((r) => r.status === 'bad' || r.status === 'idle') : rows)
    : rows.filter((r) => r.group === segTab);
  const selectedRow = selectedKey ? rows.find((r) => r.key === selectedKey) ?? null : null;
  const segCounts: Record<SegKey, number> = {
    all: rows.length,
    network: rows.filter((r) => r.group === 'network').length,
    iptv: rows.filter((r) => r.group === 'iptv').length,
    video: rows.filter((r) => r.group === 'video').length,
    proxy: rows.filter((r) => r.group === 'proxy').length,
    bad: rows.filter((r) => r.status === 'bad' || r.status === 'idle').length,
  };

  // 五域磁贴（stat-card 锚点）：值 = 域级真实字段
  const domainViews = [
    { seg: 'network' as SegKey, label: '网速', state: networkResult ? (networkResult.error ? 'bad' : 'ok') : 'idle', value: networkResult ? (networkResult.error ? '异常' : `${networkResult.latency}ms`) : '—' },
    { seg: 'iptv' as SegKey, label: 'IPTV 源', state: stats.iptv.total === 0 ? 'idle' : stats.iptv.available === stats.iptv.total ? 'ok' : 'bad', value: stats.iptv.total > 0 ? `${stats.iptv.available}/${stats.iptv.total}` : '—' },
    { seg: 'video' as SegKey, label: '视频源', state: stats.video.total === 0 ? 'idle' : stats.video.available === stats.video.total ? 'ok' : 'bad', value: stats.video.total > 0 ? `${stats.video.available}/${stats.video.total}` : '—' },
    { seg: 'proxy' as SegKey, label: 'CORS 代理', state: !videoProxyResult?.configured ? 'idle' : videoProxyResult.available ? 'ok' : 'bad', value: videoProxyResult?.configured ? (videoProxyResult.available ? '正常' : '异常') : '未配置' },
    { seg: 'proxy' as SegKey, label: 'IPTV 代理', state: !iptvProxyResult?.configured ? 'idle' : iptvProxyResult.available ? 'ok' : 'bad', value: iptvProxyResult?.configured ? (iptvProxyResult.available ? '正常' : '异常') : '未配置' },
  ];

  // 延迟对比条形：固定 5 槽位、按语义顺序 —— 网速 / IPTV 代理 / 视频 CORS 代理 / 一条 IPTV 源 / 一条视频源。
  // 源槽取「最需关注」代表（有异常取异常，否则取最慢）；对应行未检测出时该槽不显。
  const pickRep = (group: 'iptv' | 'video'): RowVM | undefined => {
    const list = rows.filter((r) => r.group === group && (r.status === 'ok' || r.status === 'bad'));
    if (list.length === 0) return undefined;
    const bad = list.find((r) => r.status === 'bad');
    const pool = bad ? [bad] : list;
    return pool.reduce((a, b) => ((b.latencyMs ?? -1) > (a.latencyMs ?? -1) ? b : a));
  };
  const byKey = (k: string) => rows.find((r) => r.key === k);
  const barRows = [
    byKey('network'),
    byKey('iptvProxy'),
    byKey('videoProxy'),
    pickRep('iptv'),
    pickRep('video'),
  ].filter(Boolean) as RowVM[];
  const barScale = Math.max(100, ...barRows.map((r) => (r.latencyMs != null && r.latencyMs > 0 ? r.latencyMs : 0)));
  const barPct = (r: RowVM) => {
    if (r.status === 'bad') return 100;
    if (r.latencyMs != null) return Math.max(6, Math.min(100, Math.round((r.latencyMs / barScale) * 100)));
    return 6;
  };
  const barValueText = (r: RowVM) => {
    if (r.status === 'bad') return '超时';
    if (r.latencyMs != null) return String(r.latencyMs);
    return r.status === 'idle' ? '未配置' : '—';
  };
  // 点条形→与左导航分组、磁贴高亮、主列表行三者联动（切组 + 选中 + 滚动到该行）
  const selectFromBar = (r: RowVM) => {
    setSegTab(r.group);
    setSelectedKey(r.key);
    requestAnimationFrame(() => {
      document.querySelector(`.source-checker-page .vrow[data-key="${r.key}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };

  const selectRow = (key: string) => setSelectedKey((prev) => (prev === key ? null : key));

  const page = (
    <div ref={pageRef} className="page-padding source-checker-page">
      <div className="source-checker-header">
        <div className="header-left">
          <h1>源检测</h1>
          <p>网络与数据源健康状态 · 结果缓存本地</p>
        </div>
        <div className="header-right">
          {lastCheckTime && (
            <span className="last-check-time">上次检测: {formatRelativeTime(lastCheckTime)}</span>
          )}
          <div className="header-act-row">
            {isBatchChecking && (
              <span className="checking-inline">
                <span className="checking-spinner" />
                <span className="checking-text">检测进行中…</span>
              </span>
            )}
            <button className="check-all-btn btn-small" onClick={handleCheckAll} disabled={isBatchChecking}>
              {isBatchChecking ? '检测中...' : '一键检测'}
            </button>
          </div>
        </div>
      </div>

      {/* 健康带：健康环 + 延迟条形 + 五域磁贴 */}
      <div className={`source-checker-band${verdictOk ? ' is-ok' : ''}${!allChecked && !verdictOk ? ' is-idle' : ''}`}>
        <div className="band-top">
          <div className="band-health">
            <div className="sc-ring">
              <svg width="108" height="108" viewBox="0 0 108 108" aria-hidden="true">
                <circle className="sc-ring-track" cx="54" cy="54" r="46" fill="none" strokeWidth="10" />
                <circle className="sc-ring-arc" cx="54" cy="54" r="46" fill="none" strokeWidth="10" strokeLinecap="round" style={{ strokeDasharray: ringDash }} />
              </svg>
              <div className="sc-ring-num">
                <b>{allChecked || okCount > 0 ? okCount : '—'}<em>/{totalDomains}</em></b>
                <span>检查域</span>
              </div>
            </div>
            <div className="band-state">
              <span className="band-cap">网络与数据源健康度</span>
              <b className="band-verdict">{verdictOk ? '2 项以内已全绿' : verdictText}</b>
              {issueLabels.length > 0 && !verdictOk && (
                <span className="band-todo">{issueLabels.join(' · ')} 待修复</span>
              )}
            </div>
          </div>
          <div className="band-lat">
            <h3>延迟对比（ms · 本次实测 · 点条形选中对应行）</h3>
            <div className="band-bars">
              {barRows.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={`band-bar${r.status === 'bad' ? ' is-bad' : ''}${r.status === 'idle' ? ' is-idle' : ''}${selectedKey === r.key ? ' is-sel' : ''}`}
                  onClick={() => selectFromBar(r)}
                >
                  <span className="band-bar-n">{r.name}</span>
                  <span className="band-bar-track"><span className="band-bar-fill" style={{ width: `${barPct(r)}%` }} /></span>
                  <span className="band-bar-v">{barValueText(r)}</span>
                </button>
              ))}
              {barRows.length === 0 && <span className="band-bars-empty">暂无可对比的实测延迟</span>}
            </div>
          </div>
        </div>
        <ul className="source-checker-stats">
          {domainViews.map((d, i) => (
            <li
              key={`${d.label}-${i}`}
              className={`stat-card tile${d.state === 'bad' ? ' is-bad' : ''}${segTab === d.seg && d.seg !== 'all' ? ' is-sel' : ''}`}
              onClick={() => setSegTab((prev) => (prev === d.seg ? 'all' : d.seg))}
            >
              <span className="tile-top">
                <span className="stat-label">{d.label}</span>
                <span className={`stat-dot is-${d.state}`} />
              </span>
              <span className="stat-value">{d.value}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 三栏：左导航 / 中列表 / 右详情坞（选中才出） */}
      <div className={`source-checker-cols${selectedRow ? ' is-rail' : ''}`}>
        <nav className="source-checker-nav">
          <h4>检查域</h4>
          <div className="source-checker-seg">
            <button className={`tab-btn${segTab === 'all' ? ' active' : ''}`} onClick={() => setSegTab('all')}>全部<span className="tab-cnt">{segCounts.all}</span></button>
            <button className={`tab-btn${segTab === 'network' ? ' active' : ''}`} onClick={() => setSegTab('network')}>网速<span className="tab-cnt">{segCounts.network}</span></button>
            <button className={`tab-btn${segTab === 'iptv' ? ' active' : ''}`} onClick={() => setSegTab('iptv')}>IPTV 源<span className="tab-cnt">{segCounts.iptv}</span></button>
            <button className={`tab-btn${segTab === 'video' ? ' active' : ''}`} onClick={() => setSegTab('video')}>视频源<span className="tab-cnt">{segCounts.video}</span></button>
            <button className={`tab-btn${segTab === 'proxy' ? ' active' : ''}`} onClick={() => setSegTab('proxy')}>代理<span className="tab-cnt">{segCounts.proxy}</span></button>
          </div>
          <h4 className="nav-gap">待办</h4>
          <div className="source-checker-seg">
            <button className={`tab-btn${segTab === 'bad' ? ' active' : ''}`} onClick={() => setSegTab('bad')}>异常/未配置<span className="tab-cnt is-bad">{segCounts.bad}</span></button>
          </div>
        </nav>

        <div className="source-checker-main">
          {filteredRows.length === 0 ? (
            <div className="empty-state">
              {segTab === 'bad' ? '没有异常或未配置的项，一切正常。' : '尚未检测，点击右上角「一键检测」开始体检'}
            </div>
          ) : (
            <div className={`vlist${isBatchChecking ? ' is-scanning' : ''}`}>
              {filteredRows.map((r) => (
                <div
                  key={r.key}
                  data-key={r.key}
                  className={`vrow is-${r.status}${selectedKey === r.key ? ' is-selected' : ''}`}
                  onClick={() => selectRow(r.key)}
                  title={r.error || r.name}
                >
                  <span className={`row-pill is-${r.status}`}>{r.statusText}</span>
                  <span className="vrow-nm">{r.name}</span>
                  <span className="vrow-type">{r.type}</span>
                  <span className="vrow-u">{r.sub}</span>
                  <span className={`vrow-lat${r.status === 'bad' ? ' is-bad' : ''}`}>{r.latency}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedRow && (
          <aside className="source-checker-rail">
            <div className="rail-head">
              <span className={`row-pill is-${selectedRow.status}`}>{selectedRow.statusText}</span>
              <b>{selectedRow.name}</b>
              <button className="rail-close" onClick={() => setSelectedKey(null)} aria-label="关闭详情">×</button>
            </div>
            <dl className="rail-kv">
              <dt>类型</dt><dd>{selectedRow.type}</dd>
              <dt>地址</dt><dd>{selectedRow.sub}</dd>
              <dt>延迟</dt><dd>{selectedRow.latency}</dd>
              {selectedRow.details && (<><dt>详情</dt><dd>{selectedRow.details}</dd></>)}
              {selectedRow.error && (<><dt>错误</dt><dd className="rail-err">{selectedRow.error}</dd></>)}
              {typeof selectedRow.speed === 'string' && selectedRow.speed && (
                <><dt>估算带宽</dt><dd>{selectedRow.speed}</dd></>
              )}
            </dl>
            {selectedRow.nodes && selectedRow.nodes.length > 0 && (
              <div className="rail-nodes">
                <h4>测试节点</h4>
                <ul>
                  {selectedRow.nodes.map((n) => (
                    <li key={n.name}>
                      <span>{n.name}</span>
                      <span className={n.available ? 'ok' : 'bad'}>{n.available ? `${n.latency}ms` : '不可达'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedRow.advice && (
              <div className="rail-advice">
                <h4>建议动作</h4>
                <p>{selectedRow.advice.text}</p>
                {selectedRow.advice.toSetup && (
                  <Link className="rail-link rail-link--cta" to="/proxy-setup">去配置代理 →</Link>
                )}
              </div>
            )}
            <div className="rail-actions">
              <button
                className="btn-small"
                onClick={() => void handleCheckOne(selectedRow)}
                disabled={selectedRow.status === 'checking' || recheckingKey === selectedRow.key}
              >
                {recheckingKey === selectedRow.key ? '重测中…' : '重测该源'}
              </button>
              {(selectedRow.group === 'iptv' || selectedRow.group === 'video') && (
                <button
                  className="btn-small"
                  onClick={() => handleCheck(selectedRow.group as TabKey)}
                  disabled={isChecking(selectedRow.group as TabKey)}
                >
                  {isChecking(selectedRow.group as TabKey) ? '重测中…' : '重测本组'}
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
      <BackToTopButton />
    </div>
  );

  // 移动端：整页 portal 挂 body（fixed inset:0 覆盖全视口），顶栏替代全局导航栏
  return isMobile ? <SubPage title="源检测">{page}</SubPage> : page;
}
