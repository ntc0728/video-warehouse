import { useCallback, useState } from 'react';
import { usePlayerStore } from '@/stores';
import { playerToast } from '../PlayerToast';
import type { PlayerToastType } from '../PlayerToast';
import { buildChannelPlayUrl, detectVideoSourceType } from '@/services/iptvService';
import type { IPTVChannel } from '@/types/iptv';
import type { SourceType } from '@/types/video';

interface UseIPTVNavigationOptions {
  proxyUrl: string;
  proxyPattern: string;
  onChannelChange?: (channel: IPTVChannel) => void;
  setChannelListVisible: (visible: boolean) => void;
}

export function useIPTVNavigation({
  proxyUrl,
  proxyPattern,
  onChannelChange,
  setChannelListVisible,
}: UseIPTVNavigationOptions) {
  const [currentChannelId, setCurrentChannelId] = useState<string | undefined>(undefined);
  const [currentChannelName, setCurrentChannelName] = useState<string | undefined>(undefined);
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentType, setCurrentType] = useState('');

  const handleChannelSelect = useCallback((channel: IPTVChannel) => {
    usePlayerStore.setState({ isPlaying: false });
    setCurrentChannelId(channel.id);
    setCurrentChannelName(channel.name);
    // 统一入口构建播放地址（预留：携带频道 UA/Referer 由开关控制，默认行为与原先一致）
    const playUrl = buildChannelPlayUrl(channel, proxyUrl, proxyPattern);
    setCurrentUrl(playUrl);
    setCurrentType(detectVideoSourceType(channel.url));
    setChannelListVisible(false);
    onChannelChange?.(channel);
  }, [setChannelListVisible, onChannelChange, proxyUrl, proxyPattern]);

  const handleChannelUp = useCallback((groups: { channels: IPTVChannel[] }[]) => {
    const allChannels = groups.flatMap(g => g.channels);
    const idx = allChannels.findIndex(ch => ch.id === currentChannelId);
    if (idx > 0) handleChannelSelect(allChannels[idx - 1]);
  }, [currentChannelId, handleChannelSelect]);

  const handleChannelDown = useCallback((groups: { channels: IPTVChannel[] }[]) => {
    const allChannels = groups.flatMap(g => g.channels);
    const idx = allChannels.findIndex(ch => ch.id === currentChannelId);
    if (idx < allChannels.length - 1) handleChannelSelect(allChannels[idx + 1]);
  }, [currentChannelId, handleChannelSelect]);

  const handleSourceSwitch = useCallback((index: number, mode: string, currentChannel: IPTVChannel | undefined, _channels: IPTVChannel[], sources: { url: string; type: string }[], toastOpts?: { content?: string; type?: PlayerToastType }) => {
    if (mode === 'iptv' && currentChannel) {
      const sameNameChannels = _channels.filter(
        ch => ch.name === currentChannel.name && ch.sourceId !== currentChannel.sourceId
      );
      if (sameNameChannels.length === 0) return;
      const targetIndex = index % sameNameChannels.length;
      const nextChannel = sameNameChannels[targetIndex];
      if (nextChannel) {
        // 统一入口构建播放地址（预留：携带频道 UA/Referer 由开关控制，默认行为与原先一致）
        const playUrl = buildChannelPlayUrl(nextChannel, proxyUrl, proxyPattern);
        setCurrentUrl(playUrl);
        setCurrentType(detectVideoSourceType(nextChannel.url));
        setCurrentChannelId(nextChannel.id);
        setCurrentChannelName(nextChannel.name);
        onChannelChange?.(nextChannel);
        // 切线路提示（右上角）：C1 自动切换传入专用文案；手动切换默认「已切换到线路 X/Y」
        playerToast(toastOpts?.content ?? `已切换到线路 ${targetIndex + 1}/${sameNameChannels.length}`, 3000, toastOpts?.type);
      }
      return;
    }
    const source = sources[index];
    if (source) {
      setCurrentUrl(source.url);
      setCurrentType(source.type);
      usePlayerStore.getState().setSource(source.url, source.type as SourceType);
    }
  }, [proxyUrl, proxyPattern, onChannelChange]);

  return {
    currentChannelId,
    setCurrentChannelId,
    currentChannelName,
    setCurrentChannelName,
    currentUrl,
    setCurrentUrl,
    currentType,
    setCurrentType,
    handleChannelSelect,
    handleChannelUp,
    handleChannelDown,
    handleSourceSwitch,
  };
}
