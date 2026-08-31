import { useEffect, useRef, useState } from 'react';
import type { IPTVChannel } from '@/types/iptv';
import type { ChannelProgramInfo, EPGChannelInfo } from '@/services/epgService';

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
  /** EPG 频道列表（含 XMLTV icon），供台标候选链使用 */
  epgChannels: EPGChannelInfo[];
}

export function useEPGData({ mode, channels }: UseEPGDataOptions): UseEPGDataResult {
  const [epgReady, setEpgReady] = useState(false);
  const [epgStatus, setEpgStatus] = useState<EPGLoadStatus>('idle');
  const [epgError, setEpgError] = useState<string | null>(null);
  const [epgChannels, setEpgChannels] = useState<EPGChannelInfo[]>([]);
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

        // 缓存优先：有缓存先展示；同时后台校验/刷新过期缓存。
        // fetchAndParseEPG 内部有 TTL（epgUpdateInterval）与 URL 变化判断，
        // 未过期/未变更时直接返回缓存零请求，不会产生多余网络消耗。
        if (epgData && epgData.channels.length > 0) {
          setEpgChannels(epgData.channels);
          const programs = matchAllChannels(channels, epgData);
          epgProgramsRef.current = programs;
          setEpgStatus('success');
          setEpgReady(true);
        } else {
          // 缓存为空或无频道数据：直接走网络获取
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
          if (cancelled) return;

          if (epgData && epgData.channels.length > 0) {
            setEpgChannels(epgData.channels);
            const programs = matchAllChannels(channels, epgData);
            epgProgramsRef.current = programs;
            setEpgStatus('success');
          } else if (!epgErrorRef.current) {
            // 有缓存但无匹配数据
            setEpgStatus('success');
          }
          setEpgReady(true);
        }

        // 后台静默刷新过期缓存（不阻塞展示，失败不覆盖已展示数据）
        fetchAndParseEPG().catch(() => {});
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

  return { epgReady, epgProgramsRef, epgStatus, epgError, epgChannels };
}
