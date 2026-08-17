import { useCallback, useRef, useMemo } from 'react';
import { usePlayerStore } from '@/stores';
import { playerToast } from '@/components/UniversalPlayer/PlayerToast';
import { suppressSourceToast } from '@/components/UniversalPlayer/lib/utils';
import type { Video, VideoSource, Episode } from '@/types/video';

interface UseEpisodeSwitcherOptions {
  video: Video | null;
  localEpisodeId: string | undefined;
  setLocalEpisodeId: (id: string | undefined) => void;
  setCurrentSrc: (src: { url: string; type: VideoSource['type'] } | null) => void;
  currentSourceNameRef: React.MutableRefObject<string | undefined>;
}

export function useEpisodeSwitcher({
  video,
  localEpisodeId,
  setLocalEpisodeId,
  setCurrentSrc,
  currentSourceNameRef,
}: UseEpisodeSwitcherOptions) {
  const { setSource, setSources } = usePlayerStore();

  const episodeSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const switchToEpisode = useCallback((ep: Episode) => {
    setLocalEpisodeId(ep.id);
    if (ep.sources.length) {
      setSources(ep.sources);
      const src = ep.sources.find(s => s.isDefault) || ep.sources[0];
      setCurrentSrc({ url: src.url, type: src.type });
      setSource(src.url, src.type);
      currentSourceNameRef.current = src.name;
    }
  }, [setLocalEpisodeId, setSource, setSources, setCurrentSrc, currentSourceNameRef]);

  const handlePlayEpisode = useCallback((ep: Episode) => {
    if (episodeSwitchTimerRef.current) return;
    const matchedEp = video?.episodes?.find(e => e.id === ep.id) ?? ep;
    switchToEpisode(matchedEp);
    // 临时抑制后续 300ms 内 ToastTrigger 的「已切换到线路名」提示，
    // 确保本条「已切换到集标题」提示独占显示（审查报告 3.2）
    suppressSourceToast(300);
    // 集数切换提示（右上角；覆盖 ToastTrigger 可能误报的「已切换到线路名」）
    playerToast(`已切换到${matchedEp.title}`);
    episodeSwitchTimerRef.current = setTimeout(() => {
      episodeSwitchTimerRef.current = null;
    }, 300);
  }, [video, switchToEpisode]);

  const handlePlaySource = useCallback((src: VideoSource) => {
    if (sourceSwitchTimerRef.current) return;
    setCurrentSrc({ url: src.url, type: src.type });
    setSource(src.url, src.type);
    currentSourceNameRef.current = src.name;
    sourceSwitchTimerRef.current = setTimeout(() => {
      sourceSwitchTimerRef.current = null;
    }, 300);
  }, [setSource, setCurrentSrc, currentSourceNameRef]);

  const episodes = useMemo(() => video?.episodes
    ? [...video.episodes].sort((a, b) => a.number - b.number)
    : [], [video?.episodes]);

  const currentEpisodeIndex = localEpisodeId
    ? episodes.findIndex((ep) => ep.id === localEpisodeId)
    : -1;

  const handlePrevEpisode = useCallback(() => {
    if (currentEpisodeIndex > 0) {
      handlePlayEpisode(episodes[currentEpisodeIndex - 1]);
    }
  }, [currentEpisodeIndex, episodes, handlePlayEpisode]);

  const handleNextEpisode = useCallback(() => {
    if (currentEpisodeIndex < episodes.length - 1) {
      handlePlayEpisode(episodes[currentEpisodeIndex + 1]);
    }
  }, [currentEpisodeIndex, episodes, handlePlayEpisode]);

  return {
    switchToEpisode,
    handlePlayEpisode,
    handlePlaySource,
    handlePrevEpisode,
    handleNextEpisode,
    episodes,
    currentEpisodeIndex,
    isFirstEpisode: currentEpisodeIndex <= 0,
    isLastEpisode: currentEpisodeIndex >= episodes.length - 1,
  };
}
