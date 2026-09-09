import { useCallback, useLayoutEffect, useRef } from 'react';
import { type VideoSource } from '@/types/video';
import type { VideoDetailResult } from '@/services/videoService';
import { Server, ChevronDown } from 'lucide-react';
import { Icon } from "@/components/ui/Icon";
import { usePanelCollapse } from './hooks';

interface PlayerCMSPanelProps {
  selectedSourceIds: string[];
  sourceNameMap: Map<string, string>;
  cmsResults: VideoDetailResult[];
  currentSrc: { url: string; type: VideoSource['type'] } | null;
  activeSourceId?: string;
  onPlaySource: (result: VideoDetailResult) => void;
  onFetchSource: (sourceId: string) => void;
  expanded?: boolean;
  onToggle?: () => void;
  compact?: boolean;
  /** 只读模式：源默认选中，点击无操作（直链搜索场景） */
  readOnly?: boolean;
  /** 桌面端（≥1024px）无选季面板模式：CMS tab 一行各占 1/3 空间（与选集面板等宽） */
  seasonAvailable?: boolean;
}

export function PlayerCMSPanel({
  selectedSourceIds,
  sourceNameMap = new Map(),
  cmsResults,
  currentSrc,
  activeSourceId,
  onPlaySource,
  onFetchSource,
  expanded = true,
  onToggle,
  compact = false,
  readOnly = false,
  seasonAvailable = true,
}: PlayerCMSPanelProps) {
  const HeaderTag = compact ? 'div' : 'button';
  // App 端（compact）面板不可折叠 → collapsed 恒 false，不产生动画
  const collapsed = !compact && !expanded;
  const collapseRef = usePanelCollapse<HTMLDivElement>(collapsed);

  // sourceId → VideoDetailResult 映射
  const resultMap = new Map(cmsResults.map(r => [r.sourceId, r]));

  // ── CMS tab 均分行布局（全端：窄屏 <1024px / app 恒移动 / 桌面 ≥1024px）──
  // 列数 = 一行能容下的最多 tab 数：列宽下限取「最宽 tab 的自然宽度」，
  // 保证任何 tab 都不会被列宽截断；所有行共用同一列网格 → 首行 tab 平均分配空间、
  // 后续行与首行列对齐。列数写入 --cms-tab-cols（CSS 变量），窄屏与桌面两套网格规则
  // 都消费它；侧栏宽度变化（断点切换 / 窗口缩放）由 ResizeObserver 自动重算，无断点硬编码。
  const listRef = useRef<HTMLDivElement>(null);
  // 内容签名：tab 文本（displayName）变化也会改变最宽 tab 宽度，需重算列数
  const nameSig = selectedSourceIds.map((id) => sourceNameMap.get(id) ?? id).join('|');

  const syncCmsTabCols = useCallback(() => {
    const list = listRef.current;
    if (!list || list.children.length === 0) return;
    const items = Array.from(list.children) as HTMLElement[];
    // 测量态：临时强制单行 + tab 自然宽度（layout effect 内同步量完立即移除，不产生绘制帧）
    list.classList.add('player-cms-list--measure');
    const widths = items.map((el) => el.offsetWidth);
    list.classList.remove('player-cms-list--measure');
    const containerW = list.clientWidth;
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    const maxItemW = Math.max(...widths);
    // 下限 3：无论视口多窄，CMS 面板至少一行显示 3 列（侧栏最小宽度 240px 已兜底列宽可行）。
    // 若源数不足 3 则退化为实际数量（Math.min(items.length)）。
    const cols = Math.max(3, Math.min(items.length, Math.floor((containerW + gap) / (maxItemW + gap))));
    if (list.style.getPropertyValue('--cms-tab-cols') !== String(cols)) {
      list.style.setProperty('--cms-tab-cols', String(cols));
    }
  }, []);

  useLayoutEffect(() => {
    syncCmsTabCols();
  }, [nameSig, syncCmsTabCols]);

  // 容器宽度变化（旋转 / 窗口缩放 / 面板尺寸变化）时重算列数；
  // 重算只改 CSS 变量且值不变时不写入，ResizeObserver 不会无限循环。
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => syncCmsTabCols());
    ro.observe(list);
    return () => ro.disconnect();
  }, [syncCmsTabCols]);

  // 判断某个源是否正在播放中
  const isActiveSource = (sourceId: string) => {
    if (readOnly) return true;
    if (activeSourceId !== undefined) return activeSourceId === sourceId;
    if (!currentSrc) return false;
    const result = resultMap.get(sourceId);
    if (!result?.video) return false;
    return (
      result.video.sources?.some(s => s.url === currentSrc.url) ||
      result.video.episodes?.some(ep => ep.sources.some(s => s.url === currentSrc.url))
    );
  };

  return (
    <div ref={collapseRef} className={`player-panel player-panel--cms${!seasonAvailable ? ' player-panel--cms-movie' : ''}${collapsed ? ' collapsed' : ''}`}>
      <HeaderTag
        className="player-panel-header"
        {...(!compact && onToggle ? { onClick: onToggle } : {})}
      >
        <span className="player-panel-icon"><Icon icon={Server} size="sm" /></span>
        <span className="player-panel-title">CMS源</span>
        <span className="player-panel-info">{selectedSourceIds.length}个源</span>
        {!compact && (
          <span className={`player-panel-arrow ${expanded ? 'expanded' : ''}`}>
            <Icon icon={ChevronDown} size="sm" />
          </span>
        )}
      </HeaderTag>
      <div className={`player-panel-body${collapsed ? ' collapsed' : ''}`}>
        {selectedSourceIds.length > 0 ? (
          <div ref={listRef} className="player-cms-list">
            {selectedSourceIds.map((sourceId) => {
              const result = resultMap.get(sourceId);
              const displayName = sourceNameMap.get(sourceId) ?? sourceId;
              const active = isActiveSource(sourceId);
              return (
                <button
                  key={sourceId}
                  className={`player-cms-item ${active ? 'active' : ''}`}
                  onClick={readOnly ? undefined : () => {
                    if (result?.video) {
                      onPlaySource(result);
                    } else {
                      onFetchSource(sourceId);
                    }
                  }}
                >
                  <span className="player-cms-name">{displayName}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="player-panel-empty">暂无数据源</div>
        )}
      </div>
    </div>
  );
}
