/**
 * 视频播放页面
 * 左侧播放器 + 右侧折叠面板（CMS源/选集）+ 下方详情信息
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useVideoStore, usePlayerStore, useUserStore, useSettingsStore } from '@/stores';
import { searchVideoFromSingleSource } from '@/services/videoService';
import { fetchMovieDetail, fetchTVDetail, buildImageUrl } from '@/services/tmdbService';
import { UniversalPlayer } from '@/components/UniversalPlayer';
import { VideoCard } from '@/components/VideoCard';
import type { Video, VideoSource, Episode } from '@/types/video';
import type { VideoDetailResult } from '@/services/videoService';
import type { TMDBMovieDetail, TMDBTVShowDetail, TMDBCastMember } from '@/types/tmdb';
import { AppLoading } from '@/components/common';
import { getHistory } from '@/services/database';
import type { HistoryRecord } from '@/types/store';
import { useSmartBack } from '@/lib/navigation';
import { isNativePlatform } from '@/lib/platform';
import {
  ArrowLeft, VideoOff, AlertTriangle,
  SkipForward, Timer, X,
  ChevronDown, ChevronUp, Heart,
} from 'lucide-react';
import { PlayerCMSPanel } from './PlayerCMSPanel';
import { PlayerSeasonPanel } from './PlayerSeasonPanel';
import { PlayerEpisodesPanel } from './PlayerEpisodesPanel';
import { PlayerSidebar } from './PlayerSidebar';
import './Player.css';

type TMDBResultItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
};

function toVideoItem(item: TMDBResultItem, mediaType: 'movie' | 'tv'): Video {
  return {
    id: `tmdb-${mediaType}-${item.id}`,
    title: mediaType === 'tv' ? item.name ?? '' : item.title ?? '',
    cover: buildImageUrl(item.poster_path, 'w500') || '',
    type: mediaType,
    year: item.release_date
      ? new Date(item.release_date).getFullYear()
      : item.first_air_date
        ? new Date(item.first_air_date).getFullYear()
        : undefined,
    tags: [],
    description: '',
    actors: [],
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const videoCache = new Map<string, Video>();

export default function PlayerPage() {
  const { id, episodeId } = useParams<{ id: string; episodeId?: string }>();
  const location = useLocation();
  const skipHistory = (location.state as Record<string, unknown>)?.skipHistory === true;
  const routeSourceIndex = (location.state as Record<string, unknown>)?.sourceIndex as number | undefined;

  const { videos, currentSourceIndex } = useVideoStore();
  const { setSource, setSources, sources: playerSources, reset: resetPlayer } = usePlayerStore();
  const { updateHistoryProgress, isCollected, addCollection, removeCollection } = useUserStore();
  const { videoSourceIndex, videoSourceIndices } = useSettingsStore();

  const isCompact = useMemo(() => isNativePlatform(), []);

  const [video, setVideo] = useState<Video | null>(null);
  const [currentSrc, setCurrentSrc] = useState<{ url: string; type: VideoSource['type'] } | null>(null);
  const [loadError, setLoadError] = useState<'api' | null>(null);
  const [cmsResults, setCmsResults] = useState<VideoDetailResult[]>([]);
  const [cmsLoading, setCmsLoading] = useState(false);
  const cmsAbortRef = useRef<AbortController | null>(null);
  const activeCmsSourceIndexRef = useRef<number | undefined>(undefined);

  // ── CMS 缓存 helpers ──────────────────────────────────────
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

  const writeCmsCache = useCallback((videoId: string, sourceIndex: number, video: Video) => {
    try {
      localStorage.setItem(getCmsCacheKey(videoId, sourceIndex),
        JSON.stringify({ video, timestamp: Date.now() }));
    } catch { /* quota exceeded, ignore */ }
  }, [getCmsCacheKey]);

  const clearAllCmsCache = useCallback((videoId: string) => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`cms-cache-${videoId}-`)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }, []);

  const [tmdbDetail, setTmdbDetail] = useState<TMDBMovieDetail | TMDBTVShowDetail | null>(null);
  const [tmdbMediaType, setTmdbMediaType] = useState<'movie' | 'tv'>('movie');
  const tmdbAbortRef = useRef<AbortController | null>(null);

  // 设置页中勾选的 CMS 源名称列表（从配置加载）
  const [selectedSourceNames, setSelectedSourceNames] = useState<string[]>([]);
  // 当前活跃的 CMS 源名称（点击时立即设置，不等 API 响应）
  const [activeSourceName, setActiveSourceName] = useState<string | undefined>();

  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    cms: true,
    season: true,
    episodes: true,
  });

  const [selectedSeason, setSelectedSeason] = useState(1);

  const [skipIndicator, setSkipIndicator] = useState<'intro' | 'outro' | null>(null);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPlayCancelRef = useRef(false);

  const [overviewExpanded, setOverviewExpanded] = useState(false);

  const [localEpisodeId, setLocalEpisodeId] = useState<string | undefined>();

  // ── ref 绑定（渲染阶段同步，消除闭包陈旧问题）────────────────
  const abortRef = useRef<AbortController | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const currentSourceNameRef = useRef<string | undefined>(undefined);
  const currentSrcRef = useRef(currentSrc);
  currentSrcRef.current = currentSrc;
  const videoRef = useRef(video);
  videoRef.current = video;
  const backdropRef = useRef<string | undefined>(undefined);
  backdropRef.current = tmdbDetail?.backdrop_path
    ? buildImageUrl(tmdbDetail.backdrop_path, 'w780') || undefined
    : undefined;
  const localEpisodeIdRef = useRef(localEpisodeId);
  localEpisodeIdRef.current = localEpisodeId;
  // CMS 源配置名称（如 "量子资源"），不同于播放线路名（如 "ikm3u8"）
  const cmsSourceNameRef = useRef<string | undefined>(undefined);
  // 渲染阶段通过 source URL 在 video 数据中精确匹配源名称
  if (currentSrc && video) {
    const url = currentSrc.url;
    const match = video.sources.find(s => s.url === url)
      ?? video.episodes?.flatMap(e => e.sources).find(s => s.url === url);
    if (match?.name) currentSourceNameRef.current = match.name;
  }

  useEffect(() => setLocalEpisodeId(episodeId), [episodeId]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 非 TMDB 视频：首次 effect 执行即标记；TMDB 视频：等 TMDB 接口响应后再取消 loading
    if (!hasLoadedOnce && !id?.startsWith('tmdb-')) setHasLoadedOnce(true);

    const loadVideo = async () => {
      if (!id) return;

      setLoadError(null);

      // 提前读取历史记录：cmsSourceName 用于恢复 CMS 源，episodeId 用于恢复集数
      // skipHistory（从头播放）时跳过历史记录，使用默认源和第一集
      let activeSourceIndex = videoSourceIndex;
      let historyRecord: HistoryRecord | undefined;
      if (!skipHistory) {
        try {
          const history = await getHistory();
          historyRecord = history.find(h => h.videoId === id);
          if (historyRecord?.cmsSourceName) {
            const { getVideoSources } = await import('@/services/sourceService');
            const allSrc = await getVideoSources();
            const matchedIdx = allSrc.findIndex(s => s.name === historyRecord!.cmsSourceName);
            if (matchedIdx >= 0) activeSourceIndex = matchedIdx;
          }
        } catch { /* history read failed, use default */ }
      }

      try {
        let foundVideo: Video | null = null;

        if (currentSourceIndex === activeSourceIndex) {
          foundVideo = videos.find((v) => v.id === id) || null;
        }

        if (!foundVideo) {
          foundVideo = videoCache.get(id) ?? null;
        }

        // 有历史记录但 CMS 源不一致时，从正确的源重新拉数据，避免用旧源的缓存数据
        if (foundVideo
            && currentSourceIndex !== activeSourceIndex
            && !id.startsWith('tmdb-')) {
          const svc = await import('@/services/videoService');
          const detailVideo = await svc.fetchVideoDetail(activeSourceIndex, id);
          if (detailVideo) {
            foundVideo = detailVideo;
          }
        }

        if (foundVideo && foundVideo.sources.length === 0 && !foundVideo.episodes) {
          if (!id.startsWith('tmdb-')) {
            const svc = await import('@/services/videoService');
            const detailVideo = await svc.fetchVideoDetail(activeSourceIndex, id);
            if (detailVideo) {
              foundVideo = detailVideo;
            }
          }
        }

        if (!foundVideo && !id.startsWith('tmdb-')) {
          const svc = await import('@/services/videoService');
          const detailVideo = await svc.fetchVideoDetail(activeSourceIndex, id);
          if (detailVideo) {
            foundVideo = detailVideo;
          }
        }

        if (controller.signal.aborted) return;

        if (foundVideo) {
          videoCache.set(id, foundVideo);
          setVideo(foundVideo);

          // 恢复上次的 CMS 源名称
          if (historyRecord?.cmsSourceName) {
            cmsSourceNameRef.current = historyRecord.cmsSourceName;
          }

          let sources = foundVideo.sources;
          let selectedEpisode: Episode | null = null;

          if (foundVideo.episodes && foundVideo.episodes.length > 0) {
            if (episodeId) {
              selectedEpisode = foundVideo.episodes.find((ep) => ep.id === episodeId) || null;
            } else {
              // 从历史记录恢复上次播放的选集
              if (historyRecord?.episodeId) {
                selectedEpisode = foundVideo.episodes.find(
                  (ep) => ep.id === historyRecord.episodeId
                ) || null;
              }
              // 无历史记录则默认播放第一集
              if (!selectedEpisode) {
                selectedEpisode = [...foundVideo.episodes].sort((a, b) => a.number - b.number)[0] || null;
              }
            }
            if (selectedEpisode) {
              sources = selectedEpisode.sources;
              setLocalEpisodeId(selectedEpisode.id);
            }
          }

          setSources(sources);

          if (sources.length > 0) {
            // 从历史记录恢复上次使用的源，优先匹配历史记录
            let matchedSource = sources.find(s => s.isDefault) || sources[0];
            if (historyRecord?.sourceName) {
              const found = sources.find(s => s.name === historyRecord.sourceName);
              if (found) matchedSource = found;
            }
            setCurrentSrc({ url: matchedSource.url, type: matchedSource.type });
            setSource(matchedSource.url, matchedSource.type);
            currentSourceNameRef.current = matchedSource.name;
          } else if (!id.startsWith('tmdb-')) {
            // 本地无数据，等待 CMS 搜索
          }
        } else if (!id.startsWith('tmdb-')) {
          // 本地无数据，等待 CMS 搜索
        }
        // 无本地数据时，从历史记录恢复 CMS 源名称
        if (!foundVideo && historyRecord?.cmsSourceName) {
          cmsSourceNameRef.current = historyRecord.cmsSourceName;
        }
      } catch {
        if (controller.signal.aborted) return;
        setLoadError('api');
      }
    };

    loadVideo();

    return () => {
      controller.abort();
      resetPlayer();
    };
    // zustand actions 引用稳定，不会导致重新执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, episodeId, videos, videoSourceIndex, currentSourceIndex]);

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
        if (isNaN(tid)) { setHasLoadedOnce(true); return; }
        const detail = mt === 'tv'
          ? await fetchTVDetail(tid, { signal: ctrl.signal })
          : await fetchMovieDetail(tid, { signal: ctrl.signal });
        if (!ctrl.signal.aborted) {
          setTmdbDetail(detail);
          setHasLoadedOnce(true);
        }
      } catch {
        if (!ctrl.signal.aborted) setHasLoadedOnce(true);
      }
    };

    loadTMDB();
    return () => ctrl.abort();
  }, [id]);

  // 加载设置页中勾选的 CMS 源名称
  useEffect(() => {
    if (!id?.startsWith('tmdb-')) return;
    const indices = videoSourceIndices && videoSourceIndices.length > 0
      ? videoSourceIndices
      : [videoSourceIndex];
    import('@/services/sourceService').then(mod => {
      mod.getVideoSources().then(sources => {
        setSelectedSourceNames(indices.map(i => sources[i]?.name).filter(Boolean));
      }).catch(() => {});
    }).catch(() => {});
  }, [id, videoSourceIndex, videoSourceIndices]);

  const fetchCMSSources = useCallback(async (targetSourceIndex?: number) => {
    if (!id) return;
    cmsAbortRef.current?.abort();
    const ctrl = new AbortController();
    cmsAbortRef.current = ctrl;
    // 切换源时不显示 loading，后台静默获取后直接替换
    const isSwitching = targetSourceIndex !== undefined;
    if (!isSwitching) setCmsLoading(true);
    setLoadError(null);

    // 切换源时不清空旧数据，保留当前视频继续播放，等新数据就绪后直接替换
    if (isSwitching && !video && !currentSrc) {
      // 无当前播放内容时仍需清空（首次切换或数据已被清空的边缘场景）
      setSources([]);
      setCurrentSrc(null);
      currentSourceNameRef.current = undefined;
    }

    // ── 确定要调用的 CMS 源 ──────────────────────────
    let sourceIdx = targetSourceIndex;

    // 1) 历史记录优先（从头播放时跳过）
    if (sourceIdx === undefined && !skipHistory) {
      try {
        const history = await getHistory();
        const histRecord = history.find(h => h.videoId === id);
        if (histRecord?.cmsSourceName) {
          const { getVideoSources } = await import('@/services/sourceService');
          const allSrc = await getVideoSources();
          const matchedIdx = allSrc.findIndex(s => s.name === histRecord.cmsSourceName);
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
      if (!ctrl.signal.aborted) setCmsLoading(false);
      return;
    }

    try {
      // 检查缓存
      const cached = readCmsCache(id, sourceIdx);
      let result: VideoDetailResult;
      if (cached) {
        const { getVideoSources } = await import('@/services/sourceService');
        const allSrc = await getVideoSources();
        const sourceName = allSrc[sourceIdx]?.name ?? '未知';
        result = { sourceIndex: sourceIdx, sourceName, video: cached };
      } else {
        result = await searchVideoFromSingleSource(sourceIdx, videoTitle, videoYear);
        if (result.video) writeCmsCache(id, sourceIdx, result.video);
      }

      if (!ctrl.signal.aborted) {
        // 维护 cmsResults 数组：替换或追加该源的结果
        setCmsResults(prev => {
          const idx = prev.findIndex(r => r.sourceIndex === sourceIdx);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = result;
            return next;
          }
          return [...prev, result];
        });

        let histSourceName: string | undefined;
        let histEpisodeId: string | undefined;
        try {
          const history = await getHistory();
          const histRecord = history.find(h => h.videoId === id);
          histSourceName = histRecord?.sourceName;
          histEpisodeId = histRecord?.episodeId;
        } catch { /* ignore */ }

        if (result.video) {
          videoCache.set(id!, result.video);
          setVideo(result.video);

          // 剧集：按历史记录的 episodeId 选集，默认第一集
          if (result.video.episodes?.length) {
            const episodes = [...result.video.episodes].sort((a, b) => a.number - b.number);
            let targetEp = episodes.find(ep => ep.id === histEpisodeId);
            if (!targetEp) targetEp = episodes[0];
            if (targetEp?.sources.length) {
              switchToEpisode(targetEp);
              setActiveSourceName(undefined);
              return;
            }
          }

          // 电影：按历史记录的 sourceName 选线路，默认第一线路
          const allSrc = result.video.sources;
          let matchedSrc = allSrc.find(s => s.isDefault) || allSrc[0];
          if (histSourceName) {
            const found = allSrc.find(s => s.name === histSourceName);
            if (found) matchedSrc = found;
          }
          if (matchedSrc) {
            setSources(allSrc);
            setCurrentSrc({ url: matchedSrc.url, type: matchedSrc.type });
            setSource(matchedSrc.url, matchedSrc.type);
            currentSourceNameRef.current = matchedSrc.name;
            cmsSourceNameRef.current = result.sourceName;
            setActiveSourceName(undefined);
          }
        } else {
          // 空结果：清理旧数据，用户可切换其他源
          setVideo(null);
          setSources([]);
          setCurrentSrc(null);
          currentSourceNameRef.current = undefined;
        }
      }
    } catch {
      if (!ctrl.signal.aborted) setLoadError('api');
    } finally {
      if (!ctrl.signal.aborted) setCmsLoading(false);
    }
    // zustand actions 引用稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, videoSourceIndex, videoSourceIndices, routeSourceIndex, skipHistory, tmdbDetail, tmdbMediaType, video, readCmsCache, writeCmsCache]);

  // 首次加载 + 路由 sourceIndex 变化时重新搜索
  useEffect(() => {
    if (!id?.startsWith('tmdb-') || !tmdbDetail || cmsLoading) return;
    if (cmsResults.length === 0) {
      fetchCMSSources(routeSourceIndex);
    }
  }, [id, tmdbDetail, cmsLoading, cmsResults.length, fetchCMSSources, routeSourceIndex]);

  useEffect(() => () => {
    cmsAbortRef.current?.abort();
    tmdbAbortRef.current?.abort();
    // 页面销毁时清理 CMS 缓存
    if (id) clearAllCmsCache(id);
  }, [id, clearAllCmsCache]);

  const handleProgress = useCallback((progress: number, duration: number) => {
    if (id) {
      const v = videoRef.current;
      // URL 有 episodeId 时用 URL，否则用 loadVideo 自动选中的 localEpisodeId
      const activeEpId = episodeId || localEpisodeIdRef.current;
      const currentEp = v?.episodes?.length ? v.episodes.find((e) => e.id === activeEpId) : undefined;
      // 剧集 → "第X集"，电影 → vod_play_url 解析出的名称（如 "正片"）
      const epLabel = currentEp ? `第${currentEp.number}集` : (!v?.episodes?.length && currentSourceNameRef.current ? currentSourceNameRef.current : undefined);
      updateHistoryProgress(id, activeEpId, progress, duration, v?.title, v?.cover, backdropRef.current, currentSourceNameRef.current, cmsSourceNameRef.current, epLabel);
    }
  }, [id, episodeId, updateHistoryProgress]);

  const handleSkipIntro = useCallback(() => {
    setSkipIndicator('intro');
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    skipTimerRef.current = setTimeout(() => setSkipIndicator(null), 2000);
  }, []);

  const handleSkipOutro = useCallback(() => {
    setSkipIndicator('outro');
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    skipTimerRef.current = setTimeout(() => setSkipIndicator(null), 2000);
  }, []);

  const nextEpisodeRef = useRef<string | null>(null);

  // 切换到指定集数：更新本地状态 + 匹配播放源 + 同步 URL
  const switchToEpisode = useCallback((ep: Episode) => {
    setLocalEpisodeId(ep.id);
    if (ep.sources.length) {
      setSources(ep.sources);
      const src = ep.sources.find(s => s.isDefault) || ep.sources[0];
      setCurrentSrc({ url: src.url, type: src.type });
      setSource(src.url, src.type);
      currentSourceNameRef.current = src.name;
    }
    window.history.replaceState(null, '', `/play/${id}/${ep.id}`);
  }, [id, setSource, setSources]);

  const startAutoPlayCountdown = useCallback((nextEpId: string) => {
    nextEpisodeRef.current = nextEpId;
    autoPlayCancelRef.current = false;
    setAutoPlayCountdown(3);

    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      setAutoPlayCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
          autoPlayTimerRef.current = null;
          if (!autoPlayCancelRef.current && nextEpisodeRef.current) {
            const nextEp = video?.episodes?.find(e => e.id === nextEpisodeRef.current);
            if (nextEp) switchToEpisode(nextEp);
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [video, switchToEpisode]);

  const cancelAutoPlay = useCallback(() => {
    autoPlayCancelRef.current = true;
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setAutoPlayCountdown(null);
    nextEpisodeRef.current = null;
  }, []);

  // 卸载时清理
  useEffect(() => {
    return () => {
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, []);

  const handleEnded = useCallback(() => {
    const loopMode = usePlayerStore.getState().loopMode;
    const autoPlayEnabled = useSettingsStore.getState().autoPlay;
    const activeEpId = localEpisodeId || episodeId;

    // 单集循环：seek 到 0 重新播放
    if (loopMode === 'single') {
      const videoEl = document.querySelector('video');
      if (videoEl) {
        videoEl.currentTime = 0;
        videoEl.play().catch(() => {});
      }
      return;
    }

    // 自动连播关闭时，不跳转到下一集
    if (!autoPlayEnabled && loopMode === 'none') {
      return;
    }

    if (video?.episodes && video.episodes.length > 0 && activeEpId) {
      const currentIndex = video.episodes.findIndex((ep) => ep.id === activeEpId);

      // 列表循环：最后一集回到第一集
      if (loopMode === 'list') {
        const nextIndex = (currentIndex + 1) % video.episodes.length;
        const nextEpisode = video.episodes[nextIndex];
        startAutoPlayCountdown(nextEpisode.id);
        return;
      }

      // 默认模式：最后一集不跳转
      if (currentIndex < video.episodes.length - 1) {
        const nextEpisode = video.episodes[currentIndex + 1];
        startAutoPlayCountdown(nextEpisode.id);
      }
    }
  }, [video, localEpisodeId, episodeId, startAutoPlayCountdown]);

  const handleBack = useSmartBack(id ? `/detail/${id}` : undefined);

  const togglePanel = (key: string) => {
    setExpandedPanels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePlayEpisode = (ep: Episode) => {
    const matchedEp = video?.episodes?.find(e => e.id === ep.id) ?? ep;
    switchToEpisode(matchedEp);
  };

  // 点击面板中尚未获取的 CMS 源 → 立即高亮 + 按名称查找索引并获取
  const handleFetchCMSSourceByName = useCallback(async (sourceName: string) => {
    setActiveSourceName(sourceName);
    if (!id) return;
    const { getVideoSources } = await import('@/services/sourceService');
    const allSrc = await getVideoSources();
    const idx = allSrc.findIndex(s => s.name === sourceName);
    if (idx >= 0) fetchCMSSources(idx);
  }, [id, fetchCMSSources]);

  const handlePlayCMSSource = (result: VideoDetailResult) => {
    setActiveSourceName(result.sourceName);
    if (result.video) {
      cmsSourceNameRef.current = result.sourceName;
      videoCache.set(id!, result.video);
      setVideo(result.video);

      const activeEpId = localEpisodeId || episodeId;
      if (activeEpId && result.video.episodes?.length) {
        const oldEpisodes = videoRef.current?.episodes ?? [];
        const currentEp = oldEpisodes.find(ep => ep.id === activeEpId);
        let matchedEp = result.video.episodes.find(ep => ep.id === activeEpId);
        if (!matchedEp && currentEp) {
          matchedEp = result.video.episodes.find(ep => ep.title === currentEp.title);
        }
        if (!matchedEp && currentEp) {
          matchedEp = result.video.episodes[Math.min(currentEp.number - 1, result.video.episodes.length - 1)];
        }
        if (matchedEp?.sources.length) {
          switchToEpisode(matchedEp);
          setActiveSourceName(undefined);
          return;
        }
      }

      if (result.video.sources.length > 0) {
        setSources(result.video.sources);
        const src = result.video.sources.find(s => s.isDefault) || result.video.sources[0];
        setCurrentSrc({ url: src.url, type: src.type });
        setSource(src.url, src.type);
        currentSourceNameRef.current = src.name;
        setActiveSourceName(undefined);
      } else if (result.video.episodes?.length) {
        switchToEpisode(result.video.episodes[0]);
        setActiveSourceName(undefined);
      } else {
        setCurrentSrc(null);
        currentSourceNameRef.current = undefined;
        setActiveSourceName(undefined);
      }
    }
  };

  const handlePlaySource = useCallback((src: VideoSource) => {
    setCurrentSrc({ url: src.url, type: src.type });
    setSource(src.url, src.type);
    currentSourceNameRef.current = src.name;
  }, [setSource]);

  const episodes = video?.episodes
    ? [...video.episodes].sort((a, b) => a.number - b.number)
    : [];

  const activeEpId = localEpisodeId || episodeId;
  const currentEpisodeIndex = activeEpId ? episodes.findIndex((ep) => ep.id === activeEpId) : -1;
  const isFirstEpisode = currentEpisodeIndex <= 0;
  const isLastEpisode = currentEpisodeIndex >= episodes.length - 1;

  const handlePrevEpisode = () => {
    if (currentEpisodeIndex > 0) {
      handlePlayEpisode(episodes[currentEpisodeIndex - 1]);
    }
  };

  const handleNextEpisode = () => {
    if (currentEpisodeIndex < episodes.length - 1) {
      handlePlayEpisode(episodes[currentEpisodeIndex + 1]);
    }
  };

  // 当前集数 badge（传递给播放器 header）— 多集剧集显示集数，单集电影显示线路名
  const currentEp = activeEpId && episodes.length > 1
    ? episodes.find(ep => ep.id === activeEpId)
    : undefined;
  const episodeLabel = currentEp
    ? `第${currentEp.number}集`
    : (episodes.length <= 1 && currentSourceNameRef.current) || undefined;

  const d = tmdbDetail;
  let title: string | undefined;
  if (d) {
    if ('name' in d) title = d.name;
    else if ('title' in d) title = d.title;
  }
  const isTV = d ? 'name' in d : false;
  const seasons = isTV && d ? ((d as TMDBTVShowDetail).seasons ?? []) : [];
  let year: number | undefined;
  if (d && tmdbMediaType === 'tv') {
    const dateStr = (d as TMDBTVShowDetail).first_air_date;
    year = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
  } else if (d && tmdbMediaType === 'movie') {
    const dateStr = (d as TMDBMovieDetail).release_date;
    year = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
  }
  const voteAverage: number = d?.vote_average ?? 0;
  const runtime = isTV ? (d as TMDBTVShowDetail | undefined)?.episode_run_time?.[0] : (d as TMDBMovieDetail | undefined)?.runtime;
  const director = d?.credits?.crew?.find((c) => c.job === 'Director')?.name;
  const cast: TMDBCastMember[] = d?.credits?.cast?.slice(0, 8) || [];
  const posterUrl = d?.poster_path ? buildImageUrl(d.poster_path, 'w342') || '' : '';
  const overview = d?.overview || '';
  const similarResults = d?.similar?.results?.slice(0, 12) || [];
  const recommendedResults = d?.recommendations?.results?.slice(0, 12) || [];

  const isTMDB = id?.startsWith('tmdb-');

  // TMDB 视频：TMDB 详情加载完成后，仍需等待 CMS 搜索，避免误显示"找不到匹配播放源"
  const cmsStillSearching = isTMDB && !loadError && !video && cmsLoading;

  // 仅首次进入时显示页面级 loading，之后不再触发
  const shouldShowPageLoading = !hasLoadedOnce;

  if (shouldShowPageLoading) {
    return (
      <div className="player-page">
        <div className="player-page__container">
          <div className="player-loading-wrap">
            <AppLoading tip="加载中…" showTip />
          </div>
        </div>
      </div>
    );
  }

  // TMDB 视频：TMDB 详情已加载但 CMS 搜索中，显示轻量 loading（不阻塞整个页面）
  if (cmsStillSearching) {
    return (
      <div className="player-page">
        <div className="player-page__container">
          <div className="player-loading-wrap">
            <AppLoading tip="搜索匹配源中…" showTip />
          </div>
        </div>
      </div>
    );
  }

  if (!video) {
    if (loadError === 'api') {
      return (
        <div className="player-page">
          <div className="player-empty-state">
            <div className="player-empty-content">
              <AlertTriangle />
              <p className="player-empty-title">某些接口请求失败</p>
              <p className="player-empty-sub">请稍后重试</p>
              <button className="player-empty-back" onClick={handleBack}>
                <ArrowLeft size={14} />
                <span>返回</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
    // 无数据时不清空页面，让用户通过侧边栏切换 CMS 源
    return (
      <div className="player-page">
        <div className="player-main">
          <div className="player-video-area">
            <div className="player-empty-state">
              <div className="player-empty-content">
                <VideoOff />
                <p className="player-empty-title">暂无数据</p>
                <p className="player-empty-sub">请尝试切换其他 CMS 源</p>
              </div>
            </div>
          </div>
          <PlayerSidebar>
            <PlayerCMSPanel
              selectedSourceNames={selectedSourceNames}
              cmsResults={cmsResults}
              currentSrc={currentSrc}
              activeSourceName={activeSourceName}
              onPlaySource={handlePlayCMSSource}
              onFetchSource={handleFetchCMSSourceByName}
              expanded={expandedPanels.cms}
              onToggle={() => togglePanel('cms')}
              compact={isCompact}
            />
            <PlayerSeasonPanel
              seasons={seasons}
              activeSeason={selectedSeason}
              onSelectSeason={setSelectedSeason}
              expanded={expandedPanels.season}
              onToggle={() => togglePanel('season')}
              compact={isCompact}
            />
            <PlayerEpisodesPanel
              episodes={episodes}
              sources={playerSources}
              currentSrc={currentSrc}
              activeEpisodeId={localEpisodeId || episodeId}
              loading={cmsLoading}
              onPlayEpisode={handlePlayEpisode}
              onPlaySource={handlePlaySource}
              expanded={expandedPanels.episodes}
              onToggle={() => togglePanel('episodes')}
              compact={isCompact}
            />
          </PlayerSidebar>
        </div>
      </div>
    );
  }

  if (!currentSrc) return null;

  return (
    <div className="player-page">
      <div className="player-main">
        <div className="player-video-area">
          <UniversalPlayer
            key={`video-player-${id}-${episodeId || ''}`}
            mode="video"
            platform="desktop"
            url={currentSrc.url}
            type={currentSrc.type}
            title={video.title}
            videoId={id}
            episodeId={episodeId}
            episodeLabel={episodeLabel}
            skipHistory={skipHistory}
            onProgress={handleProgress}
            onEnded={handleEnded}
            onBack={handleBack}
            onSkipIntro={handleSkipIntro}
            onSkipOutro={handleSkipOutro}
            hasPrevEpisode={episodes.length > 0 ? !isFirstEpisode : undefined}
            hasNextEpisode={episodes.length > 0 ? !isLastEpisode : undefined}
            onPrevEpisode={handlePrevEpisode}
            onNextEpisode={handleNextEpisode}
          />

          {/* Skip indicator */}
          {skipIndicator && (
            <div className="player-skip-indicator">
              <SkipForward size={18} />
              <span>{skipIndicator === 'intro' ? '已跳过片头' : '已跳过片尾'}</span>
            </div>
          )}

          {/* Auto-play countdown overlay */}
          {autoPlayCountdown !== null && (
            <div className="player-autoplay-overlay">
              <div className="player-autoplay-card">
                <Timer size={20} className="player-autoplay-icon" />
                <span className="player-autoplay-text">
                  {autoPlayCountdown} 秒后播放下一集
                </span>
                <button className="player-autoplay-cancel" onClick={cancelAutoPlay}>
                  <X size={14} />
                  <span>取消</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <PlayerSidebar>
          <PlayerCMSPanel
            selectedSourceNames={selectedSourceNames}
            cmsResults={cmsResults}
            currentSrc={currentSrc}
            activeSourceName={activeSourceName}
            onPlaySource={handlePlayCMSSource}
            onFetchSource={handleFetchCMSSourceByName}
            expanded={expandedPanels.cms}
            onToggle={() => togglePanel('cms')}
            compact={isCompact}
          />
          <PlayerSeasonPanel
            seasons={seasons}
            activeSeason={selectedSeason}
            onSelectSeason={setSelectedSeason}
            expanded={expandedPanels.season}
            onToggle={() => togglePanel('season')}
            compact={isCompact}
          />
          <PlayerEpisodesPanel
            episodes={episodes}
            sources={playerSources}
            currentSrc={currentSrc}
            activeEpisodeId={localEpisodeId || episodeId}
            loading={cmsLoading}
            onPlayEpisode={handlePlayEpisode}
            onPlaySource={handlePlaySource}
            expanded={expandedPanels.episodes}
            onToggle={() => togglePanel('episodes')}
            compact={isCompact}
          />
        </PlayerSidebar>
      </div>

      {d && (
        <div className="player-detail-section">
          <div className="player-detail-content">
            <div className="player-detail-info">
              <div className="player-detail-info-header">
                <div className="player-detail-title-row">
                  <h3 className="player-detail-title">{title}</h3>
                  <button
                    className={`player-detail-fav-btn${isCollected(id!) ? ' collected' : ''}`}
                    onClick={() => {
                      if (isCollected(id!)) {
                        removeCollection(id!);
                      } else {
                        addCollection(id!, {
                          title: video?.title,
                          cover: video?.cover,
                          type: video?.type,
                          year: video?.year,
                        });
                      }
                    }}
                  >
                    <Heart size={16} fill={isCollected(id!) ? 'currentColor' : 'none'} />
                    <span>{isCollected(id!) ? '已收藏' : '收藏'}</span>
                  </button>
                </div>
                <div className="player-detail-meta">
                  {voteAverage > 0 && <span>★ {voteAverage.toFixed(1)}</span>}
                  {year && <span>{year}</span>}
                  {runtime && <span>{runtime}分钟</span>}
                  {director && <span>导演: {director}</span>}
                </div>
                {cast.length > 0 && (
                  <div className="player-detail-cast">
                    <span className="player-detail-cast-label">演员:</span>
                    {cast.map((c) => c.name).join(' / ')}
                  </div>
                )}
              </div>
              <div className="player-detail-info-body">
                {posterUrl && (
                  <div className="player-detail-poster">
                    <img src={posterUrl} alt={title} width={300} height={450} />
                  </div>
                )}
                {overview && (
                  <>
                    <p className={`player-detail-overview${overviewExpanded ? ' player-detail-overview--expanded' : ''}`}>{overview}</p>
                    <button className="player-overview-toggle" onClick={() => setOverviewExpanded(!overviewExpanded)}>
                      {overviewExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{overviewExpanded ? '收起' : '展开全文'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {(() => {
              const seen = new Set<number>();
              const allRecommendations = [
                ...similarResults,
                ...recommendedResults,
              ].filter((item) => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
              }).slice(0, 12);
              return allRecommendations.length > 0 ? (
                <section className="player-recommend">
                  <h4 className="player-recommend-title">相关推荐</h4>
                  <div className="player-recommend-row">
                    {allRecommendations.map((item) => (
                      <div key={`rec-${item.id}`} className="player-recommend-card">
                        <VideoCard video={toVideoItem(item, tmdbMediaType)} rating={item.vote_average} />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
