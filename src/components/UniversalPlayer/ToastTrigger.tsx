import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores';
import { usePlayerToast } from './PlayerToast';

export default function ToastTrigger() {
  const { show } = usePlayerToast();
  const prevVolume = useRef(usePlayerStore.getState().volume);
  const prevSource = useRef(usePlayerStore.getState().currentSrc);
  const prevPlaying = useRef(usePlayerStore.getState().isPlaying);

  useEffect(() => {
    const unsub = usePlayerStore.subscribe((state) => {
      const vol = state.volume;
      const src = state.currentSrc;
      const playing = state.isPlaying;

      // 音量变化
      if (vol !== prevVolume.current) {
        prevVolume.current = vol;
        show(`音量 ${Math.round(vol * 100)}%`);
      }

      // 切换线路
      if (src !== prevSource.current && src) {
        prevSource.current = src;
        // 从 sources 列表中找线路名
        const sources = state.sources;
        const matched = sources.find(s => s.url === src);
        if (matched) show(`已切换到${matched.name}`);
      }

      // 播放/暂停
      if (playing !== prevPlaying.current) {
        prevPlaying.current = playing;
        show(playing ? '播放' : '暂停');
      }
    });
    return unsub;
  }, [show]);

  return null;
}
