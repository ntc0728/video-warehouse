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

/**
 * CMS 请求超时兜底（ms）：接口 hang / 重试过久时强制中断并结束加载态。
 * 没有它，切源失败会把播放器永久留在加载中。
 */
const CMS_FETCH_TIMEOUT_MS = 20_000;

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
  /** 详情页「全部」弹窗直达：目标集号（URL 精确匹配落空时按（季,集号）兜底，2026-10-11） */
  routeEpisodeNumber?: number;
}

export function useCMSSourceManager(opts: UseCMSSourceManagerOptions) {
  const {
    id, video, setVideo, tmdbDetail, tmdbMediaType,
    setTmdbDetail, setTmdbMediaType, onTmdbReady,
    selectedSeason, setSelectedSeason, selectedSeasonRef, seasonChangedRef,
    cmsSourceIdRef, cmsSourceNameRef, currentSourceNameRef,
    setCurrentSrc, setLocalEpisodeId, videoCache,
    routeSourceIndex, activeSourceIndex, skipHistory, onSwitchEpisode, handlePlaySource,
    routePlayUrl, routeSeasonNumber, routeEpisodeNumber,
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
  // 请求序号：区分「被新请求取代的 abort」与「超时/失败的 abort」。
  // 只有持有最新序号的请求才允许写状态与收尾——否则旧请求返回后回写，会把用户
  // 刚点的新源选中态覆盖掉（表现为「接口没响应完就连点切源 → 选中态消失」）。
  const reqSeqRef = useRef(0);
  const activeCmsSourceIndexRef = useRef<number | undefined>(undefined);
  const seasonMapsRef = useRef<Map<number, Map<number, Video>>>(new Map());
  const cmsSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchInitiatedRef = useRef(false);
  // 聚合探测进行中标记（2026-10-11 用户定稿）：播放器能否正常播放的判定（源死亡
  // failover / 空态）必须等**所有 CMS 源响应结束**后再做——用首批不完整结果过早
  // 标记/跳过会误报「播放失败/无数据」。消费方：Player index 的 handlePlayerError
  // 挂起 + probeSettledSeq 重放。
  const probeActiveRef = useRef(false);
  const [probeSettledSeq, setProbeSettledSeq] = useState(0);
  // 缓存剧名/年份，供"按需重建季映射"复用（切源/切季懒加载兜底时无需重新计算）
  const videoTitleRef = useRef<string>('');
  const videoYearRef = useRef<number | undefined>(undefined);

  // ── fetchCMSSources ──────────────────────────────
  /**
   * @param targetSourceIndex 目标源下标
   * @param manualSwitch 缺省 true = 用户在面板手动切源（先清屏 + cmsSwitching 遮罩）；
   *   初始进入传 false（即使携带 routeSourceIndex 指定源）——只有手动切换才走清屏语义，
   *   初始进入走「聚合探测 → 面板过滤 → 选择」主链（2026-10-11 用户定稿）。
   */
  const fetchCMSSources = useCallback(async (targetSourceIndex?: number, manualSwitch = true) => {
    if (!id) return;
    cmsAbortRef.current?.abort();
    const ctrl = new AbortController();
    cmsAbortRef.current = ctrl;
    const isSwitching = targetSourceIndex !== undefined && manualSwitch !== false;
    // 领取请求序号：后续所有状态写入只在「仍是最新请求」时生效
    const reqId = ++reqSeqRef.current;
    const isLatest = () => reqSeqRef.current === reqId;
    setCmsLoading(true);
    if (isSwitching) setCmsSwitching(true);

    // 超时兜底：接口不响应时强制中断并收尾，杜绝「切源失败后播放器一直加载」
    const timeoutId = setTimeout(() => {
      ctrl.abort();
      if (isLatest()) {
        setCmsLoading(false);
        setCmsSwitching(false);
      }
    }, CMS_FETCH_TIMEOUT_MS);

    // 统一关闭 loading 的出口：仅最新请求可收尾
    const finishLoading = () => {
      clearTimeout(timeoutId);
      if (isLatest()) {
        setCmsLoading(false);
        setCmsSwitching(false);
      }
    };

    if (isSwitching) {
      setVideo(null);
      setSources([]);
      setCurrentSrc(null);
      setLocalEpisodeId(undefined);
      currentSourceNameRef.current = undefined;
    }

    // 一次性获取视频源配置，后续所有位置复用。
    // ⚠️ 必须捕获：这里抛错原本会变成未捕获的 Promise rejection，loading 永远关不掉
    // （表现之一：切换 CMS 失败/超时后播放器一直转圈）。
    const { getVideoSources } = await import('@/services/sourceService');
    let allSrc: Awaited<ReturnType<typeof getVideoSources>>;
    try {
      allSrc = await getVideoSources();
    } catch {
      finishLoading();
      return;
    }

    let sourceIdx = targetSourceIndex;
    // 历史源下标（供聚合后选择与「历史源已无数据」提醒判定）与探测命中集（电影分支复用免重搜）
    let histIdx: number | undefined;
    let probeHits: Map<number, VideoDetailResult> | undefined;

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
      if (matchedIdx >= 0) {
        sourceIdx = matchedIdx;
        histIdx = matchedIdx;
      }
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

    // 选集恢复：弹窗直达的 routePlayUrl 精确匹配 > route 集号兜底 > 历史集号 > 默认第一集。
    // routePlayUrl 优先保证「全部」弹窗点的集在首帧就位，杜绝先播其它集导致的
    // 首播季号/集号竞态写入；集号兜底（2026-10-11）应对 CMS 轮转导致 url 对不上。
    const pickInitialEpisode = (eps?: Episode[]): Episode | undefined => {
      if (!eps?.length) return undefined;
      const sorted = [...eps].sort((a, b) => a.number - b.number);
      if (routePlayUrl) {
        const byUrl = sorted.find(ep => ep.sources?.some(s => s.url === routePlayUrl));
        if (byUrl) return byUrl;
      }
      if (routeEpisodeNumber != null && (routeSeasonNumber == null || selectedSeasonRef.current === routeSeasonNumber)) {
        const byNum = sorted.find(ep => ep.number === routeEpisodeNumber);
        if (byNum) return byNum;
      }
      if (histEpNum != null) {
        const matched = sorted.find(ep => ep.number === histEpNum);
        if (matched) return matched;
      }
      return sorted[0];
    };

    // 线路恢复：弹窗直达的 routePlayUrl 精确命中 > 历史 episodeUrl 命中 > 保持默认首线。
    // 2026-10-11：旧版只认历史 url，弹窗点「线路」时首帧总落在 sources[0]（用户报
    // 「有概率播第一个线路」的直接来源），routePlayUrl 提到最前。
    const restoreLineIfNeeded = (ep: Episode | undefined) => {
      if (!ep?.sources.length) return;
      const wantUrl = routePlayUrl ?? histRecord?.episodeUrl;
      if (!wantUrl) return;
      const line = ep.sources.find(s => s.url === wantUrl);
      if (line) handlePlaySource(line);
    };

    {
      const matchedId = allSrc[sourceIdx]?.id;
      // 仅最新请求写选中态：旧请求回写会覆盖用户刚点的新源（连点切源 → 选中态丢失）
      if (matchedId && isLatest()) setActiveSourceId(matchedId);
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
      finishLoading();
      return;
    }

    // ── 进入播放页即聚合全部启用源：面板只显示「CMS 接口有返回当前视频数据」的源 ──
    // （2026-10-11 用户定稿，替代同日「单源+后台探测+继续观看豁免」过渡版）：
    // 本面板职责 = 纯数据源展示，**无条件适用于所有进入方式**（含继续观看）；
    // 选中/季集线路回显等逻辑一律排在本聚合之后执行。
    // 竞速窗口策略：首个命中即上屏并开 1.5s 收尾窗吸收在飞结果，迟到的命中后续
    // 继续增量上屏；全部失败时等到 allSettled 再走空态。
    // 历史源被判定无数据 → 不回显它：toast 提醒并换有数据的源，按内容身份（季/集号）续播。
    if (!isSwitching && id.startsWith('tmdb-')) {
      probeActiveRef.current = true;
      // 池顺序 = 设置页勾选顺序（videoSourceIds 为空则全量下标序）
      const pool = videoSourceIds.length > 0
        ? videoSourceIds.map(sid => allSrc.findIndex(s => s.id === sid)).filter(i => i >= 0)
        : allSrc.map((_, i) => i);
      const hits = new Map<number, VideoDetailResult>();
      probeHits = hits;
      const writePanel = () => {
        if (!isLatest() || ctrl.signal.aborted) return;
        const ordered = pool.filter(i => hits.has(i)).map(i => hits.get(i)!);
        setCmsResults(ordered);
        setSelectedSourceIds(ordered.map(r => r.sourceId).filter(Boolean));
      };
      let firstHitResolve: () => void = () => {};
      const firstHit = new Promise<void>(r => { firstHitResolve = r; });
      const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
      /**
       * 单源探测（2026-10-11 稳定性修复，用户报「同一数据时有时无」）：
       *  ① 错峰发起（每源 +120ms）——全部启用源同打一个 CORS 代理域，瞬发并发易触发
       *    限流/连接排队，失败被静默当作「无数据」→ 面板缺源；
       *  ② 非「业务未找到」的失败（网络/超时/限流/异常）重试一次（800ms 后），
       *    业务确认无数据的源不白白发第二枪（api-abuse 约束）。
       */
      const probeOne = async (idx: number, slot: number) => {
        await sleep(slot * 120);
        for (let attempt = 0; attempt < 2; attempt++) {
          if (!isLatest() || ctrl.signal.aborted) return;
          let res: VideoDetailResult | null = null;
          try {
            if (tmdbMediaType === 'tv') {
              const r = await searchVideoSeasonsFromSingleSource(idx, videoTitle, videoYear, ctrl.signal);
              if (r.seasons.size > 0) {
                // 季映射入缓存：选择该源时 apply 链直接取用，不重复请求
                seasonMapsRef.current.set(idx, r.seasons);
                const first = r.seasons.values().next().value as Video | undefined;
                res = {
                  sourceIndex: idx,
                  sourceId: allSrc[idx]?.id ?? '',
                  sourceName: allSrc[idx]?.name ?? '',
                  video: first ?? null,
                };
              } else {
                res = {
                  sourceIndex: idx,
                  sourceId: allSrc[idx]?.id ?? '',
                  sourceName: allSrc[idx]?.name ?? '',
                  video: null,
                  error: r.error ?? '未找到匹配资源',
                };
              }
            } else {
              res = await searchVideoFromSingleSource(idx, videoTitle, videoYear, ctrl.signal);
            }
          } catch { res = null; }
          if (!isLatest() || ctrl.signal.aborted) return;
          if (res?.video) {
            hits.set(idx, res);
            writePanel();
            firstHitResolve();
            return;
          }
          const errMsg = res?.error ?? '';
          const permanentNoData = res !== null && errMsg === '未找到匹配资源';
          if (permanentNoData || attempt === 1) return;
          await sleep(800);
        }
      };
      const allDone = Promise.allSettled(pool.map((idx, slot) => probeOne(idx, slot)));
      // 闸门解除只认「全部池源落定」（allDone）——首批+1.5s 窗口仅决定启动播放的选择
      // 时机，不影响 failover 挂起；迟到源未定期间若有流死亡，错误继续挂起至全部落定重放。
      // isLatest 守卫：旧请求被新一轮取代时，其 allDone 回调不得误关新轮的闸门。
      allDone.then(() => {
        if (isLatest() && probeActiveRef.current) {
          probeActiveRef.current = false;
          setProbeSettledSeq(s => s + 1);
        }
      });
      await Promise.race([allDone, firstHit.then(() => new Promise(r => setTimeout(r, 1500)))]);
      if (hits.size === 0) await allDone; // 暂无任何命中：等全部落定再定夺空态
      if (!isLatest() || ctrl.signal.aborted) { finishLoading(); return; }

      // 选择（面板数据落定后才执行）：指定源（有数据）> 历史源（有数据）> 勾选顺序首个
      const hitList = pool.filter(i => hits.has(i));
      let selected: number | undefined;
      if (routeSourceIndex !== undefined && hits.has(routeSourceIndex)) selected = routeSourceIndex;
      else if (histIdx !== undefined && hits.has(histIdx)) selected = histIdx;
      else selected = hitList[0];
      if (selected === undefined) {
        // 全部启用源都无当前视频数据：空态（面板「无数据源」文案，cmsLoading 已落）。
        // ⚠️ cmsResults 必须写入每池源的落定记录（video:null）而非清空：Player 空态
        //   门控（index.tsx :949-950）把「tmdb id + cmsResults 空 + 无季数据」当作
        //   「仍在聚合」→ 置空会永不落空态（PLAYER-095 回归拖住 loading）。
        finishLoading();
        setVideo(null);
        setSources([]);
        setCurrentSrc(null);
        setLocalEpisodeId(undefined);
        currentSourceNameRef.current = undefined;
        setCmsResults(pool.map(idx => ({
          sourceIndex: idx,
          sourceId: allSrc[idx]?.id ?? '',
          sourceName: allSrc[idx]?.name ?? '',
          video: null,
          error: 'no-data',
        })));
        setSelectedSourceIds([]);
        return;
      }
      if (histIdx !== undefined && !hits.has(histIdx) && !skipHistory) {
        // 提示不再走全局 toast（用户报「未居中/与续播卡叠加」）——写入播放器内续播卡顶部行：
        // 先显示换源提示、续播完成后其下才出现「已从上次位置继续播放」，同源同卡不叠加。
        usePlayerStore.getState().setSourceNotice(`上次使用的源「${allSrc[histIdx]?.name ?? '未知'}」已无本片数据，已改用「${allSrc[selected]?.name ?? '其它源'}」并按最近进度续播`);
      }
      sourceIdx = selected;
      activeCmsSourceIndexRef.current = selected;
      const selectedId = allSrc[selected]?.id;
      if (selectedId) setActiveSourceId(selectedId);
    }

    // ── 快速恢复路径：有 vodId 时直接调 CMS 详情接口 ──────────
    /**
     * 快速恢复路径：有 vodId 时直接调 CMS 详情接口
     * 场景：用户从历史记录恢复播放，已有 vodId，可直接获取视频详情。
     * 注意：routeSourceIndex 指定了具体源时不可走此路径——历史 vodId 属于
     * 历史记录的那个源，跨源 vodId 不通用，会在用户点的源上拉错视频。
     */
    // ⚠️ sourceIdx === histIdx 守卫（2026-10-11）：聚合选择可能已改选非历史源（历史源无数据），
    //   vod_id 跨源不通用，绝不能拿历史 vodId 去快取其它源。
    if (!isSwitching && routeSourceIndex === undefined && sourceIdx === histIdx && histRecord?.vodId) {
      try {
        const svc = await import('@/services/videoService');
        /** 通过 vodId 获取视频详情（传递 signal 支持取消） */
        const detailVideo = await svc.fetchVideoDetail(sourceIdx, histRecord.vodId, ctrl.signal);
        if (!isLatest()) return;

        if (detailVideo && (detailVideo.sources.length > 0 || (detailVideo.episodes?.length ?? 0) > 0)) {
          // 2026-10-11：detail 命中但无任何可播线/集视同未命中（继续走下方按标题重搜 +
          // 跨源兜底），避免「有壳无料」停在暂无数据。
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
              // curIdx：const 捕获已定值（:173-177 默认段保证 number），规避闭包内 let 窄化丢失
              const curIdx = sourceIdx;
              searchVideoSeasonsFromSingleSource(curIdx, videoTitle, videoYear, ctrl.signal).then(result => {
                if (!isLatest()) return;
                seasonMapsRef.current.set(curIdx, result.seasons);
                setCmsSeasons(buildCmsSeasons(result.seasons));
                if (histRecord?.vodId) {
                  for (const [seasonNum, seasonVid] of result.seasons) {
                    if (seasonVid.id === histRecord.vodId) {
                      selectedSeasonRef.current = seasonNum;
                      break;
                    }
                  }
                }
              }).catch(() => {});
              return;
            }
          }
          if (detailVideo.sources.length > 0) {
            setSources(detailVideo.sources);
            // 2026-10-11：线路首帧选择 routePlayUrl > 历史 url > 首线（旧版忽略弹窗指定线路）
            const firstSrc = (routePlayUrl && detailVideo.sources.find(s => s.url === routePlayUrl))
              || (histRecord?.episodeUrl && detailVideo.sources.find(s => s.url === histRecord!.episodeUrl))
              || detailVideo.sources[0];
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
          let seasonResult = await searchVideoSeasonsFromSingleSource(sourceIdx, videoTitle, videoYear, ctrl.signal);
          // 2026-10-11「继续观看→cms 源无数据」跨源兜底：历史/指定源按标题找不到该剧
          // （资源轮转/下架）时不再停死在空态——顺延其它源最多 4 次，首个命中即采用。
          if (seasonResult.seasons.size === 0 && !isSwitching) {
            for (let i = 0, tried = 0; i < allSrc.length && tried < 4; i++) {
              if (i === sourceIdx) continue;
              tried += 1;
              if (!isLatest() || ctrl.signal.aborted) break;
              const alt = await searchVideoSeasonsFromSingleSource(i, videoTitle, videoYear, ctrl.signal);
              if (alt.seasons.size > 0) {
                seasonResult = alt; sourceIdx = i;
                // 兜底命中的新源并进面板首位（当前播放源必须在面板；tmdb 初始进入才有聚合面板）
                if (id.startsWith('tmdb-') && allSrc[i]?.id) {
                  setSelectedSourceIds(prev => (prev.includes(allSrc[i].id) ? prev : [allSrc[i].id, ...prev]));
                }
                break;
              }
            }
          }
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

        if (isLatest()) {
          cmsSourceIdRef.current = allSrc[sourceIdx]?.id;
          cmsSourceNameRef.current = allSrc[sourceIdx]?.name ?? '';
          // 跨源兜底可能已切换 sourceIdx：同步 CMS tab 选中态（:221 早写的是兜底前的源）
          if (allSrc[sourceIdx]?.id) setActiveSourceId(allSrc[sourceIdx].id);

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
        finishLoading();
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
        // ── CMS 源视频（id 即某源的 vod_id）──────────────────────────
        // ⚠️ vod_id 是**源内主键，跨源不通用**（见本文件 :249-255 注释）。切源时若仍拿
        // 旧源的 vod_id 去请求新源详情，新源要么返回空、要么返回**同 id 的另一部片子**
        // → 播放器播错片 / 黑屏（2026-09-16 评审 P0-4）。
        // 放行条件（任一成立即可）：
        //   ① 非「显式指定源」（isSwitching=false）——首次进入，id 天然来自本次导航的目标源；
        //   ② 本会话缓存证明该 id 就在目标源取过详情（Collections/History 二次进入最常见）；
        //   ③ 历史记录证明该 vod_id 属于目标源（含「切回原源」= 合法快路径）。
        // 反例（必须走标题重搜）：跨源切换时 id 属于旧源；用户从详情页「立即播放」传的
        // sourceIndex 是**匹配结果所属源**，未必等于 id 的来源。
        const cachedEntry = id ? videoCache.get(id) : undefined;
        const idBelongsToTargetSource =
          (!isSwitching) ||
          (!!cachedEntry && cachedEntry.sourceIndex === sourceIdx) ||
          (!!histRecord?.vodId && histRecord.vodId === id &&
            ((!!histRecord.cmsSourceId && histRecord.cmsSourceId === allSrc[sourceIdx]?.id) ||
              (!!histRecord.cmsSourceName && histRecord.cmsSourceName === allSrc[sourceIdx]?.name)));
        if (idBelongsToTargetSource) {
          // CMS 源视频：通过 vod_id 获取详情（传递 signal 支持取消）
          const { fetchVideoDetail } = await import('@/services/videoService');
          const detailVideo = await fetchVideoDetail(sourceIdx, id, ctrl.signal);
          const sourceName = allSrc[sourceIdx]?.name ?? '未知';
          result = { sourceIndex: sourceIdx, sourceId: allSrc[sourceIdx]?.id ?? '', sourceName, video: detailVideo };
        } else if (videoTitle) {
          // 切源 + vod_id 不可移植：改用「标题 + 年份」在新源重搜（与 TMDB 分支同一路径）
          result = await searchVideoFromSingleSource(sourceIdx, videoTitle, videoYear, ctrl.signal);
        } else {
          // 无标题可用（直接进 /play/<vod_id> 且无任何元数据）：宁可留空也不发错请求，
          // 避免把别的片子的线路写进播放器。
          finishLoading();
          return;
        }
      } else {
        // TMDB 视频：优先复用聚合探测已拿到的结果（免重复搜索）；未命中（手动切源等）才现搜
        result = probeHits?.get(sourceIdx) ?? await searchVideoFromSingleSource(sourceIdx, videoTitle, videoYear, ctrl.signal);
      }

      // 2026-10-11 电影跨源兜底（同 TV 分支）：指定/历史源搜不到本片时顺延其它源最多 4 次，
      // 首个命中即采用并同步面板选中源，杜绝「继续观看→cms 源无数据」死端。
      if (!result.video && !isSwitching && videoTitle) {
        for (let i = 0, tried = 0; i < allSrc.length && tried < 4; i++) {
          if (i === sourceIdx) continue;
          tried += 1;
          if (!isLatest() || ctrl.signal.aborted) break;
          const alt = await searchVideoFromSingleSource(i, videoTitle, videoYear, ctrl.signal);
          if (alt.video) {
            result = alt;
            sourceIdx = i;
            activeCmsSourceIndexRef.current = i;
            // 同 TV 分支：兜底命中的新源并进面板首位
            if (id.startsWith('tmdb-') && allSrc[i]?.id) {
              setSelectedSourceIds(prev => (prev.includes(allSrc[i].id) ? prev : [allSrc[i].id, ...prev]));
            }
            break;
          }
        }
        if (isLatest() && allSrc[sourceIdx]?.id) setActiveSourceId(allSrc[sourceIdx].id);
      }

      if (isLatest()) {
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
            // 2026-10-11：同上，routePlayUrl > 历史 url > 首线
            const firstSrc = (routePlayUrl && result.video.sources.find(s => s.url === routePlayUrl))
              || (histRecord?.episodeUrl && result.video.sources.find(s => s.url === histRecord!.episodeUrl))
              || result.video.sources[0];
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
      finishLoading();
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

    // 用户最新意图：领序号；后续状态写入与收尾仅在仍是最新意图时生效，
    // 避免与更晚的切源/切季请求互相覆盖造成「选中态丢失 / 数据回滚」。
    const reqId = ++reqSeqRef.current;
    const isLatest = () => reqSeqRef.current === reqId;

    // ⚠️ 此前写 result.sourceName → 永远对不上 activeSourceId（按 id 比较），
    // 这是「CMS tab 选中态消失」的根因之一。
    setActiveSourceId(result.sourceId || result.sourceName);
    activeCmsSourceIndexRef.current = result.sourceIndex;

    const activeEpId = video?.episodes?.length
      ? video.episodes.find(ep => ep.id === video.episodes?.[0]?.id)?.id
      : undefined;
    const oldEpisodes = video?.episodes ?? [];
    const currentEp = activeEpId ? oldEpisodes.find(ep => ep.id === activeEpId) : undefined;
    const currentEpNumber = currentEp?.number;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (isLatest()) {
        setCmsLoading(false);
        setCmsSwitching(false);
      }
    };
    // 超时兜底：避免接口 hang 时「切 CMS 后播放器一直加载」
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

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
        // 当前集号在新源该季不存在时回退首集；无论是否命中集号都写 video——
        // 切源语义下禁止保留上一个源的数据（「失败不回退」）
        const targetEp = matchedEp?.sources.length
          ? matchedEp
          : [...cachedVideo.episodes].sort((a, b) => a.number - b.number)[0];
        videoCache.set(id!, { video: cachedVideo, sourceIndex: result.sourceIndex, fetchedAt: Date.now() });
        setVideo(cachedVideo);
        if (targetEp?.sources.length) onSwitchEpisode(targetEp);
      } else {
        // 该源该季无集数：清空播放状态落到空态（不回退旧源数据）
        setVideo(null);
        setSources([]);
        setCurrentSrc(null);
        setLocalEpisodeId(undefined);
        currentSourceNameRef.current = undefined;
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
      timeoutId = setTimeout(() => {
        ctrl.abort();
        if (isLatest()) {
          setCmsLoading(false);
          setCmsSwitching(false);
        }
      }, CMS_FETCH_TIMEOUT_MS);
      try {
        const seasonResult = await searchVideoSeasonsFromSingleSource(
          result.sourceIndex, videoTitleRef.current, videoYearRef.current, ctrl.signal,
        );
        if (!isLatest()) { cleanup(); return; }
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
          // 该源没有当前季：清空全部播放状态（不回退旧源数据）
          setVideo(null);
          setSources([]);
          setCurrentSrc(null);
          setLocalEpisodeId(undefined);
          currentSourceNameRef.current = undefined;
        }
      } catch {
        // 重建失败：切源语义下不回退上一个源的数据（用户定稿 2026-09-09），
        // 清空播放状态落到「暂无数据」空态，由用户改选其他源。
        if (isLatest()) {
          setVideo(null);
          setSources([]);
          setCurrentSrc(null);
          setLocalEpisodeId(undefined);
          currentSourceNameRef.current = undefined;
        }
      } finally {
        cleanup();
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
    } else {
      // 无可用数据：清空播放状态，不回退上一个源
      setVideo(null);
      setSources([]);
      setCurrentSrc(null);
      setLocalEpisodeId(undefined);
      currentSourceNameRef.current = undefined;
    }
    cleanup();
  }, [id, video, selectedSeason, videoCache, setVideo, setSources, setSource, setCurrentSrc, currentSourceNameRef, cmsSourceNameRef, seasonChangedRef, onSwitchEpisode, setSelectedSeason]);

  // ── loadSeason：切季/切源缓存缺失时的懒加载兜底 ──────────
  const loadSeason = useCallback(async (sourceIdx: number, seasonNumber: number, currentEpNumber?: number) => {
    if (!id || !videoTitleRef.current) return;
    cmsAbortRef.current?.abort();
    const ctrl = new AbortController();
    cmsAbortRef.current = ctrl;
    const reqId = ++reqSeqRef.current;
    const isLatest = () => reqSeqRef.current === reqId;
    // 超时兜底：避免「切季接口 hang → 选集面板 loading 永驻」
    const timeoutId = setTimeout(() => {
      ctrl.abort();
      if (isLatest()) setCmsLoading(false);
    }, CMS_FETCH_TIMEOUT_MS);
    setCmsLoading(true);
    try {
      const seasonResult = await searchVideoSeasonsFromSingleSource(
        sourceIdx, videoTitleRef.current, videoYearRef.current, ctrl.signal,
      );
      if (!isLatest()) return;
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
      clearTimeout(timeoutId);
      // isLatest=true 包含超时与正常失败：均清掉加载态（仅限最新请求）
      if (isLatest()) setCmsLoading(false);
    }
  }, [id, videoCache, setVideo, setSources, setCurrentSrc, setLocalEpisodeId, onSwitchEpisode, setSelectedSeason]);

  // ── Effects ──────────────────────────────

  // 加载 TMDB 详情（token 未配置时短路，避免 401 在飞请求）
  useEffect(() => {
    if (!id || !id.startsWith('tmdb-')) return;
    if (!useSettingsStore.getState().tmdbAccessToken?.trim()) return;
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
          // 2026-10-11 用户定稿：TMDB id 的面板（selectedSourceIds）**完全交给** fetchCMSSources
          // 聚合主链——只展示「接口有返回当前视频数据」的源，探测期间由 loading 文案占位。
          // 本 effect 绝不能再铺设置页勾选源（旧行为会覆盖聚合过滤结果，且带 lazy-fetch 错觉）。
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
      // 初始进入（含详情「立即播放」指定源）：manualSwitch=false 走聚合主链，
      // 不走手动切源的清屏分支（2026-10-11 用户定稿）
      fetchCMSSources(routeSourceIndex, false);
    }
  }, [id, tmdbDetail, cmsLoading, cmsResults.length, fetchCMSSources, routeSourceIndex]);

  // 清理：id 变化时重置所有 CMS 状态，避免旧视频数据残留
  useEffect(() => () => {
    cmsAbortRef.current?.abort();
    tmdbAbortRef.current?.abort();
    seasonMapsRef.current.clear();
    fetchInitiatedRef.current = false;
    probeActiveRef.current = false;
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
    probeActiveRef,
    probeSettledSeq,
  };
}
