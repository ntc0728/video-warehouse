import { useEffect, useRef, useState } from 'react';
import type { IPTVChannel } from '@/types/iptv';
import type { ChannelProgramInfo } from '@/services/epgService';

interface UseEPGDataOptions {
  mode: string;
  channels: IPTVChannel[];
}

export type EPGLoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseEPGDataResult {
  epgReady: boolean;
  epgProgramsRef: React.MutableRefObject<Map<string, ChannelProgramInfo>>;
  epgStatus: EPGLoadStatus;
  epgError: string | null;
}

export function useEPGData({ mode, channels }: UseEPGDataOptions): UseEPGDataResult {
  const [epgReady, setEpgReady] = useState(false);
  const [epgStatus, setEpgStatus] = useState<EPGLoadStatus>('idle');
  const [epgError, setEpgError] = useState<string | null>(null);
  const epgProgramsRef = useRef<Map<string, ChannelProgramInfo>>(new Map());
  const epgErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== 'iptv' || channels.length === 0) return;
    let cancelled = false;

    const loadEPG = async () => {
      setEpgStatus('loading');
      setEpgError(null);
      epgErrorRef.current = null;

      try {
        const { getCachedEPGData, fetchAndParseEPG, matchAllChannels } = await import('@/services/epgService');
        let epgData = await getCachedEPGData();
        if (cancelled) return;

        // 如果缓存为空或无频道数据，尝试从网络获取
        if (!epgData || epgData.channels.length === 0) {
          try {
            epgData = await fetchAndParseEPG();
          } catch (err) {
            // 网络获取失败
            if (!cancelled) {
              const errMsg = err instanceof Error ? err.message : '节目单加载失败';
              setEpgError(errMsg);
              epgErrorRef.current = errMsg;
              setEpgStatus('error');
            }
          }
        }
        if (cancelled) return;

        if (epgData && epgData.channels.length > 0) {
          const programs = matchAllChannels(channels, epgData);
          epgProgramsRef.current = programs;
          setEpgStatus('success');
        } else if (!epgErrorRef.current) {
          // 有缓存但无匹配数据
          setEpgStatus('success');
        }

        setEpgReady(true);
      } catch {
        if (!cancelled) {
          setEpgReady(true);
          setEpgStatus('error');
          setEpgError('节目单数据加载异常');
        }
      }
    };

    loadEPG();
    return () => { cancelled = true; };
  }, [mode, channels]);

  return { epgReady, epgProgramsRef, epgStatus, epgError };
}
