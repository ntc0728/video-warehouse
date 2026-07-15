import { useState, useCallback, useRef, useEffect } from 'react';
import { usePlayerStore, useSettingsStore } from '@/stores';
import {
  searchVideoFromSingleSource,
  searchVideoSeasonsFromSingleSource,
  findEpisodeByNumber,
  buildCmsSeasons,
} from '@/services/videoService';
import type { VideoDetailResult } from '@/services/videoService';
import type { Video, Episode } from '@/types/video';
import type { TMDBMovieDetail, TMDBTVShowDetail } from '@/types/tmdb';
import type { HistoryRecord } from '@/types/store';

interface UseCMSSourceManagerOptions {
  id: string | undefined;
  video: Video | null;
  setVideo: (v: Video | null) => void;
  tmdbDetail: TMDBMovieDetail | TMDBTVShowDetail | null;
  tmdbMediaType: 'movie' | 'tv';
  setTmdbDetail: (d: TMDBMovieDetail | TMDBTVShowDetail | null) => void;
  setTmdbMediaType: (mt: 'movie' | 'tv') => void;
  onTmdbReady?: () => void;
  selectedSeason: number;
  selectedSeasonRef: React.MutableRefObject<number>;
  seasonChangedRef: React.MutableRefObject<boolean>;
  historyRecordRef: React.MutableRefObject<HistoryRecord | undefined>;
  cmsSourceIdRef: React.MutableRefObject<string | undefined>;
  cmsSourceNameRef: React.MutableRefObject<string | undefined>;
  currentSourceNameRef: React.MutableRefObject<string | undefined>;
  setCurrentSrc: (src: { url: string; type: Video['sources'][0]['type'] } | null) => void;
  setLocalEpisodeId: (id: string | undefined) => void;
  videoCache: Map<string, Video>;
  routeSourceIndex: number | undefined;
  skipHistory: boolean;
  onSwitchEpisode: (ep: Episode) => void;
}

export function useCMSSourceManager(opts: UseCMSSourceManagerOptions) {
  const {
    id, video, setVideo, tmdbDetail, tmdbMediaType,
    setTmdbDetail, setTmdbMediaType, onTmdbReady,
    selectedSeason, selectedSeasonRef, seasonChangedRef,
    historyRecordRef, cmsSourceIdRef, cmsSourceNameRef, currentSourceNameRef,
    setCurrentSrc, setLocalEpisodeId, videoCache,
    routeSourceIndex, skipHistory, onSwitchEpisode,
  } = opts;

  const { setSource, setSources } = usePlayerStore();
  const { videoSourceIndex, videoSourceIndices } = useSettingsStore();

  const [cmsResults, setCmsResults] = useState<VideoDetailResult[]>([]);
  const [cmsLoading, setCmsLoading] = useState(false);
  const [cmsSwitching, setCmsSwitching] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [sourceNameMap, setSourceNameMap] = useState<Map<string, string>>(new Map());
  const [activeSourceId, setActiveSourceId] = useState<string | undefined>();
  const [cmsSeasons, setCmsSeasons] = useState<{ season_number: number; name: string; episode_count: number }[]>([]);

  const cmsAbortRef = useRef<AbortController | null>(null);
  const tmdbAbortRef = useRef<AbortController | null>(null);
  const activeCmsSourceIndexRef = useRef<number | undefined>(undefined);
  const seasonMapsRef = useRef<Map<number, Map<number, Video>>>(new Map());
  const cmsSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchInitiatedRef = useRef(false);

  // ── CMS 缓存 helpers ──────────────────────────────
  const getCmsCacheKey = useCallback((videoId: string, sourceIndex: number) =>
    `cms-cache-${videoId}-${sourceIndex}`, []);

  const readCmsCache = useCallback((videoId: string, sourceIndex: number): Video | null => {
    try {
      const raw = localStorage.getItem(getCmsCacheKey(videoId, sourceIndex));
      if (!raw) return null;
      const entry = JSON.parse(raw) as { video: Video; timestamp: number };
      return entry.video ?? null;
    } catch { return null; }
  }, [getCmsCacheKey]);

  const writeCmsCache = useCallback((videoId: string, sourceIndex: number, v: Video) => {
    try {
      localStorage.setItem(getCmsCacheKey(videoId, sourceIndex),
        JSON.stringify({ video: v, timestamp: Date.now() }));
    } catch { /* quota exceeded */ }
  }, [getCmsCacheKey]);

  const clearAllCmsCache = useCallback((videoId: string) => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`cms-cache-${videoId}-`)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }, []);

  // ── fetchCMSSources ──────────────────────────────
  const fetchCMSSources = useCallback(async (targetSourceIndex?: number) => {
    if (!id) return;
    cmsAbortRef.current?.abort();
    const ctrl = new AbortController();
    cmsAbortRef.current = ctrl;
    const isSwitching = targetSourceIndex !== undefined;
    setCmsLoading(true);
    if (isSwitching) setCmsSwitching(true);

    // 统一关闭 loading 的出口：无条件执行，避免 video 为空时 loading 永久卡死
    const finishLoading = () => {
      setCmsLoading(false);
      setCmsSwitching(false);
    };

    if (isSwitching) {
      setVideo(null);
      setSources([]);
      setCurrentSrc(null);
      setLocalEpisodeId(undefined);
      currentSourceNameRef.current = undefined;
    }

    let sourceIdx = targetSourceIndex;

    // 1) 历史记录优先
    if (sourceIdx === undefined && !skipHistory) {
      try {
        const { getHistory } = await import('@/services/database');
        const history = await getHistory();
        const histRecord = history.find(h => h.videoId === id);
        if (histRecord?.cmsSourceId || histRecord?.cmsSourceName) {
          const { getVideoSources } = await import('@/services/sourceService');
          const allSrc = await getVideoSources();
          const matchedIdx = histRecord.cmsSourceId
            ? allSrc.findIndex(s => s.id === histRecord.cmsSourceId)
            : allSrc.findIndex(s => s.name === histRecord!.cmsSourceName);
          if (matchedIdx >= 0) sourceIdx = matchedIdx;
        }
      } catch { /* ignore */ }
    }

    // 2) 路由传入的 sourceIndex
    if (sourceIdx === undefined && routeSourceIndex !== undefined) {
      sourceIdx = routeSourceIndex;
    }

    // 3) 默认使用设置页中第一个被选中的 CMS 源
    if (sourceIdx === undefined) {
      sourceIdx = videoSourceIndices && videoSourceIndices.length > 0
        ? videoSourceIndices[0]
        : videoSourceIndex;
    }

    activeCmsSourceIndexRef.current = sourceIdx;

    {
      const { getVideoSources } = await import('@/services/sourceService');
      const allSrc = await getVideoSources();
      const matchedId = allSrc[sourceIdx]?.id;
      if (matchedId) setActiveSourceId(matchedId);
    }

    let videoTitle = '';
    let videoYear: number | undefined;
    if (tmdbDetail) {
      if ('name' in tmdbDetail) videoTitle = tmdbDetail.name || '';
      else if ('title' in tmdbDetail) videoTitle = tmdbDetail.title || '';
      if (tmdbMediaType === 'tv') {
        const dateStr = (tmdbDetail as TMDBTVShowDetail).first_air_date;
        videoYear = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
      } else {
        const dateStr = (tmdbDetail as TMDBMovieDetail).release_date;
        videoYear = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
      }
    } else if (video) {
      videoTitle = video.title || '';
      videoYear = video.year;
    }

    if (!videoTitle) {
      if (!ctrl.signal.aborted) finishLoading();
      return;
    }

    // ── 快速恢复路径：有 vodId 时直接调 CMS 详情接口 ──────────
    const histRecord = historyRecordRef.current;
    /**
     * 快速恢复路径：有 vodId 时直接调 CMS 详情接口
     * 场景：用户从历史记录恢复播放，已有 vodId，可直接获取视频详情
     */
    if (!isSwitching && histRecord?.vodId) {
      try {
        const svc = await import('@/services/videoService');
        /** 通过 vodId 获取视频详情（传递 signal 支持取消） */
        const detailVideo = await svc.fetchVideoDetail(sourceIdx, histRecord.vodId, ctrl.signal);
        if (ctrl.signal.aborted) return;

        if (detailVideo) {
          // 设置 CMS 源信息
          const { getVideoSources } = await import('@/services/sourceService');
          const allSrc = await getVideoSources();
          cmsSourceIdRef.current = allSrc[sourceIdx]?.id;
          cmsSourceNameRef.current = allSrc[sourceIdx]?.name ?? '';

          // 缓存并设置视频数据
          videoCache.set(id, detailVideo);
          setVideo(detailVideo);

          // 剧集类型：选中第一集并异步加载季信息
          if (detailVideo.episodes?.length) {
            const firstEp = [...detailVideo.episodes].sort((a, b) => a.number - b.number)[0];
            if (firstEp?.sources.length) {
              finishLoading();
              onSwitchEpisode(firstEp);
              // 异步加载季信息（传递 signal 支持取消）
              searchVideoSeasonsFromSingleSource(sourceIdx, videoTitle, videoYear, ctrl.signal).then(result => {
                if (!ctrl.signal.aborted) {
                  seasonMapsRef.current.set(sourceIdx, result.seasons);
                  setCmsSeasons(buildCmsSeasons(result.seasons));
                  if (histRecord.vodId) {
                    for (const [seasonNum, seasonVid] of result.seasons) {
                      if (seasonVid.id === histRecord.vodId) {
                        selectedSeasonRef.current = seasonNum;
                        break;
                      }
                    }
                  }
                }
              }).catch(() => {});
              return;
            }
          }
          if (detailVideo.sources.length > 0) {
            setSources(detailVideo.sources);
            const firstSrc = detailVideo.sources[0];
            setCurrentSrc({ url: firstSrc.url, type: firstSrc.type });
            setSource(firstSrc.url, firstSrc.type);
            currentSourceNameRef.current = firstSrc.name;
          }
          finishLoading();
          return;
        }
      } catch { /* fall through */ }
    }

    /**
     * TV 剧集按季搜索
     * 场景：TMDB 剧集类型，需要按季分组搜索 CMS 源
     */
    if (id.startsWith('tmdb-') && tmdbMediaType === 'tv') {
      try {
        /** 当前源的季映射（缓存，避免重复搜索） */
        let seasonMap = seasonMapsRef.current.get(sourceIdx);

        if (!seasonMap) {
          /** 按季搜索 CMS 源（传递 signal 支持取消） */
          const seasonResult = await searchVideoSeasonsFromSingleSource(sourceIdx, videoTitle, videoYear, ctrl.signal);
          seasonMap = seasonResult.seasons;
          seasonMapsRef.current.set(sourceIdx, seasonMap);
          setCmsSeasons(buildCmsSeasons(seasonMap));

          const firstSeasonVideo = seasonMap.size > 0 ? seasonMap.values().next().value : null;
          const cmsResult: VideoDetailResult = {
            sourceIndex: sourceIdx,
            sourceId: seasonResult.sourceId,
            sourceName: seasonResult.sourceName,
            video: firstSeasonVideo ?? null,
            error: seasonResult.error,
          };
          setCmsResults(prev => {
            const idx = prev.findIndex(r => r.sourceIndex === sourceIdx);
            if (idx >= 0) { const next = [...prev]; next[idx] = cmsResult; return next; }
            return [...prev, cmsResult];
          });
        } else {
          setCmsSeasons(buildCmsSeasons(seasonMap));
        }

        if (!ctrl.signal.aborted) {
          const { getVideoSources } = await import('@/services/sourceService');
          const allSrc = await getVideoSources();
          cmsSourceIdRef.current = allSrc[sourceIdx]?.id;
          cmsSourceNameRef.current = allSrc[sourceIdx]?.name ?? '';

          const seasonVideo = seasonMap.get(selectedSeasonRef.current);
          if (seasonVideo) {
            videoCache.set(id!, seasonVideo);
            setVideo(seasonVideo);

            if (!seasonChangedRef.current && seasonVideo.episodes?.length) {
              const episodes = [...seasonVideo.episodes].sort((a, b) => a.number - b.number);
              const targetEp = episodes[0];
              if (targetEp?.sources.length) {
                finishLoading();
                onSwitchEpisode(targetEp);
              }
            }
          } else {
            setVideo(null);
            setSources([]);
            setCurrentSrc(null);
            setLocalEpisodeId(undefined);
            currentSourceNameRef.current = undefined;
          }
          finishLoading();
        }
      } catch {
        if (!ctrl.signal.aborted) {
          finishLoading();
        }
      }
      return;
    }

    /**
     * 电影 / 单季剧集
     * 场景：非 TV 类型或单季剧集，直接搜索或获取详情
     */
    try {
      /** 尝试从缓存获取视频数据 */
      const cached = readCmsCache(id, sourceIdx);
      let result: VideoDetailResult;
      if (cached) {
        // 缓存命中，直接使用
        const { getVideoSources } = await import('@/services/sourceService');
        const allSrc = await getVideoSources();
        const sourceName = allSrc[sourceIdx]?.name ?? '未知';
        result = { sourceIndex: sourceIdx, sourceId: allSrc[sourceIdx]?.id ?? '', sourceName, video: cached };
      } else if (!id?.startsWith('tmdb-')) {
        // CMS 源视频：通过 vod_id 获取详情（传递 signal 支持取消）
        const { fetchVideoDetail } = await import('@/services/videoService');
        const detailVideo = await fetchVideoDetail(sourceIdx, id, ctrl.signal);
        const { getVideoSources } = await import('@/services/sourceService');
        const allSrc = await getVideoSources();
        const sourceName = allSrc[sourceIdx]?.name ?? '未知';
        result = { sourceIndex: sourceIdx, sourceId: allSrc[sourceIdx]?.id ?? '', sourceName, video: detailVideo };
        if (result.video) writeCmsCache(id, sourceIdx, result.video);
      } else {
        // TMDB 视频：通过标题搜索（传递 signal 支持取消）
        result = await searchVideoFromSingleSource(sourceIdx, videoTitle, videoYear, ctrl.signal);
        if (result.video) writeCmsCache(id, sourceIdx, result.video);
      }

      if (!ctrl.signal.aborted) {
        setCmsResults(prev => {
          const idx = prev.findIndex(r => r.sourceIndex === sourceIdx);
          if (idx >= 0) { const next = [...prev]; next[idx] = result; return next; }
          return [...prev, result];
        });

        if (result.video) {
          videoCache.set(id!, result.video);
          setVideo(result.video);
          {
            const { getVideoSources } = await import('@/services/sourceService');
            const src = (await getVideoSources())[result.sourceIndex];
            if (src) cmsSourceIdRef.current = src.id;
          }
          cmsSourceNameRef.current = result.sourceName;

          if (result.video.episodes?.length) {
            if (!seasonChangedRef.current) {
              const episodes = [...result.video.episodes].sort((a, b) => a.number - b.number);
              const targetEp = episodes[0];
              if (targetEp?.sources.length) {
                onSwitchEpisode(targetEp);
              }
            }
            finishLoading();
            return;
          }

          if (result.video.sources.length > 0) {
            setSources(result.video.sources);
            const firstSrc = result.video.sources[0];
            setCurrentSrc({ url: firstSrc.url, type: firstSrc.type });
            setSource(firstSrc.url, firstSrc.type);
            currentSourceNameRef.current = firstSrc.name;
          }
          finishLoading();
        } else {
          setSources([]);
          setCurrentSrc(null);
          currentSourceNameRef.current = undefined;
          finishLoading();
        }
      }
    } catch {
      if (!ctrl.signal.aborted) {
        finishLoading();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, videoSourceIndex, videoSourceIndices, routeSourceIndex, skipHistory, tmdbDetail, tmdbMediaType, video, readCmsCache, writeCmsCache]);

  // ── handleFetchCMSSourceById ──────────────────────
  const handleFetchCMSSourceById = useCallback(async (sourceId: string) => {
    if (cmsSwitchTimerRef.current) clearTimeout(cmsSwitchTimerRef.current);
    cmsSwitchTimerRef.current = setTimeout(() => { cmsSwitchTimerRef.current = null; }, 300);
    setActiveSourceId(sourceId);
    if (!id) return;
    const { getVideoSources } = await import('@/services/sourceService');
    const allSrc = await getVideoSources();
    const idx = allSrc.findIndex(s => s.id === sourceId);
    if (idx >= 0) fetchCMSSources(idx);
  }, [id, fetchCMSSources]);

  // ── handlePlayCMSSource ──────────────────────
  const handlePlayCMSSource = useCallback((result: VideoDetailResult) => {
    if (cmsSwitchTimerRef.current) clearTimeout(cmsSwitchTimerRef.current);
    cmsSwitchTimerRef.current = setTimeout(() => { cmsSwitchTimerRef.current = null; }, 300);

    setActiveSourceId(result.sourceName);
    activeCmsSourceIndexRef.current = result.sourceIndex;

    const activeEpId = video?.episodes?.length
      ? video.episodes.find(ep => ep.id === video.episodes?.[0]?.id)?.id
      : undefined;
    const oldEpisodes = video?.episodes ?? [];
    const currentEp = activeEpId ? oldEpisodes.find(ep => ep.id === activeEpId) : undefined;
    const currentEpNumber = currentEp?.number;

    const cleanup = () => {
      setCmsLoading(false);
      setCmsSwitching(false);
    };

    // TV 剧集：使用按季映射表切换到当前季
    const seasonMap = seasonMapsRef.current.get(result.sourceIndex);
    if (seasonMap) {
      cmsSourceNameRef.current = result.sourceName;

      const seasonVideo = seasonMap.get(selectedSeason);
      if (seasonVideo) {
        setCmsSeasons(buildCmsSeasons(seasonMap));
        if (seasonVideo.episodes?.length) {
          const matchedEp = currentEpNumber
            ? findEpisodeByNumber(seasonVideo.episodes, currentEpNumber)
            : undefined;
          if (matchedEp?.sources.length) {
            videoCache.set(id!, seasonVideo);
            setVideo(seasonVideo);
            onSwitchEpisode(matchedEp);
          }
        }
      } else {
        setVideo(null);
        currentSourceNameRef.current = undefined;
      }
      cleanup();
      return;
    }

    if (result.video) {
      cmsSourceNameRef.current = result.sourceName;

      if (result.video.episodes?.length) {
        if (!seasonChangedRef.current) {
          const matchedEp = currentEpNumber
            ? findEpisodeByNumber(result.video.episodes, currentEpNumber)
            : undefined;
          if (matchedEp?.sources.length) {
            videoCache.set(id!, result.video);
            setVideo(result.video);
            onSwitchEpisode(matchedEp);
            cleanup();
            return;
          }
        }
        cleanup();
        return;
      }

      if (result.video.sources.length > 0) {
        videoCache.set(id!, result.video);
        setVideo(result.video);
        setSources(result.video.sources);
        const firstSrc = result.video.sources[0];
        setCurrentSrc({ url: firstSrc.url, type: firstSrc.type });
        setSource(firstSrc.url, firstSrc.type);
        currentSourceNameRef.current = firstSrc.name;
      }
    }
    cleanup();
  }, [id, video, selectedSeason, videoCache, setVideo, setSources, setSource, setCurrentSrc, currentSourceNameRef, cmsSourceNameRef, seasonChangedRef, onSwitchEpisode]);

  // ── Effects ──────────────────────────────

  // 加载 TMDB 详情
  useEffect(() => {
    if (!id || !id.startsWith('tmdb-')) return;
    tmdbAbortRef.current?.abort();
    const ctrl = new AbortController();
    tmdbAbortRef.current = ctrl;

    const loadTMDB = async () => {
      try {
        const parts = id.replace('tmdb-', '').split('-');
        const mt = parts[0] as 'movie' | 'tv';
        const tid = parseInt(parts.slice(1).join('-'), 10);
        setTmdbMediaType(mt);
        if (isNaN(tid)) {
          if (!ctrl.signal.aborted) onTmdbReady?.();
          return;
        }
        const { fetchMovieDetail, fetchTVDetail } = await import('@/services/tmdbService');
        const detail = mt === 'tv'
          ? await fetchTVDetail(tid, { signal: ctrl.signal })
          : await fetchMovieDetail(tid, { signal: ctrl.signal });
        if (!ctrl.signal.aborted) {
          setTmdbDetail(detail);
          onTmdbReady?.();
        }
      } catch {
        // TMDB 请求失败时也标记就绪，避免页面永久 loading
        if (!ctrl.signal.aborted) onTmdbReady?.();
      }
    };

    loadTMDB();
    return () => ctrl.abort();
  }, [id, setTmdbDetail, setTmdbMediaType, onTmdbReady]);

  // 加载 CMS 源配置
  useEffect(() => {
    import('@/services/sourceService').then(mod => {
      mod.getVideoSources().then(sources => {
        setSourceNameMap(new Map(sources.map(s => [s.id, s.name])));
        if (id?.startsWith('tmdb-')) {
          const indices = videoSourceIndices && videoSourceIndices.length > 0
            ? videoSourceIndices
            : [videoSourceIndex];
          setSelectedSourceIds(indices.map(i => sources[i]?.id).filter(Boolean));
        } else if (routeSourceIndex !== undefined && sources[routeSourceIndex]) {
          const sourceId = sources[routeSourceIndex].id;
          setSelectedSourceIds([sourceId]);
          setActiveSourceId(sourceId);
        }
      }).catch(() => {});
    }).catch(() => {});
  }, [id, videoSourceIndex, videoSourceIndices, routeSourceIndex]);

  // TMDB 详情加载后触发 CMS 搜索
  useEffect(() => {
    if (!id?.startsWith('tmdb-') || !tmdbDetail || cmsLoading) return;
    if (cmsResults.length === 0 && !fetchInitiatedRef.current) {
      fetchInitiatedRef.current = true;
      fetchCMSSources(routeSourceIndex);
    }
  }, [id, tmdbDetail, cmsLoading, cmsResults.length, fetchCMSSources, routeSourceIndex]);

  // 清理：id 变化时重置所有 CMS 状态，避免旧视频数据残留
  useEffect(() => () => {
    cmsAbortRef.current?.abort();
    tmdbAbortRef.current?.abort();
    if (id) clearAllCmsCache(id);
    seasonMapsRef.current.clear();
    fetchInitiatedRef.current = false;
    setCmsResults([]);
    setCmsSeasons([]);
    setSelectedSourceIds([]);
    setActiveSourceId(undefined);
    setCmsLoading(false);
    setCmsSwitching(false);
  }, [id, clearAllCmsCache]);

  return {
    cmsResults,
    cmsLoading,
    cmsSwitching,
    selectedSourceIds,
    sourceNameMap,
    activeSourceId,
    cmsSeasons,
    fetchCMSSources,
    handleFetchCMSSourceById,
    handlePlayCMSSource,
    seasonMapsRef,
    activeCmsSourceIndexRef,
  };
}
