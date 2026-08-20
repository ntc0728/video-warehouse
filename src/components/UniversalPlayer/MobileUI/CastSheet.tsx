import { useCallback, useEffect, useRef, useState } from 'react';
import { Cast, X, RotateCcw, Monitor, Play, Pause, Volume2, Link2Off, Settings } from 'lucide-react';
import { BottomSheet } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { toast } from '@/components/ui';
import {
  discoverCastDevices, connectCastDevice, disconnectCast,
  getCastBridge, getCastMode, ensureCastPermission, openCastAppSettings,
  type CastDevice,
} from '@/services/castService';
import {
  initWebCast, webCastRequestSession, webCastLoadMedia,
  webCastTogglePlay, webCastSetVolume, webCastEndSession,
} from '@/services/webCastSdk';

type CastView = 'searching' | 'list' | 'connecting' | 'connected' | 'permission';

interface CastSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 当前播放 URL（连接后推送至电视） */
  url: string;
  title?: string;
  /** 投屏状态变化通知父组件（用于右上角图标常亮提示） */
  onCastActiveChange: (active: boolean) => void;
}

/** 投屏底部弹窗（双模式）：
 *  - native：搜索动画 → 设备列表 / 空态 → 连接中 → 已连接控制面板（原生 DLNA 桥）
 *  - web：打开即调系统 Cast 设备选择弹窗（Chromecast / Google TV）→ 已连接控制面板 */
export default function CastSheet({ visible, onClose, url, title, onCastActiveChange }: CastSheetProps) {
  const mode = getCastMode();
  const isWeb = mode === 'web';
  const [view, setView] = useState<CastView>('searching');
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<CastDevice | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const startSearch = useCallback(async () => {
    // 权限前置：DLNA 组播需要「附近的设备」权限，未授予时引导去系统设置（不闪雷达）
    const perm = await ensureCastPermission();
    if (!mountedRef.current) return;
    if (perm === 'denied') {
      setView('permission');
      return;
    }
    setView('searching');
    const found = await discoverCastDevices();
    if (!mountedRef.current) return;
    setDevices(found);
    setView('list');
  }, []);

  // Web Cast：初始化 SDK → 弹系统设备选择弹窗 → 已连接
  // 第二参 showSearching：空态「重新选择设备」时传 false → 不再闪雷达、直接重开系统选择器
  const startWebCast = useCallback(async (showSearching = true) => {
    if (showSearching) setView('searching');
    const ready = await initWebCast();
    if (!mountedRef.current) return;
    if (!ready) {
      setDevices([]);
      setView('list');
      return;
    }
    const device = await webCastRequestSession();
    if (!mountedRef.current) return;
    if (!device) {
      setDevices([]);
      setView('list');
      return;
    }
    setConnectedDevice(device);
    setView('connected');
    onCastActiveChange(true);
    toast.show({ content: `已开始投屏到「${device.name}」`, type: 'success' });
    await webCastLoadMedia(url, title);
  }, [url, title, onCastActiveChange]);

  // 打开即搜索（native 设备列表）或弹系统选择（web Cast）
  useEffect(() => {
    if (visible) {
      if (isWeb) void startWebCast();
      else void startSearch();
    } else {
      // 关闭时复位状态（断开态由 disconnect 流程处理）
      setConnectingId(null);
    }
  }, [visible, isWeb, startSearch, startWebCast]);

  const handleConnect = useCallback(async (device: CastDevice) => {
    setConnectingId(device.id);
    setView('connecting');
    try {
      await connectCastDevice(device.id);
      const bridge = getCastBridge();
      if (bridge?.setSource && url) {
        await bridge.setSource(url, title);
      }
      if (!mountedRef.current) return;
      setConnectedDevice(device);
      setView('connected');
      onCastActiveChange(true);
      toast.show({ content: `已开始投屏到「${device.name}」`, type: 'success' });
    } catch {
      if (!mountedRef.current) return;
      setConnectingId(null);
      setView('list');
      toast.show({ content: '连接失败，请重试', type: 'error' });
    }
  }, [url, title, onCastActiveChange]);

  const handleDisconnect = useCallback(async () => {
    if (isWeb) await webCastEndSession();
    else await disconnectCast();
    if (!mountedRef.current) return;
    setConnectedDevice(null);
    setView('list');
    onCastActiveChange(false);
    toast.show({ content: '已断开投屏', type: 'success' });
  }, [isWeb, onCastActiveChange]);

  const handleBridgePlay = useCallback(async (action: 'play' | 'pause') => {
    if (isWeb) {
      await webCastTogglePlay();
      return;
    }
    const bridge = getCastBridge();
    if (!bridge) return;
    try {
      if (action === 'play') await bridge.play?.();
      else await bridge.pause?.();
    } catch { /* 静默 */ }
  }, [isWeb]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="投屏到电视" className="up-cast-sheet">
      <div className="up-ms-head">
        <span className="up-ms-title">投屏到电视</span>
        <button className="up-ms-close" onClick={onClose} aria-label="关闭投屏">
          <Icon icon={X} size="sm" />
        </button>
      </div>

      <div className="up-cast-body">
        <div className="up-cast-hint">
          {isWeb ? (
            <>请确保手机与电视连接<b>同一 Wi-Fi</b>，点击下方按钮将打开系统投屏面板选择 <b>Chromecast / Google TV</b> 设备。</>
          ) : (
            <>请确保手机与电视连接<b>同一 Wi-Fi</b>，将自动发现局域网内支持 <b>DLNA</b> 的投屏设备。</>
          )}
        </div>

        {view === 'searching' && (
          <div className="up-cast-status">
            <div className="up-cast-radar">
              <div className="up-cast-ring" />
              <div className="up-cast-ring" />
              <div className="up-cast-ring" />
              <div className="up-cast-core"><Icon icon={Cast} size="lg" /></div>
            </div>
            <p>{isWeb ? '正在等待系统投屏面板…' : '正在搜索局域网中的投屏设备…'}</p>
          </div>
        )}

        {view === 'list' && devices.length === 0 && (
          <div className="up-cast-status">
            <div style={{ fontSize: 40, lineHeight: 1 }}>📡</div>
            <p>
              {isWeb ? '未选择投屏设备' : '未发现投屏设备'}<br />
              <span className="up-cast-empty-sub">
                {isWeb
                  ? '请确认电视/盒子已开机并处于可投屏状态，再重新打开系统投屏面板'
                  : '请确认手机与电视在同一 Wi-Fi，并在电视端开启「多屏互动 / DLNA」'}
              </span>
            </p>
            <button className="up-cast-btn up-cast-btn--primary" onClick={() => void (isWeb ? startWebCast(false) : startSearch())}>
              <Icon icon={RotateCcw} size="sm" /> {isWeb ? '重新选择设备' : '重新搜索'}
            </button>
          </div>
        )}

        {view === 'permission' && (
          <div className="up-cast-status">
            <div style={{ fontSize: 40, lineHeight: 1 }}>🔒</div>
            <p>
              需要投屏权限<br />
              <span className="up-cast-empty-sub">
                请在系统设置中授权「附近的设备 / 本地网络」后重试
              </span>
            </p>
            <button
              className="up-cast-btn up-cast-btn--primary"
              onClick={() => void openCastAppSettings()}
            >
              <Icon icon={Settings} size="sm" /> 去设置授权
            </button>
          </div>
        )}

        {view === 'list' && devices.length > 0 && (
          <div className="up-cast-list">
            {devices.map(device => (
              <button
                key={device.id}
                className="up-cast-device"
                onClick={() => void handleConnect(device)}
                disabled={connectingId !== null}
              >
                <span className="up-cast-device-icon"><Icon icon={Monitor} size="md" /></span>
                <span className="up-cast-device-name">{device.name}</span>
                <span className="up-cast-device-go">投屏 <Icon icon={Play} size="sm" /></span>
              </button>
            ))}
          </div>
        )}

        {view === 'connecting' && (
          <div className="up-cast-status">
            <div className="up-cast-spinner" />
            <p>正在连接设备…</p>
          </div>
        )}

        {view === 'connected' && connectedDevice && (
          <div className="up-cast-connected">
            <div className="up-cast-banner">
              <Icon icon={Cast} size="md" />
              <span>已连接 · {connectedDevice.name}</span>
            </div>
            <div className="up-ms-card">
              <div className="up-ms-row">
                <div className="up-ms-label">正在投屏</div>
                <span className="up-ms-sub">{title || url}</span>
              </div>
            </div>
            <div className="up-cast-actions-row">
              <button className="up-cast-mini" title="暂停" onClick={() => void handleBridgePlay('pause')}>
                <Icon icon={Pause} size="sm" />
              </button>
              <button className="up-cast-mini up-cast-mini--primary" title="播放" onClick={() => void handleBridgePlay('play')}>
                <Icon icon={Play} size="md" />
              </button>
              <button
                className="up-cast-mini" title="音量"
                onClick={() => {
                  if (isWeb) void webCastSetVolume(0.5);
                  else { const b = getCastBridge(); void b?.setVolume?.(0.5); }
                }}
              >
                <Icon icon={Volume2} size="sm" />
              </button>
            </div>
            <button className="up-cast-btn" onClick={() => void handleDisconnect()}>
              <Icon icon={Link2Off} size="sm" /> 断开投屏
            </button>
            <div className="up-cast-note">
              {isWeb ? (
                <><b>Google Cast 说明：</b>通过 Cast Web SDK 将当前播放地址推送至 Chromecast / Google TV 设备，
                  <code>RemotePlayerController</code> 控制播放/暂停/音量，电视侧独立解码播放（手机可关屏/切走）。</>
              ) : (
                <><b>DLNA 实现说明：</b>由 Android 原生模块经 SSDP 发现设备 → 用
                  <code>SetAVTransportURI</code> 推送当前播放 URL 至电视 → 电视侧独立解码播放（手机可关屏/切走），
                  并通过 <code>Play/Pause/Seek</code> 反向控制。</>
              )}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}