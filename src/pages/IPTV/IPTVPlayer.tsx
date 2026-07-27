import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { UniversalPlayer } from '@/components/UniversalPlayer';
import { useSmartBack } from '@/lib/navigation';
import { useIsMobile, useIsTV } from '@/hooks';
import { shouldProxy, buildProxyUrl } from '@/services/iptvService';
import './IPTVPlayer.css';

export default function IPTVPlayerPage() {
  const [searchParams] = useSearchParams();
  const rawQuery = searchParams.toString();
  const url = searchParams.get('url') || '';
  const navigate = useCustomNavigate();
  const { channels, groups, isLoading, refreshChannels, settings } = useIPTVStore();

  const isTV = useIsTV();
  const isMobile = useIsMobile();
  const platform: 'tv' | 'mobile' | 'desktop' = isTV ? 'tv' : isMobile ? 'mobile' : 'desktop';

  const videoUrl = decodeURIComponent(url);

  /** 从 URL 参数提取频道 ID 和名称 */
  const urlParams = useMemo(() => ({
    id: searchParams.get('id') || '',
    name: searchParams.get('name') || '',
  }), [searchParams]);

  /** 直接从 URL 匹配频道，避免依赖 selectedChannel 导致的延迟 */
  const matchedChannel = useMemo(() => {
    if (!videoUrl || channels.length === 0) return null;
    // 1. 优先用频道 ID 精确匹配
    if (urlParams.id) {
      const byId = channels.find(ch => ch.id === urlParams.id);
      if (byId) return byId;
    }
    // 2. 用频道名称匹配
    if (urlParams.name) {
      const byName = channels.find(ch => ch.name === urlParams.name);
      if (byName) return byName;
    }
    // 3. 直接匹配 URL
    const exact = channels.find(ch => ch.url === videoUrl);
    if (exact) return exact;
    // 4. 代理 URL 匹配：从 /m3u8-proxy?url=... 中提取原始 URL
    try {
      const parsed = new URL(videoUrl);
      const innerUrl = parsed.searchParams.get('url');
      if (innerUrl) {
        return channels.find(ch => ch.url === innerUrl || ch.url === decodeURIComponent(innerUrl)) ?? null;
      }
    } catch { /* not a standard URL */ }
    // 5. 编码/解码容错匹配
    for (const ch of channels) {
      try { if (decodeURIComponent(ch.url) === videoUrl) return ch; } catch { /* ignore */ }
      try { if (ch.url === decodeURIComponent(videoUrl)) return ch; } catch { /* ignore */ }
      try { if (encodeURIComponent(ch.url) === videoUrl) return ch; } catch { /* ignore */ }
    }
    return null;
  }, [videoUrl, channels, urlParams]);

  const channelName = matchedChannel?.name || urlParams.name || 'IPTV 直播';

  useEffect(() => {
    // 优先从 IndexedDB 缓存加载频道数据，避免首次渲染时 channels 为空
    useIPTVStore.getState().loadFromCache().then((loaded) => {
      if (!loaded && channels.length === 0 && !isLoading) {
        refreshChannels();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const handleBack = useSmartBack('/iptv');

  const handleChannelChange = useCallback((channel: { id: string; url: string; name: string }) => {
    const { proxyUrl, proxyPattern } = settings;
    const useProxy = shouldProxy(channel.url, proxyUrl, proxyPattern);
    const playUrl = useProxy
      ? buildProxyUrl(channel.url, proxyUrl)
      : channel.url;
    const encodedUrl = encodeURIComponent(playUrl);
    const params = new URLSearchParams({ url: encodedUrl });
    if (channel.id) params.set('id', channel.id);
    if (channel.name) params.set('name', channel.name);
    navigate(`/iptv/play?${params.toString()}`, { replace: true, state: { from: '/iptv' } });
  }, [navigate, settings]);

  if (!url) {
    navigate('/iptv', { replace: true });
    return null;
  }

  return (
    <div className="iptv-player-page">
      <div className="iptv-player__layout">
        <div className="iptv-player-container">
          <UniversalPlayer
            mode="iptv"
            platform={platform}
            url={rawQuery}
            type="m3u8"
            autoPlay
            channelName={channelName}
            channels={channels}
            groups={groups}
            onBack={handleBack}
            onChannelChange={handleChannelChange}
          />
        </div>
      </div>
    </div>
  );
}
