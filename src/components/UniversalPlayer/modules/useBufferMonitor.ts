import { useEffect } from 'react';
import { usePlayerStore } from '@/stores';

export function useBufferMonitor(videoRef: React.RefObject<HTMLVideoElement | null>, currentUrl: string) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const store = usePlayerStore.getState;
    const onWaiting = () => store().setBuffering(true);
    const onPlaying = () => store().setBuffering(false);
    const onCanPlay = () => store().setBuffering(false);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    return () => {
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [videoRef, currentUrl]);
}
