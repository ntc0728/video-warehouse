import { useState, useEffect, useCallback, useRef } from 'react';

interface PlayerCoreApi {
  isLive: () => boolean;
  getLiveLatency: () => number;
  getSeekableStart: () => number;
  getSeekableEnd: () => number;
  getCurrentTime: () => number;
  seek: (time: number) => void;
}

interface UseTimeshiftOptions {
  mode: string;
  playerCore: PlayerCoreApi;
  /** 检查间隔（毫秒，默认 2000） */
  checkIntervalMs?: number;
  /** 延迟阈值（秒）— 超过此值视为用户处于时移状态 */
  latencyThreshold?: number;
}

interface UseTimeshiftResult {
  /** 流是否支持时移（DVR 窗口 > 0） */
  supportsTimeshift: boolean;
  /** 用户当前是否在观看时移内容 */
  isTimeshifted: boolean;
  /** 落后实时边缘的秒数 */
  latencySeconds: number;
  /** 可读的延迟标签（如 "回看 5分钟"） */
  latencyLabel: string;
  /** 回到实时边缘 */
  returnToLive: () => void;
}

function formatLatency(seconds: number): string {
  if (seconds < 60) return `回看 ${Math.round(seconds)}秒`;
  if (seconds < 3600) return `回看 ${Math.round(seconds / 60)}分钟`;
  return `回看 ${Math.round(seconds / 3600)}小时`;
}

export function useTimeshift({
  mode,
  playerCore,
  checkIntervalMs = 2000,
  latencyThreshold = 5,
}: UseTimeshiftOptions): UseTimeshiftResult {
  const [supportsTimeshift, setSupportsTimeshift] = useState(false);
  const [isTimeshifted, setIsTimeshifted] = useState(false);
  const [latencySeconds, setLatencySeconds] = useState(0);
  const hasReturnedToLiveRef = useRef(false);

  // 挂载时和模式变化时检测时移支持
  useEffect(() => {
    if (mode !== 'iptv') {
      setSupportsTimeshift(false);
      setIsTimeshifted(false);
      setLatencySeconds(0);
      return;
    }

    // 检查流是否支持 DVR
    const checkSupport = () => {
      const isLive = playerCore.isLive();
      if (!isLive) {
        setSupportsTimeshift(false);
        return;
      }

      const seekableStart = playerCore.getSeekableStart();
      const seekableEnd = playerCore.getSeekableEnd();
      const seekableWindow = seekableEnd - seekableStart;

      // 可 seek 窗口 > 30 秒则视为支持 DVR
      setSupportsTimeshift(seekableWindow > 30);
    };

    // 延迟初始检查，等待 HLS.js 完成 manifest 解析
    const initialTimer = setTimeout(checkSupport, 3000);

    return () => clearTimeout(initialTimer);
  }, [mode, playerCore]);

  // 轮询延迟
  useEffect(() => {
    if (mode !== 'iptv' || !supportsTimeshift) return;

    const interval = setInterval(() => {
      const latency = playerCore.getLiveLatency();
      setLatencySeconds(latency);

      if (!hasReturnedToLiveRef.current && latency > latencyThreshold) {
        setIsTimeshifted(true);
      }
    }, checkIntervalMs);

    return () => clearInterval(interval);
  }, [mode, supportsTimeshift, playerCore, checkIntervalMs, latencyThreshold]);

  const returnToLive = useCallback(() => {
    const seekableEnd = playerCore.getSeekableEnd();
    if (seekableEnd > 0) {
      playerCore.seek(seekableEnd - 1);
      hasReturnedToLiveRef.current = true;
      setIsTimeshifted(false);
      setLatencySeconds(0);

      // 短暂延迟后重置标志，重新启用检测
      setTimeout(() => {
        hasReturnedToLiveRef.current = false;
      }, 500);
    }
  }, [playerCore]);

  const latencyLabel = isTimeshifted ? formatLatency(latencySeconds) : '';

  return {
    supportsTimeshift,
    isTimeshifted,
    latencySeconds,
    latencyLabel,
    returnToLive,
  };
}
