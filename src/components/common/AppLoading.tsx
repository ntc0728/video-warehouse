/**
 * AppLoading — 项目品牌定制 Loading 组件
 *
 * 设计要点：
 * - 文字从 KinoTV 图片中"抠"出，纯文字双行排版（影视大全 + KinoTV）
 * - 下方进度条颜色与全局滚动条悬停色一致（--color-text-tertiary）
 * - 多端适配：Mobile / Desktop / TV 三套尺寸（基于 Design Token）
 * - 全屏 / 内联两种模式，可拓展 className / showTip
 */
import { useIsTV } from '@/hooks/useMediaQuery';
import './AppLoading.css';

export interface AppLoadingProps {
  /** 副提示文字（默认 '加载中…'） */
  tip?: string;
  /** 全屏模式：fixed 覆盖整个视口（默认 false，内联） */
  fullScreen?: boolean;
  /** 是否显示 tip 文字（默认 true） */
  showTip?: boolean;
  /** 自定义类名 */
  className?: string;
}

export default function AppLoading({
  tip = '加载中…',
  fullScreen = false,
  showTip = true,
  className = '',
}: AppLoadingProps) {
  const isTV = useIsTV();

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
        <h1 className="app-loading__brand-name">影视大全</h1>
        <h2 className="app-loading__brand-sub">KinoTV</h2>
      </div>

      <div className="app-loading__progress" aria-hidden="true">
        <div className="app-loading__progress-bar" />
      </div>

      {showTip && tip && <p className="app-loading__tip">{tip}</p>}
    </div>
  );
}
