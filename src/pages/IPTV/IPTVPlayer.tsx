import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useIPTVStore } from '@/stores';
import { UniversalPlayer } from '@/components/UniversalPlayer';
import { useSmartBack } from '@/lib/navigation';
import { useIsMobile, useIsTV } from '@/hooks';
import './IPTVPlayer.css';

export default function IPTVPlayerPage() {
  const [searchParams] = useSearchParams();
  const url = searchParams.get('url') || '';
  const navigate = useNavigate();
  const { selectedChannel, channels, groups, isLoading, refreshChannels } = useIPTVStore();

  // Platform 自动检测：TV 优先于 Mobile，TV/Mobile 优先于 Desktop。
  // 修复 platform 硬编码 desktop 导致 .up-platform-mobile / .up-platform-tv 样式不生效的问题。
  const isTV = useIsTV();
  const isMobile = useIsMobile();
  const platform: 'tv' | 'mobile' | 'desktop' = isTV ? 'tv' : isMobile ? 'mobile' : 'desktop';

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

  /**
   * 锁定 body 滚动：
   * 顶层独立路由下 IPTV 播放页本身就是 fixed 全屏，理论上不需要此保护。
   * 但在某些移动 WebView / 旧版 Android Chrome 中，body 仍可能出现 rubber-band
   * 弹性滚动或键盘弹起时的内容抖动。挂载时锁 body 滚动，卸载时还原原值。
   */
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
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
  );
}
