/**
 * 源状态指示器
 * 显示搜索结果数和源状态（加载中闪烁 / 成功绿色 / 部分失败黄色 / 全部失败红色）
 */
import { useState, useCallback } from 'react';
import './SourceStatusIndicator.css';

interface SourceStatusProps {
  totalSources: number;
  completedSources: number;
  succeededSources: number;
  failedSources: number;
  totalResults: number;
  isLoading: boolean;
}

export function SourceStatusIndicator({
  totalSources,
  completedSources,
  succeededSources,
  failedSources,
  totalResults,
  isLoading,
}: SourceStatusProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleMouseEnter = useCallback(() => setShowTooltip(true), []);
  const handleMouseLeave = useCallback(() => setShowTooltip(false), []);
  // 移动端点击切换 tooltip（触摸设备无 hover）
  const handleToggle = useCallback(() => setShowTooltip((v) => !v), []);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setShowTooltip((v) => !v);
    }
  }, []);

  // 圆点颜色状态
  const dotClass = (() => {
    if (isLoading) return 'source-status-dot--loading';
    if (failedSources === 0) return 'source-status-dot--success';
    if (failedSources === totalSources) return 'source-status-dot--error';
    return 'source-status-dot--warning';
  })();

  if (totalSources === 0) return null;

  return (
    <div className="source-status">
      <span className="source-status-results">共找到 {totalResults} 个结果</span>
            <div
              className="source-status-badge"
              role="button"
              tabIndex={0}
              aria-label={`源状态：${completedSources}/${totalSources}，成功 ${succeededSources}，失败 ${failedSources}${failedSources > 0 ? '，点击查看详情' : ''}`}
              aria-expanded={showTooltip}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={handleToggle}
              onKeyDown={handleKeyDown}
            >
        <span className={`source-status-dot ${dotClass}`} />
        <span className="source-status-count">
          {completedSources}/{totalSources} 源
        </span>
        {showTooltip && (
          <div className="source-status-tooltip">
            <div className="source-status-tooltip-row">
              <span>总源数</span>
              <span>{totalSources}</span>
            </div>
            <div className="source-status-tooltip-row">
              <span>成功</span>
              <span className="source-status-tooltip-success">{succeededSources}</span>
            </div>
            <div className="source-status-tooltip-row">
              <span>失败</span>
              <span className="source-status-tooltip-error">{failedSources}</span>
            </div>
            <div className="source-status-tooltip-divider" />
            <div className="source-status-tooltip-row">
              <span>结果数</span>
              <span>{totalResults}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
