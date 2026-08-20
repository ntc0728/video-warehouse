/**
 * AppLoading — 项目品牌定制 Loading 组件
 *
 * 设计要点：
 * - 文字从 KinoTV 图片中"抠"出，纯文字排版（KinoTV）
 * - 下方进度条颜色与全局滚动条悬停色一致（--color-text-tertiary）
 * - 多端适配：Mobile / Desktop / TV 三套尺寸（基于 Design Token）
 * - 全屏 / 内联两种模式，可拓展 className / showTip / showProgress
 *
 * 进度条说明（2026-08-04）：
 * 原进度条是固定 1.5s 的纯 CSS 动画，与实际加载时长无关：
 *   - 加载 <1.5s → 组件卸载、进度条动画中断（「进度加载很快」）
 *   - 加载 >1.5s → 动画播完停 100% + 条纹无限循环（「持续不断加载」）
 * 现改为组件内 JS 模拟渐进进度：0 → 90% 封顶（指数逼近，速度递减），
 * 组件随加载完成卸载即结束——快则进度走到中途随页面出现而结束，
 * 慢则渐增到 90% 停止示意进行中，绝不出现「满格 100% 卡死」。
 * prefers-reduced-motion 下不做动画，直接静止在 90%。
 */
import { useEffect, useState } from 'react';
import { useIsTV } from '@/hooks/useMediaQuery';
import './AppLoading.css';

export interface AppLoadingProps {
  /** 副提示文字（默认 '加载中…'） */
  tip?: string;
  /** 全屏模式：fixed 覆盖整个视口（默认 false，内联） */
  fullScreen?: boolean;
  /** 是否显示 tip 文字（默认 true） */
  showTip?: boolean;
  /** 是否显示进度条（默认 true；Suspense chunk fallback 场景传 false，
   *  避免 fallback 与页面 loading 两个实例各播一遍进度条造成「加载两次」感知） */
  showProgress?: boolean;
  /** 自定义类名 */
  className?: string;
}

/** 模拟进度封顶值（%）：不达到 100%，避免「满格但仍未完成」的假象 */
const PROGRESS_CAP = 90;

export default function AppLoading({
  tip = '加载中…',
  fullScreen = false,
  showTip = true,
  showProgress = true,
  className = '',
}: AppLoadingProps) {
  const isTV = useIsTV();

  // 模拟渐进进度：0 → 90% 封顶（指数逼近，rAF 驱动，卸载即停）
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!showProgress || typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // 减少动画：不做渐进动画，直接静止在封顶值（示意加载中）
      setProgress(PROGRESS_CAP);
      return;
    }
    let raf = 0;
    let value = 0;
    const tick = () => {
      // 指数逼近封顶值：开头快、后段慢，符合「接近完成时减速」的真实感
      value += (PROGRESS_CAP - value) * 0.04;
      if (PROGRESS_CAP - value < 0.05) value = PROGRESS_CAP;
      setProgress(value);
      if (value < PROGRESS_CAP) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [showProgress]);

  const containerClass = [
    'app-loading',
    fullScreen ? 'app-loading--fullscreen' : 'app-loading--inline',
    isTV ? 'app-loading--tv' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClass}
      role="status"
      aria-live="polite"
      aria-label={tip || '加载中'}
    >
      <div className="app-loading__brand">
        <h1 className="app-loading__brand-name">kinoTv</h1>
      </div>

      {showProgress && (
        <div className="app-loading__progress" aria-hidden="true">
          <div
            className="app-loading__progress-bar"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
      )}

      {showTip && tip && <p className="app-loading__tip">{tip}</p>}
    </div>
  );
}
