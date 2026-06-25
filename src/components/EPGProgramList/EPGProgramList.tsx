/**
 * EPG 节目列表组件
 * 展示频道的节目单，支持点击已过期节目进行回看（需源支持时移）
 */
import { useMemo } from 'react';
import type { EPGProgram } from '@/services/epgService';
import { formatTimeHHmm } from '@/services/epgService';
import './EPGProgramList.css';

interface EPGProgramListProps {
  /** 节目列表 */
  programs: EPGProgram[];
  /** 是否支持时移 */
  supportTimeshift?: boolean;
  /** 点击节目回调 */
  onProgramClick?: (program: EPGProgram) => void;
}

export default function EPGProgramList({
  programs,
  supportTimeshift = false,
  onProgramClick,
}: EPGProgramListProps) {
  /** 按时间排序并标记状态 */
  const sortedPrograms = useMemo(() => {
    return [...programs].sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [programs]);

  if (sortedPrograms.length === 0) {
    return (
      <div className="epg-program-list epg-program-list--empty">
        <span className="epg-program-list__empty-text">暂无节目单</span>
      </div>
    );
  }

  return (
    <div className="epg-program-list">
      {sortedPrograms.map((program, index) => {
        const isClickable = program.isPast && supportTimeshift;
        const isCurrent = program.isCurrent;
        
        return (
          <div
            key={`${program.start.getTime()}-${index}`}
            className={`epg-program-item ${isCurrent ? 'epg-program-item--current' : ''} ${program.isPast ? 'epg-program-item--past' : ''} ${program.isFuture ? 'epg-program-item--future' : ''} ${isClickable ? 'epg-program-item--clickable' : ''}`}
            onClick={() => isClickable && onProgramClick?.(program)}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={(e) => {
              if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onProgramClick?.(program);
              }
            }}
          >
            <div className="epg-program-item__time">
              <span className="epg-program-item__start">{formatTimeHHmm(program.start)}</span>
              <span className="epg-program-item__separator">-</span>
              <span className="epg-program-item__end">{formatTimeHHmm(program.end)}</span>
            </div>
            <div className="epg-program-item__info">
              <span className="epg-program-item__title">{program.title}</span>
              {isCurrent && <span className="epg-program-item__badge epg-program-item__badge--live">直播中</span>}
              {program.isPast && !isCurrent && supportTimeshift && (
                <span className="epg-program-item__badge epg-program-item__badge--replay">回看</span>
              )}
              {program.isPast && !isCurrent && !supportTimeshift && (
                <span className="epg-program-item__badge epg-program-item__badge--ended">已结束</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
