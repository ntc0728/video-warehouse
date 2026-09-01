import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import SettingsContent, { type SettingsContentProps } from './SettingsContent';

interface SettingsDrawerProps extends Omit<SettingsContentProps, 'closeOnChipSelect'> {
  visible: boolean;
  onClose: () => void;
}

/**
 * 全屏 / 横屏时的「更多设置」右侧抽屉（需求⑤）。
 * 内容 = 原移动端竖版更多设置（清晰度/循环/定时关闭/后台听视频/镜像/画面比例/解码模式），
 * 按需求②移除倍速 / 字幕 / 快捷键，避免与全屏场景冗余。
 * closeOnChipSelect=true → 选取/修改子设置项后关闭抽屉，操作提示在播放器内
 * 居中靠上显示（mobileSettingsToast → center-toast，避让 up-player-header）。
 * 抽屉定位在播放器内右侧，高度吃满、宽度增大，视频画面仍可见。
 * 阻止事件冒泡到播放器（点抽屉不会触发播放/暂停）；点击抽屉之外（含视频空白）关闭抽屉。
 */
export default function SettingsDrawer({
  visible,
  onClose,
  ...content
}: SettingsDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // 需求④：点击抽屉之外的空白区域（视频画面）关闭抽屉。
  // 排除右上角操作组 .up-fs-corner（含「更多设置」按钮），避免点更多按钮误关。
  useEffect(() => {
    if (!visible) return;
    const handlePointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (drawerRef.current && !drawerRef.current.contains(t) && !(t as Element).closest?.('.up-fs-corner')) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={drawerRef}
      className="up-fs-drawer"
      role="dialog"
      aria-label="更多设置"
      aria-modal="false"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="up-fs-drawer-head">
        <span className="up-fs-drawer-title">更多设置</span>
        <button className="up-fs-drawer-close" onClick={onClose} aria-label="关闭更多设置">
          <Icon icon={X} size="sm" />
        </button>
      </div>
      <div className="up-fs-drawer-body">
        <SettingsContent
          {...content}
          closeOnChipSelect={true}
          onClose={onClose}
          hideSpeed
          hideSubtitle
          hideShortcuts
        />
      </div>
    </div>
  );
}
