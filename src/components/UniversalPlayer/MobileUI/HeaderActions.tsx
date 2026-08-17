import { Cast, MoreHorizontal } from 'lucide-react';
import PiPButton from '../ControlBar/PiPButton';
import { Icon } from '@/components/ui/Icon';

interface HeaderActionsProps {
  /** 当前是否画中画（PiPButton 内部自判平台支持） */
  isPiP: boolean;
  onTogglePiP: () => void;
  /** 是否正在投屏（图标常亮高亮提示连接中） */
  castActive: boolean;
  /** 投屏能力是否可用（iOS Web 端无 Cast SDK/原生桥 → 隐藏投屏按钮） */
  castEnabled: boolean;
  onCastClick: () => void;
  onMoreClick: () => void;
}

/**
 * 播放器右上角操作组（移动端/App 端 /play 点播页专属）：
 * 画中画 · 投屏 · 更多设置。
 * 倍速/音量/循环/上下集从控制栏移除后收纳于此。
 * 投屏按钮在能力不可用时隐藏（iOS Web：Chromium 内核才支持 Cast SDK，且无原生桥）。
 */
export default function HeaderActions({ isPiP, onTogglePiP, castActive, castEnabled, onCastClick, onMoreClick }: HeaderActionsProps) {
  return (
    <div className="up-header-actions">
      <PiPButton isPiP={isPiP} onClick={onTogglePiP} />
      {castEnabled && (
        <button
          className={`up-header-action-btn${castActive ? ' up-header-action-btn--active' : ''}`}
          title="投屏到电视"
          aria-label="投屏到电视"
          aria-pressed={castActive}
          onClick={onCastClick}
        >
          <Icon icon={Cast} size="sm" />
        </button>
      )}
      <button
        className="up-header-action-btn"
        title="更多设置"
        aria-label="更多设置"
        onClick={onMoreClick}
      >
        <Icon icon={MoreHorizontal} size="sm" />
      </button>
    </div>
  );
}