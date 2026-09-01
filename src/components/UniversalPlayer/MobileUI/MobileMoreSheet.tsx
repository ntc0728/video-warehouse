import { X } from 'lucide-react';
import { BottomSheet } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import SettingsContent from './SettingsContent';
import type { LoopMode, PlayerLevel } from '@/types/player';

interface MobileMoreSheetProps {
  visible: boolean;
  onClose: () => void;
  currentRate: number;
  onPlaybackRateChange: (rate: number) => void;
  loopMode: LoopMode;
  onLoopModeChange: (mode: LoopMode) => void;
  levels: PlayerLevel[];
  currentLevel: number;
  onLevelChange: (level: number) => void;
  isHls: boolean;
  sleepMinutes: number;
  onSleepChange: (minutes: number) => void;
  backgroundPlay: boolean;
  onBackgroundPlayChange: (on: boolean) => void;
  subtitleEnabled: boolean;
  onSubtitleToggle: (on: boolean) => void;
  onOpenSubtitleSettings: () => void;
  onImportSubtitle: (file: File) => void;
  mirror: boolean;
  onMirrorToggle: (on: boolean) => void;
  aspectRatio: 'default' | '4:3' | '16:9' | 'fill';
  onAspectRatioChange: (ratio: 'default' | '4:3' | '16:9' | 'fill') => void;
  /**
   * Portal 容器（全屏场景必传，否则 body 下的抽屉被全屏盖住）
   */
  portalContainer?: HTMLElement | null;
}

export default function MobileMoreSheet({
  visible, onClose,
  portalContainer,
  currentRate, onPlaybackRateChange,
  loopMode, onLoopModeChange,
  levels, currentLevel, onLevelChange, isHls,
  sleepMinutes, onSleepChange,
  backgroundPlay, onBackgroundPlayChange,
  subtitleEnabled, onSubtitleToggle, onOpenSubtitleSettings, onImportSubtitle,
  mirror, onMirrorToggle,
  aspectRatio, onAspectRatioChange,
}: MobileMoreSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="更多设置" className="up-ms-sheet" portalContainer={portalContainer}>
      <div className="up-ms-head">
        <span className="up-ms-title">更多设置</span>
        <button className="up-ms-close" onClick={onClose} aria-label="关闭更多设置">
          <Icon icon={X} size="sm" />
        </button>
      </div>
      <SettingsContent
        closeOnChipSelect
        onClose={onClose}
        currentRate={currentRate}
        onPlaybackRateChange={onPlaybackRateChange}
        loopMode={loopMode}
        onLoopModeChange={onLoopModeChange}
        levels={levels}
        currentLevel={currentLevel}
        onLevelChange={onLevelChange}
        isHls={isHls}
        sleepMinutes={sleepMinutes}
        onSleepChange={onSleepChange}
        backgroundPlay={backgroundPlay}
        onBackgroundPlayChange={onBackgroundPlayChange}
        subtitleEnabled={subtitleEnabled}
        onSubtitleToggle={onSubtitleToggle}
        onOpenSubtitleSettings={onOpenSubtitleSettings}
        onImportSubtitle={onImportSubtitle}
        mirror={mirror}
        onMirrorToggle={onMirrorToggle}
        aspectRatio={aspectRatio}
        onAspectRatioChange={onAspectRatioChange}
      />
    </BottomSheet>
  );
}
