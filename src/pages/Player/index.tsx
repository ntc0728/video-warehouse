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
import { useDocumentTitle } from '@/hooks';
import { useAutoPlay, useEpisodeSwitcher, useCMSSourceManager } from './hooks';
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

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const skipHistory = (location.state as Record<string, unknown>)?.skipHistory === true;
  const routeSourceIndex = (location.state as Record<string, unknown>)?.sourceIndex as number | undefined;

  const { currentSourceIndex } = useVideoStore();
  const { setSource, setSources, sources: playerSources, resetRuntime: resetPlayer } = usePlayerStore();
  const { updateHistoryProgress, isCollected, addCollection, removeCollection } = useUserStore();
  const { videoSourceIndex } = useSettingsStore();

  const isCompact = useMemo(() => isNativePlatform(), []);

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
    fetchCMSSources: _fetchCMSSources, handleFetchCMSSourceById, handlePlayCMSSource,
    seasonMapsRef, activeCmsSourceIndexRef,
  } = useCMSSourceManager({
    id, video, setVideo, tmdbDetail, tmdbMediaType,
    setTmdbDetail, setTmdbMediaType,
    onTmdbReady: handleTmdbReady,
    selectedSeason, selectedSeasonRef, seasonChangedRef,
    historyRecordRef, cmsSourceIdRef, cmsSourceNameRef, currentSourceNameRef,
    setCurrentSrc, setLocalEpisodeId, videoCache,
    routeSourceIndex, skipHistory, onSwitchEpisode: switchToEpisode,
  });


  // ── 初始加载：读取视频数据 ──────────────────────────────
  const prevIdRef = useRef(id);
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // 仅 id 变化时重置加载状态，HMR 重挂载时不重置
    if (prevIdRef.current !== id) {
      setHasLoadedOnce(false);
      setTmdbReady(false);
      prevIdRef.current = id;
    }

    const loadVideo = async () => {
      if (!id) return;
      videoCache.delete(id);
      setLoadError(null);

      let activeSourceIndex = routeSourceIndex ?? videoSourceIndex;
      let historyRecord: HistoryRecord | undefined;
      if (!skipHistory) {
        try {
          const { getHistory } = await import('@/services/database');
          const history = await getHistory();
          historyRecord = history.find(h => h.videoId === id);
          if (historyRecord?.cmsSourceId || historyRecord?.cmsSourceName) {
            const { getVideoSources } = await import('@/services/sourceService');
            const allSrc = await getVideoSources();
            const matchedIdx = historyRecord!.cmsSourceId
              ? allSrc.findIndex(s => s.id === historyRecord!.cmsSourceId)
              : allSrc.findIndex(s => s.name === historyRecord!.cmsSourceName);
            if (matchedIdx >= 0) activeSourceIndex = matchedIdx;
          }
        } catch { /* history read failed */ }
      }
      historyRecordRef.current = historyRecord;

      try {
        let foundVideo: Video | null = videoCache.get(id) ?? null;

        if (foundVideo && currentSourceIndex !== activeSourceIndex && !id.startsWith('tmdb-')) {
          const svc = await import('@/services/videoService');
          const detailVideo = await svc.fetchVideoDetail(activeSourceIndex, id);
          if (detailVideo) foundVideo = detailVideo;
        }

        if (foundVideo && foundVideo.sources.length === 0 && !foundVideo.episodes) {
          if (!id.startsWith('tmdb-')) {
            const svc = await import('@/services/videoService');
            const detailVideo = await svc.fetchVideoDetail(activeSourceIndex, id);
            if (detailVideo) foundVideo = detailVideo;
          }
        }

        if (!foundVideo && !id.startsWith('tmdb-')) {
          const svc = await import('@/services/videoService');
          const detailVideo = await svc.fetchVideoDetail(activeSourceIndex, id);
          if (detailVideo) foundVideo = detailVideo;
        }

        if (controller.signal.aborted) return;

        if (foundVideo) {
          videoCache.set(id, foundVideo);
          setVideo(foundVideo);

          if (historyRecord?.cmsSourceId) cmsSourceIdRef.current = historyRecord.cmsSourceId;
          if (historyRecord?.cmsSourceName) cmsSourceNameRef.current = historyRecord.cmsSourceName;

          let sources = foundVideo.sources;
          let selectedEpisode: Episode | null = null;

          if (foundVideo.episodes && foundVideo.episodes.length > 0) {
            if (historyRecord?.episodeUrl) {
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
  }, [id, videoSourceIndex, currentSourceIndex]);

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
      const currentEp = v?.episodes?.length ? v.episodes.find((e) => e.id === activeEpId) : undefined;
      const epLabel = currentEp ? `第${currentEp.number}集` : (!v?.episodes?.length ? currentSourceNameRef.current : undefined);
      const vodId = id.startsWith('tmdb-') ? undefined : id;
      updateHistoryProgress({ videoId: id, progress, duration, title: v?.title, cover: v?.cover, backdrop: backdropRef.current, cmsSourceId: cmsSourceIdRef.current, cmsSourceName: cmsSourceNameRef.current, episodeLabel: epLabel, vodId, episodeUrl: currentSrcRef.current?.url });
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
    if (!seasonMap) return;

    const activeEpId = localEpisodeId;
    const oldEpisodes = videoRef.current?.episodes ?? [];
    const currentEp = activeEpId ? oldEpisodes.find(ep => ep.id === activeEpId) : undefined;
    const currentEpNumber = currentEp?.number;

    const seasonVideo = seasonMap.get(seasonNumber);
    if (seasonVideo && seasonVideo.episodes?.length) {
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
      setVideo(null);
      setSources([]);
      setCurrentSrc(null);
      setLocalEpisodeId(undefined);
      currentSourceNameRef.current = undefined;
    }
    // zustand actions 和 refs 引用稳定，不会导致重新执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, switchToEpisode]);

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
                    {overviewExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
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
      <div className="page-padding player-page">
        <div className="player-main">
          <div className="player-video-area">
            <div className="player-empty-state player-empty-state--inline">
              <div className="player-empty-content">
                <VideoOff />
                <p className="player-empty-title">暂无数据</p>
                <p className="player-empty-sub">请尝试切换其他 CMS 源</p>
                <button className="player-empty-back" onClick={handleBack}>
                  <ArrowLeft size={14} />
                  <span>返回</span>
                </button>
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
                  <ArrowLeft size={18} />
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
            platform="desktop"
            url={currentSrc.url}
            type={currentSrc.type}
            title={video?.title || ''}
            videoId={id}
            vodId={id?.startsWith('tmdb-') ? undefined : id}
            episodeUrl={currentSrc.url}
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
                <button className="player-autoplay-nav-btn" onClick={playNextNow}>
                  <Play size={18} fill="currentColor" />
                  <span>立即播放</span>
                </button>
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
          />
        </PlayerSidebar>
      </div>
      {detailSection}
    </div>
  );
}
