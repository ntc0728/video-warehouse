/**
 * IPTV 频道卡片组件
 * 展示单个 IPTV 频道信息，支持点击播放、收藏切换和代理播放
 */
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, CheckCircle, XCircle } from 'lucide-react';
import type { IPTVChannel } from '@/types/iptv';
import { useIPTVStore } from '@/stores';
import { useIsTV } from '@/hooks/useMediaQuery';
import { shouldProxy } from '@/services/iptvService';
import LazyImage from '../LazyImage/LazyImage';
import './IPTVChannelCard.css';

interface IPTVChannelCardProps {
  channel: IPTVChannel;
  index?: number;
  hideFavorite?: boolean;
}

const IPTVChannelCard = memo(function IPTVChannelCard({ channel, index = 0, hideFavorite = false }: IPTVChannelCardProps) {
  const navigate = useNavigate();
  // 使用 selector 单独订阅需要的字段,避免每张卡片都订阅整个 IPTVStore。
  // 频道列表 N 张卡片同时订阅任一字段变化会触发 N 次重渲染。
  // settings 通常低频变更 (用户去设置页才改),用 shallow 一次取两个引用字段。
  const toggleFavorite = useIPTVStore((s) => s.toggleFavorite);
  const setSelectedChannel = useIPTVStore((s) => s.setSelectedChannel);
  const recordPlay = useIPTVStore((s) => s.recordPlay);
  const proxyUrl = useIPTVStore((s) => s.settings.proxyUrl);
  const proxyPattern = useIPTVStore((s) => s.settings.proxyPattern);
  const [isAnimating, setIsAnimating] = useState(false);
  const isTV = useIsTV();

  /** 点击播放：记录播放历史，根据代理规则构建播放地址并跳转 */
  const handlePlay = useCallback(() => {
    setSelectedChannel(channel);
    recordPlay(channel.id);
    const useProxy = shouldProxy(channel.url, proxyUrl, proxyPattern);
    const playUrl = useProxy
      ? `${proxyUrl}/m3u8-proxy?url=${encodeURIComponent(channel.url)}`
      : channel.url;
    navigate(`/iptv/play?url=${encodeURIComponent(playUrl)}`, { state: { from: '/iptv' } });
  }, [channel, proxyUrl, proxyPattern, setSelectedChannel, recordPlay, navigate]);

  /** 收藏切换，带弹跳动画反馈 */
  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    toggleFavorite(channel.id);
    setTimeout(() => setIsAnimating(false), 450);
  }, [toggleFavorite, channel.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePlay();
    }
  }, [handlePlay]);

  const staggerDelay = { animationDelay: `${index * 0.012}s` };
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isTitleOverflow, setIsTitleOverflow] = useState(false);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const check = () => {
      const overflow = el.scrollWidth > el.clientWidth;
      setIsTitleOverflow(overflow);
      if (overflow) {
        el.style.setProperty('--marquee-dist', `-${el.scrollWidth - el.clientWidth}px`);
      }
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [channel.name]);

  return (
    <div
      className={`iptv-channel-card ${channel.isAvailable === false ? 'unavailable' : ''} animate-card-enter btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:rounded-lg`}
      style={staggerDelay}
      onClick={handlePlay}
      tabIndex={isTV ? 0 : undefined}
      onKeyDown={isTV ? handleKeyDown : undefined}
    >
      <div className="card-body">
        <div className="iptv-card-cover">
          <LazyImage
            src={channel.logo || ''}
            alt={channel.name}
            letter={channel.name.charAt(0)}
            loadingVariant="brand"
          />
          {channel.isAvailable !== undefined && (
            <div className={`availability-badge ${channel.isAvailable ? 'available' : 'unavailable'}`}>
              {channel.isAvailable ? <CheckCircle size={8} /> : <XCircle size={8} />}
            </div>
          )}
          {channel.group ? (
            <span className="iptv-card-group">{channel.group}</span>
          ) : null}
        </div>
        <div className="iptv-card-info">
          <h3
            ref={titleRef}
            className={`iptv-card-title${isTitleOverflow ? ' marquee' : ''}`}
            title={channel.name}
          >{channel.name}</h3>
        </div>
      </div>
      {!hideFavorite && (
        <button
          className={`iptv-card-favorite ${channel.isFavorite ? 'visible active' : 'hover-visible'} ${isAnimating ? 'animate-pop-bounce' : ''}`}
          onClick={handleFavorite}
          aria-label={channel.isFavorite ? '取消收藏' : '添加收藏'}
        >
          <Heart
            size={13}
            fill={channel.isFavorite ? 'var(--color-favorite-active)' : 'none'}
            color={channel.isFavorite ? 'var(--color-favorite-active)' : 'currentColor'}
          />
        </button>
      )}
    </div>
  );
});

export default IPTVChannelCard;
