/**
 * 播放器整改 Demo — 主页面
 *
 * 把 engine / gestures / progress / overlays 四个模块拼装成一个可交互的对照播放器。
 * 重点不是复刻所有功能，而是把「整改计划」里 P0/P1 的关键交互做出手感，
 * 让你确认方向后再铺回真实 UniversalPlayer。
 *
 * 除「引擎抽象」「手势」「进度条键盘可达」「错误友好化」「快捷键面板」
 * 「续播提示」「右键菜单」外，本 demo 还带一个对比侧栏，逐一列出
 * 「现有实现哪里坑 → demo 怎么改」。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import './PlayerLab.css';
import { VirtualEngine, describeMediaError, type MediaEngine } from './engine/MediaEngine';
import { useGestures } from './engine/useGestures';
import DemoProgressBar, { type DemoChapter } from './components/DemoProgressBar';
import {
  GestureHUD,
  RateBadge,
  ShortcutHelp,
  ResumeToast,
  ContextMenu,
  type HudState,
  type MenuItem,
} from './components/DemoOverlays';

const DURATION = 184; // 03:04 演示片长
const RESUME_AT = 96; // 续播点：演示「已为你跳转到 01:36」

const CHAPTERS: DemoChapter[] = [
  { start: 0, end: 28, label: '第 1 章 · 开场' },
  { start: 28, end: 70, label: '第 2 章 · 发展' },
  { start: 70, end: 124, label: '第 3 章 · 高潮' },
  { start: 124, end: 184, label: '第 4 章 · 收尾' },
];

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const QUALITIES = ['自动', '1080P 高清', '720P 清晰', '480P 流畅'];

export default function PlayerLab() {
  const playerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MediaEngine | null>(null);

  // ── 引擎：离线虚拟引擎即可完整体验交互 ──
  if (!engineRef.current) {
    engineRef.current = new VirtualEngine({ duration: DURATION, startTime: 0 });
  }

  // ── 低频 React 状态（时间文本 / 图标），由 subscribe(100ms) 驱动，不走每帧 ──
  const [paused, setPaused] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buffered, setBuffered] = useState(0.32);

  const [timeText, setTimeText] = useState('00:00');

  // ── UI 状态 ──
  const [showControls, setShowControls] = useState(true);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const [hud, setHud] = useState<HudState>({ kind: null, value: 0, duration: DURATION });
  const [rateBadge, setRateBadge] = useState<number | null>(null);
  const [longPressRate] = useState(2);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeRate, setActiveRate] = useState(1);
  const [activeQuality, setActiveQuality] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [resume, setResume] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 引擎订阅：100ms 节流刷新低频 UI ──
  useEffect(() => {
    const engine = engineRef.current!;
    const unsub = engine.subscribe(() => {
      const s = engine.snapshot;
      setPaused(s.paused);
      setVolume(s.volume);
      setMuted(s.muted);
      setError(s.error);
      setBuffered(s.bufferedRatio);
      setTimeText(fmt(s.currentTime));
    });
    return unsub;
  }, []);

  // ── 每帧直写进度条 CSS 变量（零 React 重渲染，对照 P0-4） ──
  useEffect(() => {
    const engine = engineRef.current!;
    const unsub = engine.onFrame(() => {
      const el = playerRef.current;
      if (!el) return;
      const ratio = engine.snapshot.currentTime / engine.snapshot.duration;
      el.style.setProperty('--pl-progress', String(ratio));
      el.style.setProperty('--pl-buffered', String(engine.snapshot.bufferedRatio));
    });
    return unsub;
  }, []);

  // ── 卸载销毁引擎 ──
  useEffect(() => () => { engineRef.current?.destroy(); }, []);

  // ── 全屏变化同步 ──
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // ── 控制栏自动隐藏 ──
  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!paused && !showSettings && !showShortcuts) setShowControls(false);
    }, 3000);
  }, [paused, showSettings, showShortcuts]);

  // ── 桌面端：键盘快捷键（含输入框排除，对照 D2） ──
  useEffect(() => {
    const engine = engineRef.current!;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.shiftKey && e.key === '?') { e.preventDefault(); setShowShortcuts((v) => !v); return; }
      switch (e.key) {
        case ' ': case 'k': case 'K': e.preventDefault(); engine.toggle(); break;
        case 'j': case 'J': engine.seekBy(-10); break;
        case 'l': case 'L': engine.seekBy(10); break;
        case 'ArrowLeft': engine.seekBy(e.shiftKey ? -10 : -5); break;
        case 'ArrowRight': engine.seekBy(e.shiftKey ? 10 : 5); break;
        case 'ArrowUp': e.preventDefault(); engine.setVolume(volume + 0.05); break;
        case 'ArrowDown': e.preventDefault(); engine.setVolume(volume - 0.05); break;
        case 'm': case 'M': engine.toggleMute(); break;
        case 'Home': engine.seek(0); break;
        case 'End': engine.seek(engine.snapshot.duration); break;
        case 'f': case 'F': toggleFullscreen(); break;
        case 'p': case 'P': requestPip(); break;
        case 'c': case 'C': setToast('字幕：开/关（演示）'); break;
        case '.': case '>': if (engine.snapshot.paused) engine.seekBy(1 / 30); break;
        case ',': case '<': if (engine.snapshot.paused) engine.seekBy(-1 / 30); break;
        case 'r': case 'R': setToast('循环模式已切换（演示）'); break;
        default:
          if (/^[0-9]$/.test(e.key)) {
            const pct = Number(e.key) / 10;
            engine.seek(engine.snapshot.duration * pct);
          }
      }
      bumpControls();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);

  // ── 桌面端：鼠标显隐控制栏 ──
  const onMouseMove = useCallback(() => bumpControls(), [bumpControls]);

  // ── 双击切换全屏（桌面） ──
  const toggleFullscreen = useCallback(() => {
    const el = playerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  const requestPip = useCallback(() => {
    setToast('画中画：本 demo 用虚拟引擎，无真实 <video>，需在真实引擎模式下体验');
  }, []);

  // ── 亮度（移动端上滑调节，桌面无此控件） ──
  const [brightness, setBrightness] = useState(1);
  const brightnessRef = useRef(1);
  brightnessRef.current = brightness;
  const applyBrightness = useCallback((b: number) => {
    playerRef.current?.style.setProperty('--pl-brightness', String(b));
  }, []);

  // ── 移动端手势接线 ──
  useGestures({
    containerRef: playerRef,
    enabled: !showShortcuts && !contextMenu,
    fullscreen: isFullscreen,
    getDuration: () => engineRef.current!.snapshot.duration,
    locked: isLocked,
    handlers: {
      onSeekDelta: (d) => {
        const eng = engineRef.current!;
        eng.seekBy(d);
        const v = eng.snapshot.currentTime;
        setHud({ kind: 'seek', value: v, duration: eng.snapshot.duration, direction: d >= 0 ? 'forward' : 'back' });
      },
      onVerticalDelta: (axis, delta) => {
        const eng = engineRef.current!;
        if (axis === 'volume') {
          eng.setVolume(eng.snapshot.volume + delta);
          setHud({ kind: 'volume', value: eng.snapshot.volume, duration: 1 });
        } else {
          setBrightness((b) => {
            const nb = Math.max(0, Math.min(1, b + delta));
            applyBrightness(nb);
            return nb;
          });
          setHud((h) => ({ ...h, kind: 'brightness', value: brightnessRef.current, duration: 1 }));
        }
      },
      onGestureBegin: () => {},
      onGestureEnd: () => setTimeout(() => setHud((h) => ({ ...h, kind: null })), 220),
      onDoubleTap: () => engineRef.current!.toggle(),
      onSingleTap: () => setShowControls((v) => !v),
      onLongPressChange: (active) => {
        if (active) {
          setRateBadge(longPressRate);
          engineRef.current!.setRate(longPressRate);
        } else {
          setRateBadge(null);
          engineRef.current!.setRate(activeRate);
        }
      },
    },
  });

  // ── 进度条回调 ──
  const onScrubStart = useCallback(() => {
    const eng = engineRef.current!;
    eng.pause(); // 拖拽暂停，松手恢复
  }, []);
  const onScrubEnd = useCallback(() => {
    setDragRatio(null);
    if (!paused) engineRef.current!.play();
  }, [paused]);
  const onSeek = useCallback((time: number) => {
    const ratio = engineRef.current!.snapshot.duration
      ? time / engineRef.current!.snapshot.duration
      : 0;
    setDragRatio(ratio);
  }, []);

  // ── 续播演示 ──
  const triggerResume = useCallback(() => {
    engineRef.current!.seek(RESUME_AT);
    setResume(RESUME_AT);
    setShowControls(true);
  }, []);
  const resumeKeep = useCallback(() => setResume(null), []);
  const resumeRestart = useCallback(() => { engineRef.current!.seek(0); setResume(null); }, []);

  // ── 错误演示 ──
  const simulateError = useCallback(() => {
    (engineRef.current as VirtualEngine).simulateError(describeMediaError(2));
  }, []);
  const retry = useCallback(() => {
    (engineRef.current as VirtualEngine).clearError();
    engineRef.current!.play();
  }, []);

  // ── 右键菜单 ──
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);
  const menuItems: MenuItem[] = [
    { label: '播放 / 暂停', hint: 'Space', onSelect: () => engineRef.current!.toggle() },
    { label: '倍速 2.0x', hint: '长按', onSelect: () => { setActiveRate(2); engineRef.current!.setRate(2); } },
    { label: '画中画', hint: 'P', onSelect: requestPip },
    { label: '复制当前时间', onSelect: () => { navigator.clipboard?.writeText(timeText).catch(() => {}); } },
  ];

  const volumePct = Math.round((muted ? 0 : volume) * 100);
  const VolIcon = muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊';

  return (
    <div className="pl-page">
      <header className="pl-page-head">
        <h1>播放器整改 Demo <span className="pl-tag">PlayerLab</span></h1>
        <p>对照现有手写 UniversalPlayer，演示 P0/P1 关键交互。键盘快捷键见右下角或按 <kbd>Shift</kbd>+<kbd>?</kbd>。</p>
      </header>

      <div className="pl-layout">
        {/* 播放器本体 */}
        <div
          ref={playerRef}
          className={`pl-player${isFullscreen ? ' pl-player--fs' : ''}${showControls ? ' pl-show' : ''}${isLocked ? ' pl-locked' : ''}`}
          onMouseMove={onMouseMove}
          onDoubleClick={toggleFullscreen}
          onContextMenu={onContextMenu}
        >
          {/* 视频画面（占位，用渐变模拟帧） */}
          <div className="pl-stage" style={{ filter: `brightness(var(--pl-brightness, 1))` }}>
            <div className="pl-stage-grid" />
            <div className="pl-stage-time">{timeText} / {fmt(DURATION)}</div>
            {error && (
              <div className="pl-error pl-no-gesture">
                <div className="pl-error-icon">⚠</div>
                <p>{error}</p>
                <div className="pl-error-actions">
                  <button type="button" className="pl-btn pl-btn--primary" onClick={retry}>重试</button>
                  <button type="button" className="pl-btn" onClick={() => engineRef.current!.seek(0)}>换源</button>
                </div>
              </div>
            )}
          </div>

          {/* 手势反馈 HUD */}
          <GestureHUD hud={hud} />
          {rateBadge !== null && <RateBadge rate={rateBadge} />}

          {/* 续播提示 */}
          {resume !== null && !error && (
            <ResumeToast seconds={resume} onKeep={resumeKeep} onRestart={resumeRestart} />
          )}

          {/* 控制栏 */}
          <div className="pl-controls pl-no-gesture">
            <DemoProgressBar
              duration={DURATION}
              buffered={buffered}
              dragRatio={dragRatio}
              chapters={CHAPTERS}
              onSeek={onSeek}
              onScrubStart={onScrubStart}
              onScrubEnd={onScrubEnd}
            />

            <div className="pl-controls-row">
              <button type="button" className="pl-icon-btn" onClick={() => engineRef.current!.toggle()} aria-label={paused ? '播放' : '暂停'}>
                {paused ? '▶' : '❚❚'}
              </button>

              <div className="pl-volume">
                <button type="button" className="pl-icon-btn" onClick={() => engineRef.current!.toggleMute()} aria-label="静音">
                  {VolIcon}
                </button>
                <input
                  className="pl-volume-slider"
                  type="range" min={0} max={1} step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => engineRef.current!.setVolume(Number(e.target.value))}
                  aria-label="音量"
                />
                <span className="pl-volume-pct">{volumePct}%</span>
              </div>

              <span className="pl-time"><b>{timeText}</b> / {fmt(DURATION)}</span>

              <div className="pl-spacer" />

              <button type="button" className="pl-icon-btn" onClick={() => setShowSettings((v) => !v)} aria-label="设置" title="设置">
                ⚙
              </button>
              <button type="button" className="pl-icon-btn" onClick={requestPip} aria-label="画中画" title="画中画">⧉</button>
              <button type="button" className="pl-icon-btn" onClick={toggleFullscreen} aria-label="全屏" title="全屏">⛶</button>
              <button type="button" className="pl-icon-btn pl-lock-btn" onClick={() => setIsLocked((v) => !v)} aria-label={isLocked ? '解锁' : '锁定'} title={isLocked ? '解锁' : '锁定'}>
                {isLocked ? '🔒' : '🔓'}
              </button>
            </div>

            {/* 设置面板 */}
            {showSettings && (
              <div className="pl-settings pl-no-gesture">
                <div className="pl-settings-title">倍速</div>
                <div className="pl-settings-chips">
                  {RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`pl-chip${activeRate === r ? ' pl-chip--on' : ''}`}
                      onClick={() => { setActiveRate(r); engineRef.current!.setRate(r); }}
                    >{r}x</button>
                  ))}
                </div>
                <div className="pl-settings-title">清晰度</div>
                <div className="pl-settings-chips">
                  {QUALITIES.map((q, i) => (
                    <button
                      key={q}
                      type="button"
                      className={`pl-chip${activeQuality === i ? ' pl-chip--on' : ''}`}
                      onClick={() => setActiveQuality(i)}
                    >{q}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 快捷键面板 */}
          {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}

          {/* 右键菜单 */}
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              items={menuItems}
              onClose={() => setContextMenu(null)}
            />
          )}

          {/* 锁定遮罩提示 */}
          {isLocked && <div className="pl-locked-hint">已锁定，手势与点击已禁用 · 再次点击 🔒 解锁</div>}

          {/* toast */}
          {toast && <div className="pl-toast pl-no-gesture" onClick={() => setToast(null)}>{toast}</div>}
        </div>

        {/* 右侧：功能对照 / 操作 */}
        <aside className="pl-side">
          <section className="pl-panel">
            <h3>演示操作</h3>
            <div className="pl-actions">
              <button type="button" className="pl-btn" onClick={triggerResume}>演示续播提示</button>
              <button type="button" className="pl-btn" onClick={simulateError}>演示错误态 + 重试</button>
              <button type="button" className="pl-btn" onClick={() => setShowShortcuts(true)}>打开快捷键面板</button>
              <button type="button" className="pl-btn" onClick={toggleFullscreen}>进入全屏</button>
            </div>
            <p className="pl-hint">移动端：用手机/DevTools 触摸模拟体验手势。桌面端：键盘全快捷键可用。</p>
          </section>

          <section className="pl-panel">
            <h3>现有实现 vs Demo</h3>
            <ComparisonTable />
          </section>
        </aside>
      </div>
    </div>
  );
}

/** 现有实现问题 → demo 改法的对照表（节选自完整调研报告） */
function ComparisonTable() {
  const rows = [
    ['进度条每 250ms 走 React state，播放中整页重渲染', 'rAF 直写 CSS 变量，零重渲染（P0）'],
    ['横向滑动手势被整段丢弃', '完整增量 seek + «/» 反馈（P0）'],
    ['进度条无 ARIA / 键盘盲区', 'role=slider + 全键盘 + aria-valuetext（P0）'],
    ['音量初值硬编码 0、无条件 preventDefault 锁死滚动', '外部传入初值、按全屏分级（P0）'],
    ['错误只一句「播放失败」', '媒体错误码翻译 + 重试/换源（P0）'],
    ['无快捷键面板', 'Shift+? 调出完整快捷键表（P1）'],
    ['无续播提示，静默 seek', '「已跳转到 01:36」+ 从头播放（P1）'],
    ['无右键菜单', '复制时间 / 倍速 / 画中画（P1）'],
    ['单击播放延迟 250ms', '单击立即显隐控制栏（P1）'],
    ['无章节标记', '进度条章节分段（P2）'],
  ];
  return (
    <table className="pl-compare">
      <thead><tr><th>现有问题</th><th>Demo 改法</th></tr></thead>
      <tbody>
        {rows.map(([a, b]) => (
          <tr key={a}><td>{a}</td><td>{b}</td></tr>
        ))}
      </tbody>
    </table>
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
