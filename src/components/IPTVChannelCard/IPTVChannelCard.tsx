/**
 * IPTV 频道卡片组件
 * 展示单个 IPTV 频道信息，支持点击播放、收藏切换和代理播放
 */
import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';
import type { IPTVChannel } from '@/types/iptv';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { useIsTV } from '@/hooks/useMediaQuery';
import { buildChannelPlayUrl } from '@/services/iptvService';
import { resolveChannelLogoCandidates, markLogoFailed, markLogoSucceeded } from '@/services/channelLogo';
import LazyImage from '../LazyImage/LazyImage';
import './IPTVChannelCard.css';
import { Icon } from "@/components/ui/Icon";

interface IPTVChannelCardProps {
  channel: IPTVChannel;
  hideFavorite?: boolean;
  batchMode?: boolean;
  /** 「更多台」来源角标文本（设置页启用的 IPTV 源名）；undefined 表示主干频道不显示 */
  sourceBadge?: string;
}

const IPTVChannelCard = memo(function IPTVChannelCard({ channel, hideFavorite = false, batchMode = false, sourceBadge }: IPTVChannelCardProps) {
  const toggleFavorite = useIPTVStore((s) => s.toggleFavorite);
  const setSelectedChannel = useIPTVStore((s) => s.setSelectedChannel);
  const recordPlay = useIPTVStore((s) => s.recordPlay);
  const proxyUrl = useIPTVStore((s) => s.settings.proxyUrl);
  const proxyPattern = useIPTVStore((s) => s.settings.proxyPattern);
  const sourceNames = useIPTVStore((s) => s.settings.sourceNames);
  const isTV = useIsTV();
  // 收藏按钮不依赖台标加载结果。此前是 (imageLoaded || !channel.logo)：台标 404、
  // 被网络/广告拦截，或命中失败记忆（resolveChannelLogoCandidates 返回空数组）时
  // onLoad 永不触发、imageLoaded 恒 false → 整颗红心不渲染。
  // 实测 IPTV 页 60 张卡只有 3 颗红心，正是这条门控造成的（用户反馈「收藏图标被覆盖」）。
  const showFavorite = !batchMode && !hideFavorite;

  const sourceName = channel.sourceId && sourceNames
    ? sourceNames[parseInt(channel.sourceId.replace('source-', ''), 10)]
    : undefined;
  // 当前所在页（收藏/历史/列表等），用作深链兜底返回来源。
  // 正常应用内导航由 useSmartBack 走浏览器原生后退（navigate(-1)）回退到本页，
  // 此 from 仅在深链直达 /iptv/play 时作为兜底。
  const location = useLocation();

  /** 台标候选（iptv-org logos.json 单一来源，见 channelLogo.ts）；无 logo 走字母占位 */
  const logoCandidates = useMemo(
    () => resolveChannelLogoCandidates(channel),
    [channel]
  );

  /** 构建播放链接：根据代理规则生成最终 URL（统一入口，预留 UA/Referer 携带） */
  const to = useMemo(() => {
    if (batchMode) return '#';
    const playUrl = buildChannelPlayUrl(channel, proxyUrl, proxyPattern);
    const params = new URLSearchParams({ url: encodeURIComponent(playUrl) });
    params.set('id', channel.id);
    params.set('name', channel.name);
    return `/iptv/play?${params.toString()}`;
  }, [batchMode, channel, proxyUrl, proxyPattern]);

  /** 跳转前记录播放历史与当前选中频道 */
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (batchMode) {
      e.preventDefault();
      return;
    }
    setSelectedChannel(channel);
    recordPlay(channel.id);
  }, [batchMode, channel, setSelectedChannel, recordPlay]);

  /** 收藏切换（动效统一由按钮 hover/scale 过渡承担，不再做弹跳动画） */
  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // 鼠标点击后主动移除焦点：否则取消收藏后按钮因 :focus-within 常显不消失
    if (e.detail > 0) (e.currentTarget as HTMLElement).blur();
    toggleFavorite(channel.id);
  }, [toggleFavorite, channel.id]);

  // [2026-08-13] 入场动画统一由网格容器 stagger 控制（.iptv-channel-grid > *:nth-child(n)，
  // 与收藏页/浏览页 .video-card-grid 的阶梯入场完全一致），卡片自身不再写死 delay。
  const titleRef = useRef<HTMLDivElement>(null);
  const [isTitleOverflow, setIsTitleOverflow] = useState(false);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const check = () => {
      const textEl = el.querySelector('.iptv-card-title-text') as HTMLElement | null;
      if (!textEl) return;
      const overflow = textEl.scrollWidth > el.clientWidth;
      setIsTitleOverflow(overflow);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [channel.name]);

  const cardClassName = `iptv-channel-card btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:rounded-lg`;

  const cardBody = (
    <div className="card-body">
      <div className="iptv-card-cover">
        <LazyImage
          src={logoCandidates[0] ?? ''}
          srcCandidates={logoCandidates.slice(1)}
          alt={channel.name}
          // IPTV 台标失败/缺失：走 LazyImage fallbackVariant="tv" → 渲染 lucide Tv 图标
          // + kinoTV 品牌字，与视频兜底 MonitorPlay 图标区分（视频/IPTV 占位逻辑分离）。
          fallbackVariant="tv"
          onLoad={(url) => {
            // 成功记忆：跨会话优先复用该 URL，避免下次重新走候选链
            if (url) markLogoSucceeded(url);
          }}
          onError={(_, failedUrl) => {
            // 候选 URL 失败后记入失败记忆，避免后续重复请求
            if (failedUrl) markLogoFailed(failedUrl);
          }}
        />
        {/* 横向 cover 失败兜底：LazyImage fallbackVariant="tv" 渲染 lucide Tv 图标 + kinoTV 品牌字 */}
        {/* 批量模式下隐藏封面角标。LIVE 绿色角标为常驻展示（可用性检测已移除）。 */}
        {!batchMode && (
          <div className="iptv-card-cover__badges">
            <span className="record-card__live-badge is-available">LIVE</span>
            {/* 「更多台」来源角标（紫色）：勾选的设置页 IPTV 源名 */}
            {sourceBadge && (
              <span className="iptv-card-source-badge">{sourceBadge}</span>
            )}
          </div>
        )}
        {!batchMode && channel.group ? (
          <span className="iptv-card-group">{channel.group}</span>
        ) : null}
        {!batchMode && sourceName && (
          <span className="iptv-card-source">{sourceName}</span>
        )}
      </div>
      <div className="iptv-card-info">
        <div
          ref={titleRef}
          className={`iptv-card-title${isTitleOverflow ? ' marquee' : ''}`}
          title={channel.name}
        >
          <span className="iptv-card-title-track">
            <span className="iptv-card-title-text">{channel.name}</span>
            {isTitleOverflow && (
              <span className="iptv-card-title-text">{channel.name}</span>
            )}
          </span>
        </div>
        {/* P2 增强层：iptv-org 英文名（与中文台名不同时才展示，避免重复） */}
        {channel.name_en && channel.name_en !== channel.name && (
          <div className="iptv-card-subtitle">{channel.name_en}</div>
        )}
        {/* P2 增强层：iptv-org 分类（group-title），可能为空，做好条件渲染 */}
        {channel.categories && channel.categories.length > 0 && (
          <div className="iptv-card-categories">{channel.categories.join(' / ')}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="iptv-channel-card-wrap animate-fade-in-up">
      {batchMode ? (
        <div
          className={cardClassName}
          aria-label={`播放 ${channel.name}`}
          tabIndex={isTV ? 0 : undefined}
        >
          {cardBody}
        </div>
      ) : (
        <Link
          to={to}
          state={{ from: location.pathname }}
          className={cardClassName}
          onClick={handleClick}
          aria-label={`播放 ${channel.name}`}
          tabIndex={isTV ? 0 : undefined}
        >
          {cardBody}
        </Link>
      )}
      {/* 批量模式下隐藏收藏按钮 */}
      {showFavorite && (
        <button
          type="button"
          className={`iptv-card-favorite ${channel.isFavorite ? 'visible active' : 'hover-visible'}`}
          onClick={handleFavorite}
          aria-label={channel.isFavorite ? '取消收藏' : '添加收藏'}
          aria-pressed={channel.isFavorite}
        >
          <Icon icon={Heart} size="xs" fill="currentColor" />
        </button>
      )}
    </div>
  );
});

export default IPTVChannelCard;
