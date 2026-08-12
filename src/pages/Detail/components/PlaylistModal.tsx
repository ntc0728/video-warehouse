import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import LazyImage from '@/components/LazyImage/LazyImage';
import { toast } from '@/components/ui/toastBus';
import { useIsMobileLayout, useIsTV } from '@/hooks/useMediaQuery';
import { useUserStore } from '@/stores';
import type { Episode, Video, VideoSource } from '@/types/video';
import './PlaylistModal.css';

export interface PlaylistModalData {
  sourceIndex: number;
  sourceName: string;
  video: Video;
  seasons: Video[];
  seasonNumbers: number[];
  isSeries: boolean;
}

interface PlaylistProgressEntry {
  progress: number;
  duration: number;
  completed: boolean;
}

interface PlaylistModalProps {
  data: PlaylistModalData;
  videoId?: string;
  posterUrl?: string;
  progressMap?: Record<string, PlaylistProgressEntry>;
  historyRecord?: { seasonNumber?: number; episodeLabel?: string } | null;
  onClose: () => void;
  onPlayEpisode: (ep: {
    seasonNumber: number;
    episode: Episode;
  }) => void;
  onPlayLine: (
    sourceIndex: number,
    seasonNumber: number | null,
    playUrl: string,
    playType: string,
  ) => void;
}

type Item =
  | {
      kind: 'ep';
      origIndex: number;
      episode: Episode;
      number: number;
      title: string;
      seasonNumber: number;
    }
  | { kind: 'line'; origIndex: number; line: VideoSource; number: number; title: string };

function stripHtml(s?: string): string {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function sortByNumber(eps: Episode[]): Episode[] {
  return [...eps].sort((a, b) => (a.number || 0) - (b.number || 0));
}

// 根据 cell 取到对应的进度记录。进度以「内容身份」为准（与 store.addHistory
// 的去重键一致）：
//   - 电影（line）：按线路 URL（line.url）独立，每条线路各自维护进度
//   - 剧集（ep）：按 季号+集号 统一，相同选集在不同源之间共享同一进度
// 因此「最后播放的进度」始终覆盖、相同选集跨源保持一致。
function cellProgress(
  item: Item,
  map?: Record<string, PlaylistProgressEntry>,
): PlaylistProgressEntry | null {
  if (!map) return null;
  const key = item.kind === 'line' ? item.line.url : `s${item.seasonNumber}-第${item.number}集`;
  return map[key] ?? null;
}

export default function PlaylistModal({
  data,
  videoId,
  posterUrl,
  progressMap: progressMapProp,
  historyRecord: historyRecordProp,
  onClose,
  onPlayEpisode,
  onPlayLine,
}: PlaylistModalProps) {
  // 9.1：布局判断统一 useIsMobileLayout（app 端恒真，横屏不误判桌面）
  const isMobile = useIsMobileLayout();
  const isTV = useIsTV();
  const { isSeries, seasons, seasonNumbers, video, sourceName } = data;

  // 直接订阅观看历史 store：播放页在 timeupdate 时持续写入进度，
  // 返回并重新打开弹窗时，必须显示「最新」进度与百分比，不能依赖父页是否重渲染
  // （详情页在 Keep-Alive 下可能因 memo 跳过重渲染而拿到过期 props）。
  const liveHistory = useUserStore((s) => s.history);

  // 实时重建 progressMap，按「内容身份」聚合（与 store.addHistory 去重键一致）：
  //   - 电影：按线路 URL（episodeUrl）独立，每条线路各自维护进度
  //   - 剧集：键 's{季号}-{episodeLabel}'，相同选集跨源共用
  // 因此「最后播放的进度」始终生效，相同选集不同源进度保持一致。
  const liveProgressMap = useMemo<Record<string, PlaylistProgressEntry>>(() => {
    const map: Record<string, PlaylistProgressEntry> = {};
    if (!videoId) return map;
    for (const h of liveHistory) {
      if (h.videoId !== videoId) continue;
      // 与 addHistory 的 dedupId 对齐：剧集按 季号+episodeLabel，电影按线路 URL
      const key =
        h.seasonNumber != null && h.episodeLabel
          ? `s${h.seasonNumber}-${h.episodeLabel}`
          : h.episodeUrl;
      if (!key) continue;
      map[key] = {
        progress: h.progress,
        duration: h.duration,
        completed: h.duration > 0 && h.progress >= h.duration,
      };
    }
    return map;
  }, [liveHistory, videoId]);

  // 实时读取「最后播放」记录（按 updatedAt 倒序），用于「播放中」标记与初始选中。
  const liveHistoryRecord = useMemo(() => {
    if (!videoId) return undefined;
    const records = liveHistory.filter((h) => h.videoId === videoId);
    if (records.length === 0) return undefined;
    return records.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  }, [liveHistory, videoId]);

  // 优先使用 store 实时数据，保证进度/百分比始终最新；videoId 缺失时回退到父页 props。
  const progressMap = videoId ? liveProgressMap : progressMapProp;
  const historyRecord = (videoId ? liveHistoryRecord : historyRecordProp) ?? null;

  const [showAll, setShowAll] = useState(false);
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [visibleCount, setVisibleCount] = useState(40);

  const bodyRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(6);
  const [flashIdx, setFlashIdx] = useState(-1);
  // 首次挂载时按历史记录对齐「最后播放的季」，锁定避免 historyRecord 持续更新导致重复切季
  const initialSeasonSetRef = useRef(false);

  // 变体在挂载时锁定：桌面居中 / 移动≤10集底部 / 移动>10集右侧整页抽屉
  const [variant] = useState<'center' | 'sheet' | 'drawer'>(() => {
    if (!isMobile) return 'center';
    if (isSeries && (seasons[0]?.episodes?.length ?? 0) > 10) return 'drawer';
    return 'sheet';
  });

  // 抽屉(drawer)变体为全屏，季导航复用桌面左侧竖向布局，与桌面端保持一致；
  // 仅移动端底部 sheet（≤10 集）保留顶部 chips 布局
  const isVerticalNav = !isMobile || variant === 'drawer';

  const activeVideo = isSeries && !showAll ? seasons[seasonIdx] : undefined;
  const currentSeasonNumber = isSeries && !showAll ? seasonNumbers[seasonIdx] : 0;

  // 最后播放选集的「集号」（仅作数字解析，季归属在 isPlaying 中判定，
  // 以便「全部」聚合视图与单季视图都能正确高亮历史那一集）。
  const histEpNumber = useMemo(() => {
    if (!historyRecord) return null;
    const m = /(\d+)/.exec(historyRecord.episodeLabel || '');
    const y = m ? parseInt(m[1], 10) : NaN;
    return Number.isNaN(y) ? null : y;
  }, [historyRecord]);

  const allItems = useMemo<Item[]>(() => {
    if (isSeries) {
      if (showAll) {
        const items: Item[] = [];
        seasons.forEach((seasonVideo, si) => {
          const sn = seasonNumbers[si];
          sortByNumber(seasonVideo?.episodes ?? []).forEach((ep, i) => {
            items.push({
              kind: 'ep',
              origIndex: i,
              episode: ep,
              number: ep.number,
              title: ep.title,
              seasonNumber: sn,
            });
          });
        });
        return items;
      }
      return sortByNumber(activeVideo?.episodes ?? []).map((ep, i) => ({
        kind: 'ep' as const,
        origIndex: i,
        episode: ep,
        number: ep.number,
        title: ep.title,
        seasonNumber: currentSeasonNumber,
      }));
    }
    return (video.sources ?? []).map((s, i) => ({
      kind: 'line' as const,
      origIndex: i,
      line: s,
      number: i + 1,
      title: s.name,
    }));
  }, [isSeries, showAll, activeVideo, seasons, seasonNumbers, currentSeasonNumber, video.sources]);

  const filtered = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (it) => it.title.toLowerCase().includes(q) || String(it.number).includes(q),
    );
  }, [allItems, query]);

  const visibleItems = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  // 切季 / 切类型 / 切"全部"时：重置搜索、可见数量，并根据历史推断初始选中。
  // 初始选中采用「零选中」策略：仅当历史记录命中的那一集（季+集号精确匹配）才选中，
  // 未看过的一律不渲染任何选中框。
  useEffect(() => {
    setQuery('');
    setVisibleCount(40);
    // 弹窗打开时：若存在历史「最后播放的季」，先在单季视图下对齐到该季，
    // 使有播放记录的剧集默认落在历史所属季，并选中历史那一集。
    // historyRecord 未就绪时不锁定（等就绪后本 effect 会随 deps 重跑再对齐）；
    // 对齐完成或无需对齐（历史季不在当前源 / 已在默认季）后锁定一次。
    if (!initialSeasonSetRef.current && isSeries && !showAll && historyRecord) {
      const histSeason = historyRecord.seasonNumber;
      if (histSeason != null) {
        const idx = seasonNumbers.indexOf(histSeason);
        if (idx > 0 && idx !== seasonIdx) {
          setSeasonIdx(idx);
          return; // 切季后本 effect 重跑，再完成选中初始化
        }
      }
      initialSeasonSetRef.current = true;
    }
    let init = -1;
    if (isSeries && historyRecord) {
      const m = /(\d+)/.exec(historyRecord.episodeLabel || '');
      const y = m ? parseInt(m[1], 10) : NaN;
      if (!Number.isNaN(y)) {
        const histSeason = historyRecord.seasonNumber;
        const idx = allItems.findIndex(
          (it) => it.kind === 'ep' && it.seasonNumber === histSeason && it.number === y,
        );
        if (idx >= 0) init = idx;
      }
    }
    setSelectedIdx(init);
  }, [seasonIdx, showAll, isSeries, historyRecord, currentSeasonNumber, allItems, seasonNumbers]);

  // 测量网格列数，供键盘上下导航
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const update = () => {
      const cs = getComputedStyle(el);
      const c = cs.gridTemplateColumns.split(' ').filter(Boolean).length;
      if (c > 0) setCols(c);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [seasonIdx, visibleItems.length]);

  // 加载更多：滚动事件 + 兜底检查双保险。
  // 不用 IntersectionObserver —— 其绑定依赖 sentinelRef/bodyRef 在 effect 运行时的
  // 就绪状态，弹窗挂载初期数据未就绪时会被 `if (!el) return` 跳过且后续不重建，
  // 导致懒加载永久失效（大量选集无法显示）。改为：
  //   1. 兜底：visibleCount/filtered 变化时检查哨兵是否在容器可视区内（内容不足
  //      一屏时无需滚动自动补齐，每次 +40 直至填满或全部加载）；
  //   2. 滚动：body（滚动容器）的 scroll 事件触发时同款检查（超一屏时滚动加载）。
  // 加载更多：滚动事件 + 兜底检查双保险。
  // 关键约束：本组件内容经 Radix Dialog.Portal 渲染，bodyRef/sentinelRef 在组件
  // useEffect 首次运行时可能尚未挂载（Portal 时序），若此时按 ref 直接 return，
  // 且 deps（visibleCount/filtered.length）保持稳定导致 effect 不再重跑，懒加载
  // 监听将「从未绑定」，大量选集无法显示。因此：
  //   1. 用 requestAnimationFrame 等待 body 挂载后再绑定；
  //   2. 滚动监听挂在 document（capture）上捕获 .playlist-body 的滚动（scroll 不冒泡）；
  //   3. 每次 visibleCount/filtered 变化后做一次兜底检查（内容不足一屏时自动补齐）。
  useEffect(() => {
    let raf = 0;
    let unbind: (() => void) | null = null;
    // I2（2026-08-04）：rAF 自递归加最大尝试上限——若 Portal 异常/弹窗生命周期边缘
    // 导致 bodyRef 始终取不到，约 1s（60 帧）后放弃，避免无限空转（无网络但有 CPU 空转）。
    let tries = 0;
    const tryBind = () => {
      if (++tries > 60) return;
      const body = bodyRef.current;
      if (!body) {
        raf = requestAnimationFrame(tryBind);
        return;
      }
      const maybeLoadMore = () => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        setVisibleCount((c) => {
          if (c >= filtered.length) return c;
          const bodyRect = body.getBoundingClientRect();
          const sentinelRect = sentinel.getBoundingClientRect();
          if (sentinelRect.top < bodyRect.bottom) {
            return Math.min(filtered.length, c + 40);
          }
          return c;
        });
      };
      // 兜底：内容不足一屏时无需滚动自动补齐（直至填满或全部加载）
      maybeLoadMore();
      // 滚动触发：scroll 事件不冒泡，用 capture 监听 document 捕获任意滚动容器
      document.addEventListener('scroll', maybeLoadMore, { passive: true, capture: true });
      unbind = () => document.removeEventListener('scroll', maybeLoadMore, true);
    };
    raf = requestAnimationFrame(tryBind);
    return () => {
      cancelAnimationFrame(raf);
      unbind?.();
    };
  }, [visibleCount, filtered.length]);

  const scrollCellIntoView = useCallback((idx: number) => {
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${idx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, []);

  const playItem = useCallback(
    (item: Item) => {
      if (item.kind === 'ep') {
        onPlayEpisode({
          seasonNumber: item.seasonNumber,
          episode: item.episode,
        });
      } else {
        onPlayLine(item.origIndex, null, item.line.url, item.line.type);
      }
    },
    [onPlayEpisode, onPlayLine],
  );

  const playSelected = useCallback(() => {
    const item = filtered[selectedIdx];
    if (item) playItem(item);
  }, [filtered, selectedIdx, playItem]);

  const jumpToFirstMatch = useCallback(() => {
    if (filtered.length === 0) {
      toast.warning('没有匹配的剧集');
      return;
    }
    const first = filtered[0];
    const label = first.kind === 'ep' ? `第${first.number}集` : first.title;
    setSelectedIdx(0);
    setFlashIdx(0);
    requestAnimationFrame(() => scrollCellIntoView(0));
    toast.show(`已定位到${label}`);
    window.setTimeout(() => setFlashIdx(-1), 1200);
  }, [filtered, scrollCellIntoView]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const inInput =
        document.activeElement &&
        (document.activeElement as HTMLElement).tagName === 'INPUT';
      if (inInput) {
        if (e.key === 'Enter') {
          e.preventDefault();
          jumpToFirstMatch();
        }
        return;
      }
      const n = filtered.length;
      if (n === 0) return;
      // 零选中（-1）时首次按方向键统一落到第一格
      let next = selectedIdx < 0 ? 0 : selectedIdx;
      if (e.key === 'ArrowRight') next = Math.min(n - 1, next + 1);
      else if (e.key === 'ArrowLeft') next = Math.max(0, next - 1);
      else if (e.key === 'ArrowDown') next = Math.min(n - 1, next + cols);
      else if (e.key === 'ArrowUp') next = Math.max(0, next - cols);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      else if (e.key === 'Enter') {
        e.preventDefault();
        playSelected();
        return;
      } else return;
      e.preventDefault();
      setSelectedIdx(next);
      scrollCellIntoView(next);
    },
    [filtered.length, selectedIdx, cols, jumpToFirstMatch, playSelected, scrollCellIntoView],
  );

  // ── 移动端右侧抽屉下拉关闭手势 ──
  const dragRef = useRef<{ startY: number; active: boolean }>({ startY: 0, active: false });
  const [dragY, setDragY] = useState(0);
  const onHandleDown = (e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, active: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    setDragY(Math.max(0, e.clientY - dragRef.current.startY));
  };
  const onHandleUp = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    if (dragY > 120) onClose();
    setDragY(0);
  };

  const desc = stripHtml(video.description).slice(0, 140);
  const countLabel = isSeries
    ? `共 ${allItems.length} 集`
    : `共 ${allItems.length} 条线路`;

  const renderSeasonNav = () => {
    if (!isSeries || seasons.length <= 1) return null;
    // 移动端 sheet（≤10 集）用顶部 chips；桌面 / 抽屉(drawer) 用左侧竖向分季导航
    if (!isVerticalNav) {
      return (
        <div className="playlist-seasons" role="tablist" aria-label="选择季">
          <button
            type="button"
            role="tab"
            aria-selected={showAll}
            className={`playlist-season-tab${showAll ? ' is-active' : ''}`}
            onClick={() => {
              setShowAll(true);
              setVisibleCount(40);
            }}
          >
            全部
          </button>
          {seasonNumbers.map((sn, i) => (
            <button
              key={sn}
              type="button"
              role="tab"
              aria-selected={!showAll && i === seasonIdx}
              className={`playlist-season-tab${!showAll && i === seasonIdx ? ' is-active' : ''}`}
              onClick={() => {
                setShowAll(false);
                setSeasonIdx(i);
                setVisibleCount(40);
              }}
            >
              {sn === 0 ? '正片' : `第${sn}季`}
            </button>
          ))}
        </div>
      );
    }
    return (
      <aside className="playlist-season-nav" aria-label="分季">
        <div className="playlist-season-nav-title">分季</div>
        <button
          type="button"
          className={`playlist-season-item${showAll ? ' is-active' : ''}`}
          onClick={() => {
            setShowAll(true);
            setVisibleCount(40);
          }}
        >
          <span>全部</span>
        </button>
        {seasonNumbers.map((sn, i) => (
          <button
            key={sn}
            type="button"
            className={`playlist-season-item${!showAll && i === seasonIdx ? ' is-active' : ''}`}
            onClick={() => {
              setShowAll(false);
              setSeasonIdx(i);
              setVisibleCount(40);
            }}
          >
            <span>{sn === 0 ? '正片' : `第${sn}季`}</span>
            <span className="playlist-season-count">{seasons[i]?.episodes?.length ?? 0}</span>
          </button>
        ))}
      </aside>
    );
  };

  const renderBody = () => (
    <>
      <div className="playlist-toolbar">
        <div className="playlist-search">
          <span className="playlist-search-icon">🔍</span>
          <input
            className="playlist-search-input"
            type="text"
            placeholder={isSeries ? '搜索剧集…' : '搜索播放线路…'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisibleCount(40);
            }}
          />
        </div>
        <div className="playlist-count">{countLabel}</div>
      </div>

      <div className="playlist-body" ref={bodyRef}>
        <div
          className={isSeries ? 'playlist-grid' : 'playlist-line-grid'}
          ref={gridRef}
          key={`${seasonIdx}-${showAll}`}
        >
          {visibleItems.map((it, flatIdx) => {
            const isSel = flatIdx === selectedIdx;
            const prog = cellProgress(it, progressMap);
            // 已看判定：仅「真有进度记录」的 cell 显示已看标记（✓ + 已看底色），
            // 未看过/无进度记录的一律不标记。
            const isPlayed = prog != null;
            // 「播放中」仅限历史记录所属季、且集号命中的那一个 cell，
            // 避免非历史季默认选中的第一集也显示「播放中」而串季。
            const isPlaying =
              isSel &&
              it.kind === 'ep' &&
              historyRecord?.seasonNumber === it.seasonNumber &&
              histEpNumber != null &&
              it.number === histEpNumber;
            const isBad =
              it.kind === 'ep'
                ? !it.episode.sources || it.episode.sources.length === 0
                : !it.line.url;
            const pct =
              prog && prog.duration > 0
                ? Math.min(100, Math.round((prog.progress / prog.duration) * 100))
                : 0;
            const cls = [
              'playlist-cell',
              it.kind === 'ep' ? 'playlist-cell--ep' : 'playlist-cell--line',
              // 选中态（is-selected）两端都加：用于背景着色与数字主色，
              // 与「历史已看」(is-watched) 的浅色底做区分；金边框高亮框
              // 仅 TV 端通过 .playlist-modal--tv 限定显示（非 TV 端不出现高亮框）
              isSel ? 'is-selected' : '',
              isPlayed ? 'is-watched' : '',
              isBad ? 'is-bad' : '',
              flatIdx === flashIdx ? 'is-flash' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={it.kind === 'ep' ? it.episode.id : `line-${it.origIndex}`}
                type="button"
                className={cls}
                title={it.title}
                data-cell={flatIdx}
                onClick={() => {
                  setSelectedIdx(flatIdx);
                  playItem(it);
                }}
              >
                {it.kind === 'ep' ? (
                  <>
                    {showAll && (
                      <span className="playlist-cell-season">S{it.seasonNumber}</span>
                    )}
                    <span className="playlist-cell-num">{it.number}</span>
                    {/* 勾号与「已看」或「有播放进度」联动：跨季/聚合视图里带进度的 cell 也显示右上角 ✓ */}
                    {isPlayed && (
                      <span
                        className={`playlist-cell-check${
                          prog?.completed ? ' is-complete' : ''
                        }`}
                      >
                        ✓
                      </span>
                    )}
                    {isPlaying && (
                      <span className="playlist-cell-playing">播放中</span>
                    )}
                    {isBad && <span className="playlist-cell-na">无源</span>}
                    {prog && (
                      <>
                        <span
                          className={`playlist-cell-pct${prog.completed ? ' is-complete' : ''}`}
                        >
                          {prog.completed ? '看完' : `${pct}%`}
                        </span>
                        <span className="playlist-cell-progress" aria-hidden="true">
                          <span
                            className={`playlist-cell-progress-bar${prog.completed ? ' is-complete' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="playlist-cell-name">{it.title}</span>
                    {/* 线路（电影）有播放进度时，也显示右上角 ✓ 与剧集一致 */}
                    {prog && (
                      <span
                        className={`playlist-cell-check${
                          prog.completed ? ' is-complete' : ''
                        }`}
                      >
                        ✓
                      </span>
                    )}
                    <span className="playlist-cell-type">{it.line.type.toUpperCase()}</span>
                    {isBad && <span className="playlist-cell-na">失效</span>}
                    {prog && (
                      <>
                        <span
                          className={`playlist-cell-pct${prog.completed ? ' is-complete' : ''}`}
                        >
                          {prog.completed ? '看完' : `${pct}%`}
                        </span>
                        <span className="playlist-cell-progress" aria-hidden="true">
                          <span
                            className={`playlist-cell-progress-bar${prog.completed ? ' is-complete' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                      </>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
        {visibleCount < filtered.length && (
          <div className="playlist-sentinel" ref={sentinelRef}>
            加载更多…
          </div>
        )}
        {filtered.length === 0 && <div className="playlist-empty">没有匹配的结果</div>}
      </div>
    </>
  );

  const content = (
    <div className="playlist-inner" onKeyDown={onKeyDown}>
      {variant === 'drawer' && (
        <div
          className="playlist-drag-handle"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
        >
          <span className="playlist-drag-bar" />
        </div>
      )}

      <div className="playlist-header">
        <div className="playlist-poster">
          <LazyImage
            src={video.cover || posterUrl || ''}
            alt={video.title}
            // CMS 封面缺失或加载失败时回退到 TMDB 海报（LazyImage 的 error/空值统一走 fallbackSrc）
            fallbackSrc={posterUrl || '/placeholder.svg'}
          />
        </div>
        <div className="playlist-meta">
          <Dialog.Title className="playlist-title">
            {isSeries
              ? showAll
                ? `${video.title} · 全部`
                : `${video.title} · 第${currentSeasonNumber === 0 ? '正片' : currentSeasonNumber}季`
              : video.title}
          </Dialog.Title>
          <div className="playlist-sub">
            {sourceName}
            {video.year ? ` · ${video.year}` : ''} · {isSeries ? '剧集' : '电影'}
          </div>
          {desc && <p className="playlist-desc">{desc}…</p>}
        </div>
        <button className="playlist-close" type="button" aria-label="关闭" onClick={onClose}>
          ✕
        </button>
      </div>

      {isSeries ? (
        isVerticalNav ? (
          <div className="playlist-split">
            {renderSeasonNav()}
            <div className="playlist-content">{renderBody()}</div>
          </div>
        ) : (
          <div className="playlist-main">
            {renderSeasonNav()}
            <div className="playlist-content">{renderBody()}</div>
          </div>
        )
      ) : (
        <div className="playlist-main">
          <div className="playlist-content">{renderBody()}</div>
        </div>
      )}
    </div>
  );

  const baseClass = `playlist-modal playlist-modal--${variant} ${
    isTV ? 'playlist-modal--tv' : ''
  } ${
    variant === 'drawer' ? 'playlist-drawer' : 'modal-content-animate'
  }`;

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay-animate" />
        <Dialog.Content
          className={baseClass}
          style={variant === 'drawer' ? { transform: `translateY(${dragY}px)` } : undefined}
          aria-describedby={undefined}
          onInteractOutside={(e) => {
            if (variant === 'drawer') e.preventDefault();
          }}
        >
          {content}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
