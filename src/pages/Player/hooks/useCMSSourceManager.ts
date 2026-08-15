import { useState, useCallback, useRef, useEffect } from 'react';
import { usePlayerStore, useSettingsStore } from '@/stores';
import type { CachedVideoEntry } from '@/pages/Player';
import {
  searchVideoFromSingleSource,
  searchVideoSeasonsFromSingleSource,
  findEpisodeByNumber,
  buildCmsSeasons,
} from '@/services/videoService';
import type { VideoDetailResult } from '@/services/videoService';
import type { Video, Episode, VideoSource } from '@/types/video';
import type { TMDBMovieDetail, TMDBTVShowDetail } from '@/types/tmdb';
import type { HistoryRecord } from '@/types/store';

// 取 Map 第一个 key（用于跨源季号对齐时回退到新源第一季）
function firstKeyOf<T>(map: Map<number, T>, fallback: number): number {
  const it = map.keys().next();
  return it.done ? fallback : it.value;
}

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
  setSelectedSeason: (n: number) => void;
  selectedSeasonRef: React.MutableRefObject<number>;
  seasonChangedRef: React.MutableRefObject<boolean>;
  cmsSourceIdRef: React.MutableRefObject<string | undefined>;
  cmsSourceNameRef: React.MutableRefObject<string | undefined>;
  currentSourceNameRef: React.MutableRefObject<string | undefined>;
  setCurrentSrc: (src: { url: string; type: Video['sources'][0]['type'] } | null) => void;
  setLocalEpisodeId: (id: string | undefined) => void;
  videoCache: Map<string, CachedVideoEntry>;
  routeSourceIndex: number | undefined;
  /** 当前实际使用的 CMS 源索引（历史恢复/设置默认等计算后的最终值，普通 CMS id 进入时用于初始化面板） */
  activeSourceIndex?: number;
  skipHistory: boolean;
  onSwitchEpisode: (ep: Episode) => void;
  handlePlaySource: (src: VideoSource) => void;
  /** 详情页「全部」弹窗直达：目标选集播放地址（精确匹配初始集） */
  routePlayUrl?: string;
  /** 详情页「全部」弹窗直达：目标季号（优先对齐初始季，避免首播季号竞态） */
  routeSeasonNumber?: number;
}

export function useCMSSourceManager(opts: UseCMSSourceManagerOptions) {
  const {
    id, video, setVideo, tmdbDetail, tmdbMediaType,
    setTmdbDetail, setTmdbMediaType, onTmdbReady,
    selectedSeason, setSelectedSeason, selectedSeasonRef, seasonChangedRef,
    cmsSourceIdRef, cmsSourceNameRef, currentSourceNameRef,
    setCurrentSrc, setLocalEpisodeId, videoCache,
    routeSourceIndex, activeSourceIndex, skipHistory, onSwitchEpisode, handlePlaySource,
    routePlayUrl, routeSeasonNumber,
  } = opts;

  const { setSource, setSources } = usePlayerStore();
  const { videoSourceIds } = useSettingsStore();

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
  // 缓存剧名/年份，供"按需重建季映射"复用（切源/切季懒加载兜底时无需重新计算）
  const videoTitleRef = useRef<string>('');
  const videoYearRef = useRef<number | undefined>(undefined);

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

    // 一次性获取视频源配置，后续所有位置复用
    const { getVideoSources } = await import('@/services/sourceService');
    const allSrc = await getVideoSources();

    let sourceIdx = targetSourceIndex;

    // 统一读取历史记录：既用于「未指定源时回退最近播放源」，也用于
    // 「按内容身份（季号+集号）恢复选集/线路进度」，保证不同源进度一致。
    let histRecord: HistoryRecord | undefined;
    if (!skipHistory) {
      try {
        const { getHistory } = await import('@/services/database');
        const history = await getHistory();
        histRecord = history.find(h => h.videoId === id);
      } catch { /* ignore */ }
    }

    // 1) 路由传入的 sourceIndex 最优先：用户在详情页点了具体源的「立即播放」，
    //    必须播放用户点的那个源，绝不能被历史记录的源覆盖。
    if (sourceIdx === undefined && routeSourceIndex !== undefined) {
      sourceIdx = routeSourceIndex;
    }

    // 2) 历史记录：仅在未指定具体源（直接打开/继续播放）时，回退最近播放的源
    if (sourceIdx === undefined && (histRecord?.cmsSourceId || histRecord?.cmsSourceName)) {
      const matchedIdx = histRecord.cmsSourceId
        ? allSrc.findIndex(s => s.id === histRecord.cmsSourceId)
        : allSrc.findIndex(s => s.name === histRecord!.cmsSourceName);
      if (matchedIdx >= 0) sourceIdx = matchedIdx;
    }

    // 3) 默认使用设置页中第一个被选中的 CMS 源（ID 持久化 → 解析下标）
    if (sourceIdx === undefined) {
      const { getEnabledVideoSourceIndices } = await import('@/services/sourceService');
      const idxs = await getEnabledVideoSourceIndices();
      sourceIdx = idxs[0] ?? 0;
    }

    activeCmsSourceIndexRef.current = sourceIdx;

    // 选集/线路恢复遵循全局规则：相同内容（电影=videoId；剧集=videoId+季+集）的播放进度
    // 以「最后播放」为准，且在不同 CMS 源之间保持一致。因此恢复不限定源，而是按内容身份
    // （季号 + 集号）匹配：跨源时 episodeUrl 不同无法精确匹配线路，回退默认线路，但选集与
    // 播放进度（时间）仍按历史回显。
    const parseEpisodeNumber = (label?: string): number | undefined => {
      if (!label) return undefined;
      const m = label.match(/\d+/);
      return m ? Number(m[0]) : undefined;
    };
    const histEpNum = parseEpisodeNumber(histRecord?.episodeLabel);
    const histSeason = histRecord?.seasonNumber;

    // 选集恢复：弹窗直达的 routePlayUrl 精确匹配 > 历史集号 > 默认第一集。
    // routePlayUrl 优先保证「全部」弹窗点的集在首帧就位，杜绝先播其它集导致的
    // 首播季号/集号竞态写入。
    const pickInitialEpisode = (eps?: Episode[]): Episode | undefined => {
      if (!eps?.length) return undefined;
      const sorted = [...eps].sort((a, b) => a.number - b.number);
      if (routePlayUrl) {
        const byUrl = sorted.find(ep => ep.sources?.some(s => s.url === routePlayUrl));
        if (byUrl) return byUrl;
      }
      if (histEpNum != null) {
        const matched = sorted.find(ep => ep.number === histEpNum);
        if (matched) return matched;
      }
      return sorted[0];
    };

    // 线路恢复：历史 episodeUrl 命中当前源线路时精确回显；跨源未命中则保持默认第一条。
    const restoreLineIfNeeded = (ep: Episode | undefined) => {
      if (histRecord?.episodeUrl && ep?.sources.length) {
        const line = ep.sources.find(s => s.url === histRecord!.episodeUrl);
        if (line) handlePlaySource(line);
      }
    };

    {
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
    // 缓存剧名/年份，供按需重建季映射复用
    videoTitleRef.current = videoTitle;
    videoYearRef.current = videoYear;

    if (!videoTitle) {
      if (!ctrl.signal.aborted) finishLoading();
      return;
    }

    // ── 快速恢复路径：有 vodId 时直接调 CMS 详情接口 ──────────
    /**
     * 快速恢复路径：有 vodId 时直接调 CMS 详情接口
     * 场景：用户从历史记录恢复播放，已有 vodId，可直接获取视频详情。
     * 注意：routeSourceIndex 指定了具体源时不可走此路径——历史 vodId 属于
     * 历史记录的那个源，跨源 vodId 不通用，会在用户点的源上拉错视频。
     */
    if (!isSwitching && routeSourceIndex === undefined && histRecord?.vodId) {
      try {
        const svc = await import('@/services/videoService');
        /** 通过 vodId 获取视频详情（传递 signal 支持取消） */
        const detailVideo = await svc.fetchVideoDetail(sourceIdx, histRecord.vodId, ctrl.signal);
        if (ctrl.signal.aborted) return;

        if (detailVideo) {
          // 设置 CMS 源信息
          cmsSourceIdRef.current = allSrc[sourceIdx]?.id;
          cmsSourceNameRef.current = allSrc[sourceIdx]?.name ?? '';

          // 缓存并设置视频数据（带源与时间戳）
          videoCache.set(id, { video: detailVideo, sourceIndex: sourceIdx, fetchedAt: Date.now() });
          setVideo(detailVideo);

          // 剧集类型：选中第一集并异步加载季信息
          if (detailVideo.episodes?.length) {
            const firstEp = pickInitialEpisode(detailVideo.episodes);
            if (firstEp?.sources.length) {
              finishLoading();
              onSwitchEpisode(firstEp);
              restoreLineIfNeeded(firstEp);
              // 异步加载季信息（传递 signal 支持取消）
              searchVideoSeasonsFromSingleSource(sourceIdx, videoTitle, videoYear, ctrl.signal).then(result => {
                if (!ctrl.signal.aborted) {
                  seasonMapsRef.current.set(sourceIdx, result.seasons);
                  setCmsSeasons(buildCmsSeasons(result.seasons));
                  if (histRecord?.vodId) {
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
            const firstSrc = (histRecord?.episodeUrl)
              ? detailVideo.sources.find(s => s.url === histRecord!.episodeUrl) ?? detailVideo.sources[0]
              : detailVideo.sources[0];
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
          cmsSourceIdRef.current = allSrc[sourceIdx]?.id;
          cmsSourceNameRef.current = allSrc[sourceIdx]?.name ?? '';

          // 初始季优先级：弹窗直达的 routeSeasonNumber > 历史「最后播放的季」> 默认。
          // 仅当目标源确实存在该季号时才覆盖，避免源间季号体系不同导致的错配。
          let initialSeason = selectedSeasonRef.current;
          if (routeSeasonNumber != null && seasonMap.has(routeSeasonNumber)) {
            initialSeason = routeSeasonNumber;
          } else if (histSeason != null && seasonMap.has(histSeason)) {
            initialSeason = histSeason;
          }
          if (initialSeason !== selectedSeasonRef.current) {
            selectedSeasonRef.current = initialSeason;
            setSelectedSeason(initialSeason);
          }

          // 跨源对齐：新源季号体系可能与旧 selectedSeason 不同，回退到新源第一季
          const alignedSeason = seasonMap.has(selectedSeasonRef.current)
            ? selectedSeasonRef.current
            : firstKeyOf(seasonMap, selectedSeasonRef.current);
          if (alignedSeason !== selectedSeasonRef.current) {
            selectedSeasonRef.current = alignedSeason;
            setSelectedSeason(alignedSeason);
          }
          const seasonVideo = seasonMap.get(alignedSeason);
          if (seasonVideo) {
            videoCache.set(id!, { video: seasonVideo, sourceIndex: sourceIdx, fetchedAt: Date.now() });
            setVideo(seasonVideo);

            if (!seasonChangedRef.current && seasonVideo.episodes?.length) {
              const targetEp = pickInitialEpisode(seasonVideo.episodes);
              if (targetEp?.sources.length) {
                finishLoading();
                onSwitchEpisode(targetEp);
                restoreLineIfNeeded(targetEp);
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
      let result: VideoDetailResult;
      if (!id?.startsWith('tmdb-')) {
        // CMS 源视频：通过 vod_id 获取详情（传递 signal 支持取消）
        const { fetchVideoDetail } = await import('@/services/videoService');
        const detailVideo = await fetchVideoDetail(sourceIdx, id, ctrl.signal);
        const sourceName = allSrc[sourceIdx]?.name ?? '未知';
        result = { sourceIndex: sourceIdx, sourceId: allSrc[sourceIdx]?.id ?? '', sourceName, video: detailVideo };
      } else {
        // TMDB 视频：通过标题搜索（传递 signal 支持取消）
        result = await searchVideoFromSingleSource(sourceIdx, videoTitle, videoYear, ctrl.signal);
      }

      if (!ctrl.signal.aborted) {
        setCmsResults(prev => {
          const idx = prev.findIndex(r => r.sourceIndex === sourceIdx);
          if (idx >= 0) { const next = [...prev]; next[idx] = result; return next; }
          return [...prev, result];
        });

        if (result.video) {
          videoCache.set(id!, { video: result.video, sourceIndex: result.sourceIndex, fetchedAt: Date.now() });
          setVideo(result.video);
          {
            const src = allSrc[result.sourceIndex];
            if (src) cmsSourceIdRef.current = src.id;
          }
          cmsSourceNameRef.current = result.sourceName;

          if (result.video.episodes?.length) {
            if (!seasonChangedRef.current) {
              const targetEp = pickInitialEpisode(result.video.episodes);
              if (targetEp?.sources.length) {
                onSwitchEpisode(targetEp);
                restoreLineIfNeeded(targetEp);
              }
            }
            finishLoading();
            return;
          }

          if (result.video.sources.length > 0) {
            setSources(result.video.sources);
            const firstSrc = (histRecord?.episodeUrl)
              ? result.video.sources.find(s => s.url === histRecord!.episodeUrl) ?? result.video.sources[0]
              : result.video.sources[0];
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
  }, [id, videoSourceIds, routeSourceIndex, skipHistory, tmdbDetail, tmdbMediaType, video, setSelectedSeason, routePlayUrl, routeSeasonNumber]);

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
  const handlePlayCMSSource = useCallback(async (result: VideoDetailResult) => {
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

    // TV 剧集：优先用已缓存且对齐的该源季映射；缺失则重建该源季映射并按语义对齐
    const seasonMap = seasonMapsRef.current.get(result.sourceIndex);
    const cachedVideo = seasonMap?.get(selectedSeason);
    if (seasonMap && cachedVideo) {
      cmsSourceNameRef.current = result.sourceName;
      setCmsSeasons(buildCmsSeasons(seasonMap));
      if (cachedVideo.episodes?.length) {
        const matchedEp = currentEpNumber
          ? findEpisodeByNumber(cachedVideo.episodes, currentEpNumber)
          : undefined;
        if (matchedEp?.sources.length) {
          videoCache.set(id!, { video: cachedVideo, sourceIndex: result.sourceIndex, fetchedAt: Date.now() });
          setVideo(cachedVideo);
          onSwitchEpisode(matchedEp);
        }
      }
      cleanup();
      return;
    }

    // 该源季映射缺失或当前季不在该源：重建该源季映射并语义对齐（保留当前集号）
    if (videoTitleRef.current) {
      cmsAbortRef.current?.abort();
      const ctrl = new AbortController();
      cmsAbortRef.current = ctrl;
      setCmsLoading(true);
      try {
        const seasonResult = await searchVideoSeasonsFromSingleSource(
          result.sourceIndex, videoTitleRef.current, videoYearRef.current, ctrl.signal,
        );
        if (ctrl.signal.aborted) { cleanup(); return; }
        const sm = seasonResult.seasons;
        seasonMapsRef.current.set(result.sourceIndex, sm);
        setCmsSeasons(buildCmsSeasons(sm));
        const aligned = sm.has(selectedSeason) ? selectedSeason : firstKeyOf(sm, selectedSeason);
        const seasonVideo = sm.get(aligned);
        selectedSeasonRef.current = aligned;
        setSelectedSeason(aligned);
        if (seasonVideo) {
          videoCache.set(id!, { video: seasonVideo, sourceIndex: result.sourceIndex, fetchedAt: Date.now() });
          setVideo(seasonVideo);
          if (seasonVideo.episodes?.length) {
            const matchedEp = currentEpNumber
              ? findEpisodeByNumber(seasonVideo.episodes, currentEpNumber)
              : undefined;
            const ep = matchedEp?.sources.length
              ? matchedEp
              : [...seasonVideo.episodes].sort((a, b) => a.number - b.number)[0];
            if (ep?.sources.length) onSwitchEpisode(ep);
          }
        } else {
          setVideo(null);
        }
      } catch {
        // 重建失败：保留当前状态，不静默清空
      } finally {
        if (!ctrl.signal.aborted) cleanup();
      }
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
            videoCache.set(id!, { video: result.video, sourceIndex: result.sourceIndex, fetchedAt: Date.now() });
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
        videoCache.set(id!, { video: result.video, sourceIndex: result.sourceIndex, fetchedAt: Date.now() });
        setVideo(result.video);
        setSources(result.video.sources);
        const firstSrc = result.video.sources[0];
        setCurrentSrc({ url: firstSrc.url, type: firstSrc.type });
        setSource(firstSrc.url, firstSrc.type);
        currentSourceNameRef.current = firstSrc.name;
      }
    }
    cleanup();
  }, [id, video, selectedSeason, videoCache, setVideo, setSources, setSource, setCurrentSrc, currentSourceNameRef, cmsSourceNameRef, seasonChangedRef, onSwitchEpisode, setSelectedSeason]);

  // ── loadSeason：切季/切源缓存缺失时的懒加载兜底 ──────────
  const loadSeason = useCallback(async (sourceIdx: number, seasonNumber: number, currentEpNumber?: number) => {
    if (!id || !videoTitleRef.current) return;
    cmsAbortRef.current?.abort();
    const ctrl = new AbortController();
    cmsAbortRef.current = ctrl;
    setCmsLoading(true);
    try {
      const seasonResult = await searchVideoSeasonsFromSingleSource(
        sourceIdx, videoTitleRef.current, videoYearRef.current, ctrl.signal,
      );
      if (ctrl.signal.aborted) return;
      const sm = seasonResult.seasons;
      seasonMapsRef.current.set(sourceIdx, sm);
      setCmsSeasons(buildCmsSeasons(sm));
      // 对齐季号：优先请求季，否则回退到该源第一季
      const aligned = sm.has(seasonNumber) ? seasonNumber : firstKeyOf(sm, seasonNumber);
      const seasonVideo = sm.get(aligned);
      selectedSeasonRef.current = aligned;
      setSelectedSeason(aligned);
      if (seasonVideo) {
        setLocalEpisodeId(undefined);
        setSources([]);
        setCurrentSrc(null);
        videoCache.set(id, { video: seasonVideo, sourceIndex: sourceIdx, fetchedAt: Date.now() });
        setVideo(seasonVideo);
        const matchedEp = currentEpNumber
          ? findEpisodeByNumber(seasonVideo.episodes ?? [], currentEpNumber)
          : undefined;
        const ep = matchedEp?.sources.length
          ? matchedEp
          : [...(seasonVideo.episodes ?? [])].sort((a, b) => a.number - b.number)[0];
        if (ep?.sources.length) onSwitchEpisode(ep);
      } else {
        setVideo(null);
        setSources([]);
        setCurrentSrc(null);
        setLocalEpisodeId(undefined);
        currentSourceNameRef.current = undefined;
      }
    } catch {
      // 加载失败：保留当前状态，不静默清空
    } finally {
      if (!ctrl.signal.aborted) setCmsLoading(false);
    }
  }, [id, videoCache, setVideo, setSources, setCurrentSrc, setLocalEpisodeId, onSwitchEpisode, setSelectedSeason]);

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
          // 面板直接展示设置页启用的源 ID（不再依赖下标）
          const ids = videoSourceIds.length > 0
            ? videoSourceIds
            : (sources[0] ? [sources[0].id] : []);
          setSelectedSourceIds(ids);
        } else if (routeSourceIndex !== undefined && sources[routeSourceIndex]) {
          const sourceId = sources[routeSourceIndex].id;
          setSelectedSourceIds([sourceId]);
          setActiveSourceId(sourceId);
        } else if (activeSourceIndex !== undefined && sources[activeSourceIndex]) {
          // 普通 CMS vod id（历史记录/直接 URL 进入，无 routeSourceIndex）：
          // 以当前实际播放源填充面板，避免「暂无数据源」
          const sourceId = sources[activeSourceIndex].id;
          setSelectedSourceIds([sourceId]);
          setActiveSourceId(sourceId);
        }
      }).catch(() => {});
    }).catch(() => {});
  }, [id, videoSourceIds, routeSourceIndex, activeSourceIndex]);

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
    seasonMapsRef.current.clear();
    fetchInitiatedRef.current = false;
    setCmsResults([]);
    setCmsSeasons([]);
    setSelectedSourceIds([]);
    setActiveSourceId(undefined);
    setCmsLoading(false);
    setCmsSwitching(false);
  }, [id]);

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
    loadSeason,
    seasonMapsRef,
    activeCmsSourceIndexRef,
  };
}
