import { useState, useEffect } from 'react';
import { usePlayerStore } from '@/stores';
import { isVideoResource } from '@/lib/videoResource';

interface NetworkQuality {
  latency: number | null;
  packetLoss: number | null;
  rating: 'good' | 'medium' | 'poor' | 'unknown';
}

/**
 * 估算当前网络延迟
 * 取最近 5 个资源请求的平均响应时间
 */
function estimateLatency(): number | null {
  try {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    if (entries.length === 0) return null;
    const recent = entries
      .filter(e => isVideoResource(e.name) && e.responseStart > 0 && e.requestStart > 0)
      .slice(-5);
    if (recent.length === 0) return null;
    const avg = recent.reduce((sum, e) => sum + (e.responseStart - e.requestStart), 0) / recent.length;
    return Math.round(avg);
  } catch {
    return null;
  }
}

/**
 * 根据带宽和延迟粗略估算丢包率
 * 低带宽 + 高延迟可能意味着丢包
 */
function estimatePacketLoss(bandwidthBps: number, latencyMs: number | null): number | null {
  if (bandwidthBps <= 0 || latencyMs === null) return null;
  // 粗略估算：低带宽 + 高延迟 → 可能丢包
  const bandwidthKBs = bandwidthBps / 8 / 1000;
  if (bandwidthKBs < 100 && latencyMs > 500) return 0.3;
  if (bandwidthKBs < 50 && latencyMs > 300) return 0.15;
  if (bandwidthKBs < 200 && latencyMs > 200) return 0.05;
  return 0;
}

/** 综合带宽和延迟评估网络质量等级 */
function rateQuality(bandwidthBps: number, latencyMs: number | null): NetworkQuality['rating'] {
  const bandwidthKBs = bandwidthBps / 8 / 1000;
  if (bandwidthKBs <= 0) return 'unknown';
  if (bandwidthKBs >= 500 && (latencyMs === null || latencyMs < 200)) return 'good';
  if (bandwidthKBs >= 200 || (latencyMs !== null && latencyMs < 400)) return 'medium';
  return 'poor';
}

/** 格式化延迟值为可读字符串 */
function formatLatency(ms: number | null): string {
  if (ms === null) return '--';
  if (ms < 1) return '<1ms';
  return `${Math.round(ms)}ms`;
}

/** 格式化丢包率为百分比字符串 */
function formatPacketLoss(loss: number | null): string {
  if (loss === null) return '--';
  if (loss === 0) return '0%';
  return `${Math.round(loss * 100)}%`;
}

/**
 * 网络质量监测 Hook
 * 每 2 秒采样一次带宽估算、延迟和丢包率，返回格式化的质量指标
 */
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
