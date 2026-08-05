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

export default function ToastTrigger({ mode }: { mode?: PlayerMode }) {
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

  useEffect(() => {
    // IPTV 直播有独立逻辑，右上角不显示任何点播类操作提示
    if (mode === 'iptv') {
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
        show(playing ? '播放' : '暂停');
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
  }, [show, mode]);

  return null;
}
