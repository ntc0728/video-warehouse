import { useState, useEffect } from 'react';
import { usePlayerStore } from '@/stores';

interface NetworkQuality {
  latency: number | null;
  packetLoss: number | null;
  rating: 'good' | 'medium' | 'poor' | 'unknown';
}

function estimateLatency(): number | null {
  try {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    if (entries.length === 0) return null;
    // 取最近 5 个网络请求的平均 serverTiming 或 responseStart - requestStart
    const recent = entries
      .filter(e => e.responseStart > 0 && e.requestStart > 0)
      .slice(-5);
    if (recent.length === 0) return null;
    const avg = recent.reduce((sum, e) => sum + (e.responseStart - e.requestStart), 0) / recent.length;
    return Math.round(avg);
  } catch {
    return null;
  }
}

function estimatePacketLoss(bandwidthBps: number, latencyMs: number | null): number | null {
  if (bandwidthBps <= 0 || latencyMs === null) return null;
  // 粗略估算：低带宽 + 高延迟 → 可能丢包
  const bandwidthKBs = bandwidthBps / 8 / 1000;
  if (bandwidthKBs < 100 && latencyMs > 500) return 0.3;
  if (bandwidthKBs < 50 && latencyMs > 300) return 0.15;
  if (bandwidthKBs < 200 && latencyMs > 200) return 0.05;
  return 0;
}

function rateQuality(bandwidthBps: number, latencyMs: number | null): NetworkQuality['rating'] {
  const bandwidthKBs = bandwidthBps / 8 / 1000;
  if (bandwidthKBs <= 0) return 'unknown';
  if (bandwidthKBs >= 500 && (latencyMs === null || latencyMs < 200)) return 'good';
  if (bandwidthKBs >= 200 || (latencyMs !== null && latencyMs < 400)) return 'medium';
  return 'poor';
}

function formatLatency(ms: number | null): string {
  if (ms === null) return '--';
  if (ms < 1) return '<1ms';
  return `${Math.round(ms)}ms`;
}

function formatPacketLoss(loss: number | null): string {
  if (loss === null) return '--';
  if (loss === 0) return '0%';
  return `${Math.round(loss * 100)}%`;
}

export function useNetworkQuality(): {
  latency: string;
  packetLoss: string;
  rating: NetworkQuality['rating'];
} {
  const [quality, setQuality] = useState<NetworkQuality>({
    latency: null,
    packetLoss: null,
    rating: 'unknown',
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const bandwidthBps = usePlayerStore.getState().bandwidthEstimate;
      const latency = estimateLatency();
      const packetLoss = estimatePacketLoss(bandwidthBps, latency);
      const rating = rateQuality(bandwidthBps, latency);
      setQuality({ latency, packetLoss, rating });
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  return {
    latency: formatLatency(quality.latency),
    packetLoss: formatPacketLoss(quality.packetLoss),
    rating: quality.rating,
  };
}
