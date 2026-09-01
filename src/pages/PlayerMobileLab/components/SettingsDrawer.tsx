/**
 * 播放器「右侧设置抽屉」—— 横屏 / 全屏时的新弹窗
 *
 * 需求：全屏播放时点「更多设置」，在播放器**右侧**弹出面板，
 *       内容 = 原竖版更多设置弹窗的全部内容。
 *
 * 为什么竖版 BottomSheet 在横屏不能用：
 *   横屏视口典型 844×390，底部弹窗会被 `max-height: 88dvh` 压到 ~343px 高、
 *   同时又要横跨 844px 宽 —— 变成一条又宽又扁的横带，内容全靠挤，
 *   并且部分设备（PC 调试安卓 / 平板 / 桌面窄窗）还会命中 `max-width: 40rem`
 *   导致左右留白、不占满宽度。
 *   改成右侧纵向抽屉后：高度吃满播放器、宽度只占 ~1/3，视频画面仍然可见，
 *   这才是主流播放器的横屏设置形态（YouTube / 腾讯视频 / 爱奇艺一致）。
 */
import { X } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import SettingsContent, { type SettingsState } from './SettingsContent';

interface SettingsDrawerProps {
  visible: boolean;
  onClose: () => void;
  state: SettingsState;
  onPatch: (patch: Partial<SettingsState>) => void;
  onToast: (msg: string) => void;
  showQuality: boolean;
  onOpenSubtitleSettings?: () => void;
  onImportSubtitle?: (file: File) => void;
}

export default function SettingsDrawer({
  visible, onClose, state, onPatch, onToast,
  showQuality, onOpenSubtitleSettings, onImportSubtitle,
}: SettingsDrawerProps) {
  if (!visible) return null;

  return (
    <div
      className="pml-drawer"
      role="dialog"
      aria-modal="false"
      aria-label="更多设置"
      // 抽屉打开时禁止冒泡到播放器：否则点抽屉空白处会触发播放/暂停
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="pml-drawer-head">
        <span className="pml-drawer-title">更多设置</span>
        <button type="button" className="pml-drawer-close" onClick={onClose} aria-label="关闭更多设置">
          <Icon icon={X} size="sm" />
        </button>
      </div>
      <div className="pml-drawer-body">
        <SettingsContent
          state={state}
          onPatch={onPatch}
          onToast={onToast}
          onClose={onClose}
          showQuality={showQuality}
          onOpenSubtitleSettings={onOpenSubtitleSettings}
          onImportSubtitle={onImportSubtitle}
          // 抽屉里保持打开：横屏连续调倍速 / 清晰度 / 比例不用来回开关
          closeOnChipSelect={false}
        />
      </div>
    </div>
  );
}
