/**
 * 播放器整改 Demo — 覆盖层组件
 *
 * 包含四类现有播放器完全缺失的 UI：
 * - GestureHUD：手势反馈（B站式大号时间气泡 / 竖条 / 倍速徽章）
 * - ShortcutHelp：快捷键面板（Shift+?，YouTube 标配，现有实现没有）
 * - ResumeToast：续播提示（带「从头播放」，现有实现静默 seek + 一句 toast）
 * - ContextMenu：右键菜单（现有实现完全没有）
 */

/* ───────────────────────── 快捷键表 ───────────────────────── */

export interface Shortcut {
  keys: string;
  desc: string;
  group: string;
}

/** 合并 B站原生 + Bilibili-Evolved 扩展 + YouTube 官方，去掉 B站特有（弹幕/投币） */
export const SHORTCUTS: Shortcut[] = [
  { group: '播放', keys: 'Space / K', desc: '播放 / 暂停' },
  { group: '播放', keys: 'J', desc: '后退 10 秒' },
  { group: '播放', keys: 'L', desc: '前进 10 秒' },
  { group: '播放', keys: '← / →', desc: '后退 / 前进 5 秒' },
  { group: '播放', keys: 'Shift + ← / →', desc: '后退 / 前进 10 秒' },
  { group: '播放', keys: 'Home / End', desc: '跳到开头 / 结尾' },
  { group: '播放', keys: '0 – 9', desc: '跳到 0% – 90%' },
  { group: '播放', keys: ', / .', desc: '逐帧后退 / 前进（暂停时）' },

  { group: '音量', keys: '↑ / ↓', desc: '音量 ±5%' },
  { group: '音量', keys: 'M', desc: '静音 / 取消静音' },

  { group: '画面', keys: 'F', desc: '全屏 / 退出全屏' },
  { group: '画面', keys: 'W', desc: '网页全屏' },
  { group: '画面', keys: 'T', desc: '宽屏（影院）模式' },
  { group: '画面', keys: 'P', desc: '画中画' },
  { group: '画面', keys: 'Esc', desc: '退出全屏 / 关闭弹层' },

  { group: '播放设置', keys: 'Shift + , / .', desc: '倍速 −/+ 0.25x' },
  { group: '播放设置', keys: 'Shift + /', desc: '倍速重置为 1.0x' },
  { group: '播放设置', keys: 'C', desc: '字幕开关' },
  { group: '播放设置', keys: 'R', desc: '循环模式切换' },
  { group: '播放设置', keys: '[ / ]', desc: '上一集 / 下一集' },

  { group: '其他', keys: 'Shift + ?', desc: '打开 / 关闭本面板' },
];

/* ───────────────────────── 手势反馈 HUD ───────────────────────── */

export interface HudState {
  kind: 'seek' | 'brightness' | 'volume' | 'rate' | null;
  /** seek：当前时间；brightness/volume：0–1.4（亮度可到 2，这里按 DOM 缩放显示） */
  value: number;
  duration: number;
  /** seek 的方向，用于显示 « / » */
  direction?: 'back' | 'forward';
}

export function GestureHUD({ hud }: { hud: HudState }) {
  if (!hud.kind) return null;

  if (hud.kind === 'seek') {
    return (
      <div className="pl-hud pl-hud--seek">
        <span className="pl-hud-seek-arrow">{hud.direction === 'back' ? '«' : '»'}</span>
        <span className="pl-hud-seek-time">{fmt(hud.value)}</span>
        <span className="pl-hud-seek-total">/ {fmt(hud.duration)}</span>
      </div>
    );
  }

  const pct = Math.round(Math.min(1, hud.value) * 100);
  return (
    <div className="pl-hud pl-hud--vbar">
      <div className="pl-hud-vbar-icon">{hud.kind === 'volume' ? '🔊' : '☀'}</div>
      <div className="pl-hud-vbar-track">
        <div className="pl-hud-vbar-fill" style={{ height: `${pct}%` }} />
      </div>
      <div className="pl-hud-vbar-pct">{pct}%</div>
    </div>
  );
}

/** 长按倍速徽章（独立组件：出现有 scale 动画） */
export function RateBadge({ rate }: { rate: number }) {
  return (
    <div className="pl-rate-badge">
      <span className="pl-rate-badge-value">{rate.toFixed(1)}x</span>
      <span className="pl-rate-badge-hint">松手恢复</span>
    </div>
  );
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/* ───────────────────────── 快捷键面板 ───────────────────────── */

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const groups = Array.from(new Set(SHORTCUTS.map((s) => s.group)));
  return (
    <div className="pl-shortcuts pl-no-gesture" role="dialog" aria-label="键盘快捷键" aria-modal="false">
      <div className="pl-shortcuts-head">
        <h3>键盘快捷键</h3>
        <button type="button" className="pl-icon-btn" onClick={onClose} aria-label="关闭快捷键面板">✕</button>
      </div>
      <div className="pl-shortcuts-body">
        {groups.map((g) => (
          <section key={g} className="pl-shortcuts-group">
            <h4>{g}</h4>
            {SHORTCUTS.filter((s) => s.group === g).map((s) => (
              <div key={s.keys} className="pl-shortcuts-row">
                <kbd>{s.keys}</kbd>
                <span>{s.desc}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── 续播提示 ───────────────────────── */

interface ResumeToastProps {
  seconds: number;
  onKeep: () => void;
  onRestart: () => void;
}

export function ResumeToast({ seconds, onKeep, onRestart }: ResumeToastProps) {
  return (
    <div className="pl-resume pl-no-gesture" role="status" aria-live="polite">
      <span>已为你跳转到上次观看的 {fmt(seconds)}</span>
      <button type="button" className="pl-resume-btn" onClick={onRestart}>从头播放</button>
      <button type="button" className="pl-resume-close" onClick={onKeep} aria-label="关闭提示">✕</button>
    </div>
  );
}

/* ───────────────────────── 右键菜单 ───────────────────────── */

export interface MenuItem {
  label: string;
  hint?: string;
  onSelect: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  return (
    <div
      className="pl-context pl-no-gesture"
      style={{ left: x, top: y }}
      role="menu"
      onPointerLeave={onClose}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          className="pl-context-item"
          onClick={() => { it.onSelect(); onClose(); }}
        >
          <span>{it.label}</span>
          {it.hint && <kbd>{it.hint}</kbd>}
        </button>
      ))}
    </div>
  );
}
