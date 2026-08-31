import { useCallback, useRef } from 'react';
import {
  Gauge, Repeat, AlarmClock, Headphones, Subtitles, FlipHorizontal2, RectangleHorizontal,
  ChevronRight, MonitorPlay, Volume2, VolumeX, PictureInPicture2, X,
} from 'lucide-react';
import { BottomSheet } from '@/components/ui';
import Switch from '@/components/ui/Switch';
import { Icon } from '@/components/ui/Icon';
import { mobileSettingsToast } from '../PlayerToast';
import { getResolutionLabel } from '../lib/utils';
import type { LoopMode, PlayerLevel } from '@/types/player';

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SLEEP_OPTIONS = [
  { value: 0, label: '关闭' },
  { value: 10, label: '10分钟' },
  { value: 30, label: '30分钟' },
  { value: 60, label: '60分钟' },
] as const;
const LOOP_OPTIONS: { value: LoopMode; label: string }[] = [
  { value: 'none', label: '不循环' },
  { value: 'single', label: '单集循环' },
  { value: 'list', label: '列表循环' },
];
const LOOP_TOAST_TEXT: Record<LoopMode, string> = {
  none: '循环已关闭',
  single: '单集循环',
  list: '列表循环',
};
const RATIO_OPTIONS = [
  { value: 'default', label: '默认' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: 'fill', label: '铺满' },
] as const;
const RATIO_LABELS: Record<string, string> = {
  default: '默认',
  '4:3': '4:3',
  '16:9': '16:9',
  fill: '铺满',
};

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
  /** G3：移动端音量调节 */
  volume: number;
  onVolumeChange: (volume: number) => void;
  onToggleMute?: () => void;
  /** G6：移动端画中画入口（不支持的环境隐藏） */
  isPiP: boolean;
  onTogglePiP: () => void;
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

/** 移动端音量滑块：显示当前百分比 + 拖动调音量（G3） */
function VolumeSlider({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
  return (
    <div className="up-ms-volume">
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="up-ms-volume-slider"
        aria-label="音量"
      />
      <span className="up-ms-volume-value">{Math.round(volume * 100)}%</span>
    </div>
  );
}

export default function MobileMoreSheet({
  visible, onClose,
  currentRate, onPlaybackRateChange,
  loopMode, onLoopModeChange,
  levels, currentLevel, onLevelChange, isHls,
  volume, onVolumeChange, onToggleMute,
  isPiP, onTogglePiP,
  sleepMinutes, onSleepChange,
  backgroundPlay, onBackgroundPlayChange,
  subtitleEnabled, onSubtitleToggle, onOpenSubtitleSettings, onImportSubtitle,
  mirror, onMirrorToggle,
  aspectRatio, onAspectRatioChange,
}: MobileMoreSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportSubtitle(file);
    e.target.value = '';
  }, [onImportSubtitle]);

  /** chip 子设置选中：生效 + 顶部居中提示（demo 定位）+ 关闭弹窗 */
  const selectAndClose = useCallback((apply: () => void, msg: string) => {
    apply();
    mobileSettingsToast(msg, 1800);
    onClose();
  }, [onClose]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="更多设置" className="up-ms-sheet">
      <div className="up-ms-head">
        <span className="up-ms-title">更多设置</span>
        <button className="up-ms-close" onClick={onClose} aria-label="关闭更多设置">
          <Icon icon={X} size="sm" />
        </button>
      </div>
      <div className="up-ms-body">
        {/* 音量（G3：移动端缺少音量调节的唯一入口） */}
        <div className="up-ms-card">
          <div className="up-ms-row">
            <div className="up-ms-label"><Icon icon={Volume2} size="sm" /> 音量</div>
            <div className="up-ms-volume-control">
              <VolumeSlider volume={volume} onChange={onVolumeChange} />
              <button
                className="up-ms-mute-btn"
                onClick={() => onToggleMute?.()}
                aria-label="静音切换"
              >
                <Icon icon={volume === 0 ? VolumeX : Volume2} size="sm" />
              </button>
            </div>
          </div>
        </div>

        {/* 画中画（G6：仅支持环境显示） */}
        {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
          <div className="up-ms-card">
            <div className="up-ms-row">
              <div className="up-ms-label"><Icon icon={PictureInPicture2} size="sm" /> 画中画</div>
              <button
                className="up-ms-chip up-ms-chip--on"
                onClick={() => {
                  onTogglePiP();
                  onClose();
                }}
              >
                {isPiP ? '退出' : '开启'}
              </button>
            </div>
          </div>
        )}

        {/* 倍速 */}
        <div className="up-ms-card">
          <div className="up-ms-row">
            <div className="up-ms-label"><Icon icon={Gauge} size="sm" /> 倍速调节</div>
            <ChipRow
              options={PLAYBACK_RATES.map(r => ({ value: r, label: r === 1 ? '1x' : `${r}x` }))}
              value={currentRate}
              onChange={(v) => selectAndClose(() => onPlaybackRateChange(v), `倍速 ${v}x`)}
            />
          </div>
        </div>

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
                onChange={(v) => selectAndClose(
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
              onChange={(v) => selectAndClose(() => onLoopModeChange(v), LOOP_TOAST_TEXT[v])}
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
              onChange={(v) => selectAndClose(
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
                mobileSettingsToast(on ? '已开启后台听视频' : '已关闭后台听视频', 1800);
              }}
            />
          </div>
        </div>

        {/* 字幕：开关开启后才显示子项（字幕设置 + 导入字幕文件） */}
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
                // 关闭字幕 → 弹窗一并关闭（开启不关，便于直接进入下方字幕设置）
                if (!on) onClose();
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

        {/* 镜像翻转 */}
        <div className="up-ms-card">
          <div className="up-ms-row">
            <div className="up-ms-label"><Icon icon={FlipHorizontal2} size="sm" /> 镜像翻转</div>
            <Switch
              checked={mirror}
              onChange={(on) => {
                onMirrorToggle(on);
                mobileSettingsToast(on ? '镜像已开启' : '镜像已关闭', 1800);
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
              onChange={(v) => selectAndClose(
                () => onAspectRatioChange(RATIO_LABELS[v] ? v : 'default'),
                `画面比例：${RATIO_LABELS[v] ?? '默认'}`,
              )}
            />
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </BottomSheet>
  );
}