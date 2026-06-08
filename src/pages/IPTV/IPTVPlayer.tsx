import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useIPTVStore } from '@/stores';
import { UniversalPlayer } from '@/components/UniversalPlayer';
import { useSmartBack } from '@/lib/navigation';
import './IPTVPlayer.css';

export default function IPTVPlayerPage() {
  const [searchParams] = useSearchParams();
  const url = searchParams.get('url') || '';
  const navigate = useNavigate();
  const { selectedChannel, channels, groups, isLoading, refreshChannels } = useIPTVStore();

  const channelName = selectedChannel?.name || 'IPTV 直播';
  const videoUrl = decodeURIComponent(url);

  /** Store 数据为空时触发加载（页面刷新后恢复数据） */
  useEffect(() => {
    if (channels.length === 0 && !isLoading) {
      refreshChannels();
    }
    // 故意仅在挂载时检查一次：依赖项随 store 状态变化会导致无限循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = useSmartBack('/iptv');

  /** 频道切换：保留 REPLACE 不累积历史，附加 from 以便首次进入后能跳回 /iptv */
  const handleChannelChange = useCallback((channel: { id: string; url: string }) => {
    const encodedUrl = encodeURIComponent(channel.url);
    navigate(`/iptv/play?url=${encodedUrl}`, { replace: true, state: { from: '/iptv' } });
  }, [navigate]);

  if (!url) {
    navigate('/iptv', { replace: true });
    return null;
  }

  return (
    <div className="iptv-player-page">
      <div className="iptv-player-container">
        <UniversalPlayer
          mode="iptv"
          platform="desktop"
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
  );
}
