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
import { useMediaQuery } from '@/hooks/useMediaQuery';
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
  | { kind: 'ep'; origIndex: number; episode: Episode; number: number; title: string }
  | { kind: 'line'; origIndex: number; line: VideoSource; number: number; title: string };

function stripHtml(s?: string): string {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function sortByNumber(eps: Episode[]): Episode[] {
  return [...eps].sort((a, b) => (a.number || 0) - (b.number || 0));
}

// 根据 cell 取到对应的进度记录（按线路 url 命中历史 episodeUrl）
function cellProgress(
  item: Item,
  map?: Record<string, PlaylistProgressEntry>,
): PlaylistProgressEntry | null {
  if (!map) return null;
  if (item.kind === 'line') return map[item.line.url] ?? null;
  const urls = [item.episode.url, ...item.episode.sources.map((s) => s.url)];
  for (const u of urls) {
    if (map[u]) return map[u];
  }
  return null;
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
  const { isSeries, seasons, seasonNumbers, video, sourceName } = data;

  // 直接订阅观看历史 store：播放页在 timeupdate 时持续写入进度，
  // 返回并重新打开弹窗时，必须显示「最新」进度与百分比，不能依赖父页是否重渲染
  // （详情页在 Keep-Alive 下可能因 memo 跳过重渲染而拿到过期 props）。
  const liveHistory = useUserStore((s) => s.history);

  // 实时重建 progressMap（按 episodeUrl 命中），供线路/选集进度条与百分比显示。
  const liveProgressMap = useMemo<Record<string, PlaylistProgressEntry>>(() => {
    const map: Record<string, PlaylistProgressEntry> = {};
    if (!videoId) return map;
    for (const h of liveHistory) {
      if (h.videoId === videoId && h.episodeUrl) {
        map[h.episodeUrl] = {
          progress: h.progress,
          duration: h.duration,
          completed: h.duration > 0 && h.progress >= h.duration,
        };
      }
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

  const activeVideo = isSeries ? seasons[seasonIdx] : video;
  const currentSeasonNumber = isSeries ? seasonNumbers[seasonIdx] : 0;

  // 当前季对应的「最后播放选集」集号（仅当历史记录正好属于当前季时才有值）。
  // 用于把「播放中」标记限定在历史记录所属的那一季，避免串到其他季。
  const currentSeasonHistEp = useMemo(() => {
    if (!isSeries || !historyRecord) return null;
    if (historyRecord.seasonNumber !== currentSeasonNumber) return null;
    const m = /(\d+)/.exec(historyRecord.episodeLabel || '');
    const y = m ? parseInt(m[1], 10) : NaN;
    return Number.isNaN(y) ? null : y;
  }, [isSeries, historyRecord, currentSeasonNumber]);

  const allItems = useMemo<Item[]>(() => {
    if (isSeries) {
      return sortByNumber(activeVideo?.episodes ?? []).map((ep, i) => ({
        kind: 'ep' as const,
        origIndex: i,
        episode: ep,
        number: ep.number,
        title: ep.title,
      }));
    }
    return (video.sources ?? []).map((s, i) => ({
      kind: 'line' as const,
      origIndex: i,
      line: s,
      number: i + 1,
      title: s.name,
    }));
  }, [isSeries, activeVideo, video.sources]);

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

  // 切季 / 切类型时：重置搜索、可见数量，并根据历史推断"已看"与初始选中
  useEffect(() => {
    setQuery('');
    setVisibleCount(40);
    const w = new Set<number>();
    let init = 0;
    if (isSeries && historyRecord && historyRecord.seasonNumber === currentSeasonNumber) {
      const m = /(\d+)/.exec(historyRecord.episodeLabel || '');
      const y = m ? parseInt(m[1], 10) : NaN;
      if (!Number.isNaN(y)) {
        allItems.forEach((it) => {
          if (it.kind === 'ep' && it.number <= y) w.add(it.number);
        });
        const idx = allItems.findIndex((it) => it.kind === 'ep' && it.number === y);
        if (idx >= 0) init = idx;
      }
    }
    setWatched(w);
    setSelectedIdx(init);
  }, [seasonIdx, isSeries, historyRecord, currentSeasonNumber, allItems]);

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
          seasonNumber: currentSeasonNumber,
          episodeId: item.episode.id,
          episode: item.episode,
          sources: activeVideo?.sources ?? [],
          sourceIndex: activeSourceIndex,
        });
      } else {
        onPlayLine(item.origIndex, null, item.line.url, item.line.type);
      }
    },
    [onPlayEpisode, onPlayLine, currentSeasonNumber, activeVideo, activeSourceIndex],
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
              ? `${video.title} · 第${currentSeasonNumber === 0 ? '正片' : currentSeasonNumber}季`
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

      <div className="playlist-main">
        {isSeries && seasons.length > 1 && (
          <div className="playlist-seasons" role="tablist" aria-label="选择季">
            {seasonNumbers.map((sn, i) => (
              <button
                key={sn}
                role="tab"
                aria-selected={i === seasonIdx}
                className={`playlist-season-tab${i === seasonIdx ? ' is-active' : ''}`}
                onClick={() => setSeasonIdx(i)}
              >
                {sn === 0 ? '正片' : `第${sn}季`}
              </button>
            ))}
          </div>
        )}

        <div className="playlist-content">
          <div className="playlist-toolbar">
            <div className="playlist-search">
              <span className="playlist-search-icon">🔍</span>
              <input
                className="playlist-search-input"
                type="text"
                placeholder={isSeries ? '搜索本季剧集…' : '搜索播放线路…'}
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
            <div className="playlist-grid" ref={gridRef} key={seasonIdx}>
              {visibleItems.map((it, flatIdx) => {
                const isSel = flatIdx === selectedIdx;
                const isWatched = it.kind === 'ep' && watched.has(it.number);
                // 「播放中」仅限历史记录所属季、且集号命中的那一个 cell，
                // 避免非历史季默认选中的第一集也显示「播放中」而串季。
                const isPlaying = isSel && it.kind === 'ep' && currentSeasonHistEp != null && it.number === currentSeasonHistEp;
                const prog = cellProgress(it, progressMap);
                const pct =
                  prog && prog.duration > 0
                    ? Math.min(100, Math.round((prog.progress / prog.duration) * 100))
                    : 0;
                const cls = [
                  'playlist-cell',
                  isSel ? 'is-selected' : '',
                  isWatched ? 'is-watched' : '',
                  flatIdx === flashIdx ? 'is-flash' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <button
                    key={it.kind === 'ep' ? it.episode.id : `line-${it.origIndex}`}
                    type="button"
                    className={cls}
                    data-cell={flatIdx}
                    onClick={() => {
                      setSelectedIdx(flatIdx);
                      playItem(it);
                    }}
                  >
                    <span className="playlist-cell-num">{it.number}</span>
                    <span className="playlist-cell-title">{it.title}</span>
                    {it.kind === 'ep' && isWatched && (
                      <span className="playlist-cell-check">✓</span>
                    )}
                    {isPlaying && <span className="playlist-cell-playing">播放中</span>}
                    {it.kind === 'line' && (
                      <span className="playlist-cell-type">{it.line.type.toUpperCase()}</span>
                    )}
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
        </div>
      </div>
    </div>
  );

  const baseClass = `playlist-modal playlist-modal--${variant} ${
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
