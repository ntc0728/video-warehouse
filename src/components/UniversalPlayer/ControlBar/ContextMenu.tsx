import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Palette, Volume2, Keyboard } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';

interface ContextMenuProps {
  visible: boolean;
  /** 视口坐标（onContextMenu 的 clientX/clientY） */
  x: number;
  y: number;
  isPlaying: boolean;
  onClose: () => void;
  onTogglePlay: () => void;
  /** Issue4：打开「视频色彩调整」弹窗 */
  onOpenColor: () => void;
  /** Issue4：打开「视频音效调节」弹窗 */
  onOpenAudio: () => void;
  onShowShortcuts: () => void;
}

/**
 * P1-6 桌面点播右键菜单（对齐 B站/YouTube 播放器）：
 * 播放/暂停、视频色彩调整、视频音效调节、快捷键说明。
 * 仅桌面点播模式挂载；点击外部 / Escape 关闭；位置钳制在视口内。
 */
export default function ContextMenu({
  visible,
  x,
  y,
  isPlaying,
  onClose,
  onTogglePlay,
  onOpenColor,
  onOpenAudio,
  onShowShortcuts,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击菜单外部关闭（capture 阶段监听，避免被播放器单击逻辑拦截）
  useEffect(() => {
    if (!visible) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  // 位置钳制：菜单预估尺寸（宽 ~200px，高 ~190px），越界翻转到指针左/上方
  const MENU_W = 200;
  const MENU_H = 190;
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_H - 8);

  const act = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="up-context-menu"
      style={{ left, top }}
      role="menu"
      aria-label="播放器菜单"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button className="up-context-menu__item" role="menuitem" onClick={act(onTogglePlay)}>
        <Icon icon={isPlaying ? Pause : Play} size="sm" />
        <span>{isPlaying ? '暂停' : '播放'}</span>
        <kbd className="up-context-menu__kbd">K</kbd>
      </button>
      <button className="up-context-menu__item" role="menuitem" onClick={act(onOpenColor)}>
        <Icon icon={Palette} size="sm" />
        <span>视频色彩调整</span>
      </button>
      <button className="up-context-menu__item" role="menuitem" onClick={act(onOpenAudio)}>
        <Icon icon={Volume2} size="sm" />
        <span>视频音效调节</span>
      </button>
      <div className="up-context-menu__divider" />
      <button className="up-context-menu__item" role="menuitem" onClick={act(onShowShortcuts)}>
        <Icon icon={Keyboard} size="sm" />
        <span>快捷键说明</span>
        <kbd className="up-context-menu__kbd">Shift+?</kbd>
      </button>
    </div>,
    document.body,
  );
}
