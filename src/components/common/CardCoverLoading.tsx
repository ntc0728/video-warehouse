/**
 * CardCoverLoading — 卡片封面 Loading 公共组件
 *
 * 设计要点：
 * - KinoTV 抠图占位：纯 CSS 渐变还原金/蓝/橙电影感文字 + 衬线字体
 * - 进度条：复用 AppLoading 风格（slide + stripes），按 card 宽度比例缩放
 * - 多端适配：Mobile / Desktop / TV 三套尺寸（基于 Design Token）
 * - 与 AppLoading 区分：AppLoading 双行品牌字 + 全屏/内联；本组件单行 KinoTV + card 嵌入
 *
 * 使用场景：VideoCard / IPTVChannelCard 封面图加载时
 */
import { useIsTV } from '@/hooks/useMediaQuery';
import './CardCoverLoading.css';

export interface CardCoverLoadingProps {
  /** 自定义类名 */
  className?: string;
  /** 是否显示进度条 (默认 true) */
  showProgress?: boolean;
}

export default function CardCoverLoading({
  className = '',
  showProgress = true,
}: CardCoverLoadingProps) {
  const isTV = useIsTV();

  const containerClass = [
    'card-cover-loading',
    isTV ? 'card-cover-loading--tv' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClass}
      role="status"
      aria-live="polite"
      aria-label="加载中"
    >
      <div className="card-cover-loading__brand" aria-hidden="true">
        <span className="card-cover-loading__brand-text">KinoTV</span>
      </div>

      {showProgress && (
        <div className="card-cover-loading__progress" aria-hidden="true">
          <div className="card-cover-loading__progress-bar" />
        </div>
      )}
    </div>
  );
}
