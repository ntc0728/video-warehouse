/**
 * 竖版「更多设置」底部弹窗（保留原手感，修掉宽度与高度的坑）
 *
 * 修的两处宽度问题（对应「有些设备 modal 没有占满设备宽度」）：
 *
 * 坑 1：`width: 100%` 在 Radix Portal + 部分 WebView 里不是「设备宽度」。
 *        Radix 打开时会给 body 加 `padding-right: <滚动条宽>` 做滚动锁定补偿，
 *        body 变窄 → 100% 跟着变窄 → 弹窗右侧出现一条缝。
 *        修法：显式 `width: 100vw; max-width: 100vw; left: 0; right: 0`，
 *              不依赖父级/body 的内容盒宽度。
 *
 * 坑 2：外层 `max-width: 40rem`（640px）会让 640–844px 之间的横屏手机、
 *       平板竖屏、桌面窄窗的弹窗收窄居中、两侧留白。
 *        修法：命中移动端布局/横屏时 `max-width: none`。
 *
 * 坑 3：`max-height: min(88dvh, 52rem)` 在横屏（390px 高）只剩 343px，
 *        内容挤成一条。横屏一律改走右侧抽屉（SettingsDrawer），不再用底部弹窗。
 */
import { X } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import SettingsContent, { type SettingsState } from './SettingsContent';

interface MoreSheetProps {
  visible: boolean;
  onClose: () => void;
  state: SettingsState;
  onPatch: (patch: Partial<SettingsState>) => void;
  onToast: (msg: string) => void;
  showQuality: boolean;
  onOpenSubtitleSettings?: () => void;
  onImportSubtitle?: (file: File) => void;
}

export default function MoreSheet({
  visible, onClose, state, onPatch, onToast,
  showQuality, onOpenSubtitleSettings, onImportSubtitle,
}: MoreSheetProps) {
  if (!visible) return null;

  return (
    <>
      <div className="pml-sheet-scrim" onClick={onClose} />
      <div
        className="pml-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="更多设置"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pml-sheet-grabber" aria-hidden="true" />
        <div className="pml-sheet-head">
          <span className="pml-sheet-title">更多设置</span>
          <button type="button" className="pml-sheet-close" onClick={onClose} aria-label="关闭更多设置">
            <Icon icon={X} size="sm" />
          </button>
        </div>
        <div className="pml-sheet-body">
          <SettingsContent
            state={state}
            onPatch={onPatch}
            onToast={onToast}
            onClose={onClose}
            showQuality={showQuality}
            onOpenSubtitleSettings={onOpenSubtitleSettings}
            onImportSubtitle={onImportSubtitle}
            // 竖版沿用原行为：chip 选中后生效即关闭
            closeOnChipSelect
          />
        </div>
      </div>
    </>
  );
}
