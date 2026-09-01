/**
 * 「更多设置」内容体 —— 横屏右侧抽屉与竖屏底部弹窗共用同一份内容。
 *
 * 原来这份内容只存在于竖版 BottomSheet（MobileUI/MobileMoreSheet.tsx），
 * 横屏后被 40rem 的 max-width 卡住、又被 88dvh 的矮高度挤成一条，
 * 现在抽成与容器无关的内容组件，由两种容器各自套壳：
 *   · 竖屏 → 底部弹窗（保持原有手感）
 *   · 横屏/全屏 → 播放器右侧抽屉（本次新增）
 */
import { useRef } from 'react';
import {
  Gauge, Repeat, AlarmClock, Headphones, Subtitles, FlipHorizontal2, RectangleHorizontal,
  ChevronRight, MonitorPlay,
} from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import Switch from '@/components/ui/Switch';

export type DemoLoopMode = 'none' | 'single' | 'list';
export type DemoAspectRatio = 'default' | '4:3' | '16:9' | 'fill';

export interface SettingsState {
  rate: number;
  loopMode: DemoLoopMode;
  quality: number;
  sleepMinutes: number;
  backgroundPlay: boolean;
  subtitleEnabled: boolean;
  mirror: boolean;
  aspectRatio: DemoAspectRatio;
}

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
export const SLEEP_OPTIONS = [
  { value: 0, label: '关闭' },
  { value: 10, label: '10分钟' },
  { value: 30, label: '30分钟' },
  { value: 60, label: '60分钟' },
];
export const LOOP_OPTIONS: { value: DemoLoopMode; label: string }[] = [
  { value: 'none', label: '不循环' },
  { value: 'single', label: '单集循环' },
  { value: 'list', label: '列表循环' },
];
export const RATIO_OPTIONS: { value: DemoAspectRatio; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: 'fill', label: '铺满' },
];
export const QUALITY_OPTIONS = ['自动', '1080P 高清', '720P 清晰', '480P 流畅'];

export const LOOP_TOAST_TEXT: Record<DemoLoopMode, string> = {
  none: '循环已关闭',
  single: '单集循环',
  list: '列表循环',
};
export const RATIO_LABELS: Record<DemoAspectRatio, string> = {
  default: '默认',
  '4:3': '4:3',
  '16:9': '16:9',
  fill: '铺满',
};

interface ChipRowProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function ChipRow<T extends string | number>({ options, value, onChange }: ChipRowProps<T>) {
  return (
    <div className="pml-chips">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className={`pml-chip${opt.value === value ? ' pml-chip--on' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface SettingsContentProps {
  state: SettingsState;
  onPatch: (patch: Partial<SettingsState>) => void;
  /** 选中 chip 类设置后的提示文案（demo 里 toast 到播放器中央） */
  onToast: (msg: string) => void;
  /** 开关/跳转类操作，由外层决定是否关闭弹窗 */
  onClose: () => void;
  /** 是否显示清晰度（仅 HLS 有实际画质档位） */
  showQuality: boolean;
  onOpenSubtitleSettings?: () => void;
  onImportSubtitle?: (file: File) => void;
  /** 竖版底部弹窗里 chip 选中后自动关闭；右侧抽屉里保持打开（可连续调） */
  closeOnChipSelect: boolean;
}

export default function SettingsContent({
  state, onPatch, onToast, onClose, showQuality,
  onOpenSubtitleSettings, onImportSubtitle, closeOnChipSelect,
}: SettingsContentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** chip 子设置选中：生效 + 提示（+ 竖版关弹窗） */
  const selectChip = (patch: Partial<SettingsState>, msg: string) => {
    onPatch(patch);
    onToast(msg);
    if (closeOnChipSelect) onClose();
  };

  const toggleSwitch = (patch: Partial<SettingsState>, msg: string) => {
    onPatch(patch);
    onToast(msg);
    if (closeOnChipSelect) onClose();
  };

  return (
    <div className="pml-settings-body">
      {/* 倍速 */}
      <div className="pml-card">
        <div className="pml-row">
          <div className="pml-label"><Icon icon={Gauge} size="sm" /> 倍速调节</div>
          <ChipRow
            options={PLAYBACK_RATES.map((r) => ({ value: r, label: r === 1 ? '1x' : `${r}x` }))}
            value={state.rate}
            onChange={(v) => selectChip({ rate: v }, `倍速 ${v}x`)}
          />
        </div>
      </div>

      {/* 清晰度 */}
      {showQuality && (
        <div className="pml-card">
          <div className="pml-row">
            <div className="pml-label"><Icon icon={MonitorPlay} size="sm" /> 清晰度</div>
            <ChipRow
              options={QUALITY_OPTIONS.map((q, i) => ({ value: i, label: q }))}
              value={state.quality}
              onChange={(v) => selectChip({ quality: v }, `清晰度：${QUALITY_OPTIONS[v]}`)}
            />
          </div>
        </div>
      )}

      {/* 循环播放 */}
      <div className="pml-card">
        <div className="pml-row">
          <div className="pml-label"><Icon icon={Repeat} size="sm" /> 循环播放</div>
          <ChipRow
            options={LOOP_OPTIONS}
            value={state.loopMode}
            onChange={(v) => selectChip({ loopMode: v }, LOOP_TOAST_TEXT[v])}
          />
        </div>
      </div>

      {/* 定时关闭 */}
      <div className="pml-card">
        <div className="pml-row">
          <div className="pml-label"><Icon icon={AlarmClock} size="sm" /> 定时关闭</div>
          <ChipRow
            options={SLEEP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={state.sleepMinutes}
            onChange={(v) => selectChip(
              { sleepMinutes: v },
              v === 0 ? '定时关闭已取消' : `${v} 分钟后自动关闭`,
            )}
          />
        </div>
      </div>

      {/* 后台听视频 */}
      <div className="pml-card">
        <div className="pml-row">
          <div className="pml-label">
            <Icon icon={Headphones} size="sm" />
            <span className="pml-label__stack">
              <span className="pml-label__title">后台听视频</span>
              <span className="pml-sub">锁屏/切后台时仅保留声音</span>
            </span>
          </div>
          <Switch
            checked={state.backgroundPlay}
            onChange={(on) => toggleSwitch({ backgroundPlay: on }, on ? '已开启后台听视频' : '已关闭后台听视频')}
          />
        </div>
      </div>

      {/* 字幕 */}
      <div className="pml-card">
        <div className="pml-row">
          <div className="pml-label">
            <Icon icon={Subtitles} size="sm" />
            <span className="pml-label__stack">
              <span className="pml-label__title">字幕</span>
              <span className="pml-sub">视频支持字幕时可开启</span>
            </span>
          </div>
          <Switch
            checked={state.subtitleEnabled}
            onChange={(on) => toggleSwitch({ subtitleEnabled: on }, on ? '字幕已开启' : '字幕已关闭')}
          />
        </div>
        {state.subtitleEnabled && (
          <>
            <button type="button" className="pml-row pml-row--tap" onClick={onOpenSubtitleSettings}>
              <div className="pml-label">
                <span className="pml-label__stack">
                  <span className="pml-label__title">字幕设置</span>
                  <span className="pml-sub">双语字幕 · 字幕大字号 · 翻译语言</span>
                </span>
              </div>
              <Icon icon={ChevronRight} size="sm" />
            </button>
            <button
              type="button"
              className="pml-row pml-row--tap"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="pml-label">
                <span className="pml-label__stack">
                  <span className="pml-label__title">导入字幕文件</span>
                  <span className="pml-sub">支持 .srt / .vtt</span>
                </span>
              </div>
              <Icon icon={ChevronRight} size="sm" />
            </button>
          </>
        )}
      </div>

      {/* 镜像翻转 */}
      <div className="pml-card">
        <div className="pml-row">
          <div className="pml-label"><Icon icon={FlipHorizontal2} size="sm" /> 镜像翻转</div>
          <Switch
            checked={state.mirror}
            onChange={(on) => toggleSwitch({ mirror: on }, on ? '镜像已开启' : '镜像已关闭')}
          />
        </div>
      </div>

      {/* 画面比例 */}
      <div className="pml-card">
        <div className="pml-row">
          <div className="pml-label"><Icon icon={RectangleHorizontal} size="sm" /> 画面比例</div>
          <ChipRow
            options={RATIO_OPTIONS}
            value={state.aspectRatio}
            onChange={(v) => selectChip({ aspectRatio: v }, `画面比例：${RATIO_LABELS[v]}`)}
          />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportSubtitle?.(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
