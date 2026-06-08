/**
 * 性能监控组件（仅开发环境）
 * 使用 web-vitals 库采集 LCP/INP/CLS/FCP/TTFB 等核心性能指标，
 * 以浮动面板形式展示，帮助开发阶段定位性能问题
 */
import { useState, useEffect } from 'react';
import type { Metric } from 'web-vitals';
import './PerformanceMonitor.css';

type MetricKey = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<Partial<Record<MetricKey, Metric>>>({});
  const [isVisible, setIsVisible] = useState(false);

  /** 仅在开发环境加载 web-vitals 并采集性能指标 */
  useEffect(() => {
    if (import.meta.env.DEV) {
      import('web-vitals').then((webVitals) => {
        webVitals.onLCP((metric) => { setMetrics((prev) => ({ ...prev, LCP: metric })); });
        webVitals.onINP((metric) => { setMetrics((prev) => ({ ...prev, INP: metric })); });
        webVitals.onCLS((metric) => { setMetrics((prev) => ({ ...prev, CLS: metric })); });
        webVitals.onFCP((metric) => { setMetrics((prev) => ({ ...prev, FCP: metric })); });
        webVitals.onTTFB((metric) => { setMetrics((prev) => ({ ...prev, TTFB: metric })); });
      });
    }
  }, []);

  /** 根据指标评级返回对应颜色：绿色(良好)、黄色(待改进)、红色(较差) */
  const getRatingColor = (rating?: string) => {
    switch (rating) {
      case 'good':
        return '#52c41a';
      case 'needs-improvement':
        return '#faad14';
      case 'poor':
        return '#ff4d4f';
      default:
        return '#999';
    }
  };

  const formatValue = (metric?: Metric): string => {
    if (!metric) return '--';
    if (metric.name === 'CLS') return `${(metric.value * 1000).toFixed(2)}ms`;
    return `${Math.round(metric.value)}ms`;
  };

  if (!isVisible && import.meta.env.DEV) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="pm-toggle-btn"
      >
        性能监控
      </button>
    );
  }

  if (!import.meta.env.DEV) return null;

  return (
    <div className="pm-panel">
      <div className="pm-header">
        <h4>性能指标</h4>
        <button
          onClick={() => setIsVisible(false)}
          className="pm-close-btn"
        >
          ×
        </button>
      </div>

      <div className="pm-metric-list">
        <MetricItem
          label="LCP (最大内容绘制)"
          value={formatValue(metrics.LCP)}
          color={getRatingColor(metrics.LCP?.rating)}
          description="主要内容的加载性能"
        />
        <MetricItem
          label="INP (交互到绘制)"
          value={formatValue(metrics.INP)}
          color={getRatingColor(metrics.INP?.rating)}
          description="页面响应速度"
        />
        <MetricItem
          label="CLS (布局偏移)"
          value={formatValue(metrics.CLS)}
          color={getRatingColor(metrics.CLS?.rating)}
          description="视觉稳定性"
        />
        <MetricItem
          label="FCP (首次内容绘制)"
          value={formatValue(metrics.FCP)}
          color="var(--color-primary)"
          description="首次内容渲染"
        />
        <MetricItem
          label="TTFB (首字节时间)"
          value={formatValue(metrics.TTFB)}
          color="#722ed1"
          description="服务器响应速度"
        />
      </div>
    </div>
  );
}

interface MetricItemProps {
  label: string;
  value: string;
  color: string;
  description: string;
}

/** 单个性能指标展示项 */
function MetricItem({ label, value, color, description }: MetricItemProps) {
  return (
    <div className="pm-metric-item">
      <div>
        <div className="pm-metric-label">{label}</div>
        <div className="pm-metric-desc">{description}</div>
      </div>
      <div
        className="pm-metric-badge"
        style={{ backgroundColor: color }}
      >
        {value}
      </div>
    </div>
  );
}

export default PerformanceMonitor;
