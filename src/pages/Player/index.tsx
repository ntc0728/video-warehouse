/**
 * 视频播放页面
 * 左侧播放器 + 右侧折叠面板（CMS源/选集）+ 下方详情信息
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useVideoStore, usePlayerStore, useUserStore, useSettingsStore } from '@/stores';
import { searchVideoFromSingleSource, searchVideoSeasonsFromSingleSource, findEpisodeByNumber, buildCmsSeasons } from '@/services/videoService';
import { extractSeasonNumber } from '@/services/seasonMatcher';
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
  SkipForward, Timer, X, Play,
  ChevronDown, ChevronUp, Heart,
} from 'lucide-react';
import { PlayerCMSPanel } from './PlayerCMSPanel';
import { PlayerSeasonPanel } from './PlayerSeasonPanel';
import { PlayerEpisodesPanel } from './PlayerEpisodesPanel';
import { PlayerSidebar } from './PlayerSidebar';
import { useDocumentTitle } from '@/hooks';
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
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const skipHistory = (location.state as Record<string, unknown>)?.skipHistory === true;
  const routeSourceIndex = (location.state as Record<string, unknown>)?.sourceIndex as number | undefined;

  const { videos, currentSourceIndex } = useVideoStore();
  const { setSource, setSources, sources: playerSources, resetRuntime: resetPlayer } = usePlayerStore();
  const { updateHistoryProgress, isCollected, addCollection, removeCollection } = useUserStore();
  const { videoSourceIndex, videoSourceIndices } = useSettingsStore();

  const isCompact = useMemo(() => isNativePlatform(), []);

  const [video, setVideo] = useState<Video | null>(null);
  const [currentSrc, setCurrentSrc] = useState<{ url: string; type: VideoSource['type'] } | null>(null);
  const [loadError, setLoadError] = useState<'api' | null>(null);
  const [cmsResults, setCmsResults] = useState<VideoDetailResult[]>([]);
  const [cmsLoading, setCmsLoading] = useState(false);
  const [cmsSwitching, setCmsSwitching] = useState(false);
  const cmsAbortRef = useRef<AbortController | null>(null);
  const cmsSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seasonSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const episodeSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeCmsSourceIndexRef = useRef<number | undefined>(undefined);
  // CMS 源 → 季号 → Video 映射（TV 剧集按季搜索结果）
  const seasonMapsRef = useRef<Map<number, Map<number, Video>>>(new Map());

  // ── 动态页签标题 ──────────────────────────────
  useDocumentTitle(video?.title || null, true);

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

  // 设置页中勾选的 CMS 源 ID 列表（从配置加载）
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  // sourceId → sourceName 映射（用于面板显示）
  const [sourceNameMap, setSourceNameMap] = useState<Map<string, string>>(new Map());
  // 当前活跃的 CMS 源 ID（点击时立即设置，不等 API 响应）
  const [activeSourceId, setActiveSourceId] = useState<string | undefined>();

  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    cms: true,
    season: true,
    episodes: true,
  });

  const [selectedSeason, setSelectedSeason] = useState(1);
  const seasonChangedRef = useRef(false);
  // selectedSeason 的 ref，避免 fetchCMSSources 依赖变化
  const selectedSeasonRef = useRef(selectedSeason);
  selectedSeasonRef.current = selectedSeason;

  // CMS 搜索到的季列表（替代 TMDB seasons[] 渲染选季面板）
  const [cmsSeasons, setCmsSeasons] = useState<{ season_number: number; name: string; episode_count: number }[]>([]);

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
  // CMS 源配置 ID（域名 key）和名称，用于匹配和展示
  const cmsSourceIdRef = useRef<string | undefined>(undefined);
  const cmsSourceNameRef = useRef<string | undefined>(undefined);
  // 渲染阶段通过 source URL 在 video 数据中精确匹配源名称
  if (currentSrc && video) {
    const url = currentSrc.url;
    const match = video.sources.find(s => s.url === url)
      ?? video.episodes?.flatMap(e => e.sources).find(s => s.url === url);
    if (match?.name) currentSourceNameRef.current = match.name;
  }



  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const loadVideo = async () => {
      if (!id) return;

      // 清除该视频的旧缓存，确保每次进入播放页获取最新数据
      videoCache.delete(id);

      setLoadError(null);

      // 提前读取历史记录：cmsSourceId 用于恢复 CMS 源
      // skipHistory（从头播放）时跳过历史记录，使用默认源和第一集
      // routeSourceIndex（直链搜索跳转）优先级最高
      let activeSourceIndex = routeSourceIndex ?? videoSourceIndex;
      let historyRecord: HistoryRecord | undefined;
      if (!skipHistory) {
        try {
          const history = await getHistory();
          historyRecord = history.find(h => h.videoId === id);
          if (historyRecord?.cmsSourceId || historyRecord?.cmsSourceName) {
            const { getVideoSources } = await import('@/services/sourceService');
            const allSrc = await getVideoSources();
            // 优先用 cmsSourceId 匹配，回退到 cmsSourceName
            const matchedIdx = historyRecord.cmsSourceId
              ? allSrc.findIndex(s => s.id === historyRecord.cmsSourceId)
              : allSrc.findIndex(s => s.name === historyRecord!.cmsSourceName);
            if (matchedIdx >= 0) activeSourceIndex = matchedIdx;
          }
        } catch { /* history read failed, use default */ }
      }
      historyRecordRef.current = historyRecord;

      try {
        let foundVideo: Video | null = videoCache.get(id) ?? null;

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

          // 恢复上次的 CMS 源 ID 和名称
          if (historyRecord?.cmsSourceId) {
            cmsSourceIdRef.current = historyRecord.cmsSourceId;
          }
          if (historyRecord?.cmsSourceName) {
            cmsSourceNameRef.current = historyRecord.cmsSourceName;
          }
          // 恢复选季高亮（按 vodId 匹配，延迟到 fetchCMSSources 中执行）

          let sources = foundVideo.sources;
          let selectedEpisode: Episode | null = null;

          if (foundVideo.episodes && foundVideo.episodes.length > 0) {
            // 按播放 URL 匹配历史记录中的选集（匹配任意线路的 URL）
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
          } else if (!id.startsWith('tmdb-')) {
            // 本地无数据，等待 CMS 搜索
          }
        } else if (!id.startsWith('tmdb-')) {
          // 本地无数据，等待 CMS 搜索
        }
        // 无本地数据时，从历史记录恢复 CMS 源 ID 和名称
        if (!foundVideo) {
          if (historyRecord?.cmsSourceId) cmsSourceIdRef.current = historyRecord.cmsSourceId;
          if (historyRecord?.cmsSourceName) cmsSourceNameRef.current = historyRecord.cmsSourceName;
        }
      } catch {
        if (controller.signal.aborted) return;
        setLoadError('api');
      } finally {
        // 延迟一帧设置，确保 React 先渲染 loading 状态
        if (!controller.signal.aborted) {
          requestAnimationFrame(() => setHasLoadedOnce(true));
        }
      }
    };

    loadVideo();

    return () => {
      controller.abort();
      resetPlayer();
    };
    // zustand actions 引用稳定，不会导致重新执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, videoSourceIndex, currentSourceIndex]);

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

  // 加载设置页中勾选的 CMS 源 ID + 构建源名称映射
  useEffect(() => {
    import('@/services/sourceService').then(mod => {
      mod.getVideoSources().then(sources => {
        // 构建 sourceId → sourceName 映射
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

  const fetchCMSSources = useCallback(async (targetSourceIndex?: number) => {
    if (!id) return;
    cmsAbortRef.current?.abort();
    const ctrl = new AbortController();
    cmsAbortRef.current = ctrl;
    const isSwitching = targetSourceIndex !== undefined;
    setCmsLoading(true);
    if (isSwitching) setCmsSwitching(true);
    setLoadError(null);

    // 切换源时清空旧数据，等新数据就绪后替换
    if (isSwitching) {
      setVideo(null);
      setSources([]);
      setCurrentSrc(null);
      setLocalEpisodeId(undefined);
      currentSourceNameRef.current = undefined;
    }

    // ── 确定要调用的 CMS 源 ──────────────────────────
    let sourceIdx = targetSourceIndex;

    // 1) 历史记录优先（从头播放时跳过）
    if (sourceIdx === undefined && !skipHistory) {
      try {
        const history = await getHistory();
        const histRecord = history.find(h => h.videoId === id);
        if (histRecord?.cmsSourceId || histRecord?.cmsSourceName) {
          const { getVideoSources } = await import('@/services/sourceService');
          const allSrc = await getVideoSources();
          const matchedIdx = histRecord.cmsSourceId
            ? allSrc.findIndex(s => s.id === histRecord.cmsSourceId)
            : allSrc.findIndex(s => s.name === histRecord.cmsSourceName);
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

    // 设置活跃 CMS 源 ID（用于面板高亮）
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
      if (!ctrl.signal.aborted) setCmsLoading(false);
      return;
    }

    // ── 快速恢复路径：有 vodId 时直接调 CMS 详情接口 ──────────
    const histRecord = historyRecordRef.current;
    if (!isSwitching && histRecord?.vodId) {
      try {
        const svc = await import('@/services/videoService');
        const detailVideo = await svc.fetchVideoDetail(sourceIdx, histRecord.vodId);
        if (ctrl.signal.aborted) return;

        if (detailVideo) {
          const { getVideoSources } = await import('@/services/sourceService');
          const allSrc = await getVideoSources();
          cmsSourceIdRef.current = allSrc[sourceIdx]?.id;
          cmsSourceNameRef.current = allSrc[sourceIdx]?.name ?? '';

          videoCache.set(id, detailVideo);
          setVideo(detailVideo);

          // 默认播放第一集
          if (detailVideo.episodes?.length) {
            const firstEp = [...detailVideo.episodes].sort((a, b) => a.number - b.number)[0];
            if (firstEp?.sources.length) {
              setCmsLoading(false);
              setCmsSwitching(false);
              switchToEpisode(firstEp);
              // 后台搜索季列表用于选季面板 + 恢复选季高亮
              searchVideoSeasonsFromSingleSource(sourceIdx, videoTitle, videoYear).then(result => {
                if (!ctrl.signal.aborted) {
                  seasonMapsRef.current.set(sourceIdx, result.seasons);
                  setCmsSeasons(buildCmsSeasons(result.seasons));
                  // 按 vodId 恢复选季高亮
                  if (histRecord.vodId) {
                    for (const [seasonNum, seasonVid] of result.seasons) {
                      if (seasonVid.id === histRecord.vodId) {
                        setSelectedSeason(seasonNum);
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
          // 电影或集不匹配：设置线路
          if (detailVideo.sources.length > 0) {
            setSources(detailVideo.sources);
            const firstSrc = detailVideo.sources[0];
            setCurrentSrc({ url: firstSrc.url, type: firstSrc.type });
            setSource(firstSrc.url, firstSrc.type);
            currentSourceNameRef.current = firstSrc.name;
          }
          setCmsLoading(false);
          setCmsSwitching(false);
          return;
        }
      } catch { /* fall through to normal search path */ }
    }

    // ── TV 剧集按季搜索（CMS 源接口） ──────────────
    // TMDB ID 的 TV 视频：用 CMS 搜索接口获取季数据，不再依赖 TMDB seasons[]
    if (id.startsWith('tmdb-') && tmdbMediaType === 'tv') {
      try {
        // 内存缓存：已搜索过的源直接复用
        let seasonMap = seasonMapsRef.current.get(sourceIdx);

        if (!seasonMap) {
          const seasonResult = await searchVideoSeasonsFromSingleSource(sourceIdx, videoTitle, videoYear);
          seasonMap = seasonResult.seasons;
          seasonMapsRef.current.set(sourceIdx, seasonMap);

          // 更新选季面板数据
          setCmsSeasons(buildCmsSeasons(seasonMap));

          // 存储 VideoDetailResult 供 CMS 面板显示（取第一季的 video 作为代表）
          const firstSeasonVideo = seasonMap.size > 0 ? seasonMap.values().next().value : null;
          const cmsResult: VideoDetailResult = {
            sourceIndex: sourceIdx,
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
          // 有缓存时也更新选季面板
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
                setCmsLoading(false);
                setCmsSwitching(false);
                switchToEpisode(targetEp);
              }
            }
          } else {
            // 选中的季无数据 — 清空，显示"暂无数据"提示
            setVideo(null);
            setSources([]);
            setCurrentSrc(null);
            setLocalEpisodeId(undefined);
            currentSourceNameRef.current = undefined;
          }
          setCmsLoading(false);
          setCmsSwitching(false);
        }
      } catch {
        if (!ctrl.signal.aborted) setLoadError('api');
      } finally {
        if (!ctrl.signal.aborted) {
          setCmsLoading(false);
          setCmsSwitching(false);
        }
      }
      return;
    }

    // ── 电影 / 单季剧集：有 vodId 时按 ID 获取详情，无则按标题搜索 ──
    try {
      // 检查缓存
      const cached = readCmsCache(id, sourceIdx);
      let result: VideoDetailResult;
      if (cached) {
        const { getVideoSources } = await import('@/services/sourceService');
        const allSrc = await getVideoSources();
        const sourceName = allSrc[sourceIdx]?.name ?? '未知';
        result = { sourceIndex: sourceIdx, sourceId: allSrc[sourceIdx]?.id ?? '', sourceName, video: cached };
      } else if (!id?.startsWith('tmdb-')) {
        // CMS 视频：用 vodId 直接调详情接口（ids=）
        const { fetchVideoDetail } = await import('@/services/videoService');
        const detailVideo = await fetchVideoDetail(sourceIdx, id);
        const { getVideoSources } = await import('@/services/sourceService');
        const allSrc = await getVideoSources();
        const sourceName = allSrc[sourceIdx]?.name ?? '未知';
        result = {
          sourceIndex: sourceIdx,
          sourceId: allSrc[sourceIdx]?.id ?? '',
          sourceName,
          video: detailVideo,
        };
        if (result.video) writeCmsCache(id, sourceIdx, result.video);
      } else {
        // TMDB 视频：只能按标题搜索（wd=）
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
                // 先关闭 loading 再切换选集，避免面板 loading 与播放器 buffering 同时出现
                setCmsLoading(false);
                setCmsSwitching(false);
                switchToEpisode(targetEp);
              }
            }
            return;
          }

          // 电影：设置线路列表并自动选中第一个线路
          if (result.video.sources.length > 0) {
            setSources(result.video.sources);
            const firstSrc = result.video.sources[0];
            setCurrentSrc({ url: firstSrc.url, type: firstSrc.type });
            setSource(firstSrc.url, firstSrc.type);
            currentSourceNameRef.current = firstSrc.name;
          }
          // 先关闭 loading 再返回
          setCmsLoading(false);
          setCmsSwitching(false);
        } else {
          // 空结果：保留当前视频，让用户通过侧边栏切换其他源
          setSources([]);
          setCurrentSrc(null);
          currentSourceNameRef.current = undefined;
        }
      }
    } catch {
      if (!ctrl.signal.aborted) setLoadError('api');
    } finally {
      if (!ctrl.signal.aborted) {
        setCmsLoading(false);
        setCmsSwitching(false);
      }
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
    seasonMapsRef.current.clear();
  }, [id, clearAllCmsCache]);

  const handleProgress = useCallback((progress: number, duration: number) => {
    if (id) {
      const v = videoRef.current;
      const activeEpId = localEpisodeIdRef.current;
      const currentEp = v?.episodes?.length ? v.episodes.find((e) => e.id === activeEpId) : undefined;
      const epLabel = currentEp ? `第${currentEp.number}集` : (!v?.episodes?.length && currentSourceNameRef.current ? currentSourceNameRef.current : undefined);
      const vodId = id.startsWith('tmdb-') ? undefined : id;
      updateHistoryProgress(id, progress, duration, v?.title, v?.cover, backdropRef.current, cmsSourceIdRef.current, cmsSourceNameRef.current, epLabel, vodId, currentSrcRef.current?.url);
    }
  }, [id, updateHistoryProgress]);

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
  }, [setSource, setSources]);

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
            // 使用 videoRef.current 而非闭包中的 video，避免倒计时期间 video 更新导致旧引用
            const nextEp = videoRef.current?.episodes?.find(e => e.id === nextEpisodeRef.current);
            if (nextEp) switchToEpisode(nextEp);
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [switchToEpisode]);

  const cancelAutoPlay = useCallback(() => {
    autoPlayCancelRef.current = true;
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setAutoPlayCountdown(null);
    nextEpisodeRef.current = null;
  }, []);

  // 立即播放下一集（跳过倒计时）
  const playNextNow = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    autoPlayCancelRef.current = true;
    setAutoPlayCountdown(null);
    if (nextEpisodeRef.current) {
      const nextEp = videoRef.current?.episodes?.find(e => e.id === nextEpisodeRef.current);
      if (nextEp) switchToEpisode(nextEp);
    }
    nextEpisodeRef.current = null;
  }, [switchToEpisode]);

  // 卸载时清理
  useEffect(() => {
    return () => {
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      if (cmsSwitchTimerRef.current) clearTimeout(cmsSwitchTimerRef.current);
      if (seasonSwitchTimerRef.current) clearTimeout(seasonSwitchTimerRef.current);
      if (episodeSwitchTimerRef.current) clearTimeout(episodeSwitchTimerRef.current);
      if (sourceSwitchTimerRef.current) clearTimeout(sourceSwitchTimerRef.current);
    };
  }, []);

  const handleEnded = useCallback(() => {
    const loopMode = usePlayerStore.getState().loopMode;
    const autoPlayEnabled = useSettingsStore.getState().autoPlay;
    const activeEpId = localEpisodeId;

    // 单集循环：seek 到 0 重新播放
    // 使用 .up-player-video 精确匹配播放器内的 video 元素，避免页面有多个 video 时误操作
    if (loopMode === 'single') {
      const videoEl = document.querySelector<HTMLVideoElement>('.up-player-video');
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
  }, [video, localEpisodeId, startAutoPlayCountdown]);

  const handleBack = useSmartBack(id ? `/detail/${id}` : undefined);

  const togglePanel = (key: string) => {
    setExpandedPanels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePlayEpisode = (ep: Episode) => {
    if (episodeSwitchTimerRef.current) return;
    const matchedEp = video?.episodes?.find(e => e.id === ep.id) ?? ep;
    switchToEpisode(matchedEp);
    episodeSwitchTimerRef.current = setTimeout(() => {
      episodeSwitchTimerRef.current = null;
    }, 300);
  };

  // 点击面板中尚未获取的 CMS 源 → 立即高亮 + 按名称查找索引并获取
  const handleFetchCMSSourceById = useCallback(async (sourceId: string) => {
    // 防抖：300ms 内重复点击忽略
    if (cmsSwitchTimerRef.current) clearTimeout(cmsSwitchTimerRef.current);
    cmsSwitchTimerRef.current = setTimeout(() => {
      cmsSwitchTimerRef.current = null;
    }, 300);

    setActiveSourceId(sourceId);
    if (!id) return;
    const { getVideoSources } = await import('@/services/sourceService');
    const allSrc = await getVideoSources();
    const idx = allSrc.findIndex(s => s.id === sourceId);
    if (idx >= 0) fetchCMSSources(idx);
  }, [id, fetchCMSSources]);

  const handlePlayCMSSource = (result: VideoDetailResult) => {
    // 防抖：300ms 内重复点击忽略
    if (cmsSwitchTimerRef.current) clearTimeout(cmsSwitchTimerRef.current);
    cmsSwitchTimerRef.current = setTimeout(() => {
      cmsSwitchTimerRef.current = null;
    }, 300);

    setActiveSourceId(result.sourceName);
    activeCmsSourceIndexRef.current = result.sourceIndex;

    const activeEpId = localEpisodeId;
    const oldEpisodes = videoRef.current?.episodes ?? [];
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
        // 数据已就绪，直接更新（无闪烁）
        setCmsSeasons(buildCmsSeasons(seasonMap));
        if (seasonVideo.episodes?.length) {
          const matchedEp = currentEpNumber
            ? findEpisodeByNumber(seasonVideo.episodes, currentEpNumber)
            : undefined;
          if (matchedEp?.sources.length) {
            videoCache.set(id!, seasonVideo);
            setVideo(seasonVideo);
            switchToEpisode(matchedEp);
          }
          // 无匹配集时保持当前视频不变，等用户手动选集
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
            switchToEpisode(matchedEp);
            cleanup();
            return;
          }
        }
        cleanup();
        return;
      }

      // 电影：设置线路列表并自动选中第一个线路
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
  };

  // 切换选季：从内存中的季映射表查找对应集数
  const handleSelectSeason = useCallback((seasonNumber: number) => {
    if (seasonSwitchTimerRef.current) return;
    setSelectedSeason(seasonNumber);
    seasonChangedRef.current = true;
    seasonSwitchTimerRef.current = setTimeout(() => {
      seasonSwitchTimerRef.current = null;
    }, 300);

    const sourceIdx = activeCmsSourceIndexRef.current;
    if (sourceIdx === undefined) return;

    const seasonMap = seasonMapsRef.current.get(sourceIdx);
    if (!seasonMap) return;

    // 读取当前播放的集号和历史进度，用于匹配新季
    const activeEpId = localEpisodeId;
    const oldEpisodes = videoRef.current?.episodes ?? [];
    const currentEp = activeEpId ? oldEpisodes.find(ep => ep.id === activeEpId) : undefined;
    const currentEpNumber = currentEp?.number;

    const seasonVideo = seasonMap.get(seasonNumber);
    if (seasonVideo && seasonVideo.episodes?.length) {
      // 有集数：先清空选中集，面板更新为新季的集列表
      setLocalEpisodeId(undefined);
      setSources([]);
      setCurrentSrc(null);

      // 按集号匹配：新季中是否有相同集号
      const matchedEp = currentEpNumber
        ? findEpisodeByNumber(seasonVideo.episodes, currentEpNumber)
        : undefined;

      if (matchedEp?.sources.length) {
        // 有同号集 → 更新视频 + 恢复播放
        videoCache.set(id!, seasonVideo);
        setVideo(seasonVideo);
        switchToEpisode(matchedEp);
      } else {
        // 无同号集 → 视频不更新，等用户手动选集
        // 仅更新面板数据（选季面板已在 setCmsSeasons 中更新）
      }
    } else {
      // 该季无数据 — 清空，显示提示
      setVideo(null);
      setSources([]);
      setCurrentSrc(null);
      setLocalEpisodeId(undefined);
      currentSourceNameRef.current = undefined;
    }
  }, [id, switchToEpisode]);

  const handlePlaySource = useCallback((src: VideoSource) => {
    if (sourceSwitchTimerRef.current) return;
    setCurrentSrc({ url: src.url, type: src.type });
    setSource(src.url, src.type);
    currentSourceNameRef.current = src.name;
    sourceSwitchTimerRef.current = setTimeout(() => {
      sourceSwitchTimerRef.current = null;
    }, 300);
  }, [setSource]);

  const episodes = video?.episodes
    ? [...video.episodes].sort((a, b) => a.number - b.number)
    : [];

  const activeEpId = localEpisodeId;
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
      <div className="player-page">
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
                <p className={`player-detail-overview${overviewExpanded ? ' player-detail-overview--expanded' : ''}`}>{overview}</p>
                <button className="player-overview-toggle" onClick={() => setOverviewExpanded(!overviewExpanded)}>
                  {overviewExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{overviewExpanded ? '收起' : '展开全文'}</span>
                </button>
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
      <div className="player-page">
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

  if (!video && !cmsSwitching && !cmsLoading) {
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
      <div className="player-page">
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
    <div className="player-page">
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
