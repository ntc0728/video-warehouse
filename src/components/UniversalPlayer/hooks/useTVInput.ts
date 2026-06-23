import { useCallback, useRef, useState, useMemo } from 'react';
import { usePlayerStore } from '@/stores';
import { useTVRemote } from './useTVRemote';
import type { IPTVChannel } from '@/types/iptv';

interface UseTVInputOptions {
  platform: string;
  isChannelListVisible: boolean;
  playerCore: { togglePlay: () => void; setVolume: (v: number) => void };
  groups: { channels: IPTVChannel[] }[];
  onChannelSelect: (channel: IPTVChannel) => void;
  onToggleChannelList: () => void;
}

export function useTVInput({
  platform,
  isChannelListVisible,
  playerCore,
  groups,
  onChannelSelect,
  onToggleChannelList,
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
      onChannelSelect(activeChannels[tvFocusChannelIndex]);
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
    onTogglePlay: () => playerCore.togglePlay(),
    onBack: () => {},
    onVolumeUp: () => {
      playerCore.setVolume(Math.min(1, (usePlayerStore.getState().volume + 0.1)));
    },
    onVolumeDown: () => {
      playerCore.setVolume(Math.max(0, (usePlayerStore.getState().volume - 0.1)));
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
