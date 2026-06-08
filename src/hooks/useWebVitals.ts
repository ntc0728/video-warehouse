// Web Vitals 性能指标采集 Hook，用于监控页面核心性能指标
import { useEffect } from 'react';
import type { Metric } from 'web-vitals';

interface WebVitalsConfig {
  onPerfEntry?: (metric: Metric) => void;
}

// 动态导入 web-vitals 库，避免影响首屏加载
function getWebVitals() {
  return import('web-vitals').then((webVitals) => ({
    getCLS: webVitals.onCLS,
    getINP: webVitals.onINP,
    getLCP: webVitals.onLCP,
    getFCP: webVitals.onFCP,
    getTTFB: webVitals.onTTFB,
  }));
}

// 采集并上报所有 Web Vitals 指标：CLS、INP、LCP、FCP、TTFB
export function reportWebVitals(onPerfEntry?: (metric: Metric) => void) {
  getWebVitals().then(({ getCLS, getINP, getLCP, getFCP, getTTFB }) => {
    getCLS((metric) => { if (onPerfEntry) onPerfEntry(metric); });
    getINP((metric) => { if (onPerfEntry) onPerfEntry(metric); });
    getLCP((metric) => { if (onPerfEntry) onPerfEntry(metric); });
    getFCP((metric) => { if (onPerfEntry) onPerfEntry(metric); });
    getTTFB((metric) => { if (onPerfEntry) onPerfEntry(metric); });
  });
}

export function useWebVitals(config?: WebVitalsConfig) {
  useEffect(() => {
    if (config?.onPerfEntry && typeof window !== 'undefined') {
      reportWebVitals(config.onPerfEntry);
    }
  }, [config?.onPerfEntry]);
}

export default useWebVitals;
