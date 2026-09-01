/**
 * 移动端播放器横屏 / 全屏 / 画中画 整改 Demo
 *
 * 覆盖本次提出的 5 个问题：
 *   ① 横屏后「更多设置」弹窗不占满设备宽度
 *   ② iOS Web 竖屏点画中画页面卡死
 *   ③ iOS 全屏被系统原生播放器接管，自定义控制栏全丢
 *   ④ 全屏控制栏 UI 改造（恢复桌面布局 − 音量 − 循环，画中画/更多设置移到右上角）
 *   ⑤ 安卓 OEM 浏览器（X5 / UC / 各厂 ROM 浏览器）的劫持与兼容
 *
 * 真实 <video> + hls.js，可直接用手机扫码 / DevTools 设备模拟 / PC 调试安卓 打开验证。
 * 路由：/player-mobile-lab（demo 专用，不进正式导航）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, MonitorSmartphone } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import './PlayerMobileLab.css';
import {
  detectDeviceCaps, getVideoCompatAttrs, isLandscape,
  type DeviceCaps, type FullscreenCapability,
} from './lib/deviceCaps';
import {
  exitFullscreen, requestElementFullscreen, requestVideoFullscreen,
  lockLandscape, unlockOrientation, subscribeFullscreenChange,
} from './lib/fullscreenStrategy';
import { togglePip, subscribePipChange } from './lib/pipController';
import FullscreenControlBar, { FsTopRightActions } from './components/FullscreenControlBar';
import SettingsDrawer from './components/SettingsDrawer';
import MoreSheet from './components/MoreSheet';
import { QUALITY_OPTIONS, type SettingsState } from './components/SettingsContent';

const SAMPLE_MP4 = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const SAMPLE_HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

type FsModeChoice = 'auto' | FullscreenCapability;
type PipModeChoice = 'auto' | 'standard' | 'fullscreen-first';

interface LogEntry {
  time: string;
  level: 'info' | 'ok' | 'warn' | 'error';
  text: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  rate: 1,
  loopMode: 'none',
  quality: 0,
  sleepMinutes: 0,
  backgroundPlay: false,
  subtitleEnabled: false,
  mirror: false,
  aspectRatio: 'default',
};

export default function PlayerMobileLab() {
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);

  // ── 能力探测（一次）──
  const caps: DeviceCaps = useMemo(() => detectDeviceCaps(), []);
  const compatAttrs = useMemo(() => getVideoCompatAttrs(caps), [caps]);

  // ── 源 ──
  const [src, setSrc] = useState(SAMPLE_MP4);
  const [srcInput, setSrcInput] = useState(SAMPLE_MP4);

  // ── 播放状态（低频，250ms 轮询足够）──
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);

  // ── 布局 / 全屏 ──
  const [landscape, setLandscape] = useState(() => isLandscape());
  const [nativeFs, setNativeFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [fsMode, setFsMode] = useState<FsModeChoice>('auto');
  /** 强制按全屏 UI 预览（横竖屏都能看改造后的控制栏） */
  const [forceFsUi, setForceFsUi] = useState(false);

  // ── 画中画 ──
  const [isPip, setIsPip] = useState(false);
  const [pipMode, setPipMode] = useState<PipModeChoice>('auto');

  // ── 设置 ──
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── UI 杂项 ──
  const [controlsVisible, setControlsVisible] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFullscreen = nativeFs || pseudoFs;
  /** 是否展示「全屏改造后的控制栏 + 右上角操作组 + 右侧抽屉」 */
  const useFsUi = isFullscreen || forceFsUi || landscape;

  const log = useCallback((level: LogEntry['level'], text: string) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setLogs((prev) => [{ time, level, text }, ...prev].slice(0, 60));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2000);
  }, []);

  // ── 控制栏自动隐藏 ──
  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!paused && !drawerOpen && !sheetOpen) setControlsVisible(false);
    }, 3000);
  }, [paused, drawerOpen, sheetOpen]);

  useEffect(() => {
    bumpControls();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [bumpControls]);

  // ── 横竖屏 ──
  useEffect(() => {
    const on = () => {
      const l = isLandscape();
      setLandscape(l);
      log('info', `屏幕方向变化 → ${l ? '横屏' : '竖屏'}（${window.innerWidth}×${window.innerHeight}）`);
    };
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, [log]);

  // ── 全屏状态订阅 ──
  useEffect(() => subscribeFullscreenChange((v) => {
    setNativeFs(v);
    log('info', `元素级全屏：${v ? '进入' : '退出'}`);
  }), [log]);

  // ── 装载视频源（HLS 走 hls.js，iOS 原生 HLS 直接赋 src）──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setVideoError(null);
    setCurrentTime(0);
    setDuration(0);
    const isHls = /\.m3u8(\?|$)/i.test(src);
    const nativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';
    let disposed = false;

    if (isHls && !nativeHls) {
      import('hls.js').then(({ default: HlsJs }) => {
        if (disposed) return;
        if (!HlsJs.isSupported()) {
          setVideoError('当前浏览器不支持 HLS 播放');
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hls = new (HlsJs as any)({ enableWorker: true });
        hlsRef.current = hls;
        hls.on(HlsJs.Events.ERROR, (_e: unknown, data: { fatal?: boolean; details?: string }) => {
          if (data?.fatal) setVideoError(`HLS 错误：${data.details ?? 'unknown'}`);
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        log('info', 'hls.js 已挂载（非原生 HLS 环境）');
      });
    } else {
      video.src = src;
      log('info', isHls ? '使用原生 HLS 播放' : '使用原生解码播放');
    }

    return () => {
      disposed = true;
      hlsRef.current?.destroy?.();
      hlsRef.current = null;
    };
  }, [src, log]);

  // ── video 事件 ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => { setPaused(false); bumpControls(); };
    const onPause = () => { setPaused(true); setControlsVisible(true); };
    const onMeta = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onError = () => setVideoError('视频加载失败，请更换地址');
    const tick = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('durationchange', onMeta);
    video.addEventListener('error', onError);
    const timer = window.setInterval(tick, 250);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('durationchange', onMeta);
      video.removeEventListener('error', onError);
      window.clearInterval(timer);
    };
  }, [bumpControls]);

  // ── 画中画状态订阅（含 iOS webkitpresentationmodechanged）──
  useEffect(() => subscribePipChange(videoRef.current, (inPip) => {
    setIsPip(inPip);
    log('ok', inPip ? '进入画中画' : '退出画中画');
  }), [log]);

  // ── 倍速 / 镜像 / 比例 应用到 video ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = settings.rate;
  }, [settings.rate]);

  // ── 全屏切换 ──
  const resolvedFsMode: FullscreenCapability = fsMode === 'auto' ? caps.fullscreenStrategy : fsMode;

  const handleToggleFullscreen = useCallback(async () => {
    const el = playerRef.current;
    const video = videoRef.current;
    if (!el) return;

    // 退出
    if (nativeFs) {
      await exitFullscreen(video);
      unlockOrientation();
      return;
    }
    if (pseudoFs) {
      setPseudoFs(false);
      unlockOrientation();
      log('info', '退出 CSS 网页伪全屏');
      return;
    }

    const mode = resolvedFsMode;
    log('info', `请求全屏，策略 = ${mode}`);

    if (mode === 'fullscreen-api') {
      const ok = await requestElementFullscreen(el);
      if (!ok) {
        log('warn', '元素级全屏被拒绝 → 降级 CSS 网页伪全屏');
        showToast('元素级全屏失败，已降级为网页全屏');
        setPseudoFs(true);
      } else {
        await lockLandscape();
      }
      return;
    }

    if (mode === 'webkit-video') {
      const ok = requestVideoFullscreen(video);
      if (!ok) {
        log('warn', 'webkitEnterFullscreen 不可用 → 降级 CSS 网页伪全屏');
        showToast('系统级全屏不可用，已降级为网页全屏');
        setPseudoFs(true);
        return;
      }
      log('warn', '已进入系统原生全屏：自定义控制栏与弹窗将全部不可见（iOS/X5 限制）');
      await lockLandscape();
      return;
    }

    setPseudoFs(true);
    await lockLandscape();
    log('ok', '进入 CSS 网页伪全屏（自定义 UI 完整保留）');
  }, [nativeFs, pseudoFs, resolvedFsMode, log, showToast]);

  // ── 画中画切换 ──
  const handleTogglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const forceFullscreenFirst = pipMode === 'auto'
      ? caps.pipRequiresFullscreenFirst
      : pipMode === 'fullscreen-first';

    log('info', `请求画中画，通道 = ${forceFullscreenFirst ? '先全屏再切 PiP（iOS）' : '标准 API'}`);
    const res = await togglePip(video, caps.pip, forceFullscreenFirst);

    if (res.ok) {
      log('ok', `画中画成功（${res.channel}）`);
      if (res.message) showToast(res.message);
    } else {
      log('error', `画中画失败：${res.message}`);
      showToast(res.message ?? '画中画失败');
    }
  }, [caps.pip, caps.pipRequiresFullscreenFirst, pipMode, log, showToast]);

  // ── 设置 ──
  const patchSettings = useCallback((patch: Partial<SettingsState>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const openMore = useCallback(() => {
    // 横屏 / 全屏 → 右侧抽屉；竖屏 → 底部弹窗
    if (useFsUi) {
      setSheetOpen(false);
      setDrawerOpen((v) => !v);
    } else {
      setDrawerOpen(false);
      setSheetOpen(true);
    }
    bumpControls();
  }, [useFsUi, bumpControls]);

  const openSpeed = useCallback(() => {
    openMore();
    showToast('倍速已在「更多设置」中');
  }, [openMore, showToast]);

  const openQuality = useCallback(() => {
    openMore();
    showToast('清晰度已在「更多设置」中');
  }, [openMore, showToast]);

  const doSeek = useCallback((t: number) => {
    const video = videoRef.current;
    if (video && Number.isFinite(t)) video.currentTime = Math.max(0, t);
    setCurrentTime(t);
  }, []);

  const doTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => showToast('播放被拦截，请再点一次'));
    else video.pause();
  }, [showToast]);

  const rateLabel = settings.rate === 1 ? '倍速' : `${settings.rate}x`;
  const qualityLabel = QUALITY_OPTIONS[settings.quality] ?? '清晰度';
  const pipSupported = caps.pip !== 'unsupported';
  const pipHint = caps.pipRequiresFullscreenFirst
    ? '画中画（iPhone：将先全屏再切 PiP）'
    : '画中画';

  const videoStyle = useMemo(() => {
    const ar = settings.aspectRatio;
    const base: React.CSSProperties = { objectFit: 'contain' };
    if (ar === 'fill') base.objectFit = 'fill';
    if (ar === '4:3' || ar === '16:9') {
      base.objectFit = 'fill';
      base.aspectRatio = ar === '4:3' ? '4/3' : '16/9';
      base.margin = 'auto';
      base.width = ar === '16:9' ? '100%' : 'auto';
      base.height = ar === '4:3' ? '100%' : 'auto';
    }
    if (settings.mirror) base.transform = 'scaleX(-1)';
    return base;
  }, [settings.aspectRatio, settings.mirror]);

  return (
    <div className="pml-page">
      <header className="pml-page-head">
        <h1>
          移动端播放器 · 横屏 / 全屏 / 画中画 整改 Demo
          <span className="pml-tag">MobileLab</span>
        </h1>
        <p className="pml-summary">
          当前环境：<b>{caps.summary}</b>
        </p>
        <p className="pml-hintline">
          用手机浏览器 / 安卓 App / 微信 / DevTools 设备模拟打开本页，右侧面板会实时给出该环境的能力与推荐策略。
        </p>
      </header>

      <div className="pml-layout">
        {/* ───────── 播放器 ───────── */}
        <div className="pml-player-col">
          <div
            ref={playerRef}
            className={[
              'pml-player',
              pseudoFs ? 'pml-player--pseudo-fs' : '',
              controlsVisible ? 'pml-player--show' : '',
              useFsUi ? 'pml-player--fs-ui' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => { setControlsVisible((v) => !v); bumpControls(); }}
          >
            <video
              ref={videoRef}
              className="pml-video"
              style={videoStyle}
              {...compatAttrs}
              preload="metadata"
              onPointerDown={(e) => e.stopPropagation()}
            />

            {videoError && (
              <div className="pml-error" onClick={(e) => e.stopPropagation()}>
                <div className="pml-error-icon">⚠</div>
                <p>{videoError}</p>
              </div>
            )}

            {/* 右上角常驻操作组：画中画 · 投屏 · 更多设置 */}
            {useFsUi && (
              <FsTopRightActions
                pipSupported={pipSupported}
                isPip={isPip}
                onTogglePip={handleTogglePip}
                castEnabled
                castActive={false}
                onCast={() => showToast('投屏：demo 未接入 Cast SDK')}
                onMore={openMore}
                moreActive={drawerOpen}
                pipHint={pipHint}
              />
            )}

            {/* 右侧设置抽屉（横屏 / 全屏） */}
            {useFsUi && (
              <SettingsDrawer
                visible={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                state={settings}
                onPatch={patchSettings}
                onToast={showToast}
                showQuality
                onOpenSubtitleSettings={() => showToast('字幕设置：demo 未展开二级页')}
                onImportSubtitle={(f) => showToast(`已选择字幕：${f.name}`)}
              />
            )}

            {/* 控制栏 */}
            {useFsUi ? (
              <FullscreenControlBar
                visible={controlsVisible}
                paused={paused}
                currentTime={currentTime}
                duration={duration}
                buffered={buffered}
                onTogglePlay={doTogglePlay}
                onSeek={doSeek}
                onPrev={() => doSeek(Math.max(0, currentTime - 10))}
                onNext={() => doSeek(currentTime + 10)}
                onRefresh={() => { const v = videoRef.current; if (v) { v.load(); showToast('已重新加载'); } }}
                onOpenSpeed={openSpeed}
                onOpenQuality={openQuality}
                onToggleSubtitle={() => patchSettings({ subtitleEnabled: !settings.subtitleEnabled })}
                subtitleOn={settings.subtitleEnabled}
                onScreenshot={() => showToast('截图：demo 未接入')}
                onActivity={bumpControls}
                isFullscreen={isFullscreen}
                onToggleFullscreen={handleToggleFullscreen}
                rateLabel={rateLabel}
                qualityLabel={qualityLabel}
              />
            ) : (
              /* 竖屏：精简控制栏（保留原移动端手感） */
              <div className="pml-portrait-bar" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="pml-pt-btn" onClick={doTogglePlay} aria-label={paused ? '播放' : '暂停'}>
                  {paused ? '▶' : '❚❚'}
                </button>
                <span className="pml-pt-time">
                  {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                  {' / '}
                  {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
                </span>
                <span className="pml-pt-spacer" />
                {pipSupported && (
                  <button type="button" className="pml-pt-btn" onClick={handleTogglePip} aria-label="画中画" title={pipHint}>⧉</button>
                )}
                <button type="button" className="pml-pt-btn" onClick={openMore} aria-label="更多设置">⋯</button>
                <button type="button" className="pml-pt-btn" onClick={handleToggleFullscreen} aria-label="全屏">⛶</button>
              </div>
            )}

            {toast && <div className="pml-toast" onClick={(e) => e.stopPropagation()}>{toast}</div>}
          </div>

          {/* 竖屏底部弹窗（portal 到 body，规避播放器裁剪；宽度按 100dvw 修满） */}
          {!useFsUi && (
            <MoreSheet
              visible={sheetOpen}
              onClose={() => setSheetOpen(false)}
              state={settings}
              onPatch={patchSettings}
              onToast={showToast}
              showQuality
              onOpenSubtitleSettings={() => showToast('字幕设置：demo 未展开二级页')}
              onImportSubtitle={(f) => showToast(`已选择字幕：${f.name}`)}
            />
          )}

          <div className="pml-source">
            <input
              className="pml-input"
              value={srcInput}
              onChange={(e) => setSrcInput(e.target.value)}
              placeholder="输入 mp4 / m3u8 地址"
              aria-label="视频地址"
            />
            <button type="button" className="pml-btn" onClick={() => setSrc(srcInput)}>加载</button>
            <button type="button" className="pml-btn" onClick={() => { setSrcInput(SAMPLE_MP4); setSrc(SAMPLE_MP4); }}>示例 MP4</button>
            <button type="button" className="pml-btn" onClick={() => { setSrcInput(SAMPLE_HLS); setSrc(SAMPLE_HLS); }}>示例 HLS</button>
          </div>

          <div className="pml-preview-toggles">
            <label className="pml-check">
              <input type="checkbox" checked={forceFsUi} onChange={(e) => setForceFsUi(e.target.checked)} />
              强制预览「全屏改造后」的控制栏（不真全屏也能看效果）
            </label>
            <button
              type="button"
              className="pml-btn pml-btn--ghost"
              onClick={() => { setForceFsUi((v) => !v); }}
            >
              <Icon icon={MonitorSmartphone} size="sm" />
              {forceFsUi ? '回到竖屏 UI' : '预览全屏 UI'}
            </button>
          </div>
        </div>

        {/* ───────── 右侧面板 ───────── */}
        <aside className="pml-side">
          <section className="pml-panel">
            <h3>① 环境探测</h3>
            <CapTable caps={caps} />
          </section>

          <section className="pml-panel">
            <h3>② 策略（可手动改，看差异）</h3>
            <div className="pml-field">
              <label htmlFor="pml-fs">全屏方式</label>
              <select
                id="pml-fs"
                className="pml-select"
                value={fsMode}
                onChange={(e) => setFsMode(e.target.value as FsModeChoice)}
              >
                <option value="auto">自动（推荐：{caps.fullscreenStrategy}）</option>
                <option value="fullscreen-api">元素级 Fullscreen API</option>
                <option value="webkit-video">video.webkitEnterFullscreen（系统原生）</option>
                <option value="css-pseudo">CSS 网页伪全屏</option>
              </select>
            </div>
            <div className="pml-field">
              <label htmlFor="pml-pip">画中画通道</label>
              <select
                id="pml-pip"
                className="pml-select"
                value={pipMode}
                onChange={(e) => setPipMode(e.target.value as PipModeChoice)}
              >
                <option value="auto">自动（推荐：{caps.pipRequiresFullscreenFirst ? '先全屏再切 PiP' : '标准 API'}）</option>
                <option value="standard">标准 requestPictureInPicture</option>
                <option value="fullscreen-first">先全屏再切 PiP（iOS）</option>
              </select>
            </div>
            <p className="pml-note">
              当前：{isFullscreen ? (nativeFs ? '元素级全屏中' : '网页伪全屏中') : '非全屏'}
              {' · '}画中画 {isPip ? '进行中' : '未开启'}
            </p>
          </section>

          <section className="pml-panel">
            <h3>③ 已知坑与注意事项</h3>
            <ul className="pml-caveats">
              {caps.caveats.length > 0
                ? caps.caveats.map((c) => <li key={c}>{c}</li>)
                : <li>当前环境未检出已知限制。</li>}
            </ul>
          </section>

          <section className="pml-panel">
            <h3>④ 事件日志</h3>
            <div className="pml-logs">
              {logs.length === 0 && <div className="pml-log pml-log--info">暂无事件</div>}
              {logs.map((l, i) => (
                <div key={`${l.time}-${i}`} className={`pml-log pml-log--${l.level}`}>
                  <span className="pml-log-time">{l.time}</span>
                  {l.text}
                </div>
              ))}
            </div>
            <button type="button" className="pml-btn pml-btn--ghost" onClick={() => setLogs([])}>
              <Icon icon={RotateCcw} size="sm" />
              清空
            </button>
          </section>

          <section className="pml-panel">
            <h3>⑤ 本次整改对照</h3>
            <CompareTable />
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ────────────── 子组件 ────────────── */

function CapTable({ caps }: { caps: DeviceCaps }) {
  const rows: [string, string, boolean?][] = [
    ['设备', caps.isCapacitor ? `Capacitor App / ${caps.nativePlatform}` : caps.isIOSPhone ? 'iOS iPhone' : caps.isIPad ? 'iPad' : caps.isAndroid ? 'Android' : 'PC', undefined],
    ['容器', caps.webView === 'browser' ? '独立浏览器' : `App 内置（${caps.webView}）`, undefined],
    ['X5 内核', caps.isX5 ? '是（需同层播放属性）' : '否', caps.isX5],
    ['元素级 Fullscreen API', caps.supportsElementFullscreen ? '支持' : '不支持', caps.supportsElementFullscreen],
    ['video.webkitEnterFullscreen', caps.supportsVideoWebkitFullscreen ? '支持' : '不支持', caps.supportsVideoWebkitFullscreen],
    ['画中画', caps.pip === 'standard' ? '标准 API' : caps.pip === 'webkit-presentation' ? 'Safari Presentation' : '不支持', caps.pip !== 'unsupported'],
    ['Safari Presentation Mode', caps.supportsWebkitPresentationMode ? '支持' : '不支持', caps.supportsWebkitPresentationMode],
    ['方向锁定 API', caps.supportsOrientationLock ? '支持' : '不支持', caps.supportsOrientationLock],
    ['全屏后保住自定义控制栏', caps.keepsCustomControlsInFullscreen ? '能' : '不能（系统原生接管）', caps.keepsCustomControlsInFullscreen],
    ['PiP 需先进全屏', caps.pipRequiresFullscreenFirst ? '是' : '否', caps.pipRequiresFullscreenFirst],
  ];
  return (
    <table className="pml-cap">
      <tbody>
        {rows.map(([k, v, ok]) => (
          <tr key={k}>
            <th>{k}</th>
            <td className={ok === undefined ? '' : ok ? 'pml-ok' : 'pml-bad'}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CompareTable() {
  const rows: [string, string][] = [
    ['横屏弹窗被 max-width:40rem 卡住、矮成一条', '横屏一律改走播放器右侧抽屉，高度吃满'],
    ['BottomSheet 用 width:100%，被 body 滚动锁补偿挤窄', '显式 100dvw + max-width:100dvw，左0右0'],
    ['iOS 竖屏点画中画卡死', '等待元数据加 1.5s 超时 + 请求总超时 3s，永不无限挂起'],
    ['iOS PiP 从内联发起被静默拒绝', 'iPhone 走「先进全屏 → 再切 picture-in-picture」'],
    ['未监听 webkitpresentationmodechanged', '标准事件 + Safari 事件双订阅，状态始终同步'],
    ['iOS 全屏被系统原生播放器接管', 'iPhone 默认改走 CSS 网页伪全屏，控制栏完整保留'],
    ['全屏控制栏沿用竖屏精简版', '恢复桌面布局，去掉音量与循环'],
    ['画中画/更多设置埋在控制栏里', '移到播放器右上角常驻，不随控制栏自动隐藏'],
    ['安卓 X5 内核劫持 video 弹自家全屏', '按能力检测结果给 video 打 x5-video-player-type="h5-page"'],
    ['画中画失败静默无反馈', '失败一律 toast 可读原因，不支持则隐藏入口'],
  ];
  return (
    <table className="pml-cap pml-cap--compare">
      <thead><tr><th>现有问题</th><th>Demo 改法</th></tr></thead>
      <tbody>
        {rows.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}
      </tbody>
    </table>
  );
}
