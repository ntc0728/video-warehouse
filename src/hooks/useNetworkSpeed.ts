import { useState, useEffect } from 'react';
import { usePlayerStore } from '@/stores';

/** 将比特率转换为可读的速度字符串（B/s、KB/s、MB/s） */
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

/**
 * 网络速度监测 Hook
 * 每秒从播放器 store 读取带宽估算值并格式化为速度字符串
 * 缓冲期间保持上次已知速度，避免显示 "-- KB/s"
 * @returns 当前网速的可读字符串，如 '1.5 MB/s'
 */
export function useNetworkSpeed(): string {
  const [speed, setSpeed] = useState('-- KB/s');

  useEffect(() => {
    const timer = setInterval(() => {
      const currentBps = usePlayerStore.getState().bandwidthEstimate;
      if (currentBps > 0) {
        setSpeed(formatSpeed(currentBps));
      }
      // currentBps === 0 时保持上次已知速度，不回退到 "-- KB/s"
    }, 1000);

    const initialBps = usePlayerStore.getState().bandwidthEstimate;
    if (initialBps > 0) {
      setSpeed(formatSpeed(initialBps));
    }

    return () => clearInterval(timer);
  }, []);

  return speed;
}