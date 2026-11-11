import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { usePlayerStore } from '@/stores';
import { UniversalPlayer } from '@/components/UniversalPlayer';
import { useSmartBack } from '@/lib/navigation';
import { useIsMobile, useIsTV, useRouteTitleImmediate } from '@/hooks';
import { requestFullscreen, getFullscreenElement } from '@/components/UniversalPlayer/lib/fullscreen';
import { isNativePlatform } from '@/lib/platform';
import { lockLandscape, unlockOrientation } from '@/lib/orientation';
import { buildChannelPlayUrl } from '@/services/iptvService';
import { dropCurtain } from '@/lib/pageTransition';
import { buildCategoryGroups } from './categories';
import type { IPTVChannel } from '@/types/iptv';
import './IPTVPlayer.css';

export default function IPTVPlayerPage() {
  // 进入 IPTV 播放页立即更新页签标题（该路由独立于 AppLayout，需自带兜底）
  useRouteTitleImmediate();
  const [searchParams] = useSearchParams();
  const rawQuery = searchParams.toString();
  const url = searchParams.get('url') || '';
  const navigate = useCustomNavigate();
  const { channels, sourceChannels, extraSourceIds, isLoading, refreshChannels, settings, recordPlay, favoriteChannelIds, toggleFavorite } = useIPTVStore();

  // 与 IPTV 列表页同口径：勾选的「更多台」源频道并入主干，保证播放页能回显频道身份
  // （高亮 / EPG / 同名换线都依赖 channels 里能查到频道）。
  const allChannels = useMemo(() => {
    const extra = extraSourceIds.flatMap(id => sourceChannels[id] ?? []);
    return extra.length > 0 ? [...channels, ...extra] : channels;
  }, [channels, sourceChannels, extraSourceIds]);
  // 频道侧栏分类：与 IPTV 页左栏同款固定文本分类（不再用 M3U 的 group 字段）
  const groups = useMemo(() => buildCategoryGroups(allChannels), [allChannels]);
  const pageRef = useRef<HTMLDivElement>(null);

  const isTV = useIsTV();
  const isMobile = useIsMobile();
  const platform: 'tv' | 'mobile' | 'desktop' = isTV ? 'tv' : isMobile ? 'mobile' : 'desktop';

  // 入口（列表卡片/收藏/历史）是「手动 encode + URLSearchParams」双重编码，
  // searchParams.get 只解一层 → 这里再解一次，与 useIPTVChannelInit 内部口径一致。
  // 播放页内切台只编码一次，解两层会破坏代理内层 URL，但 id 命中时由 init 重建播放地址兜底。
  const videoUrl = useMemo(() => {
    if (!url) return '';
    try { return decodeURIComponent(url); } catch { return url; }
  }, [url]);

  /** 从 URL 参数提取频道 ID 和名称 */
  const urlParams = useMemo(() => ({
    id: searchParams.get('id') || '',
    name: searchParams.get('name') || '',
  }), [searchParams]);
  // 当前频道收藏态：换台时 URL 参数同步替换 → id 跟随，收藏态自动更新
  const isChannelFavorite = urlParams.id ? favoriteChannelIds.includes(urlParams.id) : false;
  const handleToggleFavorite = useCallback(() => {
    if (urlParams.id) toggleFavorite(urlParams.id);
  }, [urlParams.id, toggleFavorite]);

  /** 直接从 URL 匹配频道，避免依赖 selectedChannel 导致的延迟 */
  const matchedChannel = useMemo(() => {
    if (!videoUrl || allChannels.length === 0) return null;
    // 1. 优先用频道 ID 精确匹配
    if (urlParams.id) {
      const byId = allChannels.find(ch => ch.id === urlParams.id);
      if (byId) return byId;
    }
    // 2. 用频道名称匹配
    if (urlParams.name) {
      const byName = allChannels.find(ch => ch.name === urlParams.name);
      if (byName) return byName;
    }
    // 3. 直接匹配 URL
    const exact = allChannels.find(ch => ch.url === videoUrl);
    if (exact) return exact;
    // 4. 代理 URL 匹配：从 /m3u8-proxy?url=... 中提取原始 URL
    try {
      const parsed = new URL(videoUrl);
      const innerUrl = parsed.searchParams.get('url');
      if (innerUrl) {
        return allChannels.find(ch => ch.url === innerUrl || ch.url === decodeURIComponent(innerUrl)) ?? null;
      }
    } catch { /* not a standard URL */ }
    // 5. 编码/解码容错匹配
    for (const ch of allChannels) {
      try { if (decodeURIComponent(ch.url) === videoUrl) return ch; } catch { /* ignore */ }
      try { if (ch.url === decodeURIComponent(videoUrl)) return ch; } catch { /* ignore */ }
      try { if (encodeURIComponent(ch.url) === videoUrl) return ch; } catch { /* ignore */ }
    }
    return null;
  }, [videoUrl, allChannels, urlParams]);

  const channelName = matchedChannel?.name || urlParams.name || 'IPTV 直播';

  // 额外源频道按需加载：深链/收藏/历史进入时 store 里可能还没有它们
  useEffect(() => {
    for (const id of extraSourceIds) {
      void useIPTVStore.getState().ensureSourceChannels(id);
    }
  }, [extraSourceIds]);

  useEffect(() => {
    // 优先从 IndexedDB 缓存加载频道数据，避免首次渲染时 channels 为空
    useIPTVStore.getState().loadFromCache().then((loaded) => {
      if (!loaded && channels.length === 0 && !isLoading) {
        refreshChannels();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 离开播放页复位频道列表可见性：该状态在全局 player store，IPTV 页此前不复位，
  // 会导致下次进入其它播放页时控制栏被「面板可见」规则自动隐藏。
  useEffect(() => () => {
    usePlayerStore.getState().setChannelListVisible(false);
  }, []);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // 黑场转场的收尾：本页挂载（播放器已就位、黑底已铺满）后放幕。
  // 播放器自身不做任何进场动画 —— 幕布淡出只是把"黑"换成"播放器画面"，
  // 中间没有亮度跃变，也没有播放器首帧的重采样闪烁。
  // 双帧再放幕：首帧时 chunk 刚 eval，DOM 可能还没完成首次绘制。
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => dropCurtain());
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, []);

  // TV 端进入 IPTV 播放页默认全屏（无用户手势可能被拦截，静默失败；退出后不再次强制）
  useEffect(() => {
    if (!isTV) return;
    const el = pageRef.current;
    if (!el || getFullscreenElement()) return;
    requestFullscreen(el).catch(() => { /* 平台不支持/无手势时静默 */ });
  }, [isTV]);

  //app 端进入 IPTV 播放页自动横屏（全屏铺满播放），离开恢复系统默认方向。
  // web 端 isNativePlatform() 守卫 + 动态 import，零影响；个别 ROM 锁失败静默。
  useEffect(() => {
    if (!isNativePlatform()) return;
    void lockLandscape();
    return () => {
      void unlockOrientation();
    };
  }, []);

  const handleBack = useSmartBack('/iptv');

  const handleChannelChange = useCallback((channel: IPTVChannel) => {
    const { proxyUrl, proxyPattern } = settings;
    // 统一入口构建播放地址（预留：携带频道 UA/Referer 由开关控制，默认行为与原先一致）
    const playUrl = buildChannelPlayUrl(channel, proxyUrl, proxyPattern);
    // URLSearchParams 自动编码，不需要手动 encodeURIComponent（否则双重编码）
    const params = new URLSearchParams({ url: playUrl });
    if (channel.id) params.set('id', channel.id);
    if (channel.name) params.set('name', channel.name);
    // 换台/换线即时记入观看历史（此前只有列表卡片点击会写 → 历史页不更新）
    recordPlay(channel);
    navigate(`/iptv/play?${params.toString()}`, { replace: true, state: { from: '/iptv' } });
  }, [navigate, settings, recordPlay]);

  if (!url) {
    navigate('/iptv', { replace: true });
    return null;
  }

  return (
    <div className="iptv-player-page" ref={pageRef}>
      <div className="iptv-player__layout">
        <div className="iptv-player-container">
          <UniversalPlayer
            mode="iptv"
            platform={platform}
            url={videoUrl}
            initQuery={rawQuery}
            type="m3u8"
            autoPlay
            channelName={channelName}
            channels={allChannels}
            channelFavorite={isChannelFavorite}
            onToggleFavorite={handleToggleFavorite}
            groups={groups}
            onBack={handleBack}
            onChannelChange={handleChannelChange}
          />
        </div>
      </div>
    </div>
  );
}
