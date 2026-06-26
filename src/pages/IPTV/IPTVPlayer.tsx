import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useIPTVStore } from '@/stores';
import { UniversalPlayer } from '@/components/UniversalPlayer';
import { useSmartBack } from '@/lib/navigation';
import { useIsMobile, useIsTV } from '@/hooks';
import { shouldProxy } from '@/services/iptvService';
import './IPTVPlayer.css';

export default function IPTVPlayerPage() {
  const [searchParams] = useSearchParams();
  const url = searchParams.get('url') || '';
  const navigate = useNavigate();
  const { channels, groups, isLoading, refreshChannels, settings } = useIPTVStore();

  const isTV = useIsTV();
  const isMobile = useIsMobile();
  const platform: 'tv' | 'mobile' | 'desktop' = isTV ? 'tv' : isMobile ? 'mobile' : 'desktop';

  const videoUrl = decodeURIComponent(url);

  /** 直接从 URL 匹配频道，避免依赖 selectedChannel 导致的延迟 */
  const matchedChannel = useMemo(() => {
    if (!videoUrl || channels.length === 0) return null;
    return channels.find(ch => ch.url === videoUrl) ?? null;
  }, [videoUrl, channels]);

  const channelName = matchedChannel?.name || 'IPTV 直播';

  useEffect(() => {
    if (channels.length === 0 && !isLoading) {
      refreshChannels();
    }
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

  const handleChannelChange = useCallback((channel: { id: string; url: string }) => {
    const { proxyUrl, proxyPattern } = settings;
    const useProxy = shouldProxy(channel.url, proxyUrl, proxyPattern);
    const playUrl = useProxy
      ? `${proxyUrl}/m3u8-proxy?url=${encodeURIComponent(channel.url)}`
      : channel.url;
    const encodedUrl = encodeURIComponent(playUrl);
    navigate(`/iptv/play?url=${encodedUrl}`, { replace: true, state: { from: '/iptv' } });
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
            url={videoUrl}
            type="m3u8"
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
