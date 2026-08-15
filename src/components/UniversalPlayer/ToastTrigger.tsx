import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores';
import type { PlayerMode } from '@/types/player';
import { usePlayerToast } from './PlayerToast';

const LOOP_LABELS: Record<string, string> = {
  none: '循环关闭',
  single: '单集循环',
  list: '列表循环',
};

const RATIO_LABELS: Record<string, string> = {
  default: '默认比例',
  '4:3': '比例 4:3',
  '16:9': '比例 16:9',
  fill: '铺满画面',
};

export default function ToastTrigger({ mode, disabled = false }: { mode?: PlayerMode; disabled?: boolean }) {
  const { show } = usePlayerToast();
  const prevVolume = useRef(usePlayerStore.getState().volume);
  const prevSource = useRef(usePlayerStore.getState().currentSrc);
  const prevPlaying = useRef(usePlayerStore.getState().isPlaying);
  const prevPlaybackRate = useRef(usePlayerStore.getState().playbackRate);
  const prevLoopMode = useRef(usePlayerStore.getState().loopMode);
  const prevIsPiP = useRef(usePlayerStore.getState().isPiP);
  const prevMirror = useRef(usePlayerStore.getState().mirror);
  const prevAspectRatio = useRef(usePlayerStore.getState().aspectRatio);
  const prevDecoderMode = useRef(usePlayerStore.getState().decoderMode);
  /** 「自动播放」的『播放』提示是否已展示过（首次进入显示，后续缓冲/切集自动播不重复提示） */
  const autoPlayToastShownRef = useRef(false);

  useEffect(() => {
    // 移动端/App 端 /play 点播页：右上角不显示任何点播类操作提示（由 disabled 控制，
    // 父组件在「移动端布局 && 点播模式」时传入 true）。
    // IPTV 直播有独立逻辑，右上角不显示任何点播类操作提示。
    if (disabled || mode === 'iptv') {
      return;
    }
    const unsub = usePlayerStore.subscribe((state) => {
      const vol = state.volume;
      const src = state.currentSrc;
      const playing = state.isPlaying;
      const rate = state.playbackRate;
      const loop = state.loopMode;
      const pip = state.isPiP;
      const mirror = state.mirror;
      const ratio = state.aspectRatio;
      const decoder = state.decoderMode;

      // 音量变化
      if (vol !== prevVolume.current) {
        prevVolume.current = vol;
        show(`音量 ${Math.round(vol * 100)}%`);
      }

      // 切换线路（首帧 src 从 null 初始化为实际值不算「切换」，不提示）
      if (src && prevSource.current !== null && src !== prevSource.current) {
        prevSource.current = src;
        const sources = state.sources;
        const matched = sources.find(s => s.url === src);
        if (matched) show(`已切换到${matched.name}`);
      }

      // 播放/暂停
      if (playing !== prevPlaying.current) {
        prevPlaying.current = playing;
        if (playing) {
          // 区分「播放」提示来源：
          //  - userPlayRequested（用户手动点击播放）→ 始终提示『播放』
          //  - 自动播放（首次进入）→ 提示『播放』一次；后续缓冲/切集自动播 → 不提示
          const userPlay = state.userPlayRequested;
          if (userPlay) {
            show('播放');
            // 手动播放后清除标记，避免下一次自动缓冲播放误判为手动
            usePlayerStore.getState().setUserPlayRequested(false);
          } else if (!autoPlayToastShownRef.current) {
            autoPlayToastShownRef.current = true;
            show('播放');
          }
        } else {
          // 仅「用户手动点击暂停」显示『暂停』提示；
          // 拖拽进度条触发的自动 pause（未标记 userPauseRequested）不提示『暂停』，
          // 由 seek 的『已跳转 mm:ss』进度提示代替。
          const userPause = state.userPauseRequested;
          if (userPause) {
            show('暂停');
            usePlayerStore.getState().setUserPauseRequested(false);
          }
        }
      }

      // 倍速变化
      if (rate !== prevPlaybackRate.current) {
        prevPlaybackRate.current = rate;
        show(rate === 1 ? '正常倍速' : `倍速 ${rate}x`);
      }

      // 循环模式变化（直播无“集”概念，不提示）
      if (loop !== prevLoopMode.current && mode !== 'live') {
        prevLoopMode.current = loop;
        show(LOOP_LABELS[loop] ?? '循环关闭');
      }

      // 画中画变化
      if (pip !== prevIsPiP.current) {
        prevIsPiP.current = pip;
        show(pip ? '已开启画中画' : '已关闭画中画');
      }

      // 镜像变化（直播镜像无意义，不提示）
      if (mirror !== prevMirror.current && mode !== 'live') {
        prevMirror.current = mirror;
        show(mirror ? '镜像已开启' : '镜像已关闭');
      }

      // 画面比例变化
      if (ratio !== prevAspectRatio.current) {
        prevAspectRatio.current = ratio;
        show(RATIO_LABELS[ratio] ?? '默认比例');
      }

      // 解码模式变化
      if (decoder !== prevDecoderMode.current) {
        prevDecoderMode.current = decoder;
        show(decoder === 'native' ? '已切换到硬解' : '已切换到软解');
      }
    });
    return unsub;
  }, [show, mode, disabled]);

  return null;
}
