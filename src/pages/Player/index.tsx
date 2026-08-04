/**
 * 视频播放页面
 * 左侧播放器 + 右侧折叠面板（CMS源/选集）+ 下方详情信息
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useVideoStore, usePlayerStore, useUserStore, useSettingsStore } from '@/stores';
import { extractSeasonNumber } from '@/services/seasonMatcher';
import { findEpisodeByNumber } from '@/services/videoService';
import { buildImageUrl } from '@/services/tmdbService';
import { UniversalPlayer } from '@/components/UniversalPlayer';
import { VideoCard } from '@/components/VideoCard';
import type { Video, VideoSource, Episode } from '@/types/video';
import type { TMDBMovieDetail, TMDBTVShowDetail, TMDBCastMember } from '@/types/tmdb';
import { AppLoading } from '@/components/common';
import type { HistoryRecord } from '@/types/store';
import { useSmartBack } from '@/lib/navigation';
import { isNativePlatform } from '@/lib/platform';
import {
  ArrowLeft, VideoOff, AlertTriangle,
  SkipForward, Timer, X, Play,
  ChevronDown, ChevronUp, Heart,
} from 'lucide-react';
import { PlayerCMSPanel } from './PlayerCMSPanel';
import { PlayerSeasonPanel } from './PlayerSeasonPanel';
import { PlayerEpisodesPanel } from './PlayerEpisodesPanel';
import { PlayerSidebar } from './PlayerSidebar';
import { useDocumentTitle, useIsTV } from '@/hooks';
import { useAutoPlay, useEpisodeSwitcher, useCMSSourceManager } from './hooks';
import './Player.css';
import { Icon } from "@/components/ui/Icon";

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
    cover: buildImageUrl(item.poster_path, 'w342') || '',
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

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const skipHistory = (location.state as Record<string, unknown>)?.skipHistory === true;
  const routeSourceIndex = (location.state as Record<string, unknown>)?.sourceIndex as number | undefined;
  // 来自详情页“全部”弹框：直接跳转到指定线路/选集（按精确播放地址匹配）
  const routePlayUrl = (location.state as Record<string, unknown>)?.playUrl as string | undefined;
  // 来自详情页“全部”弹框：剧集跳转时携带的季号，用于正确回显选季面板
  const routeSeasonNumber = (location.state as Record<string, unknown>)?.seasonNumber as number | undefined;
  const appliedRoutePlayRef = useRef(false);

  const { currentSourceIndex } = useVideoStore();
  const { setSource, setSources, sources: playerSources, resetRuntime: resetPlayer } = usePlayerStore();
  const { updateHistoryProgress, isCollected, addCollection, removeCollection } = useUserStore();
  const { videoSourceIndex } = useSettingsStore();

  const isCompact = useMemo(() => isNativePlatform(), []);
  // TV 模式：用户在设置页强制开启，或 UA 自动检测为 TV 设备时启用遥控器交互
  const isTVDevice = useIsTV();

  const [video, setVideo] = useState<Video | null>(null);
  const [currentSrc, setCurrentSrc] = useState<{ url: string; type: VideoSource['type'] } | null>(null);
  const [loadError, setLoadError] = useState<'api' | null>(null);

  // ── 动态页签标题 ──────────────────────────────
  useDocumentTitle(video?.title || null, true);

  const [tmdbDetail, setTmdbDetail] = useState<TMDBMovieDetail | TMDBTVShowDetail | null>(null);
  const [tmdbMediaType, setTmdbMediaType] = useState<'movie' | 'tv'>('movie');

  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    cms: true,
    season: true,
    episodes: true,
  });

  const [selectedSeason, setSelectedSeason] = useState(1);
  const seasonChangedRef = useRef(false);
  const selectedSeasonRef = useRef(selectedSeason);
  selectedSeasonRef.current = selectedSeason;

  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [overviewTruncated, setOverviewTruncated] = useState(false);
  const overviewRef = useCallback((node: HTMLParagraphElement | null) => {
    if (!node) return;
    // 回调 ref：元素挂载后立即检测
    requestAnimationFrame(() => {
      const truncated = node.scrollHeight > node.clientHeight + 1;
      setOverviewTruncated(truncated);
    });
  }, []);
  const [localEpisodeId, setLocalEpisodeId] = useState<string | undefined>();
  const [tmdbReady, setTmdbReady] = useState(false);

  // ── ref 绑定（渲染阶段同步，消除闭包陈旧问题）────────────────
  const abortRef = useRef<AbortController | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const historyRecordRef = useRef<HistoryRecord | undefined>(undefined);
  const currentSourceNameRef = useRef<string | undefined>(undefined);
  const currentSrcRef = useRef(currentSrc);
  currentSrcRef.current = currentSrc;
  const videoRef = useRef(video);
  videoRef.current = video;
  const backdropRef = useRef<string | undefined>(undefined);
  backdropRef.current = tmdbDetail?.backdrop_path
    ? buildImageUrl(tmdbDetail.backdrop_path, 'w780') || undefined
    : (video?.cover || undefined);
  const localEpisodeIdRef = useRef(localEpisodeId);
  localEpisodeIdRef.current = localEpisodeId;
  const cmsSourceIdRef = useRef<string | undefined>(undefined);
  const cmsSourceNameRef = useRef<string | undefined>(undefined);
  if (currentSrc && video) {
    const url = currentSrc.url;
    const match = video.sources.find(s => s.url === url)
      ?? video.episodes?.flatMap(e => e.sources).find(s => s.url === url);
    if (match?.name) currentSourceNameRef.current = match.name;
  }

  // ── 视频缓存 ──────────────────────────────
  const videoCache = useMemo(() => new Map<string, Video>(), []);

  // ── Hook: Episode Switcher ──────────────────────────────
  const {
    switchToEpisode, handlePlayEpisode, handlePlaySource,
    handlePrevEpisode, handleNextEpisode,
    episodes, isFirstEpisode, isLastEpisode,
  } = useEpisodeSwitcher({
    video, localEpisodeId, setLocalEpisodeId,
    setCurrentSrc, currentSourceNameRef,
  });

  // 应用详情页“全部”弹框指定的线路/选集：在 handleSelectSeason 定义之后处理（见下方 effect）

  // ── Hook: Auto Play ──────────────────────────────
  const {
    autoPlayCountdown, skipIndicator,
    handleEnded, handleSkipIntro, handleSkipOutro,
    cancelAutoPlay, playNextNow,
  } = useAutoPlay({ video, localEpisodeId, onSwitchEpisode: switchToEpisode });

  // ── Hook: CMS Source Manager ──────────────────────────────
  const handleTmdbReady = useCallback(() => setTmdbReady(true), []);
  const {
    cmsResults, cmsLoading, cmsSwitching,
    selectedSourceIds, sourceNameMap, activeSourceId, cmsSeasons,
    fetchCMSSources: _fetchCMSSources, handleFetchCMSSourceById, handlePlayCMSSource, loadSeason,
    seasonMapsRef, activeCmsSourceIndexRef,
  } = useCMSSourceManager({
    id, video, setVideo, tmdbDetail, tmdbMediaType,
    setTmdbDetail, setTmdbMediaType,
    onTmdbReady: handleTmdbReady,
    selectedSeason, setSelectedSeason, selectedSeasonRef, seasonChangedRef,
    cmsSourceIdRef, cmsSourceNameRef, currentSourceNameRef,
    setCurrentSrc, setLocalEpisodeId, videoCache,
    routeSourceIndex, skipHistory, onSwitchEpisode: switchToEpisode, handlePlaySource,
    // 弹窗直达：初始选集/季优先按 routePlayUrl / routeSeasonNumber 对齐，避免首播季号竞态
    routePlayUrl, routeSeasonNumber,
  });


  // ── 初始加载：读取视频数据 ──────────────────────────────
  /** 上一次的视频 ID，用于检测 id 变化 */
  const prevIdRef = useRef(id);
  useEffect(() => {
    // 取消上一次的请求
    abortRef.current?.abort();
    /** 本次请求的 AbortController，用于取消请求 */
    const controller = new AbortController();
    abortRef.current = controller;

    // 仅 id 变化时重置加载状态，HMR 重挂载时不重置
    if (prevIdRef.current !== id) {
      // 重置加载状态
      setHasLoadedOnce(false);
      setTmdbReady(false);
      // 重置视频相关状态，避免 Keep-Alive 下残留上一个视频的数据
      setVideo(null);
      setCurrentSrc(null);
      setLoadError(null);
      setLocalEpisodeId(undefined);
      setTmdbDetail(null);
      setTmdbMediaType('movie');
      setSelectedSeason(1);
      // 重置 ref，避免残留上一个视频的 CMS 源信息
      cmsSourceIdRef.current = undefined;
      cmsSourceNameRef.current = undefined;
      currentSourceNameRef.current = undefined;
      historyRecordRef.current = undefined;
      // 重置“全部”弹框指定线路/选集的生效标记
      appliedRoutePlayRef.current = false;
      prevIdRef.current = id;
    }

    /**
     * 加载视频数据
     * 1. 从历史记录恢复 CMS 源
     * 2. 从缓存或 API 获取视频数据
     * 3. 设置播放源和选集
     */
    const loadVideo = async () => {
      if (!id) return;
      videoCache.delete(id);
      setLoadError(null);

      /** 当前使用的 CMS 源索引（优先级：routeSourceIndex > videoSourceIndex） */
      let activeSourceIndex = routeSourceIndex ?? videoSourceIndex;
      /** 历史记录（用于恢复 CMS 源和选集） */
      let historyRecord: HistoryRecord | undefined;
      if (!skipHistory) {
        try {
          const { getHistory } = await import('@/services/database');
          const history = await getHistory();
          // 按 videoId 查找历史记录（getHistory 返回按 updatedAt 倒序，所以找到的是最新的）
          historyRecord = history.find(h => h.videoId === id);
          // 仅当没有明确指定 routeSourceIndex 时，才使用历史记录的源
          if (routeSourceIndex === undefined && (historyRecord?.cmsSourceId || historyRecord?.cmsSourceName)) {
            const { getVideoSources } = await import('@/services/sourceService');
            const allSrc = await getVideoSources();
            // 查找历史记录中 CMS 源的索引
            const matchedIdx = historyRecord!.cmsSourceId
              ? allSrc.findIndex(s => s.id === historyRecord!.cmsSourceId)
              : allSrc.findIndex(s => s.name === historyRecord!.cmsSourceName);
            if (matchedIdx >= 0) activeSourceIndex = matchedIdx;
          }
        } catch { /* history read failed */ }
      }
      historyRecordRef.current = historyRecord;

      try {
        /** 从缓存获取视频数据 */
        let foundVideo: Video | null = videoCache.get(id) ?? null;

        // 统一判断是否需要请求详情：无缓存 / 源不匹配 / 缺少播放源
        const needFetch = !id.startsWith('tmdb-') && (
          !foundVideo ||
          (foundVideo && currentSourceIndex !== activeSourceIndex) ||
          (foundVideo && foundVideo.sources.length === 0 && !foundVideo.episodes)
        );

        if (needFetch) {
          const svc = await import('@/services/videoService');
          const detailVideo = await svc.fetchVideoDetail(activeSourceIndex, id, controller.signal);
          if (detailVideo) foundVideo = detailVideo;
        }

        if (controller.signal.aborted) return;

        if (foundVideo) {
          // 缓存视频数据并更新状态
          videoCache.set(id, foundVideo);
          setVideo(foundVideo);

          /**
           * cmsSourceIdRef 保护逻辑
           *
           * 仅当没有明确指定 routeSourceIndex 时，才使用历史记录的 CMS 源信息。
           * 原因：用户从详情页点击具体 CMS 源播放时，routeSourceIndex 已指定，
           * 不应被历史记录中的源覆盖。
           */
          if (routeSourceIndex === undefined) {
            if (historyRecord?.cmsSourceId) cmsSourceIdRef.current = historyRecord.cmsSourceId;
            if (historyRecord?.cmsSourceName) cmsSourceNameRef.current = historyRecord.cmsSourceName;
          }

          /** 当前可用的播放源列表 */
          let sources = foundVideo.sources;
          /** 选中的集（从历史记录恢复） */
          let selectedEpisode: Episode | null = null;

          // 剧集类型：从历史记录恢复选集
          if (foundVideo.episodes && foundVideo.episodes.length > 0) {
            if (historyRecord?.episodeUrl) {
              // 按 episodeUrl 查找对应的集
              selectedEpisode = foundVideo.episodes.find(ep =>
                ep.url === historyRecord.episodeUrl ||
                ep.sources.some(s => s.url === historyRecord.episodeUrl)
              ) || null;
            }
            if (!selectedEpisode) {
              selectedEpisode = [...foundVideo.episodes].sort((a, b) => a.number - b.number)[0] || null;
            }
            if (selectedEpisode) {
              sources = selectedEpisode.sources;
              setLocalEpisodeId(selectedEpisode.id);
            }
          }

          setSources(sources);

          if (sources.length > 0) {
            const matchedSource = sources.find(s => s.isDefault) || sources[0];
            setCurrentSrc({ url: matchedSource.url, type: matchedSource.type });
            setSource(matchedSource.url, matchedSource.type);
            currentSourceNameRef.current = matchedSource.name;
          }
        } else if (!id.startsWith('tmdb-')) {
          // 本地无数据，等待 CMS 搜索
        }
        if (!foundVideo) {
          if (historyRecord?.cmsSourceId) cmsSourceIdRef.current = historyRecord.cmsSourceId;
          if (historyRecord?.cmsSourceName) cmsSourceNameRef.current = historyRecord.cmsSourceName;
        }
      } catch {
        if (controller.signal.aborted) return;
        setLoadError('api');
      } finally {
        if (!controller.signal.aborted) {
          requestAnimationFrame(() => {
            // TMDB 视频：CMS 搜索尚未完成但 TMDB 已就绪时也设置 hasLoadedOnce
            if (!id?.startsWith('tmdb-') || videoRef.current || tmdbReady) {
              setHasLoadedOnce(true);
            }
          });
        }
      }
    };

    loadVideo();

    return () => {
      controller.abort();
      resetPlayer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, routeSourceIndex, videoSourceIndex, currentSourceIndex]);

  // TMDB 就绪后设置 hasLoadedOnce，取消全屏 loading
  useEffect(() => {
    if (tmdbReady && id?.startsWith('tmdb-') && !hasLoadedOnce) {
      requestAnimationFrame(() => setHasLoadedOnce(true));
    }
  }, [tmdbReady, id, hasLoadedOnce]);

  const handleProgress = useCallback((progress: number, duration: number) => {
    if (id) {
      const v = videoRef.current;
      const activeEpId = localEpisodeIdRef.current;
      const hasEpisodes = !!v?.episodes?.length;
      const currentEp = hasEpisodes ? v?.episodes?.find((e) => e.id === activeEpId) : undefined;
      // 身份守卫：剧集播放但当前选集身份缺失（切季/换源/连播切换的中间态）时跳过写入，
      // 避免把剧集进度写成电影级记录（hist-{videoId}），污染内容身份键。
      if (hasEpisodes && !currentEp) return;
      const epLabel = currentEp ? `第${currentEp.number}集` : (!hasEpisodes ? currentSourceNameRef.current : undefined);
      const vodId = id.startsWith('tmdb-') ? undefined : id;
      updateHistoryProgress({ videoId: id, progress, duration, title: v?.title, cover: v?.cover, backdrop: backdropRef.current, cmsSourceId: cmsSourceIdRef.current, cmsSourceName: cmsSourceNameRef.current, episodeLabel: epLabel, vodId, episodeUrl: currentSrcRef.current?.url, seasonNumber: hasEpisodes ? selectedSeasonRef.current : undefined });
    }
  }, [id, updateHistoryProgress]);

  const handleBack = useSmartBack(id ? `/detail/${id}` : undefined);

  const togglePanel = (key: string) => {
    setExpandedPanels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 切换选季：从内存中的季映射表查找对应集数
  const handleSelectSeason = useCallback((seasonNumber: number) => {
    setSelectedSeason(seasonNumber);
    seasonChangedRef.current = true;

    const sourceIdx = activeCmsSourceIndexRef.current;
    if (sourceIdx === undefined) return;

    const seasonMap = seasonMapsRef.current.get(sourceIdx);
    const activeEpId = localEpisodeId;
    const oldEpisodes = videoRef.current?.episodes ?? [];
    const currentEp = activeEpId ? oldEpisodes.find(ep => ep.id === activeEpId) : undefined;
    const currentEpNumber = currentEp?.number;

    const seasonVideo = seasonMap?.get(seasonNumber);
    // 缓存命中且集数有效：直接切换（保留当前集号）
    if (seasonMap && seasonVideo && seasonVideo.episodes?.length) {
      setLocalEpisodeId(undefined);
      setSources([]);
      setCurrentSrc(null);

      const matchedEp = currentEpNumber
        ? findEpisodeByNumber(seasonVideo.episodes, currentEpNumber)
        : undefined;

      if (matchedEp?.sources.length) {
        videoCache.set(id!, seasonVideo);
        setVideo(seasonVideo);
        switchToEpisode(matchedEp);
      }
    } else {
      // 缓存缺失或该季无集数：懒加载兜底——按需重建该源季映射，而非静默置空
      loadSeason(sourceIdx, seasonNumber, currentEpNumber);
    }
    // zustand actions 和 refs 引用稳定，不会导致重新执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, switchToEpisode, loadSeason]);

  // 应用详情页“全部”弹框指定的线路/选集：video 就绪后按精确地址匹配一次。
  // 必须放在 handleSelectSeason 之后定义，以便直接调用它切换季。
  useEffect(() => {
    if (appliedRoutePlayRef.current || !routePlayUrl || !video) return;
    const sourceIdx = routeSourceIndex ?? activeCmsSourceIndexRef.current;
    const seasonMap = sourceIdx !== undefined ? seasonMapsRef.current.get(sourceIdx) : undefined;

    // 选集所在季可能尚未加载（video.episodes 仅含当前季）。先定位正确季并切换，
    // video 更新后本 effect 会再次执行并完成匹配，从而保证选季/选集面板回显正确。
    const findSeasonOfUrl = (url: string): number | undefined => {
      if (!seasonMap) return undefined;
      for (const [seasonNum, seasonVideo] of seasonMap.entries()) {
        if (seasonVideo.episodes?.some((e) => e.sources?.some((s) => s.url === url))) {
          return seasonNum;
        }
      }
      return undefined;
    };

    const targetSeason = routeSeasonNumber ?? findSeasonOfUrl(routePlayUrl);
    if (targetSeason != null && targetSeason !== selectedSeason && seasonMap?.has(targetSeason)) {
      handleSelectSeason(targetSeason);
      return; // 等待该季 video 就绪后再次匹配
    }

    const ep = video.episodes?.find((e) => e.sources.some((s) => s.url === routePlayUrl));
    if (ep) {
      switchToEpisode(ep);
      const src = ep.sources.find((s) => s.url === routePlayUrl);
      if (src) handlePlaySource(src);
      appliedRoutePlayRef.current = true;
      return;
    }

    // 电影 / 单线路：直接按线路 URL 在当前 video.sources 中匹配
    const lineSrc = video.sources.find((s) => s.url === routePlayUrl);
    if (lineSrc) {
      handlePlaySource(lineSrc);
      appliedRoutePlayRef.current = true;
      return;
    }

    // video 仍是默认季但 seasonMap 已有数据：反查季后切换，再等待匹配
    if (seasonMap) {
      const seasonOfUrl = findSeasonOfUrl(routePlayUrl);
      if (seasonOfUrl != null && seasonOfUrl !== selectedSeason) {
        handleSelectSeason(seasonOfUrl);
        return;
      }
    }
  }, [video, routePlayUrl, switchToEpisode, handlePlaySource, handleSelectSeason, selectedSeason, routeSourceIndex, routeSeasonNumber]);

  const activeEpId = localEpisodeId;

  // 当前集数 badge（传递给播放器 header）
  const currentEp = activeEpId
    ? episodes.find(ep => ep.id === activeEpId)
    : undefined;
  const episodeLabel = currentEp
    ? `第${currentEp.number}集`
    : (episodes.length === 0 ? currentSourceNameRef.current : undefined);

  const d = tmdbDetail;
  const v = video;
  let title: string | undefined;
  if (d) {
    if ('name' in d) title = d.name;
    else if ('title' in d) title = d.title;
  } else if (v) {
    title = v.title;
  }
  const isTV = d ? 'name' in d : (v?.type === 'tv');
  // 优先用 CMS 搜索到的季数据，fallback 到 TMDB
  const seasons = cmsSeasons.length > 0
    ? cmsSeasons
    : (isTV && d ? ((d as TMDBTVShowDetail).seasons ?? []) : []);
  // 从 video.title 提取当前季名称（如 "第二季"），用于非 TMDB 视频的选季面板展示
  const currentSeasonName = useMemo(() => {
    if (seasons.length > 0 || !v?.title) return undefined;
    const seasonNum = extractSeasonNumber(v.title);
    if (seasonNum === undefined) return undefined;
    // 从标题中提取季名称部分
    const match = v.title.match(/(第[一二三四五六七八九十\d]+季|season\s*\d+|S\d+)/i);
    return match ? match[1] : `第${seasonNum}季`;
  }, [seasons.length, v?.title]);
  let year: number | undefined;
  if (d && tmdbMediaType === 'tv') {
    const dateStr = (d as TMDBTVShowDetail).first_air_date;
    year = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
  } else if (d && tmdbMediaType === 'movie') {
    const dateStr = (d as TMDBMovieDetail).release_date;
    year = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
  } else if (v?.year) {
    year = v.year;
  }
  const voteAverage: number = d?.vote_average ?? 0;
  const runtime = isTV
    ? (d as TMDBTVShowDetail | undefined)?.episode_run_time?.[0]
    : ((d as TMDBMovieDetail | undefined)?.runtime ?? v?.duration);
  const director = d?.credits?.crew?.find((c) => c.job === 'Director')?.name ?? v?.director;
  const cast: TMDBCastMember[] = d?.credits?.cast?.slice(0, 8) || [];
  const cmsActors = v?.actors || [];
  const posterUrl = d?.poster_path ? buildImageUrl(d.poster_path, 'w342') || '' : (v?.cover || '');
  const overview = (d?.overview || v?.description || '').replace(/<[^>]+>/g, '');
  const similarResults = d?.similar?.results?.slice(0, 12) || [];
  const recommendedResults = d?.recommendations?.results?.slice(0, 12) || [];


  // 仅首次进入时显示页面级 loading，之后不再触发
  const shouldShowPageLoading = !hasLoadedOnce;

  if (shouldShowPageLoading) {
    return (
      <div className="page-padding player-page">
        <div className="player-page__container">
          <div className="player-loading-wrap">
            <AppLoading tip="加载中…" showTip />
          </div>
        </div>
      </div>
    );
  }

  // ── 公共详情区（所有 return 路径共用，保持播放器高度稳定）──
  const detailSection = (d || v) ? (
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
                <Icon icon={Heart} size="sm" fill={isCollected(id!) ? 'currentColor' : 'none'} />
                <span>{isCollected(id!) ? '已收藏' : '收藏'}</span>
              </button>
            </div>
            <div className="player-detail-meta">
              {voteAverage > 0 && <span>★ {voteAverage.toFixed(1)}</span>}
              {year && <span>{year}</span>}
              {runtime && <span>{runtime}分钟</span>}
              {director && <span>导演: {director}</span>}
            </div>
            {cast.length > 0 ? (
              <div className="player-detail-cast">
                <span className="player-detail-cast-label">演员:</span>
                {cast.map((c) => c.name).join(' / ')}
              </div>
            ) : cmsActors.length > 0 ? (
              <div className="player-detail-cast">
                <span className="player-detail-cast-label">演员:</span>
                {cmsActors.join(' / ')}
              </div>
            ) : null}
          </div>
          <div className="player-detail-info-body">
            {posterUrl && (
              <div className="player-detail-poster">
                <img src={posterUrl} alt={title} width={300} height={450} />
              </div>
            )}
            {overview && (
              <div className="player-detail-overview-wrap">
                <p ref={overviewRef} className={`player-detail-overview${overviewExpanded ? ' player-detail-overview--expanded' : ''}`}>{overview}</p>
                {overviewTruncated && (
                  <button className="player-overview-toggle" onClick={() => setOverviewExpanded(!overviewExpanded)}>
                    {overviewExpanded ? <Icon icon={ChevronUp} size="xs" /> : <Icon icon={ChevronDown} size="xs" />}
                    <span>{overviewExpanded ? '收起' : '展开全文'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {d && (() => {
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
  ) : null;

  // CMS 加载中且无视频数据：播放器区域显示加载动画，面板显示局部 loading
  if (cmsLoading && !video) {
    return (
      <div className="page-padding player-page">
        <div className="player-main">
          <div className="player-video-area">
            <div className="player-loading-wrap">
              <div className="player-loading-spinner" />
            </div>
          </div>
          <PlayerSidebar>
            <PlayerCMSPanel
              selectedSourceIds={selectedSourceIds}
              sourceNameMap={sourceNameMap}
              cmsResults={cmsResults}
              currentSrc={currentSrc}
              activeSourceId={activeSourceId}
              onPlaySource={handlePlayCMSSource}
              onFetchSource={handleFetchCMSSourceById}
              expanded={expandedPanels.cms}
              onToggle={() => togglePanel('cms')}
              compact={isCompact}
              readOnly={!id?.startsWith('tmdb-') && routeSourceIndex !== undefined}
            />
            <PlayerSeasonPanel
              seasons={seasons}
              activeSeason={selectedSeason}
              onSelectSeason={handleSelectSeason}
              expanded={expandedPanels.season}
              onToggle={() => togglePanel('season')}
              compact={isCompact}
              currentSeasonName={currentSeasonName}
            />
            <PlayerEpisodesPanel
              episodes={episodes}
              sources={playerSources}
              currentSrc={currentSrc}
              activeEpisodeId={localEpisodeId}
              loading={cmsLoading}
              onPlayEpisode={handlePlayEpisode}
              onPlaySource={handlePlaySource}
              expanded={expandedPanels.episodes}
              onToggle={() => togglePanel('episodes')}
              compact={isCompact}
              isTV={isTV}
            />
          </PlayerSidebar>
        </div>
        {detailSection}
      </div>
    );
  }

  if (!video && !cmsSwitching && !cmsLoading && hasLoadedOnce && !loadError
    && !(id?.startsWith('tmdb-') && cmsResults.length === 0 && !cmsSeasons.length)) {
    if (loadError === 'api') {
      return (
        <div className="page-padding player-page">
          <div className="player-empty-state">
            <div className="player-empty-content">
              <Icon icon={AlertTriangle} size="lg" />
              <p className="player-empty-title">某些接口请求失败</p>
              <p className="player-empty-sub">请稍后重试</p>
              <button className="player-empty-back" onClick={handleBack}>
                <Icon icon={ArrowLeft} size="xs" />
                <span>返回</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
    // 无数据时不清空页面，让用户通过侧边栏切换 CMS 源
    return (
      <div className="page-padding player-page">
        <div className="player-main">
          <div className="player-video-area">
            <div className="player-empty-state player-empty-state--inline">
              <div className="up-player-header up-player-header-visible">
                <button className="up-header-back" onClick={(e) => { e.stopPropagation(); handleBack(); }}>
                  <Icon icon={ArrowLeft} size="sm" />
                  <span>返回</span>
                </button>
                <span className="up-header-title">{title || v?.title || ''}</span>
              </div>
              <div className="player-empty-content">
                <Icon icon={VideoOff} size="lg" />
                <p className="player-empty-title">暂无数据</p>
                <p className="player-empty-sub">请尝试切换其他 CMS 源</p>
              </div>
            </div>
          </div>
          <PlayerSidebar>
            <PlayerCMSPanel
              selectedSourceIds={selectedSourceIds}
              sourceNameMap={sourceNameMap}
              cmsResults={cmsResults}
              currentSrc={currentSrc}
              activeSourceId={activeSourceId}
              onPlaySource={handlePlayCMSSource}
              onFetchSource={handleFetchCMSSourceById}
              expanded={expandedPanels.cms}
              onToggle={() => togglePanel('cms')}
              compact={isCompact}
              readOnly={!id?.startsWith('tmdb-') && routeSourceIndex !== undefined}
            />
            <PlayerSeasonPanel
              seasons={seasons}
              activeSeason={selectedSeason}
              onSelectSeason={handleSelectSeason}
              expanded={expandedPanels.season}
              onToggle={() => togglePanel('season')}
              compact={isCompact}
              currentSeasonName={currentSeasonName}
            />
            <PlayerEpisodesPanel
              episodes={episodes}
              sources={playerSources}
              currentSrc={currentSrc}
              activeEpisodeId={localEpisodeId}
              loading={cmsLoading}
              onPlayEpisode={handlePlayEpisode}
              onPlaySource={handlePlaySource}
              expanded={expandedPanels.episodes}
              onToggle={() => togglePanel('episodes')}
              compact={isCompact}
              isTV={isTV}
            />
          </PlayerSidebar>
        </div>
        {detailSection}
      </div>
    );
  }

  if (!currentSrc) {
    // 有 video 但未选中线路/选集时，显示空播放器区域（不提前 return，保留下方详情内容）
    return (
      <div className="page-padding player-page">
        <div className="player-main">
          <div className="player-video-area">
            <div className="up-universal-player up-mode-video up-player-placeholder">
              <div className="up-player-core">
                <video className="up-player-video" playsInline />
                <div className="up-player-paused-overlay">
                  <div className="up-player-play-button">
                    <svg viewBox="0 0 80 80" className="up-player-play-icon" aria-hidden="true">
                      <circle cx="40" cy="40" r="38" />
                      <polygon points="28,24 28,56 58,40" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="up-player-header up-player-header-visible">
                <button className="up-header-back" onClick={(e) => { e.stopPropagation(); handleBack(); }}>
                  <Icon icon={ArrowLeft} size="sm" />
                  <span>返回</span>
                </button>
                <span className="up-header-title">{title || video?.title || ''}</span>
              </div>
            </div>
          </div>

          <PlayerSidebar>
            <PlayerCMSPanel
              selectedSourceIds={selectedSourceIds}
              sourceNameMap={sourceNameMap}
              cmsResults={cmsResults}
              currentSrc={currentSrc}
              activeSourceId={activeSourceId}
              onPlaySource={handlePlayCMSSource}
              onFetchSource={handleFetchCMSSourceById}
              expanded={expandedPanels.cms}
              onToggle={() => togglePanel('cms')}
              compact={isCompact}
              readOnly={!id?.startsWith('tmdb-') && routeSourceIndex !== undefined}
            />
            <PlayerSeasonPanel
              seasons={seasons}
              activeSeason={selectedSeason}
              onSelectSeason={handleSelectSeason}
              expanded={expandedPanels.season}
              onToggle={() => togglePanel('season')}
              compact={isCompact}
              currentSeasonName={currentSeasonName}
            />
            <PlayerEpisodesPanel
              episodes={episodes}
              sources={playerSources}
              currentSrc={currentSrc}
              activeEpisodeId={localEpisodeId}
              loading={cmsLoading}
              onPlayEpisode={handlePlayEpisode}
              onPlaySource={handlePlaySource}
              expanded={expandedPanels.episodes}
              onToggle={() => togglePanel('episodes')}
              compact={isCompact}
              isTV={isTV}
            />
          </PlayerSidebar>
        </div>
        {detailSection}
      </div>
    );
  }

  return (
    <div className="page-padding player-page">
      <div className="player-main">
        <div className="player-video-area">
          <UniversalPlayer
            key={`video-player-${id}`}
            mode="video"
            platform={isTVDevice ? 'tv' : 'desktop'}
            url={currentSrc.url}
            type={currentSrc.type}
            title={video?.title || ''}
            videoId={id}
            vodId={id?.startsWith('tmdb-') ? undefined : id}
            episodeUrl={currentSrc.url}
            cmsSourceId={cmsSourceIdRef.current}
            episodeLabel={episodeLabel}
            // 当前季号：供进度恢复按「内容身份」（季号+集标签）精确匹配，避免跨集恢复错位
            seasonNumber={episodes.length > 0 ? selectedSeason : undefined}
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
              <Icon icon={SkipForward} size="sm" />
              <span>{skipIndicator === 'intro' ? '已跳过片头' : '已跳过片尾'}</span>
            </div>
          )}

          {/* Auto-play countdown overlay */}
          {autoPlayCountdown !== null && (
            <div className="player-autoplay-overlay">
              <div className="player-autoplay-card">
                <Icon icon={Timer} size="md" className="player-autoplay-icon" />
                <span className="player-autoplay-text">
                  {autoPlayCountdown} 秒后播放下一集
                </span>
                <button className="player-autoplay-nav-btn" onClick={playNextNow}>
                  <Icon icon={Play} size="sm" fill="currentColor" />
                  <span>立即播放</span>
                </button>
                <button className="player-autoplay-cancel" onClick={cancelAutoPlay}>
                  <Icon icon={X} size="xs" />
                  <span>取消</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <PlayerSidebar>
          <PlayerCMSPanel
            selectedSourceIds={selectedSourceIds}
            sourceNameMap={sourceNameMap}
            cmsResults={cmsResults}
            currentSrc={currentSrc}
            activeSourceId={activeSourceId}
            onPlaySource={handlePlayCMSSource}
            onFetchSource={handleFetchCMSSourceById}
            expanded={expandedPanels.cms}
            onToggle={() => togglePanel('cms')}
            compact={isCompact}
          />
          <PlayerSeasonPanel
            seasons={seasons}
            activeSeason={selectedSeason}
            onSelectSeason={(s) => {
              seasonChangedRef.current = true;
              setSelectedSeason(s);
            }}
            expanded={expandedPanels.season}
            onToggle={() => togglePanel('season')}
            compact={isCompact}
          />
          <PlayerEpisodesPanel
            episodes={episodes}
            sources={playerSources}
            currentSrc={currentSrc}
            activeEpisodeId={localEpisodeId}
            loading={cmsLoading}
            onPlayEpisode={handlePlayEpisode}
            onPlaySource={handlePlaySource}
            expanded={expandedPanels.episodes}
            onToggle={() => togglePanel('episodes')}
            compact={isCompact}
            isTV={isTV}
          />
        </PlayerSidebar>
      </div>
      {detailSection}
    </div>
  );
}
