import { useState, useEffect } from 'react';
import { usePlayerStore } from '@/stores';

function formatSpeed(bps: number): string {
  if (bps <= 0) return '-- KB/s';

  // 先转换为 Bytes per second
  const bytesPerSecond = bps / 8;

  const KB = 1000;
  const MB = 1000 * 1000;

  if (bytesPerSecond >= MB) {
    return `${(bytesPerSecond / MB).toFixed(1)} MB/s`;
  } else if (bytesPerSecond >= KB) {
    return `${(bytesPerSecond / KB).toFixed(1)} KB/s`;
  } else {
    return `${bytesPerSecond.toFixed(0)} B/s`;
  }
}

export function useNetworkSpeed(): string {
  const [speed, setSpeed] = useState('-- KB/s');

  useEffect(() => {
    const timer = setInterval(() => {
      const currentBps = usePlayerStore.getState().bandwidthEstimate;
      setSpeed(formatSpeed(currentBps));
    }, 1000);

    const initialBps = usePlayerStore.getState().bandwidthEstimate;
    setSpeed(formatSpeed(initialBps));

    return () => clearInterval(timer);
  }, []);

  return speed;
}