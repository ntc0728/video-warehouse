import { useEffect, useRef, useState } from 'react';
import type { IPTVChannel } from '@/types/iptv';
import type { ChannelProgramInfo } from '@/services/epgService';

interface UseEPGDataOptions {
  mode: string;
  channels: IPTVChannel[];
}

export function useEPGData({ mode, channels }: UseEPGDataOptions) {
  const [epgReady, setEpgReady] = useState(false);
  const epgProgramsRef = useRef<Map<string, ChannelProgramInfo>>(new Map());

  useEffect(() => {
    if (mode !== 'iptv' || channels.length === 0) return;
    let cancelled = false;

    const loadEPG = async () => {
      try {
        const { getCachedEPGData, fetchAndParseEPG, matchAllChannels } = await import('@/services/epgService');
        let epgData = await getCachedEPGData();
        if (cancelled) return;

        if (!epgData || epgData.channels.length === 0) {
          try {
            epgData = await fetchAndParseEPG();
          } catch {
            // 拉取失败不影响播放
          }
        }
        if (cancelled) return;

        const programs = matchAllChannels(channels, epgData);
        epgProgramsRef.current = programs;
        setEpgReady(true);
      } catch {
        if (!cancelled) {
          setEpgReady(true);
        }
      }
    };

    loadEPG();
    return () => { cancelled = true; };
  }, [mode, channels]);

  return { epgReady, epgProgramsRef };
}
