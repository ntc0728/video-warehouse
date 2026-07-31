/**
 * 源检测页面
 * 检测5个维度：网速、IPTV源、视频源、IPTV代理、视频代理
 * 每个维度独立检测，支持多个同时进行
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { BackToTopButton } from '@/components/common';
import { getIPTVSources, getVideoSources } from '@/services/sourceService';
import { getText, getJSON } from '@/services/httpClient';
import { useSettingsStore, useIPTVStore } from '@/stores';
import type { VideoSourceConfig, IPTVSourceConfig } from '@/types/source';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { useIsTV } from '@/hooks/useMediaQuery';
import './SourceChecker.css';

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
  const { corsProxy, videoSourceIndices, iptvSourceIndices } = useSettingsStore();
  const { settings: iptvSettings } = useIPTVStore();

  const pageRef = useRef<HTMLDivElement>(null);
  const isTV = useIsTV();
  useSpatialNavigation({ containerRef: pageRef, isTV });

  const [activeTab, setActiveTab] = useState<TabKey>('network');
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

  const checkIPTVSources = useCallback(async (): Promise<SourceCheckItem[]> => {
    const sources = iptvSources;
    const results: SourceCheckItem[] = [];
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      setIptvProgress({ current: i + 1, total: sources.length });
      const start = performance.now();
      try {
        await getText(source.url, { timeout: 8000 });
        results.push({ name: source.name, url: source.url, available: true, latency: Math.round(performance.now() - start) });
      } catch (error) {
        results.push({ name: source.name, url: source.url, available: false, latency: Math.round(performance.now() - start), error: error instanceof Error ? error.message : '请求失败' });
      }
      setIptvResults([...results]);
    }
    return results;
  }, [iptvSources]);

  const checkVideoSources = useCallback(async (): Promise<SourceCheckItem[]> => {
    const sources = videoSources;
    const results: SourceCheckItem[] = [];
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      setVideoProgress({ current: i + 1, total: sources.length });
      const start = performance.now();
      try {
        const data = await getJSON<{ list?: unknown[] }>(source.api, { useProxy: true, timeout: 10000 });
        const videoCount = data?.list?.length;
        results.push({
          name: source.name,
          url: source.api,
          available: true,
          latency: Math.round(performance.now() - start),
          details: videoCount !== undefined ? `${videoCount} 个视频` : undefined,
        });
      } catch (error) {
        results.push({
          name: source.name,
          url: source.api,
          available: false,
          latency: Math.round(performance.now() - start),
          error: error instanceof Error ? error.message : '请求失败',
        });
      }
      setVideoResults([...results]);
    }
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

  // 获取选中的源名称
  const selectedIPTVNames = (iptvSourceIndices || [0])
    .map(i => iptvSources[i]?.name)
    .filter(Boolean)
    .join(', ') || '未选择';
  const selectedVideoNames = (videoSourceIndices || [0])
    .map(i => videoSources[i]?.name)
    .filter(Boolean)
    .join(', ') || '未选择';
  const iptvProxyUrl = iptvSettings?.proxyUrl || '未配置';
  const videoProxyUrl = corsProxy || '未配置';

  return (
    <div ref={pageRef} className="page-padding source-checker-page page-transition-enter">
      <div className="source-checker-header">
        <div className="header-left">
          <h1>源检测</h1>
          <p>检测网络连接和数据源的可用性状态</p>
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

      <div className="source-checker-tabs">
        <button className={`tab-btn ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')}>
          网速
          {isChecking('network') && <span className="tab-badge checking">···</span>}
        </button>
        <button className={`tab-btn ${activeTab === 'iptv' ? 'active' : ''}`} onClick={() => setActiveTab('iptv')}>
          IPTV 源
          {isChecking('iptv') && <span className="tab-badge checking">···</span>}
          {!isChecking('iptv') && stats.iptv.total > 0 && <span className="tab-badge available">{stats.iptv.available}</span>}
        </button>
        <button className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`} onClick={() => setActiveTab('video')}>
          视频源
          {isChecking('video') && <span className="tab-badge checking">···</span>}
          {!isChecking('video') && stats.video.total > 0 && <span className="tab-badge available">{stats.video.available}</span>}
        </button>
        <button className={`tab-btn ${activeTab === 'iptvProxy' ? 'active' : ''}`} onClick={() => setActiveTab('iptvProxy')}>
          IPTV 代理
          {isChecking('iptvProxy') && <span className="tab-badge checking">···</span>}
          {!isChecking('iptvProxy') && iptvProxyResult?.configured && (
            <span className={`tab-badge ${iptvProxyResult.available ? 'available' : 'error'}`}>
              {iptvProxyResult.available ? '✓' : '✗'}
            </span>
          )}
        </button>
        <button className={`tab-btn ${activeTab === 'videoProxy' ? 'active' : ''}`} onClick={() => setActiveTab('videoProxy')}>
          视频代理
          {isChecking('videoProxy') && <span className="tab-badge checking">···</span>}
          {!isChecking('videoProxy') && videoProxyResult?.configured && (
            <span className={`tab-badge ${videoProxyResult.available ? 'available' : 'error'}`}>
              {videoProxyResult.available ? '✓' : '✗'}
            </span>
          )}
        </button>
      </div>

      <div className="source-checker-content">
        {/* 网速检测 */}
        {activeTab === 'network' && (
          <div className="check-panel">
            <div className="panel-header">
              <h3>网络连接检测</h3>
              <button className="btn-small" onClick={() => handleCheck('network')} disabled={isChecking('network')}>
                {isChecking('network') ? '检测中...' : '检测'}
              </button>
            </div>
            {isChecking('network') ? (
              <div className="checking-state">
                <div className="checking-spinner" />
                <div className="checking-text">正在检测网络连接...</div>
              </div>
            ) : networkResult === null ? (
              <div className="empty-state">点击检测测试网络连接</div>
            ) : networkResult.error ? (
              <div className="result-card error">
                <div className="result-icon">✗</div>
                <div className="result-info">
                  <div className="result-title">连接失败</div>
                  <div className="result-detail">{networkResult.error}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="result-card success">
                  <div className="result-icon">✓</div>
                  <div className="result-info">
                    <div className="result-title">连接正常</div>
                    <div className="result-detail">延迟: {networkResult.latency}ms</div>
                  </div>
                </div>
                {networkResult.speed && (
                  <div className="speed-info">
                    <span className="speed-label">估算带宽:</span>
                    <span className="speed-value">{networkResult.speed}</span>
                  </div>
                )}
                <div className="test-points">
                  <h4>测试节点</h4>
                  <ul>
                    {networkResult.nodes.map((point) => (
                      <li key={point.name}>
                        <span className="point-name">{point.name}</span>
                        <span className={`point-status ${point.available ? 'available' : 'error'}`}>
                          {point.available ? `${point.latency}ms` : '不可达'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {/* IPTV源检测 */}
        {activeTab === 'iptv' && (
          <div className="check-panel">
            <div className="panel-header">
              <h3>IPTV 源检测</h3>
              <button className="btn-small" onClick={() => handleCheck('iptv')} disabled={isChecking('iptv')}>
                {isChecking('iptv') ? `检测中 ${iptvProgress.current}/${iptvProgress.total}...` : '检测'}
              </button>
            </div>
            {isChecking('iptv') && iptvResults.length === 0 ? (
              <div className="checking-state">
                <div className="checking-spinner" />
                <div className="checking-text">正在检测 IPTV 源 ({iptvProgress.current}/{iptvProgress.total})...</div>
              </div>
            ) : iptvResults.length === 0 ? (
              <div className="empty-state">点击检测检测 IPTV 源</div>
            ) : (
              <div className="source-list">
                {iptvResults.map((source, index) => (
                  <div key={index} className={`source-item ${source.available ? 'available' : 'error'}`}>
                    <div className="source-status">
                      <span className={`status-dot ${source.available ? 'available' : 'error'}`} />
                    </div>
                    <div className="source-info">
                      <div className="source-name">{source.name}</div>
                      <div className="source-url" title={source.url}>{source.url}</div>
                    </div>
                    <div className="source-meta">
                      <span className="latency">{source.latency}ms</span>
                      {source.error && <span className="error-msg" title={source.error}>{source.error}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 视频源检测 */}
        {activeTab === 'video' && (
          <div className="check-panel">
            <div className="panel-header">
              <h3>视频源检测</h3>
              <button className="btn-small" onClick={() => handleCheck('video')} disabled={isChecking('video')}>
                {isChecking('video') ? `检测中 ${videoProgress.current}/${videoProgress.total}...` : '检测'}
              </button>
            </div>
            {isChecking('video') && videoResults.length === 0 ? (
              <div className="checking-state">
                <div className="checking-spinner" />
                <div className="checking-text">正在检测视频源 ({videoProgress.current}/{videoProgress.total})...</div>
              </div>
            ) : videoResults.length === 0 && !isChecking('video') ? (
              <div className="empty-state">点击检测检测视频源</div>
            ) : (
              <div className="source-list">
                {videoResults.map((source, index) => (
                  <div key={index} className={`source-item ${source.available ? 'available' : 'error'}`}>
                    <div className="source-status">
                      <span className={`status-dot ${source.available ? 'available' : 'error'}`} />
                    </div>
                    <div className="source-info">
                      <div className="source-name">{source.name}</div>
                      {source.details && <div className="source-details">{source.details}</div>}
                    </div>
                    <div className="source-meta">
                      <span className="latency">{source.latency}ms</span>
                      {source.error && <span className="error-msg" title={source.error}>{source.error}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* IPTV代理检测 */}
        {activeTab === 'iptvProxy' && (
          <div className="check-panel">
            <div className="panel-header">
              <h3>IPTV 代理检测</h3>
              <button className="btn-small" onClick={() => handleCheck('iptvProxy')} disabled={isChecking('iptvProxy')}>
                {isChecking('iptvProxy') ? '检测中...' : '检测'}
              </button>
            </div>
            {isChecking('iptvProxy') ? (
              <div className="checking-state">
                <div className="checking-spinner" />
                <div className="checking-text">正在检测 IPTV 代理...</div>
              </div>
            ) : iptvProxyResult === null ? (
              <div className="empty-state">点击检测检测 IPTV 代理</div>
            ) : !iptvProxyResult.configured ? (
              <div className="result-card warning">
                <div className="result-icon">-</div>
                <div className="result-info">
                  <div className="result-title">未配置</div>
                  <div className="result-detail">请在设置中配置 IPTV 代理地址</div>
                </div>
              </div>
            ) : iptvProxyResult.available ? (
              <div className="result-card success">
                <div className="result-icon">✓</div>
                <div className="result-info">
                  <div className="result-title">代理正常</div>
                  <div className="result-detail">延迟: {iptvProxyResult.latency}ms</div>
                </div>
              </div>
            ) : (
              <div className="result-card error">
                <div className="result-icon">✗</div>
                <div className="result-info">
                  <div className="result-title">代理异常</div>
                  <div className="result-detail">{iptvProxyResult.error}</div>
                </div>
              </div>
            )}
            {iptvProxyResult?.configured && iptvProxyResult.url && (
              <div className="proxy-info">
                <span className="proxy-label">代理地址:</span>
                <span className="proxy-url">{iptvProxyResult.url}</span>
              </div>
            )}
          </div>
        )}

        {/* 视频代理检测 */}
        {activeTab === 'videoProxy' && (
          <div className="check-panel">
            <div className="panel-header">
              <h3>视频代理检测</h3>
              <button className="btn-small" onClick={() => handleCheck('videoProxy')} disabled={isChecking('videoProxy')}>
                {isChecking('videoProxy') ? '检测中...' : '检测'}
              </button>
            </div>
            {isChecking('videoProxy') ? (
              <div className="checking-state">
                <div className="checking-spinner" />
                <div className="checking-text">正在检测视频代理...</div>
              </div>
            ) : videoProxyResult === null ? (
              <div className="empty-state">点击检测检测视频代理</div>
            ) : !videoProxyResult.configured ? (
              <div className="result-card warning">
                <div className="result-icon">-</div>
                <div className="result-info">
                  <div className="result-title">未配置</div>
                  <div className="result-detail">请在设置中配置 CORS 代理地址</div>
                </div>
              </div>
            ) : videoProxyResult.available ? (
              <div className="result-card success">
                <div className="result-icon">✓</div>
                <div className="result-info">
                  <div className="result-title">代理正常</div>
                  <div className="result-detail">延迟: {videoProxyResult.latency}ms</div>
                </div>
              </div>
            ) : (
              <div className="result-card error">
                <div className="result-icon">✗</div>
                <div className="result-info">
                  <div className="result-title">代理异常</div>
                  <div className="result-detail">{videoProxyResult.error}</div>
                </div>
              </div>
            )}
            {videoProxyResult?.configured && videoProxyResult.url && (
              <div className="proxy-info">
                <span className="proxy-label">代理地址:</span>
                <span className="proxy-url">{videoProxyResult.url}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <BackToTopButton />
    </div>
  );
}
