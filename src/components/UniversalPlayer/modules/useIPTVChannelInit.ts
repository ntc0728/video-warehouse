import { useEffect } from 'react';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { buildChannelPlayUrl, detectVideoSourceType } from '@/services/iptvService';
import type { IPTVChannel, IPTVGroup } from '@/types/iptv';

interface UseIPTVChannelInitOptions {
  mode: 'video' | 'iptv' | 'live';
  url: string;
  channels: IPTVChannel[];
  groups: IPTVGroup[];
  channelName?: string;
  setCurrentChannelId: (id: string) => void;
  setCurrentChannelName: (name: string) => void;
  setCurrentUrl: (url: string) => void;
  setCurrentType: (type: string) => void;
  setTvFocusGroupIndex: (i: number) => void;
  setTvFocusChannelIndex: (i: number) => void;
}

export function useIPTVChannelInit({
  mode, url, channels, groups, channelName,
  setCurrentChannelId, setCurrentChannelName,
  setCurrentUrl, setCurrentType,
  setTvFocusGroupIndex, setTvFocusChannelIndex,
}: UseIPTVChannelInitOptions) {
  // 从 URL 初始化 IPTV 频道
  useEffect(() => {
    if (mode !== 'iptv' || !url) return;

    let urlId = '';
    let urlName = '';
    let lookupUrl = url;
    try {
      const sp = new URLSearchParams(url);
      urlId = sp.get('id') || '';
      urlName = sp.get('name') || '';
      const rawUrl = sp.get('url');
      if (rawUrl) lookupUrl = decodeURIComponent(rawUrl);
    } catch {
      try {
        const parsed = new URL(url);
        const urlMatch = parsed.search.match(/[?&]url=([^&]*)/);
        if (urlMatch) lookupUrl = urlMatch[1];
      } catch { /* use as-is */ }
    }

    const setTvFocus = (id: string) => {
      for (let g = 0; g < groups.length; g++) {
        const chIndex = groups[g].channels.findIndex(ch => ch.id === id);
        if (chIndex >= 0) {
          setTvFocusGroupIndex(g);
          setTvFocusChannelIndex(chIndex);
          break;
        }
      }
    };

    const { proxyUrl: pUrl, proxyPattern: pPattern } = useIPTVStore.getState().settings;

    // 频道列表已加载：优先做频道精确匹配（拿到正确的频道 URL / 分组焦点）
    if (channels.length > 0) {
      if (urlId) {
        const matched = channels.find(ch => ch.id === urlId);
        if (matched) {
          setCurrentChannelId(matched.id);
          setCurrentChannelName(matched.name);
          // 统一入口构建播放地址（预留：携带频道 UA/Referer 由开关控制，默认行为与原先一致）
          setCurrentUrl(buildChannelPlayUrl(matched, pUrl, pPattern));
          setCurrentType(detectVideoSourceType(matched.url));
          setTvFocus(matched.id);
          return;
        }
      }

      const matched = channels.find(ch => {
        if (ch.url === lookupUrl) return true;
        try { if (decodeURIComponent(ch.url) === lookupUrl) return true; } catch { /* decode failed */ }
        try { if (ch.url === decodeURIComponent(lookupUrl)) return true; } catch { /* decode failed */ }
        try { if (encodeURIComponent(ch.url) === lookupUrl) return true; } catch { /* encode failed */ }
        try { if (ch.url === encodeURIComponent(lookupUrl)) return true; } catch { /* encode failed */ }
        return false;
      });
      const targetUrl = matched ? matched.url : lookupUrl;
      // 统一入口构建播放地址（预留：携带频道 UA/Referer 由开关控制，默认行为与原先一致）
      const playUrl = buildChannelPlayUrl(matched ?? { url: targetUrl }, pUrl, pPattern);

      setCurrentUrl(playUrl);
      setCurrentType(detectVideoSourceType(targetUrl));

      if (matched) {
        setCurrentChannelId(matched.id);
        setCurrentChannelName(matched.name);
        setTvFocus(matched.id);
      } else if (urlName) {
        const byName = channels.find(ch => ch.name === urlName);
        if (byName) {
          setCurrentChannelId(byName.id);
          setCurrentChannelName(byName.name);
        }
      }
      return;
    }

    // 频道列表尚未加载（如直接深链到 /iptv/play 的首访场景）：
    // 仍按 URL 参数直接播放，等频道列表加载后再做一次精匹配。
    const playUrl = buildChannelPlayUrl({ url: lookupUrl }, pUrl, pPattern);
    setCurrentUrl(playUrl);
    setCurrentType(detectVideoSourceType(lookupUrl));
    if (urlName) setCurrentChannelName(urlName);
  }, [url, channels, groups, mode, setCurrentChannelId, setCurrentChannelName, setCurrentType, setCurrentUrl, setTvFocusGroupIndex, setTvFocusChannelIndex]);

  // URL 匹配失败时的兜底：用 channelName prop 反查频道
  useEffect(() => {
    if (mode !== 'iptv' || !channelName) return;
    // This is handled by the caller via a separate effect if needed
  }, [mode, channelName]);
}
