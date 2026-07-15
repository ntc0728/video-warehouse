/**
 * 视频详情页面 — ouonnki 设计风格
 *
 * Hero：全屏 backdrop + 双层渐变 + logo/标签/简介 + 毛玻璃按钮 + 桌面端右侧海报
 * 内容区：三 Tab（基础信息/播放列表/季信息）+ VideoCard 推荐行
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore, useSettingsStore, useNavStore } from '@/stores';
import { useHeaderContent } from '@/components/Layout/useHeaderContent';
import { searchVideoFromMultipleSources } from '@/services/videoService';
import { fetchMovieDetail, fetchTVDetail, fetchMovieImages, fetchTVImages, buildImageUrl } from '@/services/tmdbService';
import { useSmartBack } from '@/lib/navigation';
import type { Video } from '@/types/video';
import type { VideoDetailResult } from '@/services/videoService';
import type { TMDBMovieDetail, TMDBTVShowDetail, TMDBSeason, TMDBCastMember } from '@/types/tmdb';
import { AppLoading, BackToTopButton } from '@/components/common';
import { useDocumentTitle } from '@/hooks';
import { VideoCard } from '@/components/VideoCard';
import StillsLightbox from '@/components/StillsLightbox/StillsLightbox';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import {
  Play, Heart, Star, Calendar, ArrowLeft,
  Info, ListVideo, Layers, AlertTriangle, WifiOff,
  RefreshCw, Server, ExternalLink,
} from 'lucide-react';
import './Detail.css';

// ── 常量 ──────────────────────────────────────────────

const CMS_DEBOUNCE_MS = 2000;

const typeLabels: Record<string, string> = {
  movie: '电影', tv: '剧集', variety: '综艺', anime: '动漫',
};

type DetailTab = 'info' | 'sources' | 'seasons';

// ── 映射 TMDB → VideoCard 兼容格式 ────────────────────

type TMDBResultItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  overview: string;
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
    description: item.overview,
    actors: [],
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ============================================================
export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { videoSourceIndex, videoSourceIndices } = useSettingsStore();
  const { isCollected, addCollection, removeCollection, getHistoryByVideo } = useUserStore();

  // ── 非沉浸式 Header（hero 不被导航栏覆盖） ──
  useHeaderContent();

  // ── 智能回退 ──────────────────────────────
  const handleBack = useSmartBack('/');

  // ── 滚动位置保存/恢复（由 useScrollRestore 接管，原内联 useEffect 已删除） ────
  useScrollRestore(`detail:${id}`);

  // ── 状态 ──────────────────────────────────────
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const visitedTabsRef = useRef(new Set<DetailTab>(['info']));

  const [tmdbLoading, setTmdbLoading] = useState(true);
  const [tmdbDetail, setTmdbDetail] = useState<TMDBMovieDetail | TMDBTVShowDetail | null>(null);
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [tmdbMediaType, setTmdbMediaType] = useState<'movie' | 'tv'>('movie');

  // 剧照
  const [stills, setStills] = useState<string[]>([]);
  const [stillsLoading, setStillsLoading] = useState(false);

  // 剧照灯箱
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // 演员折叠（移动端默认折叠，桌面端始终展开）
  const [castExpanded, setCastExpanded] = useState(false);

  // CMS
  const [cmsResults, setCmsResults] = useState<VideoDetailResult[]>([]);
  const [cmsLoading, setCmsLoading] = useState(false);
  const [cmsLoaded, setCmsLoaded] = useState(false);
  const [cmsError, setCmsError] = useState<string | null>(null);
  const cmsLastFetchRef = useRef(0);
  const cmsAbortRef = useRef<AbortController | null>(null);

  // 剧照网格：根据容器实际宽度计算列数，限制显示 2 行
  const stillsGridRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(Number.MAX_SAFE_INTEGER);
  useEffect(() => {
    if (stills.length === 0) return;
    const container = stillsGridRef.current;
    if (!container) return;

    const calc = () => {
      const w = container.clientWidth;
      if (w <= 0) return;
      // 直接读取 CSS grid 实际列数（auto-fill + minmax 的列数由浏览器计算，JS 估算不可靠）
      const computed = getComputedStyle(container);
      const templateCols = computed.gridTemplateColumns;
      const actualCols = templateCols ? templateCols.split(' ').length : 1;
      setVisibleCount(actualCols * 2);
    };

    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(container);
    return () => ro.disconnect();
  }, [stills.length]);

  // ── 页面状态持久化（返回时不重载 / tab 不重置） ──
  const restoredRef = useRef(false);
  const stateRef = useRef<Record<string, unknown>>({});

  // ── TMDB 加载 ────────────────────────────────
  useEffect(() => {
    if (!id) return;
    restoredRef.current = false;
    const ctrl = new AbortController();
    setTmdbLoading(true); setTmdbError(null);
    setCmsLoaded(false); setCmsResults([]); setCmsError(null);
    setActiveTab('info');

    (async () => {
      try {
        if (!id.startsWith('tmdb-')) { setTmdbError('暂仅支持 TMDB 影片'); return; }
        const parts = id.replace('tmdb-', '').split('-');
        const mt = parts[0] as 'movie' | 'tv';
        const tid = parseInt(parts.slice(1).join('-'), 10);
        setTmdbMediaType(mt);
        if (isNaN(tid)) { setTmdbError('无效的 TMDB ID'); return; }
        const detail = mt === 'tv'
          ? await fetchTVDetail(tid, { signal: ctrl.signal })
          : await fetchMovieDetail(tid, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        setTmdbDetail(detail);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setTmdbError(err instanceof Error ? err.message : '加载失败');
      } finally { if (!ctrl.signal.aborted) setTmdbLoading(false); }
    })();

    return () => ctrl.abort();
  }, [id]);

  // ── CMS 按需加载 ─────────────────────────────
  const fetchCMSSources = useCallback(async () => {
    if (!id || !tmdbDetail) return;
    const now = Date.now();
    if (now - cmsLastFetchRef.current < CMS_DEBOUNCE_MS) return;
    cmsLastFetchRef.current = now;
    if (cmsAbortRef.current) cmsAbortRef.current.abort();
    const ctrl = new AbortController();
    cmsAbortRef.current = ctrl;
    setCmsLoading(true); setCmsError(null); setCmsResults([]);

    const indices = videoSourceIndices && videoSourceIndices.length > 0
      ? videoSourceIndices
      : [videoSourceIndex];

    const videoTitle = title || '';
    const videoYear = year;

    try {
      const results = await searchVideoFromMultipleSources(indices, videoTitle, videoYear);
      if (ctrl.signal.aborted) return;

      setCmsResults(results);
      setCmsLoaded(true);
    } catch (err) {
      if (!ctrl.signal.aborted) setCmsError(err instanceof Error ? err.message : '获取播放源失败');
    } finally {
      if (!ctrl.signal.aborted) setCmsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tmdbDetail, videoSourceIndex, videoSourceIndices]);

  useEffect(() => {
    if (activeTab === 'sources' && !cmsLoaded && !cmsLoading) fetchCMSSources();
  }, [activeTab, cmsLoaded, cmsLoading, fetchCMSSources]);

  useEffect(() => () => cmsAbortRef.current?.abort(), []);

  // ── 剧照加载 ─────────────────────────────────────
  useEffect(() => {
    if (!tmdbDetail || !id) return;
    if (!id.startsWith('tmdb-')) return;
    const parts = id.replace('tmdb-', '').split('-');
    const mt = parts[0] as 'movie' | 'tv';
    const tid = parseInt(parts.slice(1).join('-'), 10);
    if (isNaN(tid)) return;

    const ctrl = new AbortController();
    setStillsLoading(true);

    (async () => {
      try {
        const images = mt === 'tv'
          ? await fetchTVImages(tid, { signal: ctrl.signal })
          : await fetchMovieImages(tid, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        const urls = (images.backdrops || [])
          .map((b) => buildImageUrl(b.file_path, 'w1280'))
          .filter((u): u is string => Boolean(u));
        setStills(urls);
      } catch {
        if (!ctrl.signal.aborted) setStills([]);
      } finally {
        if (!ctrl.signal.aborted) setStillsLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [tmdbDetail, id]);

  // ── 页面状态保存（离开后返回恢复） ─────────────
  useEffect(() => {
    if (!id) return;
    useNavStore.getState().saveState(`detail:${id}`, { tab: activeTab });
  }, [activeTab, id]);

  // ── 收藏 ──────────────────────────────────────
  const collected = id ? isCollected(id) : false;
  const handleCollect = useCallback(() => {
    if (!id) return;
    if (collected) removeCollection(id);
    else addCollection(id, { title, cover: posterUrl, type: tmdbMediaType, year, rating: voteAverage });
    // title/cover/... 是 useMemo 派生量，闭包跟随 tmdbDetail 渲染而更新；此处只在点击时读取，不在 effect 中使用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, collected, addCollection, removeCollection, tmdbDetail]);

  // ── 播放 ──────────────────────────────────────
  const handlePlay = () => { if (id) navigate(`/play/${id}`, { state: { from: `/detail/${id}` }, viewTransition: true }); };
  const handlePlayFromBeginning = () => { if (id) navigate(`/play/${id}`, { state: { from: `/detail/${id}`, skipHistory: true }, viewTransition: true }); };

  // ── 派生数据 ──────────────────────────────────
  const d = tmdbDetail;
  let title: string | undefined;
  if (d) {
    if ('name' in d) title = d.name;
    else if ('title' in d) title = d.title;
  }

  // ── 动态页签标题 ──────────────────────────────
  useDocumentTitle(title || null);

  const isTV = d ? 'name' in d : false;
  const logoPath = d?.images?.logos?.find((l) => l.iso_639_1 === 'zh' || l.iso_639_1 === 'en')?.file_path;
  let year: number | undefined;
  if (d && tmdbMediaType === 'tv') {
    const dateStr = (d as TMDBTVShowDetail).first_air_date;
    year = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
  } else if (d && tmdbMediaType === 'movie') {
    const dateStr = (d as TMDBMovieDetail).release_date;
    year = dateStr ? new Date(dateStr).getFullYear() || undefined : undefined;
  }
  const backdropUrl = d?.backdrop_path ? buildImageUrl(d.backdrop_path, 'w1280') || '' : '';
  const posterUrl = d?.poster_path ? buildImageUrl(d.poster_path, 'w342') || '' : '';
  const [bgLoaded, setBgLoaded] = useState(false);
  // 背景图加载超时：3 秒后强制显示内容，不阻塞用户交互
  const bgTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (bgLoaded) { if (bgTimeoutRef.current) clearTimeout(bgTimeoutRef.current); return; }
    bgTimeoutRef.current = setTimeout(() => setBgLoaded(true), 10000);
    return () => { if (bgTimeoutRef.current) clearTimeout(bgTimeoutRef.current); };
  }, [bgLoaded]);
  const overview = d?.overview || '';
  const voteAverage: number = d?.vote_average ?? 0;
  const voteCount: number = d?.vote_count ?? 0;
  const popularity: number = d?.popularity ?? 0;
  const runtime = isTV ? (d as TMDBTVShowDetail | undefined)?.episode_run_time?.[0] : (d as TMDBMovieDetail | undefined)?.runtime;
  const countries = d?.production_countries?.map((c) => c.name) || [];
  const companies = d?.production_companies?.slice(0, 3) || [];
  const cast: TMDBCastMember[] = d?.credits?.cast || [];
  const director = d?.credits?.crew?.find((c) => c.job === 'Director')?.name;
  const genres = d?.genres || [];
  const status = d?.status || '';
  const originalLanguage = d?.original_language || '';
  const spokenLanguages = d?.spoken_languages?.map((l) => l.name || l.english_name) || [];
  const tvDetail = isTV ? (d as TMDBTVShowDetail) : undefined;
  const createdBy = tvDetail?.created_by?.map((c) => c.name) || [];
  const inProduction = tvDetail?.in_production;
  const lastAirDate = tvDetail?.last_air_date || '';
  const seasons: TMDBSeason[] = isTV ? ((d as TMDBTVShowDetail | undefined)?.seasons || []) : [];
  const totalSeasons = isTV ? ((d as TMDBTVShowDetail | undefined)?.number_of_seasons || 0) : 0;
  const totalEpisodes = isTV ? ((d as TMDBTVShowDetail | undefined)?.number_of_episodes || 0) : 0;
  const similarResults: TMDBResultItem[] = d?.similar?.results?.slice(0, 12) || [];
  const recommendedResults: TMDBResultItem[] = d?.recommendations?.results?.slice(0, 12) || [];
  const homepage = d?.homepage || '';

  // ── 观看历史与进度 ──────────────────────────────
  const historyRecord = id ? getHistoryByVideo(id) : undefined;
  const hasWatchingHistory = !!historyRecord && historyRecord.progress > 0;
  const watchProgressPercent = hasWatchingHistory && historyRecord.duration > 0
    ? Math.round((historyRecord.progress / historyRecord.duration) * 100)
    : 0;
  const lastEpisodeLabel = historyRecord?.episodeLabel;

  // ── 页面状态快照 ──────────────────────────────
  stateRef.current = { cmsError, tmdbDetail, tmdbMediaType, tmdbLoading, tmdbError, bgLoaded };

  useEffect(() => {
    if (!id) return;
    const saved = useNavStore.getState().getState(`detail:${id}`);
    if (saved) {
      restoredRef.current = true;
      const data = saved as Record<string, unknown>;
      // tab 不恢复，确保切换电影时重置到概览
      if (data.cmsError !== undefined) setCmsError(data.cmsError as string | null);
      if (data.tmdbDetail) setTmdbDetail(data.tmdbDetail as TMDBMovieDetail | TMDBTVShowDetail);
      if (data.tmdbMediaType) setTmdbMediaType(data.tmdbMediaType as 'movie' | 'tv');
      if (data.tmdbLoading !== undefined) setTmdbLoading(data.tmdbLoading as boolean);
      if (data.tmdbError !== undefined) setTmdbError(data.tmdbError as string | null);
      if (data.bgLoaded !== undefined) setBgLoaded(data.bgLoaded as boolean);
    }
  }, [id]);

  useEffect(() => {
    return () => {
      if (!id) return;
      useNavStore.getState().saveState(`detail:${id}`, stateRef.current);
    };
  }, [id]);

  // ── Loading ──────────────────────────────────
  if (tmdbLoading) return <div className="page-padding detail-page detail-page--loading"><AppLoading /></div>;

  // ── Error ────────────────────────────────────
  if (tmdbError || !tmdbDetail) {
    return (
      <div className="page-padding detail-page">
        <div className="detail-not-found">
          <AlertTriangle size={48} />
          <span>{tmdbError || '影片不存在'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-padding detail-page" key={id}>
      {/* ══════════════════════════════════════════════
          HERO：全屏 backdrop + 双层渐变
          ══════════════════════════════════════════════ */}
      <section className={`detail-hero${bgLoaded ? '' : ' detail-hero--skeleton'}`}>
        {backdropUrl && (
          <img className="detail-hero-bg" src={backdropUrl} alt="" width={1920} height={1080} onLoad={() => setBgLoaded(true)} />
        )}
        {/* 双层渐变遮罩 */}
        <div className="detail-hero-gradient detail-hero-gradient-1" />
        <div className="detail-hero-gradient detail-hero-gradient-2" />

        {/* 返回按钮 */}
        <button className="detail-hero-back" onClick={handleBack} aria-label="返回">
          <ArrowLeft size={18} />
          <span>返回</span>
        </button>

        {/* 官网链接 */}
        {homepage && (
          <a href={homepage} target="_blank" rel="noreferrer" className="detail-official-link">
            <ExternalLink size={16} />
            <span>官方页面</span>
          </a>
        )}

        {/* Hero 内容 */}
        <div className="detail-hero-content">
          <div className="detail-hero-left">
            {/* Logo 或标题 */}
            {logoPath ? (
              <img className="detail-hero-logo" src={buildImageUrl(logoPath, 'w500') || ''} alt={title} width={400} height={150} />
            ) : (
              <h1 className="detail-hero-title">{title}</h1>
            )}
            {/* 标语 */}
            {d?.tagline && <p className="detail-hero-tagline">{d.tagline}</p>}

            {/* Meta 行（对齐轮播图风格） */}
            <div className="detail-hero-meta">
              <span className="detail-hero-rating">★ {voteAverage > 0 ? voteAverage.toFixed(1) : ''}</span>
              {year && <span className="detail-hero-meta-item">{year}</span>}
              <span className="detail-hero-meta-item detail-hero-meta-item--type">
                {typeLabels[tmdbMediaType]}
              </span>
              {tmdbMediaType === 'tv' && totalSeasons > 0 && (
                <span className="detail-hero-meta-item">{totalSeasons} 季 / {totalEpisodes} 集</span>
              )}
              {runtime && <span className="detail-hero-meta-item">{runtime} 分钟</span>}
              {popularity > 0 && (
                <span className="detail-hero-meta-item">🔥 {popularity.toFixed(0)}</span>
              )}
            </div>

            {/* 简介 */}
            {overview && <p className="detail-hero-desc">{overview}</p>}

            {/* 操作按钮 */}
            <div className="detail-hero-actions">
              <button className="detail-btn detail-btn-play" onClick={handlePlay}>
                <Play size={18} fill="currentColor" />
                {hasWatchingHistory ? '继续播放' : '立即播放'}
              </button>
              {hasWatchingHistory && (
                <button className="detail-btn detail-btn-play-from-start" onClick={handlePlayFromBeginning}>
                  从头播放
                </button>
              )}
              <button className={`detail-btn detail-btn-collect ${collected ? 'active' : ''}`} onClick={handleCollect} aria-pressed={collected}>
                <Heart size={18} fill={collected ? 'var(--color-favorite-active)' : 'none'}
                  color={collected ? 'var(--color-favorite-active)' : 'currentColor'} />
                {collected ? '已收藏' : '加入收藏'}
              </button>
            </div>

            {/* 观看进度 */}
            {hasWatchingHistory && (
              <div className="detail-progress-row">
                <span className="detail-progress-label">
                  {lastEpisodeLabel && tmdbMediaType === 'tv'
                    ? `已播放：${lastEpisodeLabel}`
                    : '已播放'}
                </span>
                <span className="detail-progress-time">
                  {watchProgressPercent}% · {formatProgressTime(historyRecord.progress)} / {formatProgressTime(historyRecord.duration)}
                </span>
              </div>
            )}
          </div>

          {/* 桌面端右侧海报 */}
          {posterUrl && (
            <div className="detail-hero-poster">
              <img src={posterUrl} alt={title} width={300} height={450} />
              {hasWatchingHistory && (
                <div className="detail-hero-poster-progress">
                  <div
                    className="detail-hero-poster-progress-bar"
                    style={{ width: `${watchProgressPercent}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          Tab 导航（-mt-px 与 hero 重叠）
          ══════════════════════════════════════════════ */}
      <div className="detail-tabs-wrap">
        <div className="detail-tabs">
          {([
            { key: 'info' as DetailTab, icon: Info, label: '概览' },
            { key: 'sources' as DetailTab, icon: ListVideo, label: '播放列表' },
            ...(tmdbMediaType === 'tv' ? [{ key: 'seasons' as DetailTab, icon: Layers, label: '季信息' }] : []),
          ]).map((tab) => (
            <button
              key={tab.key}
              className={`tab-underline detail-tab ${activeTab === tab.key ? 'tab-underline--active detail-tab--active' : ''}`}
              onClick={() => {
                visitedTabsRef.current.add(tab.key);
                setActiveTab(tab.key);
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          Tab 内容区
          ══════════════════════════════════════════════ */}
      <div className="detail-content">
        {/* 概览 */}
        {activeTab === 'info' && (
          <div className="detail-info">
            <h2 className="detail-section-title">基础信息</h2>
            {/* 类型标签 */}
            {genres.length > 0 && (
              <div className="detail-genres">
                {genres.map((g) => (
                  <span key={g.id} className="detail-genre-tag">{g.name}</span>
                ))}
              </div>
            )}
            <div className="detail-info-grid">
              {year && <div className="detail-info-card"><Calendar size={16} /><span>发行年份</span><strong>{year}</strong></div>}
              {status && <div className="detail-info-card"><Info size={16} /><span>状态</span><strong>{statusLabel(status)}</strong></div>}
              {runtime && <div className="detail-info-card"><ClockIcon size={16} /><span>时长</span><strong>{runtime} 分钟</strong></div>}
              {originalLanguage && <div className="detail-info-card"><GlobeIcon size={16} /><span>语言</span><strong>{originalLanguage.toUpperCase()}{spokenLanguages.length > 0 ? ` / ${spokenLanguages.slice(0, 3).join(' / ')}` : ''}</strong></div>}
              {voteAverage > 0 && (
                <div className="detail-info-card">
                  <Star size={16} />
                  <span>TMDB 评分</span>
                  <strong>{voteAverage.toFixed(1)} / 10{voteCount > 0 && <span className="detail-vote-count">（{formatVoteCount(voteCount)} 人评价）</span>}</strong>
                </div>
              )}
              {director && <div className="detail-info-card"><UsersIcon size={16} /><span>导演</span><strong>{director}</strong></div>}
              {isTV && createdBy.length > 0 && <div className="detail-info-card"><UsersIcon size={16} /><span>主创</span><strong>{createdBy.join(' / ')}</strong></div>}
              {countries.length > 0 && <div className="detail-info-card"><GlobeIcon size={16} /><span>国家</span><strong>{countries.join(' / ')}</strong></div>}
              {d && tmdbMediaType === 'movie' && (d as TMDBMovieDetail).budget > 0 && <div className="detail-info-card"><DollarIcon size={16} /><span>预算</span><strong>{formatCurrency((d as TMDBMovieDetail).budget)}</strong></div>}
              {d && tmdbMediaType === 'movie' && (d as TMDBMovieDetail).revenue > 0 && <div className="detail-info-card"><DollarIcon size={16} /><span>票房</span><strong>{formatCurrency((d as TMDBMovieDetail).revenue)}</strong></div>}
              {isTV && <div className="detail-info-card"><Layers size={16} /><span>季 / 集</span><strong>{totalSeasons} 季 / {totalEpisodes} 集</strong></div>}
              {isTV && inProduction !== undefined && <div className="detail-info-card"><RefreshCw size={16} /><span>制作中</span><strong>{inProduction ? '是' : '已完结'}</strong></div>}
              {isTV && lastAirDate && <div className="detail-info-card"><Calendar size={16} /><span>最后播出</span><strong>{lastAirDate}</strong></div>}
            </div>

            {/* 发行公司 — 独立一行 */}
            {companies.length > 0 && (
              <div className="detail-info-row">
                <FilmIcon size={16} />
                <span>发行</span>
                <strong className="detail-companies">
                  {companies.map((c) => (
                    <span key={c.id} className="detail-company">
                      {c.logo_path && <img src={buildImageUrl(c.logo_path, 'w92') || ''} alt={c.name} className="detail-company-logo" />}
                      {c.name}
                    </span>
                  ))}
                </strong>
              </div>
            )}

            {cast.length > 0 && (
              <>
                <h3 className="detail-section-subtitle">演员</h3>
                <div className={`detail-cast-row${!castExpanded ? ' detail-cast-row--collapsed' : ''}`}>
                  {cast.map((c) => (
                    <a
                      key={c.id}
                      href={`/person/${c.id}`}
                      className="detail-cast-item"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/person/${c.id}`, { state: { from: `/detail/${id}` }, viewTransition: true });
                      }}
                    >
                      {c.profile_path ? (
                        <img src={buildImageUrl(c.profile_path, 'w185') || ''} alt={c.name} width={200} height={300} />
                      ) : (
                        <span className="detail-cast-avatar"><UsersIcon size={18} /></span>
                      )}
                      <span className="detail-cast-name">{c.name}</span>
                      <span className="detail-cast-role">{c.character}</span>
                    </a>
                  ))}
                </div>
                {cast.length > 8 && (
                  <button className="detail-cast-toggle" onClick={() => setCastExpanded(!castExpanded)}>
                    {castExpanded ? '收起' : `展开全部 ${cast.length} 位演员`}
                  </button>
                )}
              </>
            )}

            {overview && (
              <>
                <h3 className="detail-section-subtitle">简介</h3>
                <p className="detail-overview-full">{overview}</p>
              </>
            )}

            {(stills.length > 0 || stillsLoading) && (
              <>
                <h3 className="detail-section-subtitle">剧照</h3>
                {stillsLoading ? (
                  <div className="detail-stills-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="detail-stills-skeleton" />
                    ))}
                  </div>
                ) : (
                   <div
                    ref={stillsGridRef}
                    className={`detail-stills-grid${visibleCount < Number.MAX_SAFE_INTEGER ? ' detail-stills-grid--limited' : ''}`}
                  >
                    {stills.slice(0, visibleCount < Number.MAX_SAFE_INTEGER ? visibleCount : undefined).map((url, i) => {
                      const isLast = visibleCount < Number.MAX_SAFE_INTEGER && i === visibleCount - 1 && stills.length > visibleCount;
                      return (
                        <div
                          key={url}
                          className={`detail-stills-item${isLast ? ' detail-stills-item--more' : ''}`}
                          onClick={() => {
                            setLightboxIndex(i);
                            setLightboxOpen(true);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setLightboxIndex(i);
                              setLightboxOpen(true);
                            }
                          }}
                        >
                          <img
                            src={url}
                            alt={`剧照 ${i + 1}`}
                            loading="lazy"
                            width={1280}
                            height={720}
                          />
                          {isLast && (
                            <div className="detail-stills-more">
                              <span className="detail-stills-more__count">+{stills.length - visibleCount}</span>
                              <span className="detail-stills-more__text">查看更多</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 播放列表 */}
        {activeTab === 'sources' && (
          <div className="detail-sources">
            {cmsLoading ? (
              <div className="playlist-skeleton" aria-busy="true" aria-label="加载播放列表中">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="playlist-skeleton-row" />
                ))}
              </div>
            ) : cmsError ? (
              <div className="detail-state detail-state--error">
                <WifiOff size={32} /><p>{cmsError}</p>
                <span>请检查网络连接或更换 CMS 视频源</span>
                <button className="retry-btn retry-btn--outlined" onClick={fetchCMSSources}><RefreshCw size={14} /> 重新获取</button>
              </div>
            ) : cmsResults.length > 0 ? (
              <div className="detail-sources-container">
                <div className="detail-sources-header">
                  <div className="detail-sources-header-left">
                    <h3>匹配结果</h3>
                    <span className="detail-sources-keyword">当前关键词："{title}"</span>
                  </div>
                  <button className="retry-btn retry-btn--outlined" style={{ alignSelf: 'center', marginTop: 0 }} onClick={fetchCMSSources}>
                    <RefreshCw size={14} /> 重新匹配
                  </button>
                </div>
                <div className="detail-sources-grid">
                  {cmsResults.map((result) => (
                    result.video && (
                      <div key={result.sourceIndex} className="detail-source-group">
                        <div className="detail-source-group-header">
                          <div className="detail-source-group-title">
                            <span className="detail-source-name">{result.sourceName}</span>
                          </div>
                        </div>
                        <div className="detail-source-group-body">
                          <div className="detail-source-thumb">
                            {result.video.cover ? (
                              <>
                                <img src={result.video.cover} alt={result.video.title} />
                                {result.video.year && (
                                  <span className="detail-source-thumb-year">{result.video.year}</span>
                                )}
                              </>
                            ) : (
                              <div className="detail-source-thumb-placeholder">
                                <Server size={20} />
                              </div>
                            )}
                          </div>
                          <div className="detail-source-info">
                            <span className="detail-source-title">{result.video.title}</span>
                            <button
                              className="detail-source-play-btn"
                              onClick={() => navigate(`/play/${id}`, { state: { from: `/detail/${id}`, sourceIndex: result.sourceIndex }, viewTransition: true })}
                            >
                              <Play size={12} fill="currentColor" /> 立即播放
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
                {cmsResults.some(r => r.error) && (
                  <div className="detail-source-errors">
                    {cmsResults.filter(r => r.error).map(r => (
                      <div key={r.sourceIndex} className="detail-source-error-item">
                        <AlertTriangle size={12} />
                        <span>{r.sourceName}: {r.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="detail-state">
                <Server size={32} /><p>暂无匹配的播放资源</p>
                <span>请检查网络连接或更换 CMS 视频源</span>
                <button className="retry-btn retry-btn--outlined" onClick={fetchCMSSources}><RefreshCw size={14} /> 重新获取</button>
              </div>
            )}
          </div>
        )}

        {/* 季信息 */}
        {activeTab === 'seasons' && tmdbMediaType === 'tv' && (
          <div className="detail-seasons">
            {seasons.filter((s) => s.season_number > 0).map((s) => (
              <div key={s.id} className="detail-season-card">
                <div className="detail-season-poster">
                  {s.poster_path ? (
                    <img src={buildImageUrl(s.poster_path, 'w300') || ''} alt={s.name} width={300} height={450} />
                  ) : (
                    <span className="detail-cast-avatar"><Layers size={22} /></span>
                  )}
                </div>
                <div className="detail-season-info">
                  <h4 title={s.name}>{s.name}</h4>
                  <span>{s.episode_count} 集</span>
                  {s.air_date && <span>{s.air_date}</span>}
                  {s.overview && <p title={s.overview}>{s.overview}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          你可能还喜欢（VideoCard 横向推荐行）
          ══════════════════════════════════════════════ */}
      {similarResults.length > 0 && (
        <section className="detail-recommend">
          <h2 className="detail-recommend-title">相关推荐</h2>
          <div className="detail-recommend-row">
            {similarResults.map((item) => (
              <div key={item.id} className="detail-recommend-card">
                <VideoCard video={toVideoItem(item, tmdbMediaType)} rating={item.vote_average} />
              </div>
            ))}
          </div>
        </section>
      )}

      {recommendedResults.length > 0 && (
        <section className="detail-recommend">
          <h2 className="detail-recommend-title">你可能还喜欢</h2>
          <div className="detail-recommend-row">
            {recommendedResults.map((item) => (
              <div key={item.id} className="detail-recommend-card">
                <VideoCard video={toVideoItem(item, tmdbMediaType)} rating={item.vote_average} />
              </div>
            ))}
          </div>
        </section>
      )}

      <BackToTopButton />

      <StillsLightbox
        urls={stills}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

// ── 辅助函数 ──────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatCurrency(value?: number): string {
  if (!value) return '-';
  return currencyFormatter.format(value);
}

const statusLabels: Record<string, string> = {
  Rumored: '传闻',
  Planned: '计划中',
  'In Production': '制作中',
  Post: '后期制作',
  Released: '已上映',
  Canceled: '已取消',
  Returning: '连载中',
  Ended: '已完结',
  Pilot: '试播集',
};

function statusLabel(status: string): string {
  return statusLabels[status] || status;
}

function formatVoteCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

/** 格式化进度时间（秒 → mm:ss 或 hh:mm:ss） */
function formatProgressTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ── 内联图标组件（避免过多 import） ──────────────

function ClockIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function UsersIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function GlobeIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>;
}
function FilmIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20"/><path d="M17 2v20"/><path d="M2 12h20"/><path d="M2 7h5"/><path d="M2 17h5"/><path d="M17 17h5"/><path d="M17 7h5"/></svg>;
}
function DollarIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
