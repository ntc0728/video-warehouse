import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores';
import type { PlayerMode } from '@/types/player';
import { usePlayerToast } from './PlayerToast';
import { isSourceToastSuppressed } from './lib/utils';

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
  const prevPlaybackRate = useRef(usePlayerStore.getState().playbackRate);
  const prevLoopMode = useRef(usePlayerStore.getState().loopMode);
  const prevIsPiP = useRef(usePlayerStore.getState().isPiP);
  const prevMirror = useRef(usePlayerStore.getState().mirror);
  const prevAspectRatio = useRef(usePlayerStore.getState().aspectRatio);
  const prevDecoderMode = useRef(usePlayerStore.getState().decoderMode);

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
        // 切集/切线路瞬间会短暂经过此处；抑制窗口内跳过，避免误报「已切换到线路名」
        // 后由 handlePlayEpisode 的集标题提示独占显示（审查报告 3.2）
        if (!isSourceToastSuppressed()) {
          prevSource.current = src;
          const sources = state.sources;
          const matched = sources.find(s => s.url === src);
          if (matched) show(`已切换到${matched.name}`);
        } else {
          // 抑制窗口内也更新 prevSource，避免下次触发误报
          prevSource.current = src;
        }
      }

      // 播放/暂停不再提示：播放与暂停是最高频的两个操作，每次点击都弹一次提示
      // 属于噪声（用户 2026-09-10 明确要求去掉）。播放态的其它反馈由画面本身给出。

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
