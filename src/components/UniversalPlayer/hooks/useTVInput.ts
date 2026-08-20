import { useCallback, useRef, useState, useMemo } from 'react';
import { usePlayerStore } from '@/stores';
import { useTVRemote } from './useTVRemote';
import { playerToast } from '../PlayerToast';
import type { IPTVChannel } from '@/types/iptv';

interface UseTVInputOptions {
  platform: string;
  mode: string;
  isChannelListVisible: boolean;
  playerCore: { togglePlay: () => void; setVolume: (v: number) => void };
  groups: { channels: IPTVChannel[] }[];
  onChannelSelect: (channel: IPTVChannel) => void;
  onToggleChannelList: () => void;
  /** 遥控器音量调节时展示音量柱（VolumePopup） */
  showVolumePopup: () => void;
}

export function useTVInput({
  platform,
  mode,
  isChannelListVisible,
  playerCore,
  groups,
  onChannelSelect,
  onToggleChannelList,
  showVolumePopup,
}: UseTVInputOptions) {
  const digitTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [digitBuffer, setDigitBuffer] = useState('');
  const [tvFocusGroupIndex, setTvFocusGroupIndex] = useState(0);
  const [tvFocusChannelIndex, setTvFocusChannelIndex] = useState(0);
  const [tvFocusSection, setTvFocusSection] = useState<'groups' | 'channels'>('groups');

  const activeGroup = groups[tvFocusGroupIndex];
  const activeChannels = useMemo(() => activeGroup?.channels ?? [], [activeGroup]);

  const handleTvFocusMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (tvFocusSection === 'groups') {
      switch (direction) {
        case 'up':
          setTvFocusGroupIndex(prev => Math.max(0, prev - 1));
          break;
        case 'down':
          setTvFocusGroupIndex(prev => Math.min(groups.length - 1, prev + 1));
          break;
        case 'right':
          setTvFocusSection('channels');
          setTvFocusChannelIndex(0);
          break;
      }
    } else {
      switch (direction) {
        case 'up':
          setTvFocusChannelIndex(prev => Math.max(0, prev - 1));
          break;
        case 'down':
          setTvFocusChannelIndex(prev => Math.min(activeChannels.length - 1, prev + 1));
          break;
        case 'left':
          setTvFocusSection('groups');
          break;
      }
    }
  }, [tvFocusSection, groups.length, activeChannels.length]);

  const handleTvFocusConfirm = useCallback(() => {
    if (tvFocusSection === 'channels' && activeChannels[tvFocusChannelIndex]) {
      const channel = activeChannels[tvFocusChannelIndex];
      onChannelSelect(channel);
      // TV 端换频道右上角提示
      playerToast(`已切换到${channel.name}`);
    }
  }, [tvFocusSection, activeChannels, tvFocusChannelIndex, onChannelSelect]);

  const handleTvDigitInput = useCallback((digit: number) => {
    clearTimeout(digitTimerRef.current);
    const newBuffer = digitBuffer + String(digit);
    const globalIndex = parseInt(newBuffer, 10) - 1;

    let cumulative = 0;
    for (let g = 0; g < groups.length; g++) {
      const gChannels = groups[g].channels;
      if (globalIndex < cumulative + gChannels.length) {
        const channelIndex = globalIndex - cumulative;
        const channel = gChannels[channelIndex];
        if (channel) {
          setTvFocusGroupIndex(g);
          setTvFocusChannelIndex(channelIndex);
          setTvFocusSection('channels');
          onChannelSelect(channel);
          // TV 端遥控器频道号输入切换右上角提示
          playerToast(`已切换到${channel.name}（${newBuffer}）`);
        }
        break;
      }
      cumulative += gChannels.length;
    }

    setDigitBuffer(newBuffer);
    digitTimerRef.current = setTimeout(() => setDigitBuffer(''), 500);
  }, [digitBuffer, groups, onChannelSelect]);

  useTVRemote({
    platform,
    isChannelListVisible,
    // IPTV 直播无“暂停”语义：遥控器 播放/暂停键 不触发 togglePlay；VOD 仍可用
    onTogglePlay: () => {
      if (mode === 'iptv') return;
      playerCore.togglePlay();
    },
    onBack: () => {},
    onVolumeUp: () => {
      const next = Math.min(1, usePlayerStore.getState().volume + 0.1);
      playerCore.setVolume(next);
      showVolumePopup();
      playerToast(`音量 ${Math.round(next * 100)}%`);
    },
    onVolumeDown: () => {
      const next = Math.max(0, usePlayerStore.getState().volume - 0.1);
      playerCore.setVolume(next);
      showVolumePopup();
      playerToast(`音量 ${Math.round(next * 100)}%`);
    },
    onToggleChannelList,
    onFocusMove: handleTvFocusMove,
    onFocusConfirm: handleTvFocusConfirm,
    onDigitInput: handleTvDigitInput,
  });

  return {
    tvFocusGroupIndex,
    setTvFocusGroupIndex,
    tvFocusChannelIndex,
    setTvFocusChannelIndex,
    tvFocusSection,
    setTvFocusSection,
    digitBuffer,
  };
}
