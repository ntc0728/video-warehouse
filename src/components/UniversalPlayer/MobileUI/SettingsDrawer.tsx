import { X } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import SettingsContent, { type SettingsContentProps } from './SettingsContent';

interface SettingsDrawerProps extends Omit<SettingsContentProps, 'closeOnChipSelect'> {
  visible: boolean;
  onClose: () => void;
}

/**
 * 全屏 / 横屏时的「更多设置」右侧抽屉（需求⑤）。
 * 内容 = 原移动端竖版更多设置全部项（倍速/清晰度/循环/定时关闭/后台听视频/字幕/镜像/画面比例），
 * 加上全屏专属的解码模式与快捷键。closeOnChipSelect=false → 选中不关闭，支持连续调节。
 * 抽屉定位在播放器内右侧，高度吃满、宽度约 1/3，视频画面仍可见。
 * 阻止事件冒泡到播放器（点抽屉不会触发播放/暂停）。
 */
export default function SettingsDrawer({
  visible,
  onClose,
  ...content
}: SettingsDrawerProps) {
  if (!visible) return null;

  return (
    <div
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
          closeOnChipSelect={false}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
