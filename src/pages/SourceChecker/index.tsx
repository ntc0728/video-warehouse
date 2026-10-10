/**
 * 源检测页面
 * 检测5个维度：网速、IPTV源、视频源、IPTV代理、视频代理
 * 每个维度独立检测，支持多个同时进行
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
 * 源探测并发上限（2026-09-16）。
 * 原实现逐个 `for + await` 探测，N 个源 = N × 单次超时，最坏情况（全部不可达）
 * IPTV 10 源 × 8s ≈ 80s、视频源同理 → 页面像卡死。取 4 并行后最坏耗时降到约 1/4，
 * 同时避免瞬时对自建 CMS/IPTV 站开满连接被限流。
 */
const SOURCE_CHECK_CONCURRENCY = 4;

type TabKey = 'network' | 'iptv' | 'video' | 'iptvProxy' | 'videoProxy';

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
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30分钟过期

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
  const { corsProxy, videoSourceIds, iptvSourceIds } = useSettingsStore();
  const { settings: iptvSettings } = useIPTVStore();

  // 移动端：整页 portal 为全屏子页（SubPage，对齐设置页 SettingsSubPage），顶栏替代全局导航栏。
  // 9.1：布局判断统一 useIsMobileLayout（app 端恒真，横屏不误判桌面）
  const isMobile = useIsMobileLayout();

  const pageRef = useRef<HTMLDivElement>(null);

  // 分段筛选（监控台改版 2026-10-10：统一表格 + 分段，取代旧五面板 tab）
  const [segTab, setSegTab] = useState<'all' | 'network' | 'iptv' | 'video' | 'proxy'>('all');
  // 右栏 inspector 选中行
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [checkingTabs, setCheckingTabs] = useState<Set<TabKey>>(new Set());
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

  // 检查缓存是否过期
  const isCacheExpired = lastCheckTime ? (Date.now() - lastCheckTime) > CACHE_EXPIRY_MS : true;

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

  // 探测口径统一（2026-09-16）：原实现直接 `getText(source.url)` 直连，而实际拉取频道
  // 列表走的是 `fetchAndParsePlaylist` → `buildSourceProxyUrl(url, proxyUrl)`（iptvService.ts:530）。
  // 两条路径口径不一致 → 用户配了代理时，播放/列表能用的源在检测页被判「不可用」（假红），
  // 反之亦然。此处复用同一个 URL 构造函数，让检测结果与真实取流一致。
  const checkIPTVSources = useCallback(async (): Promise<SourceCheckItem[]> => {
    const sources = iptvSources;
    const proxyUrl = iptvSettings?.proxyUrl;
    /** 完成即追加（保持「边测边出」的观感），返回值为有序数组 */
    const arrived: SourceCheckItem[] = [];
    let done = 0;

    const results = await mapWithConcurrency(sources, SOURCE_CHECK_CONCURRENCY, async (source) => {
      const start = performance.now();
      let item: SourceCheckItem;
      try {
        await getText(buildSourceProxyUrl(source.url, proxyUrl), { timeout: 8000 });
        item = { name: source.name, url: source.url, available: true, latency: Math.round(performance.now() - start) };
      } catch (error) {
        item = {
          name: source.name,
          url: source.url,
          available: false,
          latency: Math.round(performance.now() - start),
          error: error instanceof Error ? error.message : '请求失败',
        };
      }
      done += 1;
      setIptvProgress({ current: done, total: sources.length });
      arrived.push(item);
      setIptvResults([...arrived]);
      return item;
    });

    return results;
  }, [iptvSources, iptvSettings?.proxyUrl]);

  const checkVideoSources = useCallback(async (): Promise<SourceCheckItem[]> => {
    const sources = videoSources;
    const arrived: SourceCheckItem[] = [];
    let done = 0;

    const results = await mapWithConcurrency(sources, SOURCE_CHECK_CONCURRENCY, async (source) => {
      const start = performance.now();
      let item: SourceCheckItem;
      try {
        const data = await getJSON<{ list?: unknown[] }>(source.api, { useProxy: true, timeout: 10000 });
        const videoCount = data?.list?.length;
        item = {
          name: source.name,
          url: source.api,
          available: true,
          latency: Math.round(performance.now() - start),
          details: videoCount !== undefined ? `${videoCount} 个视频` : undefined,
        };
      } catch (error) {
        item = {
          name: source.name,
          url: source.api,
          available: false,
          latency: Math.round(performance.now() - start),
          error: error instanceof Error ? error.message : '请求失败',
        };
      }
      done += 1;
      setVideoProgress({ current: done, total: sources.length });
      arrived.push(item);
      setVideoResults([...arrived]);
      return item;
    });

    return results;
  }, [videoSources]);

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
      // 并行检测网速和代理（耗时短）
      const [networkRes, iptvProxyRes, videoProxyRes] = await Promise.all([
        checkNetwork(),
        checkIPTVProxy(),
        checkVideoProxy(),
      ]);
      setNetworkResult(networkRes);
      setIptvProxyResult(iptvProxyRes);
      setVideoProxyResult(videoProxyRes);

      // 顺序检测源（耗时长，需要进度）
      const iptvRes = await checkIPTVSources();
      setIptvResults(iptvRes);

      const videoRes = await checkVideoSources();
      setVideoResults(videoRes);

      // 保存缓存
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
      // 检测完成后保存当前所有状态到缓存
      // 使用 setTimeout 确保状态更新后再保存
      setTimeout(() => saveCurrentStateToCache(), 100);
    } finally {
      setCheckingTabs((prev) => {
        const next = new Set(prev);
        next.delete(tab);
        return next;
      });
    }
  }, [checkNetwork, checkIPTVSources, checkVideoSources, checkIPTVProxy, checkVideoProxy, saveCurrentStateToCache]);

  const stats = {
    iptv: { total: iptvResults.length, available: iptvResults.filter((r) => r.available).length },
    video: { total: videoResults.length, available: videoResults.filter((r) => r.available).length },
  };

  // ── 状态监控台：五检查域结论（Hero 大号数字的数据源） ──
  const domainStates = useMemo(() => ([
    { key: 'network' as const, label: '网速', checked: networkResult !== null, ok: !!networkResult && !networkResult.error },
    { key: 'iptv' as const, label: 'IPTV 源', checked: stats.iptv.total > 0, ok: stats.iptv.total > 0 && stats.iptv.available === stats.iptv.total },
    { key: 'video' as const, label: '视频源', checked: stats.video.total > 0, ok: stats.video.total > 0 && stats.video.available === stats.video.total },
    { key: 'iptvProxy' as const, label: 'IPTV 代理', checked: iptvProxyResult !== null, ok: !!iptvProxyResult?.configured && iptvProxyResult.available === true },
    { key: 'videoProxy' as const, label: '视频代理', checked: videoProxyResult !== null, ok: !!videoProxyResult?.configured && videoProxyResult.available === true },
  ]), [networkResult, stats.iptv.total, stats.iptv.available, stats.video.total, stats.video.available, iptvProxyResult, videoProxyResult]);
  const okCount = domainStates.filter((d) => d.ok).length;
  const allChecked = domainStates.every((d) => d.checked);
  const issueLabels = domainStates.filter((d) => d.checked && !d.ok).map((d) => d.label);
  const uncheckedLabels = domainStates.filter((d) => !d.checked).map((d) => d.label);
  const verdictOk = okCount === domainStates.length;
  const verdictText = verdictOk
    ? '全部检查域正常'
    : [
        issueLabels.length > 0 && `${issueLabels.join('、')}异常`,
        uncheckedLabels.length > 0 && `${uncheckedLabels.join('、')}未检测`,
      ].filter(Boolean).join(' · ') || '尚未检测';

  // ── 状态监控台：统一行模型（网速/源/代理 同一张 dense 表格） ──
  interface RowVM {
    key: string;
    group: 'network' | 'iptv' | 'video' | 'proxy';
    name: string;
    sub: string;
    status: 'ok' | 'bad' | 'idle' | 'checking';
    statusText: string;
    latency: string;
    error?: string;
    details?: string;
    nodes?: NetworkNodeResult[];
    speed?: string | null;
    advice?: { text: string; toSetup?: boolean };
  }

  const rows: RowVM[] = useMemo(() => {
    const out: RowVM[] = [];
    // 网速
    if (checkingTabs.has('network')) {
      out.push({ key: 'network', group: 'network', name: '网速延迟', sub: '测试节点连通性', status: 'checking', statusText: '检测中', latency: '…' });
    } else if (networkResult) {
      out.push({
        key: 'network',
        group: 'network',
        name: '网速延迟',
        sub: networkResult.error ?? (networkResult.speed ? `估算带宽 ${networkResult.speed}` : `${networkResult.nodes.length} 个测试节点`),
        status: networkResult.error ? 'bad' : 'ok',
        statusText: networkResult.error ? '异常' : '可用',
        latency: networkResult.error ? '—' : `${networkResult.latency}ms`,
        error: networkResult.error ?? undefined,
        nodes: networkResult.nodes,
        speed: networkResult.speed,
        advice: networkResult.error ? { text: '所有测试节点连接失败，检查本机网络后重试' } : undefined,
      });
    }
    // IPTV 源
    if (checkingTabs.has('iptv') && iptvResults.length === 0) {
      out.push({ key: 'iptv-loading', group: 'iptv', name: 'IPTV 源', sub: `${iptvProgress.current}/${iptvProgress.total}`, status: 'checking', statusText: '检测中', latency: '…' });
    }
    iptvResults.forEach((s, i) => {
      out.push({
        key: `iptv-${i}`,
        group: 'iptv',
        name: s.name,
        sub: s.url,
        status: checkingTabs.has('iptv') ? 'checking' : s.available ? 'ok' : 'bad',
        statusText: checkingTabs.has('iptv') ? '重测中' : s.available ? '可用' : '异常',
        latency: `${s.latency}ms`,
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
      out.push({ key: 'video-loading', group: 'video', name: '视频源', sub: `${videoProgress.current}/${videoProgress.total}`, status: 'checking', statusText: '检测中', latency: '…' });
    }
    videoResults.forEach((s, i) => {
      out.push({
        key: `video-${i}`,
        group: 'video',
        name: s.name,
        sub: s.details ?? s.url,
        status: checkingTabs.has('video') ? 'checking' : s.available ? 'ok' : 'bad',
        statusText: checkingTabs.has('video') ? '重测中' : s.available ? '可用' : '异常',
        latency: `${s.latency}ms`,
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
      if (checkingTabs.has(key)) return { key, group: 'proxy', name, sub: result?.url || '—', status: 'checking', statusText: '检测中', latency: '…' };
      if (!result) return { key, group: 'proxy', name, sub: '—', status: 'idle', statusText: '未检测', latency: '—' };
      if (!result.configured) return { key, group: 'proxy', name, sub: '—', status: 'idle', statusText: '未配置', latency: '—', advice: { text: hint, toSetup: true } };
      return {
        key, group: 'proxy', name, sub: result.url,
        status: result.available ? 'ok' : 'bad',
        statusText: result.available ? '运行中' : '异常',
        latency: result.available ? `${result.latency}ms` : '—',
        error: result.error,
        advice: result.available ? undefined : { text: '代理服务不可达，可前往代理配置页重新部署', toSetup: true },
      };
    };
    out.push(proxyRow('iptvProxy', 'IPTV 流代理', iptvProxyResult, '部署 IPTV 流代理后可为不可达源提供回退链路'));
    out.push(proxyRow('videoProxy', '视频 CORS 代理', videoProxyResult, '部署 CORS 代理后可恢复跨域受限的视频源'));
    return out;
  }, [networkResult, checkingTabs, iptvResults, videoResults, iptvProgress, videoProgress, iptvProxyResult, videoProxyResult, corsProxy]);

  const filteredRows = segTab === 'all' ? rows : rows.filter((r) => r.group === segTab);
  const selectedRow = selectedKey ? rows.find((r) => r.key === selectedKey) ?? null : null;

  // 获取选中的源名称
  const selectedIPTVNames = (iptvSourceIds || [])
    .map(id => iptvSources.find(s => s.url === id)?.name)
    .filter(Boolean)
    .join(', ') || '未选择';
  const selectedVideoNames = (videoSourceIds || [])
    .map(id => videoSources.find(s => s.id === id)?.name)
    .filter(Boolean)
    .join(', ') || '未选择';
  const iptvProxyUrl = iptvSettings?.proxyUrl || '未配置';
  const videoProxyUrl = corsProxy || '未配置';

  const page = (
    <div ref={pageRef} className="page-padding source-checker-page">
      <div className="source-checker-header">
        <div className="header-left">
          <h1>源检测</h1>
          <p>网络与数据源健康状态 · 结果缓存 30 分钟</p>
        </div>
        <div className="header-right">
          <button
            className="check-all-btn"
            onClick={handleCheckAll}
            disabled={isBatchChecking}
          >
            {isBatchChecking ? '检测中...' : '一键检测'}
          </button>
          {lastCheckTime && (
            <span className={`last-check-time ${isCacheExpired ? 'expired' : ''}`}>
              上次检测: {formatRelativeTime(lastCheckTime)}
            </span>
          )}
        </div>
      </div>

      {/* Hero 结论（监控台改版）：大号可用数 + 状态一句话 */}
      <div className={`source-checker-hero${verdictOk ? ' is-ok' : ''}${!allChecked && !verdictOk ? ' is-idle' : ''}`}>
        <div className="source-checker-hero-num">
          {allChecked || okCount > 0 ? okCount : '—'}<em>/{domainStates.length}</em>
        </div>
        <div className="source-checker-hero-side">
          <span className="source-checker-hero-cap">检查域可用</span>
          <b className="source-checker-hero-state">{verdictText}</b>
        </div>
      </div>

      <div className="source-checker-stats">
        <div className="stat-card">
          <div className="stat-value" style={{ color: networkResult?.error ? 'var(--color-error)' : networkResult ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
            {networkResult?.error ? '异常' : networkResult ? `${networkResult.latency}ms` : '-'}
          </div>
          <div className="stat-label">网速延迟</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: stats.iptv.available > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
            {stats.iptv.total > 0 ? `${stats.iptv.available}/${stats.iptv.total}` : '-'}
          </div>
          <div className="stat-label">IPTV 源</div>
          <div className="stat-config" title={selectedIPTVNames}>{selectedIPTVNames}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: stats.video.available > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
            {stats.video.total > 0 ? `${stats.video.available}/${stats.video.total}` : '-'}
          </div>
          <div className="stat-label">视频源</div>
          <div className="stat-config" title={selectedVideoNames}>{selectedVideoNames}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: iptvProxyResult?.available === true ? 'var(--color-success)' : iptvProxyResult?.available === false ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>
            {iptvProxyResult?.configured ? (iptvProxyResult.available ? '正常' : '异常') : '-'}
          </div>
          <div className="stat-label">IPTV 代理</div>
          <div className="stat-config" title={iptvProxyUrl}>{iptvProxyUrl}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: videoProxyResult?.available === true ? 'var(--color-success)' : videoProxyResult?.available === false ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>
            {videoProxyResult?.configured ? (videoProxyResult.available ? '正常' : '异常') : '-'}
          </div>
          <div className="stat-label">视频代理</div>
          <div className="stat-config" title={videoProxyUrl}>{videoProxyUrl}</div>
        </div>
      </div>

      {/* 工具条：分段筛选（.tab-btn）+ 分组重测（.btn-small）+ 检测中指示 */}
      <div className="source-checker-toolbar">
        <div className="source-checker-tabs">
          <button className={`tab-btn ${segTab === 'all' ? 'active' : ''}`} onClick={() => setSegTab('all')}>
            全部
            <span className="tab-badge available">{rows.filter((r) => r.status === 'ok').length}</span>
          </button>
          <button className={`tab-btn ${segTab === 'network' ? 'active' : ''}`} onClick={() => setSegTab('network')}>
            网速
          </button>
          <button className={`tab-btn ${segTab === 'iptv' ? 'active' : ''}`} onClick={() => setSegTab('iptv')}>
            IPTV 源
            {isChecking('iptv') ? <span className="tab-badge checking">···</span> : stats.iptv.total > 0 && <span className="tab-badge available">{stats.iptv.available}</span>}
          </button>
          <button className={`tab-btn ${segTab === 'video' ? 'active' : ''}`} onClick={() => setSegTab('video')}>
            视频源
            {isChecking('video') ? <span className="tab-badge checking">···</span> : stats.video.total > 0 && <span className="tab-badge available">{stats.video.available}</span>}
          </button>
          <button className={`tab-btn ${segTab === 'proxy' ? 'active' : ''}`} onClick={() => setSegTab('proxy')}>
            代理
            {isChecking('iptvProxy') || isChecking('videoProxy') ? (
              <span className="tab-badge checking">···</span>
            ) : (iptvProxyResult?.available === true || videoProxyResult?.available === true) && (
              <span className={`tab-badge ${iptvProxyResult?.available === false || videoProxyResult?.available === false ? 'error' : 'available'}`}>
                {iptvProxyResult?.available === false || videoProxyResult?.available === false ? '✗' : '✓'}
              </span>
            )}
          </button>
        </div>
        <div className="source-checker-actions">
          <button className="btn-small" onClick={() => handleCheck('network')} disabled={isChecking('network')}>
            {isChecking('network') ? '检测中...' : '网速'}
          </button>
          <button className="btn-small" onClick={() => handleCheck('iptv')} disabled={isChecking('iptv')}>
            {isChecking('iptv') ? `检测中 ${iptvProgress.current}/${iptvProgress.total}` : 'IPTV 源'}
          </button>
          <button className="btn-small" onClick={() => handleCheck('video')} disabled={isChecking('video')}>
            {isChecking('video') ? `检测中 ${videoProgress.current}/${videoProgress.total}` : '视频源'}
          </button>
          <button
            className="btn-small"
            onClick={() => { void handleCheck('iptvProxy'); void handleCheck('videoProxy'); }}
            disabled={isChecking('iptvProxy') || isChecking('videoProxy')}
          >
            {isChecking('iptvProxy') || isChecking('videoProxy') ? '检测中...' : '代理'}
          </button>
          {(isBatchChecking || isChecking('network') || isChecking('iptv') || isChecking('video') || isChecking('iptvProxy') || isChecking('videoProxy')) && (
            <span className="checking-inline">
              <span className="checking-spinner" />
              <span className="checking-text">检测进行中…</span>
            </span>
          )}
        </div>
      </div>

      <div className="source-checker-body">
        <div className="source-checker-main">
          {filteredRows.length === 0 ? (
            <div className="empty-state">尚未检测，点击右上角「一键检测」或工具条按钮开始体检</div>
          ) : (
            <div className="source-checker-table-wrap">
              <table className="source-checker-table">
                <thead>
                  <tr>
                    <th className="c-status">状态</th>
                    <th className="c-name">名称</th>
                    <th className="c-url">地址 / 详情</th>
                    <th className="c-lat">延迟</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr
                      key={r.key}
                      className={`is-${r.status}${selectedKey === r.key ? ' is-selected' : ''}`}
                      onClick={() => setSelectedKey(selectedKey === r.key ? null : r.key)}
                      title={r.error || r.name}
                    >
                      <td className="c-status"><span className="row-pill">{r.statusText}</span></td>
                      <td className="c-name">{r.name}</td>
                      <td className="c-url" title={r.sub}>{r.sub}</td>
                      <td className="c-lat">{r.latency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <dt>地址</dt><dd>{selectedRow.sub}</dd>
              <dt>延迟</dt><dd>{selectedRow.latency}</dd>
              {lastCheckTime && (<><dt>最近检测</dt><dd>{formatRelativeTime(lastCheckTime)}</dd></>)}
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
                  <Link className="rail-link" to="/proxy-setup">前往代理配置页 →</Link>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
      <BackToTopButton />
    </div>
  );

  // 移动端：整页 portal 挂 body（fixed inset:0 覆盖全视口），顶栏替代全局导航栏，
  // 内容在顶栏下方独立滚动 —— 与设置页 SettingsSubPage 完全同模式，无全局 padding 补偿
  return isMobile ? <SubPage title="源检测">{page}</SubPage> : page;
}
