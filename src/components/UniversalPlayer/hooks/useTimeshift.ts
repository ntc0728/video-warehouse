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
  /** Update interval in ms (default 2000) */
  checkIntervalMs?: number;
  /** Threshold in seconds — if latency exceeds this, we consider the user "timeshifted" */
  latencyThreshold?: number;
}

interface UseTimeshiftResult {
  /** Whether the stream supports timeshift (DVR window > 0) */
  supportsTimeshift: boolean;
  /** Whether the user is currently watching timeshifted content */
  isTimeshifted: boolean;
  /** Seconds behind the live edge */
  latencySeconds: number;
  /** Human-readable latency (e.g. "回看 5分钟") */
  latencyLabel: string;
  /** Return to live edge */
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

  // Detect timeshift support on mount and when mode changes
  useEffect(() => {
    if (mode !== 'iptv') {
      setSupportsTimeshift(false);
      setIsTimeshifted(false);
      setLatencySeconds(0);
      return;
    }

    // Check if stream supports DVR
    const checkSupport = () => {
      const isLive = playerCore.isLive();
      if (!isLive) {
        setSupportsTimeshift(false);
        return;
      }

      const seekableStart = playerCore.getSeekableStart();
      const seekableEnd = playerCore.getSeekableEnd();
      const seekableWindow = seekableEnd - seekableStart;

      // Consider DVR supported if seekable window > 30 seconds
      setSupportsTimeshift(seekableWindow > 30);
    };

    // Delay initial check to let HLS.js finish manifest parsing
    const initialTimer = setTimeout(checkSupport, 3000);

    return () => clearTimeout(initialTimer);
  }, [mode, playerCore]);

  // Poll for latency
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

      // Reset the flag after a short delay to re-enable detection
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
