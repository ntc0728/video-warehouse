import { useEffect } from 'react';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { shouldProxy, buildProxyUrl, detectVideoSourceType } from '@/services/iptvService';
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
    if (mode !== 'iptv' || !url || channels.length === 0) return;

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

    // 优先用频道 ID 精确匹配
    if (urlId) {
      const matched = channels.find(ch => ch.id === urlId);
      if (matched) {
        setCurrentChannelId(matched.id);
        setCurrentChannelName(matched.name);
        const { proxyUrl: pUrl, proxyPattern: pPattern } = useIPTVStore.getState().settings;
        const useProxy = shouldProxy(matched.url, pUrl, pPattern);
        setCurrentUrl(useProxy ? buildProxyUrl(matched.url, pUrl) : matched.url);
        setCurrentType(detectVideoSourceType(matched.url));
        for (let g = 0; g < groups.length; g++) {
          const chIndex = groups[g].channels.findIndex(ch => ch.id === matched.id);
          if (chIndex >= 0) {
            setTvFocusGroupIndex(g);
            setTvFocusChannelIndex(chIndex);
            break;
          }
        }
        return;
      }
    }

    // URL 匹配
    const matched = channels.find(ch => {
      if (ch.url === lookupUrl) return true;
      try { if (decodeURIComponent(ch.url) === lookupUrl) return true; } catch { /* decode failed */ }
      try { if (ch.url === decodeURIComponent(lookupUrl)) return true; } catch { /* decode failed */ }
      try { if (encodeURIComponent(ch.url) === lookupUrl) return true; } catch { /* encode failed */ }
      try { if (ch.url === encodeURIComponent(lookupUrl)) return true; } catch { /* encode failed */ }
      return false;
    });
    const targetUrl = matched ? matched.url : lookupUrl;

    const { proxyUrl: pUrl, proxyPattern: pPattern } = useIPTVStore.getState().settings;
    const useProxy = shouldProxy(targetUrl, pUrl, pPattern);
    const playUrl = useProxy ? buildProxyUrl(targetUrl, pUrl) : targetUrl;

    setCurrentUrl(playUrl);
    setCurrentType(detectVideoSourceType(targetUrl));

    if (matched) {
      setCurrentChannelId(matched.id);
      setCurrentChannelName(matched.name);
      for (let g = 0; g < groups.length; g++) {
        const chIndex = groups[g].channels.findIndex(ch => ch.id === matched.id);
        if (chIndex >= 0) {
          setTvFocusGroupIndex(g);
          setTvFocusChannelIndex(chIndex);
          break;
        }
      }
    } else if (urlName) {
      const byName = channels.find(ch => ch.name === urlName);
      if (byName) {
        setCurrentChannelId(byName.id);
        setCurrentChannelName(byName.name);
      }
    }
  }, [url, channels, groups, mode, setCurrentChannelId, setCurrentChannelName, setCurrentType, setCurrentUrl, setTvFocusGroupIndex, setTvFocusChannelIndex]);

  // URL 匹配失败时的兜底：用 channelName prop 反查频道
  useEffect(() => {
    if (mode !== 'iptv' || !channelName) return;
    // This is handled by the caller via a separate effect if needed
  }, [mode, channelName]);
}
