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
import { useMediaQuery, useIsTV } from '@/hooks/useMediaQuery';
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
  activeSourceIndex: number;
  posterUrl?: string;
  progressMap?: Record<string, PlaylistProgressEntry>;
  historyRecord?: { seasonNumber?: number; episodeLabel?: string } | null;
  onClose: () => void;
  onPlayEpisode: (ep: {
    seasonNumber: number;
    episodeId: string;
    episode: Episode;
    sources: VideoSource[];
    sourceIndex: number;
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
      sources: VideoSource[];
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
//   - 电影（line）：按 videoId 统一，所有线路/源共享同一进度
//   - 剧集（ep）：按 季号+集号 统一，相同选集在不同源之间共享同一进度
// 因此「最后播放的进度」始终覆盖、跨源/跨线路保持一致。
function cellProgress(
  item: Item,
  map?: Record<string, PlaylistProgressEntry>,
): PlaylistProgressEntry | null {
  if (!map) return null;
  const key = item.kind === 'line' ? '__movie__' : `s${item.seasonNumber}-第${item.number}集`;
  return map[key] ?? null;
}

export default function PlaylistModal({
  data,
  videoId,
  activeSourceIndex,
  posterUrl,
  progressMap: progressMapProp,
  historyRecord: historyRecordProp,
  onClose,
  onPlayEpisode,
  onPlayLine,
}: PlaylistModalProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTV = useIsTV();
  const { isSeries, seasons, seasonNumbers, video, sourceName } = data;

  // 直接订阅观看历史 store：播放页在 timeupdate 时持续写入进度，
  // 返回并重新打开弹窗时，必须显示「最新」进度与百分比，不能依赖父页是否重渲染
  // （详情页在 Keep-Alive 下可能因 memo 跳过重渲染而拿到过期 props）。
  const liveHistory = useUserStore((s) => s.history);

  // 实时重建 progressMap，按「内容身份」聚合（与 store.addHistory 去重键一致）：
  //   - 电影：单条记录（seasonNumber 为空）→ 键 '__movie__'，所有线路共用
  //   - 剧集：键 's{季号}-{episodeLabel}'，相同选集跨源共用
  // 因此「最后播放的进度」始终生效，相同电影不同线路 / 相同选集不同源进度保持一致。
  const liveProgressMap = useMemo<Record<string, PlaylistProgressEntry>>(() => {
    const map: Record<string, PlaylistProgressEntry> = {};
    if (!videoId) return map;
    for (const h of liveHistory) {
      if (h.videoId !== videoId) continue;
      // 与 addHistory 的 dedupId 对齐：电影按 videoId，剧集按 季号+episodeLabel
      const key =
        h.seasonNumber != null && h.episodeLabel
          ? `s${h.seasonNumber}-${h.episodeLabel}`
          : '__movie__';
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
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(40);

  const bodyRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(6);
  const [flashIdx, setFlashIdx] = useState(-1);

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
              sources: seasonVideo?.sources ?? [],
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
        sources: activeVideo?.sources ?? [],
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

  // 切季 / 切类型 / 切"全部"时：重置搜索、可见数量，并根据历史推断"已看"与初始选中
  useEffect(() => {
    setQuery('');
    setVisibleCount(40);
    const w = new Set<number>();
    let init = 0;
    if (isSeries && historyRecord) {
      const m = /(\d+)/.exec(historyRecord.episodeLabel || '');
      const y = m ? parseInt(m[1], 10) : NaN;
      if (!Number.isNaN(y)) {
        const histSeason = historyRecord.seasonNumber;
        // 以"季号*1000+集号"为键，保证"全部"聚合视图下只高亮历史所属季的已看集
        allItems.forEach((it) => {
          if (it.kind === 'ep' && it.seasonNumber === histSeason && it.number <= y) {
            w.add(it.seasonNumber * 1000 + it.number);
          }
        });
        const idx = allItems.findIndex(
          (it) => it.kind === 'ep' && it.seasonNumber === histSeason && it.number === y,
        );
        if (idx >= 0) init = idx;
      }
    }
    setWatched(w);
    setSelectedIdx(init);
  }, [seasonIdx, showAll, isSeries, historyRecord, currentSeasonNumber, allItems]);

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

  // 无限滚动哨兵
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(filtered.length, c + 40));
        }
      },
      { root: bodyRef.current },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length, seasonIdx]);

  const scrollCellIntoView = useCallback((idx: number) => {
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${idx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, []);

  const playItem = useCallback(
    (item: Item) => {
      if (item.kind === 'ep') {
        onPlayEpisode({
          seasonNumber: item.seasonNumber,
          episodeId: item.episode.id,
          episode: item.episode,
          sources: item.sources,
          sourceIndex: activeSourceIndex,
        });
      } else {
        onPlayLine(item.origIndex, null, item.line.url, item.line.type);
      }
    },
    [onPlayEpisode, onPlayLine, activeSourceIndex],
  );

  const playSelected = useCallback(() => {
    const item = filtered[selectedIdx];
    if (item) playItem(item);
  }, [filtered, selectedIdx, playItem]);

  const jumpToFirstMatch = useCallback(() => {
    if (filtered.length === 0) {
      toast.show('没有匹配的剧集');
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
      let next = selectedIdx;
      if (e.key === 'ArrowRight') next = Math.min(n - 1, selectedIdx + 1);
      else if (e.key === 'ArrowLeft') next = Math.max(0, selectedIdx - 1);
      else if (e.key === 'ArrowDown') next = Math.min(n - 1, selectedIdx + cols);
      else if (e.key === 'ArrowUp') next = Math.max(0, selectedIdx - cols);
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
            const isWatched =
              it.kind === 'ep' && watched.has(it.seasonNumber * 1000 + it.number);
            // 有播放进度的 cell（与下方进度条/百分比同源，按「内容身份」跨季/跨源查找）：
            // 不论是否落在「连续已看到集」范围内，只要历史上播过就与未观看 cell 区分背景色
            const hasProgress = prog != null;
            const isPlayed = isWatched || hasProgress;
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
            letter={video.title?.[0]}
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
