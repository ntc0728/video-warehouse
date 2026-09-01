import { useCallback, useRef } from 'react';
import {
  Gauge, Repeat, AlarmClock, Headphones, Subtitles, FlipHorizontal2, RectangleHorizontal,
  ChevronRight, MonitorPlay,
} from 'lucide-react';
import Switch from '@/components/ui/Switch';
import { Icon } from '@/components/ui/Icon';
import { mobileSettingsToast } from '../PlayerToast';
import { getResolutionLabel } from '../lib/utils';
import { getIOSBackgroundAudioCapability } from '@/services/backgroundAudioService';
import type { DecoderMode, LoopMode, PlayerLevel } from '@/types/player';

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
export const SLEEP_OPTIONS = [
  { value: 0, label: '关闭' },
  { value: 10, label: '10分钟' },
  { value: 30, label: '30分钟' },
  { value: 60, label: '60分钟' },
] as const;
export const LOOP_OPTIONS: { value: LoopMode; label: string }[] = [
  { value: 'none', label: '不循环' },
  { value: 'single', label: '单集循环' },
  { value: 'list', label: '列表循环' },
];
export const RATIO_OPTIONS = [
  { value: 'default', label: '默认' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: 'fill', label: '铺满' },
] as const;
export const RATIO_LABELS: Record<string, string> = {
  default: '默认',
  '4:3': '4:3',
  '16:9': '16:9',
  fill: '铺满',
};

export interface SettingsContentProps {
  /** 竖版底部弹窗：chip / switch 选中后关闭弹窗；右侧抽屉：保持打开以支持连续调节 */
  closeOnChipSelect: boolean;
  /** 右侧抽屉可从外部裁剪项（需求②）：抽屉固定隐藏倍速/字幕/快捷键，竖版弹窗保留 */
  hideSpeed?: boolean;
  hideSubtitle?: boolean;
  hideShortcuts?: boolean;
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
  /** 右侧抽屉额外项（全屏场景）：解码模式 + 快捷键。竖版弹窗不需要 */
  decoderMode?: DecoderMode;
  onDecoderModeChange?: (mode: DecoderMode) => void;
  onShowShortcuts?: () => void;
}

function ChipRow<T extends string | number>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="up-ms-chips">
      {options.map(opt => (
        <button
          key={String(opt.value)}
          className={`up-ms-chip${opt.value === value ? ' up-ms-chip--on' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 更多设置的内容体（与容器无关）。
 * - 竖版底部弹窗（MobileMoreSheet）：closeOnChipSelect=true，选中即关。
 * - 全屏右侧抽屉（SettingsDrawer）：closeOnChipSelect=false，保持打开连续调节。
 */
export default function SettingsContent({
  closeOnChipSelect,
  hideSpeed,
  hideSubtitle,
  hideShortcuts,
  onClose,
  currentRate, onPlaybackRateChange,
  loopMode, onLoopModeChange,
  levels, currentLevel, onLevelChange, isHls,
  sleepMinutes, onSleepChange,
  backgroundPlay, onBackgroundPlayChange,
  subtitleEnabled, onSubtitleToggle, onOpenSubtitleSettings, onImportSubtitle,
  mirror, onMirrorToggle,
  aspectRatio, onAspectRatioChange,
  decoderMode, onDecoderModeChange, onShowShortcuts,
}: SettingsContentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportSubtitle(file);
    e.target.value = '';
  }, [onImportSubtitle]);

  /** chip / switch 子设置选中：生效 + 顶部居中提示 + 按 closeOnChipSelect 决定是否关闭 */
  const applySetting = useCallback((apply: () => void, msg: string) => {
    apply();
    mobileSettingsToast(msg, 1800);
    if (closeOnChipSelect) onClose();
  }, [closeOnChipSelect, onClose]);

  return (
    <div className="up-ms-body">
      {/* 倍速（右侧抽屉按需求②隐藏） */}
      {!hideSpeed && (
      <div className="up-ms-card">
        <div className="up-ms-row">
          <div className="up-ms-label"><Icon icon={Gauge} size="sm" /> 倍速调节</div>
          <ChipRow
            options={PLAYBACK_RATES.map(r => ({ value: r, label: r === 1 ? '1x' : `${r}x` }))}
            value={currentRate}
            onChange={(v) => applySetting(() => onPlaybackRateChange(v), `倍速 ${v}x`)}
          />
        </div>
      </div>
      )}

      {/* 清晰度（HLS 有效） */}
      {isHls && levels.length > 0 && (
        <div className="up-ms-card">
          <div className="up-ms-row">
            <div className="up-ms-label"><Icon icon={MonitorPlay} size="sm" /> 清晰度</div>
            <ChipRow
              options={[
                { value: -1, label: '自动' },
                ...levels.map((l, i) => ({ value: i, label: getResolutionLabel(l) })),
              ]}
              value={currentLevel}
              onChange={(v) => applySetting(
                () => onLevelChange(v),
                `清晰度：${v === -1 ? '自动' : getResolutionLabel(levels[v])}`,
              )}
            />
          </div>
        </div>
      )}

      {/* 循环 */}
      <div className="up-ms-card">
        <div className="up-ms-row">
          <div className="up-ms-label"><Icon icon={Repeat} size="sm" /> 循环播放</div>
          <ChipRow
            options={LOOP_OPTIONS}
            value={loopMode}
            onChange={(v) => applySetting(() => onLoopModeChange(v),
              v === 'none' ? '循环已关闭' : v === 'single' ? '单集循环' : '列表循环')}
          />
        </div>
      </div>

      {/* 定时关闭 */}
      <div className="up-ms-card">
        <div className="up-ms-row">
          <div className="up-ms-label"><Icon icon={AlarmClock} size="sm" /> 定时关闭</div>
          <ChipRow
            options={SLEEP_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
            value={sleepMinutes}
            onChange={(v) => applySetting(
              () => onSleepChange(v),
              v === 0 ? '定时关闭已取消' : `${v} 分钟后自动关闭`,
            )}
          />
        </div>
      </div>

      {/* 后台听视频 */}
      <div className="up-ms-card">
        <div className="up-ms-row">
          <div className="up-ms-label">
            <Icon icon={Headphones} size="sm" />
            <span className="up-ms-label__stack">
              <span className="up-ms-label__title">后台听视频</span>
              <span className="up-ms-sub">锁屏/切后台时仅保留声音</span>
            </span>
          </div>
          <Switch
            checked={backgroundPlay}
            onChange={(on) => {
              onBackgroundPlayChange(on);
              if (on && getIOSBackgroundAudioCapability() === 'unsupported') {
                mobileSettingsToast('当前 iOS 版本切后台会暂停播放，建议升级至 iOS 17+', 2500);
              } else {
                mobileSettingsToast(on ? '已开启后台听视频' : '已关闭后台听视频', 1800);
              }
              if (closeOnChipSelect) onClose();
            }}
          />
        </div>
      </div>

      {/* 字幕：开关开启后才显示子项（字幕设置 + 导入字幕文件）（右侧抽屉按需求②隐藏） */}
      {!hideSubtitle && (
      <div className="up-ms-card">
        <div className="up-ms-row">
          <div className="up-ms-label">
            <Icon icon={Subtitles} size="sm" />
            <span className="up-ms-label__stack">
              <span className="up-ms-label__title">字幕</span>
              <span className="up-ms-sub">视频支持字幕时可开启</span>
            </span>
          </div>
          <Switch
            checked={subtitleEnabled}
            onChange={(on) => {
              onSubtitleToggle(on);
              mobileSettingsToast(on ? '字幕已开启' : '字幕已关闭', 1800);
              if (closeOnChipSelect) onClose();
            }}
          />
        </div>
        {subtitleEnabled && (
          <>
            <button className="up-ms-row up-ms-row--tap" onClick={onOpenSubtitleSettings}>
              <div className="up-ms-label">
                <span className="up-ms-label__stack">
                  <span className="up-ms-label__title">字幕设置</span>
                  <span className="up-ms-sub">双语字幕 · 字幕大字号 · 翻译语言</span>
                </span>
              </div>
              <Icon icon={ChevronRight} size="sm" />
            </button>
            <button className="up-ms-row up-ms-row--tap" onClick={handleImportClick}>
              <div className="up-ms-label">
                <span className="up-ms-label__stack">
                  <span className="up-ms-label__title">导入字幕文件</span>
                  <span className="up-ms-sub">支持 .srt / .vtt</span>
                </span>
              </div>
              <Icon icon={ChevronRight} size="sm" />
            </button>
          </>
        )}
      </div>
      )}

      {/* 镜像翻转 */}
      <div className="up-ms-card">
        <div className="up-ms-row">
          <div className="up-ms-label"><Icon icon={FlipHorizontal2} size="sm" /> 镜像翻转</div>
          <Switch
            checked={mirror}
            onChange={(on) => {
              onMirrorToggle(on);
              mobileSettingsToast(on ? '镜像已开启' : '镜像已关闭', 1800);
              if (closeOnChipSelect) onClose();
            }}
          />
        </div>
      </div>

      {/* 画面比例 */}
      <div className="up-ms-card">
        <div className="up-ms-row">
          <div className="up-ms-label"><Icon icon={RectangleHorizontal} size="sm" /> 画面比例</div>
          <ChipRow
            options={RATIO_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
            value={aspectRatio}
            onChange={(v) => applySetting(
              () => onAspectRatioChange(RATIO_LABELS[v] ? v : 'default'),
              `画面比例：${RATIO_LABELS[v] ?? '默认'}`,
            )}
          />
        </div>
      </div>

      {/* 右侧抽屉专属：解码模式（仅在全屏更多设置里提供，避免与竖版弹窗重复） */}
      {decoderMode !== undefined && onDecoderModeChange && (
        <div className="up-ms-card">
          <div className="up-ms-row">
            <div className="up-ms-label">解码模式</div>
            <ChipRow
              options={[
                { value: 'native', label: '硬解' },
                { value: 'wasm', label: '软解' },
              ]}
              value={decoderMode}
              onChange={(v) => applySetting(() => onDecoderModeChange(v as DecoderMode), `解码：${v === 'wasm' ? '软解' : '硬解'}`)}
            />
          </div>
        </div>
      )}

      {/* 右侧抽屉专属：快捷键（需求② 抽屉内已隐藏，仅竖版弹窗可能展示） */}
      {onShowShortcuts && !hideShortcuts && (
        <div className="up-ms-card">
          <button className="up-ms-row up-ms-row--tap" onClick={onShowShortcuts}>
            <div className="up-ms-label">键盘快捷键</div>
            <Icon icon={ChevronRight} size="sm" />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
