/**
 * HeroBanner — 首页 Hero 横幅
 *
 * 布局：左侧主背景图（active item）+ 右侧竖排缩略图列（海报+标题）。
 * - 主图随 activeIndex 切换，采用左右滑动动画（所有客户端一致）；自动轮播也走滑动切换
 * - 桌面端悬停缩略图时预览主图（crossfade），不改变 activeIndex，不触发滑动
 * - 右侧缩略图自动轮播（5s），鼠标悬停切换主图并暂停轮播
 * - 移动端隐藏右侧缩略图列，仅保留主图 + 内容
 */
import { useState, useEffect, useLayoutEffect, useCallback, useRef, memo } from 'react';
import { Play } from 'lucide-react';
import { useIsMobile, useIsTV } from '@/hooks/useMediaQuery';
import { useScreenTier } from '@/hooks/useScreenTier';
import { buildImageUrl, buildImageSrcSet } from '@/services/tmdbService';
import { isImageLoaded, markImageLoaded } from '@/components/LazyImage/imageCache';
import './HeroBanner.css';
import { Icon } from "@/components/ui/Icon";

interface HeroItem {
  id: number | string;
  title: string;
  backdropPath?: string | null;
  posterPath?: string | null;
  overview?: string;
  voteAverage?: number;
  releaseDate?: string;
  mediaType?: 'movie' | 'tv';
  backdrop_path?: string;
  poster_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  name?: string;
}

interface HeroBannerProps {
  items: HeroItem[];
  autoPlayInterval?: number;
  onItemClick?: (item: HeroItem) => void;
  onContinuePlay?: (item: HeroItem) => void;
  historyMap?: Map<string, { progress: number }>;
  /** hero 数据是否加载中（加载中且 items 为空时只显示骨架，不显示误导文字） */
  loading?: boolean;
   /**
    * Keep-Alive 激活信号：首页处于激活路由（页面可见）时为 true；
    * 切到其他页面时 AppLayout 用 display:none 隐藏（组件不卸载），此时为 false。
    * 用于：离开时暂停自动轮播（避免隐藏期间 activeIndex/bgIndices/slideDir 继续推进、
    * 切回时 CSS animation 因 display:none→block 重播导致「闪一下上一张图」），
    * 切回时重置过渡状态 + 归单层 bgIndices。
    */
   active?: boolean;
   /** 初始淡入延迟（ms）：进入首页时延迟 heroBgFadeIn，等骨架覆盖层消失后再开始，避免叠加混乱。 */
   initialEnterDelay?: number;
}

const HERO_MASK_BG = 'var(--hero-mask-dark)';
/**
 * 分类切换滞留层清除延迟：新层真实绘制完成（onLoad/onError/ref-complete）后，
 * 等其 is-active 淡入（0.8s）播完再加余量再移除滞留层（旧图垫底防露底）。
 * reduced-motion 下动画被禁用、无 animationend 事件，由定时器兜底。
 */
const STALE_CLEAR_DELAY = 1200;
/** 预加载 URL 集合容量上限：长会话防无界增长（E 项，LRU 近似 FIFO 淘汰最旧） */
const MAX_PRELOADED_URLS = 1000;
/** 已请求预加载的 URL 集合：快速左右滑动时避免对同一 URL 重复 new Image + 解码（卡顿主因之一） */
const preloadedSet = new Set<string>();
/** 预加载图片（按视口选择解码尺寸：宽屏 w1280，窄屏/移动端 w780 足够且解码更快） */
function preloadImage(url: string | null | undefined): void {
  if (!url) return;
  if (preloadedSet.has(url)) return;
  preloadedSet.add(url);
  // 超容量淘汰最早加入的 URL：本场景仅需「已请求过」去重，无需 LRU 提升（偶发淘汰后重取，可忽略）
  if (preloadedSet.size > MAX_PRELOADED_URLS) {
    const oldest = preloadedSet.values().next().value;
    if (oldest !== undefined) preloadedSet.delete(oldest);
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  if (typeof img.decode === 'function') {
    img.decode().catch(() => {});
  }
}

/** 背景图预加载尺寸：移动端/窄视口用 w780（banner 实际渲染宽度即为视口宽），宽屏才用 w1280 */
function bgPreloadSize(): string {
  return window.innerWidth >= 1100 ? 'w1280' : 'w780';
}

/**
 * 滑动真实数据记录（问题 #2 调试用）：把「主图区真实宽度 / 滑动距离 / 阈值 / 是否翻页」
 * 记录下来，方便核对 50% 阈值为何永远触发不了切换。
 * - DEV 下打印到 console（前缀 [HeroBanner][swipe]）
 * - 同时累积到 window.__heroSwipeLog（数组），可在控制台随时读取真实样本
 */
function recordSwipeData(data: { mainWidth: number; dx: number; threshold: number; switched: boolean }): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[HeroBanner][swipe]', data);
  }
  try {
    const w = window as unknown as { __heroSwipeLog?: unknown[] };
    w.__heroSwipeLog = w.__heroSwipeLog || [];
    (w.__heroSwipeLog as unknown[]).push({ ...data, t: Date.now() });
  } catch {
    /* 忽略：极端环境下 window 不可写 */
  }
}


export default function HeroBanner({
  items,
  autoPlayInterval = 5000,
  onItemClick,
  onContinuePlay,
  historyMap,
  loading = false,
  active = true,
  initialEnterDelay = 0,
}: HeroBannerProps) {
  const isMobile = useIsMobile();
  const isTV = useIsTV();
  const { tier } = useScreenTier();
  const isWide = tier === 'large' || tier === 'xlarge';
  // 不截取接口数据：使用全部 items 驱动轮播；主图仅渲染当前+上一张（见 bgIndices）避免加载全部背景图
  const displayItems = items;

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // 悬停预览态：鼠标悬停缩略图时主图预览该项，但不改变 activeIndex（缩略图窗口不移动）
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // 主图实际显示项：悬停时预览 hoveredIndex，否则显示 activeIndex。
  // ⚠️ 越界保护：items 变化（切换分类）时 activeIndex 仅在下方 useEffect 中重置，
  // 其间的渲染会用「旧 activeIndex + 新 items」——若新 items 更短则越界，
  // displayItems[displayIndex] 为 undefined，后续读取 .name 等抛错导致整页白屏。
  // 故 displayIndex / activeIndex 一律钳制到当前 items 长度范围内。
  const safeActiveIndex = displayItems.length > 0
    ? Math.min(activeIndex, displayItems.length - 1)
    : 0;
  const safeHoveredIndex = hoveredIndex !== null && hoveredIndex < displayItems.length
    ? hoveredIndex
    : null;
  const displayIndex = safeHoveredIndex !== null ? safeHoveredIndex : safeActiveIndex;
  // 主图背景层：仅渲染当前 + 上一张（最多 2 层），支持无限数据而不预加载全部背景图
  const [bgIndices, setBgIndices] = useState<number[]>([0]);
  // 主 banner 图是否已渲染完成（首张背景图 onLoad 后置 true）。
  // 用于控制右侧缩略图列：渲染完成前显示骨架占位，完成后才揭示真实缩略图。
  const [bannerReady, setBannerReady] = useState(false);
  // 同步显示索引：驱动「文字 + 缩略图窗口 + 缩略图高亮」，在切换【开始】时即更新
  // （与 bg track 的 activeIndex 解耦——track 需在切换结束才更新 activeIndex 以保证
  // 滑动方向正确）。这样文字/缩略图与 banner 滑动几乎同时出现，消除「切换后才延迟显示」的滞后。
  const [switchIndex, setSwitchIndex] = useState(0);
  // ── 分类切换图片过渡（2026-08-13）──
  // 分类切换（items 引用变化）时主图不再硬切：切换渲染当帧起「不渲染新层」，
  // 旧活跃图快照为滞留层（--stale，opacity 1 垫底），同时用 new Image() 预加载
  // 新首项背景图——就绪后 switchReady=true 才挂载新层（图片已缓存 → 立即绘制 +
  // is-active 的 heroBgFadeIn 0.8s 淡入完整播放），再延时移除滞留层。
  // 消除「旧图卸载 → 新图加载期间空白 → 加载完直接蹦出」的硬切，与轮播 crossfade 同机制。
  // ⚠️ 过渡期判断 = `itemsChanged || !switchReady`：渲染期派生只覆盖切换那一帧，
  // useLayoutEffect 紧接着 setSwitchReady(false) 标记过渡中，避免「img 挂载时状态陈旧、
  // load 事件早发导致永远卡在透明层」的闭包竞态；解除动作全部幂等。
  // 无背景图 / 新图加载失败：fail-open 直接渲染（新层无图区域由背景色承接）。
  const [switchReady, setSwitchReady] = useState(true);
  // 当前预加载 url：快速连点切换时旧预加载完成后不得覆盖新目标（防竞态）
  const switchLoadRef = useRef<string | null>(null);
  // 过渡期滞留层快照（state）：切换帧由渲染期派生首帧，useLayoutEffect 写入同值（幂等），
  // 过渡期（itemsChanged 已消失）继续垫底；新层淡入完成后由清除逻辑置 null。
  const [staleSnapshot, setStaleSnapshot] = useState<{ url: string; srcSet?: string; id: string } | null>(null);
  // ── 滞留层清除（D 项收尾）──
  // 由「新层真实绘制事件」驱动启动，而非 switchReady 变化即起算——switchReady=true（预加载
  // onload）到新层 <img> 实际绘制（onLoad/ref-complete）之间存在渲染/解码间隙，旧实现从
  // switchReady 起算 1200ms，间隙大时「旧层被提前清 → 新层未就绪 → 露深色」。改为新层
  // is-active 层真实绘制完成后起算（覆盖 0.8s 淡入 + 余量），杜绝提前清。
  const staleSnapshotRef = useRef(staleSnapshot);
  staleSnapshotRef.current = staleSnapshot;
  const staleClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleStaleClear = useCallback(() => {
    if (staleSnapshotRef.current == null) return;
    if (staleClearTimerRef.current) clearTimeout(staleClearTimerRef.current);
    staleClearTimerRef.current = setTimeout(() => {
      staleClearTimerRef.current = null;
      setStaleSnapshot(null);
    }, STALE_CLEAR_DELAY);
  }, []);
  // 卸载兜底清理（Keep-Alive 下组件常驻，但 /play 等非 Keep-Alive 路由仍会卸载）
  useEffect(() => () => {
    if (staleClearTimerRef.current) clearTimeout(staleClearTimerRef.current);
  }, []);
  // 缩略图数量自适应：大屏 4 个，普通桌面 3 个
  const maxCount = isWide ? 4 : 3;
  const visibleCount = Math.min(maxCount, displayItems.length);

  // items 变化时重置 activeIndex、预览态与背景层
  // 仅在 items 从空变为有时重置 bannerReady（骨架→真实），
  // 已有数据时保持 bannerReady 不变，避免骨架图闪烁。
  const prevItemsLenRef = useRef(displayItems.length);
  // 分类切换滞留层快照用：上一 committed 的 items 引用 + 活跃索引
  // （useLayoutEffect 在每个 commit 后同步更新，渲染期读到的即「上一 commit」的值）
  const prevItemsRef = useRef<HeroItem[]>(displayItems);
  const prevDisplayIdxRef = useRef(displayIndex);
  // banner 根元素 ref：仅用于 DOM 挂载锚点（aspect-ratio 由 CSS 通过 --hero-thumb-count
  // 计算，缩略图列宽改为百分比，不再依赖 JS 注入的高度变量）。
  const bannerRef = useRef<HTMLElement>(null);
  // hero-banner__main 真实宽度引用：松手时读取会丢（隐藏态 offsetWidth=0），
  // 故拖拽开始时即捕获。滑动阈值参照物必须是「主图区真实宽度」而非整张 banner
  // （主图区只占桌面端 ~80%，用整宽会让 50% 阈值大得几乎永远触发不了切换）。
  const mainRef = useRef<HTMLDivElement>(null);
  // 滑行动画时长（自动轮播 / 手动翻页 / 遥控器 统一使用，保证三处切换逻辑一致）
  // 600ms（原为 400ms，自动轮播「滚动太快」）：配合平缓缓动，滑动更从容
  const SLIDE_MS = 600;
  // 回弹动画时长：比翻页略长，缓动无过冲（问题 #3：原 520ms + 过冲曲线显得「咔一下瞬回」）
  const BOUNCE_MS = 700;
  // ⚠️ 必须用 useLayoutEffect（而非 useEffect）：bannerReady 重置必须在「浏览器 paint 之前」
  // 同步完成，否则会出现以下闪烁序列——React 先按旧的 bannerReady=true 渲染出「新分类的真实
  // 缩略图」并绘制一帧，useEffect（paint 之后）才把它重渲染成骨架，再等背景图加载后又变回真实
  // 缩略图，表现为「右侧缩略图闪一下」。useLayoutEffect 会在那一帧被绘制前就重渲染为骨架，
  // 用户只看到干净的「骨架 → 真实」过渡，从根本上消除切换分类/进入首页时的缩略图闪烁。
  // 注意：仅该重置逻辑用 useLayoutEffect；正向下「背景图加载完成 → bannerReady=true」的揭示
  // 仍留在下方普通 useEffect，避免任何时序回归，缩略图骨架→真实的 loading 反馈保持不变。
  useLayoutEffect(() => {
    setActiveIndex(0);
    setHoveredIndex(null);
    setSwitchIndex(0);
    setBgIndices([0]);

    const prevLen = prevItemsLenRef.current;
    const curLen = displayItems.length;
    // 分类切换时重置轮播计时/滑动状态：不记录上一次轮播的时间，
    // 避免切回/切换后沿用旧阈值与预加载范围导致动画异常或预加载失准。
    swipeCooldownRef.current = 0;
    lastSlideTimeRef.current = 0;
    preloadRangeRef.current = 3;

    // 分类切换图片过渡（切换帧提交后同步执行）：
    // 新首项图预加载就绪前不渲染新层（滞留层旧图垫底），就绪后 switchReady=true 恢复渲染。
    // 预加载走 new Image()（独立于 React img），完成后触发重渲染；
    // switchLoadRef 防快速连点：仅最近一次预加载的结果生效。
    const itemsChanged = prevItemsRef.current !== displayItems;
    if (itemsChanged) {
      const oldItem = prevItemsRef.current[prevDisplayIdxRef.current];
      const oldPath = oldItem?.backdropPath || oldItem?.backdrop_path;
      const newPath = displayItems[0]?.backdropPath || displayItems[0]?.backdrop_path;
      if (curLen > 0 && oldPath && newPath) {
        const oldUrl = buildImageUrl(oldPath, 'w1280');
        const url = buildImageUrl(newPath, 'w1280');
        if (oldUrl && url) {
          // 有缓存（切回已看过的分类）：保留旧图作 stale 垫底，新层挂起（opacity:0）
          // 待 new Image() 预加载 onload 后 switchReady 淡入覆盖 → 平滑过渡。
          // 未缓存（首次进入/首次切到该分类）：跳过「旧图滞留 + 预加载门控」，
          // 直接渲染新层让图片走自身加载（加载期间由 .hero-banner__main 深色渐变承接，
          // 不会露白），消除「旧图滞留很久才更新」的慢感知，也契合「无缓存不残留留层」的预期。
          const cached = isImageLoaded(url);
          if (staleClearTimerRef.current) {
            clearTimeout(staleClearTimerRef.current);
            staleClearTimerRef.current = null;
          }
          if (cached) {
            setStaleSnapshot({
              url: oldUrl,
              srcSet: buildImageSrcSet(oldPath, ['w780', 'w1280']) ?? undefined,
              id: String(oldItem.id),
            });
            switchLoadRef.current = url;
            setSwitchReady(false);
            const img = new Image();
            const done = () => {
              if (switchLoadRef.current === url) {
                switchLoadRef.current = null;
                setSwitchReady(true);
              }
            };
            img.onload = done;
            img.onerror = done;
            img.src = url;
          } else {
            setStaleSnapshot(null);
            setSwitchReady(true);
          }
        } else {
          setStaleSnapshot(null);
          setSwitchReady(true);
        }
      } else {
        setStaleSnapshot(null);
        setSwitchReady(true);
      }
    }

    if (curLen > 0 && prevLen === 0) {
      // 从空变为有数据：重置 bannerReady，等待背景图加载
      setBannerReady(false);
      const t = window.setTimeout(() => setBannerReady(true), 3000);
      prevItemsLenRef.current = curLen;
      return () => window.clearTimeout(t);
    } else if (curLen > 0) {
      // 已有数据且 items 变化（如切换分类）：
      // ⚠️ 不再重置 bannerReady 为骨架占位（此前这行是「缩略图闪一下」的根因：
      //   切换瞬间真实图→骨架→真实图的硬切换）。改为保持 true，交由各 HeroThumb 自身的
      //   「预加载完成再换图」机制在新/旧海报间做平滑交叉淡入（旧图持续显示直到新图就绪），
      //   实现图片参与动画、无延迟无闪烁。主图背景层 key=item.id（见下方渲染）：新类目首项
      //   id 不同 → 新建 <img>；配合上方 staleSnapshot 滞留层做「旧图垫底 → 新图就绪淡入」，
      //   也不会出现「仍显示上一个类目图片」的滞留（滞留层在新图淡入完成后移除）。
      //   整页切换过渡由 Home 页级 SWR 渲染层负责（旧内容保留 + 首屏卡片预加载后再
      //   原位替换，不再做亮度凹陷），见 Home/index.tsx。
      prevItemsLenRef.current = curLen;
    } else {
      // 变为空：重置
      setBannerReady(false);
      prevItemsLenRef.current = curLen;
    }
    // ⚠️ 依赖必须仅 [displayItems]（不含 displayIndex）：
    // 轮播/悬停/拖拽会改变 displayIndex，若被本 effect 捕获会执行上方的
    // setActiveIndex(0)/setHoveredIndex(null)/setBgIndices([0]) 重置，
    // 导致「轮播切到下一张立刻被重置回 0」的轮播失效（2026-08-13 回归教训）。
    // refs（prevItemsRef/prevDisplayIdxRef）的同步已移入下方独立 useLayoutEffect。
  }, [displayItems]);

  // ── Keep-Alive 可见性守卫（离开/切回首页时重置过渡状态）──
  // AppLayout 用 display:none 隐藏离开页面（组件不卸载）。display:none 会中断
  // CSS animation，恢复 display:block 时浏览器**从 from 帧重播** is-active 层的
  // heroBgFadeIn/slide 动画。若此时 bgIndices 是 2 层（轮播/悬停/拖拽过），
  // 底层旧图（opacity:1 常显）会在重播淡入期间透出 →「先闪一下上一张图再淡入当前图」。
  // 处理：
  //  - 切回（active false→true）：归单层 bgIndices（底层无旧图可透出）+ 清 slideDir
  //    （不重播滑动动画）+ 清 hovered/滞留层/switchReady 过渡态 + 恢复轮播。
  //  - 离开（active true→false）：暂停轮播（interval 由 active 守卫控制）+ 清过渡态，
  //    避免隐藏期间状态残留、切回时被重播。
  const prevActiveRef = useRef(active);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  useLayoutEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;
    if (wasActive === active) return;
    if (active) {
      // 切回首页：归单层 + 清滑动方向/悬停/过渡态，防止 display:none→block 重播动画
      setHoveredIndex(null);
      setPaused(false);
      setSwitchIndex(Math.min(activeIndexRef.current, Math.max(0, displayItems.length - 1)));
      setBgIndices([Math.min(activeIndexRef.current, Math.max(0, displayItems.length - 1))]);
      switchLoadRef.current = null;
      if (staleClearTimerRef.current) { clearTimeout(staleClearTimerRef.current); staleClearTimerRef.current = null; }
      setStaleSnapshot(null);
      setSwitchReady(true);
    } else {
      // 离开首页：暂停轮播 + 清过渡态，但【保留当前轮播位置】（activeIndex/bgIndices 不变）。
      // 仅重置轮播计时/滑动状态：不记录上一次轮播的时间，切回时从当前位置继续、计时归零。
      setPaused(true);
      setHoveredIndex(null);
      setSlideAnim(null);
      setBounceBack(false);
      setIsDragging(false);
      setDragOffset(0);
      swipeCooldownRef.current = 0;
      lastSlideTimeRef.current = 0;
      preloadRangeRef.current = 3;
      switchLoadRef.current = null;
      if (staleClearTimerRef.current) { clearTimeout(staleClearTimerRef.current); staleClearTimerRef.current = null; }
      setStaleSnapshot(null);
      setSwitchReady(true);
    }
  }, [active]);

  // 渲染期派生（分类切换过渡）读的 refs 同步：每个 commit 后（paint 前）更新，
  // 使渲染期读到的 prevItemsRef/prevDisplayIdxRef 恒为「上一 commit」的值。
  // 独立 effect（无 setState 副作用）：displayIndex 频繁变化（轮播/悬停）也不会
  // 触发上方的重置逻辑（那是轮播失效根因）。
  useLayoutEffect(() => {
    prevItemsRef.current = displayItems;
    prevDisplayIdxRef.current = displayIndex;
  }, [displayItems, displayIndex]);

  // 当前主图无背景图时（无图可等），直接视为已就绪，避免缩略图列一直卡在骨架
  useEffect(() => {
    const item = displayItems[displayIndex];
    const hasBackdrop = !!(item?.backdropPath || item?.backdrop_path);
    if (!hasBackdrop) setBannerReady(true);
  }, [displayIndex, displayItems]);

  // displayIndex 变化时（含悬停预览），背景层保留上一张用于 crossfade / slide
  useEffect(() => {
    setBgIndices((prev) => {
      const last = prev[prev.length - 1];
      if (last === displayIndex) return prev;
      return [last, displayIndex];
    });
  }, [displayIndex]);

  // 分类切换过渡收尾：滞留层移除改由「新层 is-active img 真实绘制事件」
  // （onLoad/onError/ref-complete）驱动 scheduleStaleClear（见新层 <img> 事件绑定），
  // 不再在 switchReady 变化即起算 1200ms 定时器——消除预加载就绪与新层实际绘制
  // 之间的间隙导致「旧层提前清、新层未就绪露深色」的可能（D 项收尾）。

  // 滑动冷却期：滑动后 1000ms 内暂停自动轮播，避免动画冲突
  const swipeCooldownRef = useRef(0);
  // 滑动速度检测：记录上次滑动时间，快速滑动时扩大预加载范围
  const lastSlideTimeRef = useRef(0);
  // 动态预加载范围：默认 3，快速滑动时扩大到 6
  const preloadRangeRef = useRef(3);

  // 预加载背景图 + 即将出现的缩略图，保证轮播切换时图片已就绪
  useEffect(() => {
    if (displayItems.length <= 1) return;
    const total = displayItems.length;

    // 动态预加载范围：根据滑动速度调整
    // 快速连续滑动（<300ms 间隔）→ 扩大到 6，否则保持 3
    const now = Date.now();
    const timeSinceLastSlide = now - lastSlideTimeRef.current;
    if (timeSinceLastSlide < 300 && timeSinceLastSlide > 0) {
      preloadRangeRef.current = Math.min(6, total);
    } else if (timeSinceLastSlide >= 500) {
      // 500ms 无滑动 → 恢复默认范围
      preloadRangeRef.current = 3;
    }
    lastSlideTimeRef.current = now;

    const bgSize = bgPreloadSize();
    const range = preloadRangeRef.current;

    // 预加载当前索引 ± range 范围内的所有背景图
    for (let offset = -range; offset <= range; offset++) {
      const idx = ((activeIndex + offset) % total + total) % total;
      const p = displayItems[idx]?.backdropPath || displayItems[idx]?.backdrop_path;
      if (p) preloadImage(buildImageUrl(p, bgSize));
    }

    // 预加载即将出现在缩略图窗口中的图片（窗口大小 3，提前预加载前后各 1 张）
    const n = Math.min(3, total);
    const half = Math.floor(n / 2);
    for (let offset = -half; offset < n - half; offset++) {
      const idx = ((activeIndex + offset + 1) % total + total) % total;
      const thumbPath = displayItems[idx]?.backdropPath || displayItems[idx]?.backdrop_path;
      if (thumbPath) preloadImage(buildImageUrl(thumbPath, bgSize));
    }
  }, [activeIndex, displayItems]);

  // 轮播/拖拽进行中的实时态引用：供自动轮播定时器读取最新值（闭包问题），
  // 防止「动画仍在进行却因读到陈旧 null 而重复触发」导致的轮播错乱/失效。
  const slideAnimRef = useRef<'forward' | 'backward' | null>(null);
  const isDraggingRef = useRef(false);

  // ── 统一翻页（自动轮播 / 遥控器 / 手动拖拽翻页 三处共用同一套 track 滑动动画）──
  // 之前的实现里三处各自内联一份「setSwitchIndex + setSlideAnim + setTimeout 400ms」，
  // 一旦某处时长/冷却/抑制淡入标记不一致就会产生「自动轮播与手动滑动观感不同」的割裂。
  // 收敛为单一入口后，三种触发方式的切换动画、冷却、淡入抑制完全对齐。
  const triggerSlide = useCallback((dir: 1 | -1, fromDrag = false) => {
    const total = displayItems.length;
    if (total <= 1) return;
    const newIdx = (activeIndexRef.current + dir + total) % total;
    setSwitchIndex(newIdx); // 切换开始即同步背景图/缩略图
    setSlideAnim(dir > 0 ? 'forward' : 'backward');
    if (!fromDrag) {
      // 非拖拽（自动轮播 / 遥控器）：track 是全新挂载，先挂引导帧(-100%)再过渡
      setSlideBoot(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSlideBoot(false));
      });
    }
    swipeCooldownRef.current = Date.now();
    lastSlideTimeRef.current = Date.now();
    window.setTimeout(() => {
      setActiveIndex(newIdx);
      setSlideAnim(null);
      setTextRiseEnabled(false); // 落定一拍内关闭当前槽入场，避免新文字二次重播
      setSuppressFadeInId(displayItems[newIdx]?.id ?? null);
    }, SLIDE_MS);
    setHoveredIndex(null);
  }, [displayItems]);

  // 分类切换 / 首屏数据就绪：重置「当前文字入场」开关，让新分类文字播一次自下而上出场
  useEffect(() => {
    setTextRiseEnabled(true);
  }, [displayItems]);

  // 自动轮播（悬停暂停 / 仅 1 项不轮播 / 滑动冷却期内暂停 / 页面隐藏（Keep-Alive 离开）不轮播）
  useEffect(() => {
    if (paused || !active || displayItems.length <= 1) return;
    const timer = window.setInterval(() => {
      // 滑动后 1000ms 内不轮播，避免与滑动动画冲突
      if (Date.now() - swipeCooldownRef.current < 1000) return;
      if (isDraggingRef.current || slideAnimRef.current) return;
      // 自动轮播前进：与手动滑动共用同一套 track 滑动动画（triggerSlide）
      triggerSlide(1);
    }, autoPlayInterval);
    return () => window.clearInterval(timer);
  }, [paused, active, displayItems.length, autoPlayInterval, triggerSlide]);

  // 遥控器方向键切换（仅 TV 端 + 页面激活时）：与手动滑动共用 triggerSlide
  useEffect(() => {
    if (!isTV || !active || displayItems.length <= 1) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      triggerSlide(dir);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isTV, active, displayItems.length, triggerSlide]);

  // 悬停缩略图：预览主图 + 暂停轮播 + 预加载背景图
  const handleThumbEnter = useCallback((idx: number) => {
    setSuppressFadeInId(null);
    setHoveredIndex(idx);
    setPaused(true);
    const item = displayItems[idx];
    const p = item?.backdropPath || item?.backdrop_path;
    if (p) preloadImage(buildImageUrl(p, 'w1280'));
  }, [displayItems]);

  // 移出整个 hero-banner：将 activeIndex 同步到当前预览项，再取消预览 + 恢复轮播
  const handleBannerLeave = useCallback(() => {
    setHoveredIndex((h) => {
      if (h !== null) {
        setActiveIndex(h);
        setSwitchIndex(h);
      }
      return null;
    });
    setPaused(false);
  }, []);

  // 拖拽/滑动切换图片：桌面端鼠标拖拽 + 移动端触摸滑动
  // 三联 track 模式：拖拽/滑动动画期间渲染 [prev | current | next] 三张并排，
  // track translateX(-100%) 居中当前图；拖拽时 translateX(calc(-100% + offset))；
  // 松手翻页后动画滑向 -200%/0%，动画结束后重置回三联居中（-100%）。
  // 非拖拽/滑动时回退为 absolute 堆叠 crossfade 渲染（保持现有逻辑）。
  const dragStartX = useRef(0);  // 防止 section onMouseUp 与 window mouseup 双触发导致 handleDragEnd 执行两次
  const dragEndedRef = useRef(false);
  // 拖拽开始瞬间捕获的 banner 真实宽度（offsetWidth）：阈值取「当前状态下 banner 宽度的一半」，
  // 避免在 end 时读取（隐藏态 offsetWidth=0 会错误回退 600）。
  const bannerWidthRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // 滑动动画方向：松手后 'forward'（下一张，track → -200%）或 'backward'（上一张，track → 0%）
  const [slideAnim, setSlideAnim] = useState<'forward' | 'backward' | null>(null);
  // 滑动「起始帧」标记：自动轮播 / 遥控器触发翻页时，track 元素是「从 crossfade 模式
  // 全新挂载」的（之前未渲染 track）。若直接把 transform 设成目标位(-200%/0%)并挂 transition，
  // 新挂载元素没有「起始帧」→ 浏览器直接渲染到目标位、不播过渡 → 自动轮播变成「瞬切」，
  // 与手动拖拽（track 已挂载、从拖拽位置平滑滑出）观感完全两套。故非拖拽触发时先以
  // slideBoot=true 把 track 挂载在 -100%（当前图，与 crossfade 显示一致、无跳变），
  // 下一帧再撤掉标记 → transform 过渡到目标位 → 真正滑出。拖拽翻页时 track 早已挂载，
  // 不需要此引导帧，直接走 transition 即可。
  const [slideBoot, setSlideBoot] = useState(false);
  slideAnimRef.current = slideAnim;
  isDraggingRef.current = isDragging;
  // 未达翻页阈值时的平滑回弹动画：true 期间 track 以弹性缓动过渡回到原位（-100%），
  // 结束后切回 crossfade（否则松手瞬间 track 直接卸载 → 图片硬跳回，观感生硬）
  const [bounceBack, setBounceBack] = useState(false);
  // 静止当前文字的「自下而上入场」开关：初始 / 分类切换时为 true（播一次出场）；
  // 滑动切换结束瞬间置 false 一拍，避免新文字在滑入时已入场、落定又被当前槽重播（二次抖动）。
  const [textRiseEnabled, setTextRiseEnabled] = useState(true);
  // track→crossfade 切换瞬间的淡入抑制：track 动画结束切回 crossfade 时，
  // 新图 is-active 会触发 heroBgFadeIn（opacity 0→1），但 track 刚才已显示该图在 opacity 1 → 闪烁。
  // 用此标记短暂跳过动画，让 crossfade 层以 opacity 1 静态挂载，与 track 无缝衔接。
  // 抑制淡入的 item.id：仅对该 item 的活跃层挂 --no-anim（首帧 opacity:1 不播 heroBgFadeIn），
  // 避免「切走后移除类重新触发淡入」导致的闪一下。随每次切换被新 id 覆盖，无需定时器。
  const [suppressFadeInId, setSuppressFadeInId] = useState<string | number | null>(null);
  const handleDragStart = useCallback((x: number) => {
    dragEndedRef.current = false;
    dragStartX.current = x;
    // 参照物必须是「主图区真实宽度」(hero-banner__main)，不是整张 banner。
    // 桌面端主图区只占整 banner 的 ~80%（其余是缩略图列），用整宽会让 50% 阈值
    // 大得几乎永远触发不了切换；故拖拽开始即捕获主图区宽度。
    bannerWidthRef.current = mainRef.current?.offsetWidth ?? bannerRef.current?.offsetWidth ?? 0;
    recordSwipeData({ mainWidth: bannerWidthRef.current, dx: 0, threshold: 0, switched: false });
    setIsDragging(true);
    setSlideAnim(null);
    setPaused(true);
  }, []);
  const handleDragMove = useCallback((x: number) => {
    if (!isDragging) return;
    setDragOffset(x - dragStartX.current);
  }, [isDragging]);
  const handleDragEnd = useCallback((x: number) => {
    if (!isDragging || dragEndedRef.current) return;
    dragEndedRef.current = true;
    const dx = x - dragStartX.current;
    const total = displayItems.length;
    // 阈值参照「主图区真实宽度」：旧的 50% 阈值过大（且参照的是整 banner 宽更离谱），
    // 轻扫根本翻不了页。改为 15%、最小 60px —— 轻扫即翻、重扫更灵敏。
    const mainW = bannerWidthRef.current
      || mainRef.current?.offsetWidth
      || bannerRef.current?.offsetWidth
      || 1;
    const threshold = Math.max(100, mainW * 0.4);
    const switched = Math.abs(dx) >= threshold && total > 1;
    recordSwipeData({ mainWidth: mainW, dx, threshold, switched });
    setIsDragging(false);
    setPaused(false);
    if (!switched) {
      // 极小拖拽（几乎没移动，如轻轻一点）：直接归位、不播任何回弹动画，
      // 避免「轻轻一碰 banner 也来回弹」的过度晃动（问题：不要过多的回弹）。
      if (Math.abs(dx) < 12) {
        setDragOffset(0);
        setSuppressFadeInId(displayItems[safeActiveIndex]?.id ?? null);
        return;
      }
      // 未达翻页阈值：平滑回弹。
      // 关键点：不能在设置 bounceBack 的同一帧把 dragOffset 归零 —— 否则 track 上一帧是
      // 「transition:none 下停在拖拽位置」，本帧直接把 transform 写成 -100% 且挂上 transition，
      // 浏览器会把它当作「初始值」而非「过渡起点」，导致无过渡 → 硬跳回（观感生硬/像没动画）。
      // 正确做法：保留当前 dragOffset 作为「起始帧」并先挂 transition，下一帧再把 dragOffset
      // 置 0，触发「从拖拽位置 → -100%」的过渡；缓动无过冲、慢收尾，回弹舒缓。
      setBounceBack(true);
      setSuppressFadeInId(displayItems[safeActiveIndex]?.id ?? null);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setDragOffset(0));
      });
      window.setTimeout(() => setBounceBack(false), BOUNCE_MS);
      return;
    }
    // 翻页：共用 triggerSlide，保证与自动轮播 / 遥控器 的切换动画完全一致
    const dir = dx < 0 ? 1 : -1; // 1=前进(左拖), -1=后退(右拖)
    setDragOffset(0);
    triggerSlide(dir, true); // fromDrag=true：track 已挂载，直接过渡、无需引导帧
  }, [isDragging, displayItems.length, safeActiveIndex, displayItems, triggerSlide]);

  // 拖拽期间在 window 级监听移动/松手/失焦：解决「指针移出 <section> 后松手，
  // section 的 onMouseUp 不触发 → handleDragEnd 不执行 → isDragging 卡死、无法切换」。
  // 阈值现为主图区宽度的 15%（最小 60px），轻扫即翻；跨过阈值必然移出 section，
  // 故「在 section 外松手」是翻页拖拽的常态，必须由 window 兜底。
  useEffect(() => {
    if (!isDragging) return;
    const lastXRef = { current: dragStartX.current };
    const onMove = (e: MouseEvent) => { lastXRef.current = e.clientX; handleDragMove(e.clientX); };
    const onEnd = (e: MouseEvent) => handleDragEnd(e.clientX);
    // 指针移出浏览器窗口/失焦（alt-tab）时兜底结束拖拽，避免 isDragging 卡死
    const onBlur = () => handleDragEnd(lastXRef.current);
    const onTouchMove = (e: TouchEvent) => { const t = e.touches[0]; if (t) { lastXRef.current = t.clientX; handleDragMove(t.clientX); } };
    const onTouchEnd = (e: TouchEvent) => { const t = e.changedTouches[0]; if (t) handleDragEnd(t.clientX); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('blur', onBlur);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // 空状态：加载中只显示骨架（无文字），加载完成且无数据才显示"暂无推荐"。
  // 注意：即使 items 为空，也立即渲染右侧缩略图骨架列，避免骨架"出现太慢"。
  if (!displayItems.length) {
    return (
      <div className="hero-banner__card">
        <section ref={bannerRef} className={`hero-banner hero-banner--empty${isTV ? ' hero-banner--tv' : ''}`} style={{ ['--hero-thumb-count' as string]: maxCount, aspectRatio: isMobile ? '16 / 9' : (maxCount === 4 ? '20 / 9' : '64 / 27') } as React.CSSProperties} aria-label="热门推荐">
          <div className="hero-banner__bg-wrapper">
            <div className="hero-banner__bg-placeholder" />
            <div className="hero-banner__mask" style={{ background: HERO_MASK_BG }} />
          </div>
          {loading ? (
            <div className="hero-banner__content" aria-hidden="true">
              <div className="hero-banner__text">
                <span className="hero-banner__skeleton hero-banner__skeleton--title thumbnail-skeleton-bg" />
                <span className="hero-banner__skeleton hero-banner__skeleton--meta thumbnail-skeleton-bg" />
                {!isMobile && <span className="hero-banner__skeleton hero-banner__skeleton--desc thumbnail-skeleton-bg" />}
                <span className="hero-banner__skeleton hero-banner__skeleton--btn thumbnail-skeleton-bg" />
              </div>
            </div>
          ) : (
            <div className="hero-banner__content">
              <div className="hero-banner__text">
                <h1 className="hero-banner__title hero-banner__title--placeholder">暂无推荐</h1>
              </div>
            </div>
          )}
          {!isMobile && (
            <div className="hero-banner__thumbs" aria-hidden="true" style={{ ['--hero-thumb-count' as string]: maxCount } as React.CSSProperties}>
              {Array.from({ length: maxCount }).map((_, i) => (
                <div key={`sk-${i}`} className="hero-banner__thumb hero-banner__thumb--skeleton">
                  <span className="hero-banner__thumb-skeleton thumbnail-skeleton-bg" />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  const safeSwitchIndex = displayItems.length > 0
    ? Math.min(switchIndex, displayItems.length - 1)
    : 0;
  // 文字 track 与背景图 track 同构：拖拽 / 回弹期间文字「物理跟随」banner 一起滑动。
  // 拖拽中文字随手指水平位移（问题 #2：无论是否达切换阈值都跟随）；
  // 回弹中文字跟随 banner 平滑回位，但右侧下一张文本保持隐藏（问题 #1）；
  // 切换（slideAnim）时不水平位移、改为居中 + 垂直 6px 入场（问题 #3）。
  const textTotal = displayItems.length;
  const textCenter = slideAnim !== null
    ? safeSwitchIndex
    : bounceBack
      ? safeActiveIndex
      : safeHoveredIndex !== null
        ? safeHoveredIndex
        : safeSwitchIndex;
  const textPrev = textTotal > 1 ? (textCenter - 1 + textTotal) % textTotal : 0;
  const textNext = textTotal > 1 ? (textCenter + 1) % textTotal : 0;
  const textTrackIndices = [textPrev, textCenter, textNext];
  const activeItem = displayItems[safeSwitchIndex];
  // 防御性判空：极端情况下（items 切换竞态）直接返回避免白屏
  if (!activeItem) return null;

  // 文字内容子树（标题/评分/简介/CTA），供「单条文字」与「文字 track」两处复用。
  const renderText = (item: HeroItem) => {
    const d = item as HeroItem;
    const t = d.name || d.title || '';
    const rd = d.releaseDate || d.release_date || d.first_air_date;
    const y = rd ? new Date(rd).getFullYear() : undefined;
    const rt = d.voteAverage ?? d.vote_average ?? 0;
    const ov = item.overview || '';
    const mt = d.mediaType || d.media_type;
    return (
      <>
        <h1 className="hero-banner__title">{t}</h1>
        <div className="hero-banner__meta">
          {rt > 0 && <span className="hero-banner__rating">★ {rt.toFixed(1)}</span>}
          {y && <span className="hero-banner__year">{y}</span>}
          {mt && <span className="hero-banner__type">{mt === 'tv' ? '剧集' : '电影'}</span>}
        </div>
        {!isMobile && ov && (
          <p className="hero-banner__desc">{ov.slice(0, 150)}{ov.length > 150 ? '…' : ''}</p>
        )}
        {onItemClick && (
          <div className="hero-banner__actions">
            {historyMap?.has(String(item.id)) && onContinuePlay && (
              <button className="hero-banner__cta hero-banner__cta--continue" onClick={(e) => { e.stopPropagation(); onContinuePlay(item); }}>
                <Icon icon={Play} size="sm" fill="currentColor" />
                <span>继续播放</span>
              </button>
            )}
            <button className="hero-banner__cta" onClick={(e) => { e.stopPropagation(); onItemClick(item); }}>
              <Icon icon={Play} size="sm" fill="currentColor" />
              <span>查看详情</span>
            </button>
          </div>
        )}
      </>
    );
  };

  // ── 分类切换图片过渡（渲染期派生）──
  // 切换帧（items 引用 vs 上一 commit 不同）：本次渲染立即派生「旧活跃图快照」用于滞留层垫底，
  // 且不渲染新层（hideNewLayer）——不依赖 effect setState 时序，杜绝闭包陈旧竞态。
  // 过渡期（itemsChanged 已消失，switchReady=false）由 state 快照 + !switchReady 继续维持；
  // 新首项图预加载就绪（switchReady=true）后新层正常渲染（is-active 淡入），清理 effect 移除滞留层。
  const prevItems = prevItemsRef.current;
  const itemsChanged = prevItems !== displayItems;
  const oldActivePath = (() => {
    const it = prevItems[prevDisplayIdxRef.current];
    return it?.backdropPath || it?.backdrop_path;
  })();
  const newFirstPath = displayItems[0]?.backdropPath || displayItems[0]?.backdrop_path;
  // 目标分类首项图是否已有缓存（session 级，切回看过的分类命中）。无缓存时不做
  // 「旧图滞留 + 预加载门控 + 淡入」切换动画——图片本来就是骨架占位，直接渲染新层
  // 让图片自然加载（有缓存才保留旧图垫底 → 新图就绪淡入的平滑过渡）。
  const newFirstUrl = newFirstPath ? (buildImageUrl(newFirstPath, 'w1280') || '') : '';
  const targetCached = newFirstUrl ? isImageLoaded(newFirstUrl) : false;
  const crossfadeSwitch =
    itemsChanged && displayItems.length > 0 && !!oldActivePath && !!newFirstPath && targetCached;
  const staleLayer = crossfadeSwitch
    ? {
        url: buildImageUrl(oldActivePath, 'w1280') || '',
        srcSet: buildImageSrcSet(oldActivePath, ['w780', 'w1280']) ?? undefined,
        id: String(prevItems[prevDisplayIdxRef.current].id),
      }
    : staleSnapshot;
  // 保留 `|| !switchReady`：已缓存分类切换时，itemsChanged 在首个 effect 后即翻 false，
  // 仅靠 crossfadeSwitch 无法在「预加载未完成」窗口继续隐藏新层；!switchReady 负责该间隙。
  // 未缓存分类切换时主图区短暂透明由 .hero-banner__main 的深色渐变底色承接，不再透出卡片浅色（白隙）。
  const hideNewLayer = crossfadeSwitch || !switchReady;

  // 三联 track 索引：拖拽/滑动动画期间渲染 [prev | current | next]
  const trackTotal = displayItems.length;
  const trackPrev = trackTotal > 1 ? ((safeActiveIndex - 1 + trackTotal) % trackTotal) : 0;
  const trackNext = trackTotal > 1 ? ((safeActiveIndex + 1) % trackTotal) : 0;
  const trackIndices = [trackPrev, safeActiveIndex, trackNext];
  // track 是否激活（拖拽中或滑动动画中）——用于背景图 track
  const trackActive = isDragging || slideAnim !== null || bounceBack;

  // 文字 track 变换：
  //  - 拖拽中：与背景图 track 同构，文字跟随 banner 一起水平位移（问题 #2，任何距离都跟随）
  //  - 切换中：删除文本水平位移（问题 #3），保持居中，垂直 6px 入场由 CSS 负责
  //  - 回弹中：文字跟随 banner 一起平滑回位（问题 #2），但下一张文本保持 opacity:0（问题 #1）
  const textTrackStyle: React.CSSProperties = (() => {
    if (isDragging) {
      // 拖拽：文字随手指水平位移，与背景图完全对齐
      return { transform: `translateX(calc(-100% + ${dragOffset}px))`, transition: 'none' };
    }
    if (slideAnim === 'forward' || slideAnim === 'backward') {
      // 切换：不水平位移，保持居中（水平滑动已删除，问题 #3）
      return { transform: 'translateX(-100%)', transition: 'none' };
    }
    if (bounceBack) {
      // 回弹：文字跟随 banner 从拖拽位置平滑回到中心（与背景图同步），下一张文本因无 is-sliding 类保持隐藏
      return {
        transform: `translateX(calc(-100% + ${dragOffset}px))`,
        transition: `transform ${BOUNCE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      };
    }
    // 静止 / 悬停预览：钉在中心
    return { transform: 'translateX(-100%)' };
  })();

  // 缩略图窗口：选中项始终居中，循环显示相邻项。基于「同步显示索引」switchIndex（切换开始即更新），
  // 使缩略图窗口与 banner 滑动同步移动，而非等 activeIndex（切换结束）才动。
  const thumbSlots: number[] = [];
  if (displayItems.length > 0) {
    const total = displayItems.length;
    const n = Math.min(visibleCount, total);
    const half = Math.floor(n / 2);
    for (let offset = -half; offset < n - half; offset++) {
      thumbSlots.push(((safeSwitchIndex + offset) % total + total) % total);
    }
  }

  return (
    <div className="hero-banner__card">
      <section
        ref={bannerRef}
        className={`hero-banner${isTV ? ' hero-banner--tv' : ''}`}
        style={initialEnterDelay > 0
          ? { ['--hero-bg-fadein-delay' as string]: `${initialEnterDelay}ms`, ['--hero-thumb-count' as string]: maxCount, aspectRatio: isMobile ? '16 / 9' : (maxCount === 4 ? '20 / 9' : '64 / 27') } as React.CSSProperties
          : { ['--hero-thumb-count' as string]: maxCount, aspectRatio: isMobile ? '16 / 9' : (maxCount === 4 ? '20 / 9' : '64 / 27') } as React.CSSProperties}
        aria-roledescription="carousel"
      aria-label="热门推荐"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={handleBannerLeave}
        onMouseDown={(e) => handleDragStart(e.clientX)}
        onMouseMove={(e) => { if (isDragging) handleDragMove(e.clientX); }}
        onMouseUp={(e) => handleDragEnd(e.clientX)}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
        onTouchMove={(e) => { if (isDragging) handleDragMove(e.touches[0].clientX); }}
        onTouchEnd={(e) => handleDragEnd(e.changedTouches[0].clientX)}
      >
      {/* ── 主图区 ──
          两种渲染模式：
          A) track 模式（拖拽中 / 滑动动画中）：渲染 [prev | current | next] 三张并排，
             track translateX(-100%) 居中当前图，拖拽时偏移跟随，松手后动画滑出。
          B) crossfade 模式（默认/悬停/分类切换）：absolute 堆叠 + stale 滞留层，
             保持现有分类切换过渡逻辑。 */}
      <div
        ref={mainRef}
        className={`hero-banner__main${isDragging ? ' is-dragging' : ''}`}
      >
        {/* crossfade 背景层：始终渲染（track 模式期间被 .hero-banner__track 绝对层盖住）。
            关键修复：track→crossfade 切换时当前图 <img> 不再重挂载，移动端/App（Capacitor
            WebView）不会因新 img 元素首帧解码延迟而透明闪出底层旧图。 */}
        <>
          {/* 背景层：仅渲染当前 + 上一张（最多 2 层），crossfade；不预加载全部背景图 */}
          {/* 分类切换过渡：滞留层（--stale，先渲染 = DOM 底层 opacity 1 垫底）承载旧图，
              新首项层在新图预加载就绪（switchReady）前不渲染（hideNewLayer）——
              就绪后新层挂载即 is-active（图片已缓存 → heroBgFadeIn 0.8s 淡入完整播放），
              淡入完成后清理 effect 移除滞留层。无空白无硬切（详见上方 state 注释）。 */}
          {staleLayer && (
            <img
              key={`stale-${staleLayer.id}`}
              className="hero-banner__bg-layer hero-banner__bg-layer--stale"
              src={staleLayer.url}
              srcSet={staleLayer.srcSet || undefined}
              sizes="(max-width: 767px) 100vw, 80vw"
              alt=""
              aria-hidden="true"
              loading="eager"
              decoding="async"
              draggable={false}
            />
          )}
          {bgIndices.map((idx) => {
            const item = displayItems[idx];
            if (!item) return null;
            const backdropPath = item.backdropPath || item.backdrop_path || '';
            const backdropUrl = buildImageUrl(backdropPath, 'w1280') || '';
            const backdropSrcSet = buildImageSrcSet(backdropPath, ['w780', 'w1280']);
            const isActive = idx === displayIndex;
            // 分类切换过渡期（切换帧派生或新图未就绪）：不渲染新层，滞留层旧图继续垫底
            if (isActive && hideNewLayer) return null;
            return (
              <img
                key={item.id}
                className={`hero-banner__bg-layer${isActive ? ' is-active' : ''}${isActive && suppressFadeInId === item.id ? ' hero-banner__bg-layer--no-anim' : ''}`}
                src={backdropUrl}
                srcSet={backdropSrcSet || undefined}
                sizes="(max-width: 767px) 100vw, 80vw"
                alt=""
                aria-hidden="true"
                loading="eager"
                decoding="async"
                draggable={false}
                onLoad={() => {
                  if (backdropUrl) markImageLoaded(backdropUrl);
                  if (isActive) {
                    setBannerReady(true);
                    scheduleStaleClear();
                  }
                }}
                onError={() => {
                  if (isActive) {
                    setBannerReady(true);
                    scheduleStaleClear();
                  }
                }}
                ref={(el) => {
                  if (el && el.complete && el.naturalWidth > 0) {
                    if (backdropUrl) markImageLoaded(backdropUrl);
                    if (isActive) {
                      setBannerReady(true);
                      scheduleStaleClear();
                    }
                  }
                }}
              />
            );
          })}
        </>
        {/* 三联 track 模式：仅拖拽 / 滑动动画期间渲染，绝对定位覆盖在 crossfade 背景之上
            （.hero-banner__track 加 position:absolute; inset:0; z-index:1）。滑动结束 trackActive=false
            时仅移除该覆盖层，crossfade 已常驻、当前图已解码 → 切换无缝、无闪烁。 */}
        {trackActive && (
          /* ── 三联 track 模式 ── */
          <div
            className="hero-banner__track"
            style={(() => {
              if (isDragging) {
                return { transform: `translateX(calc(-100% + ${dragOffset}px))`, transition: 'none' };
              }
              if (slideAnim === 'forward') {
                // 引导帧：先停在 -100%（当前图，与 crossfade 显示一致）一帧，
                // 下一帧 slideBoot 撤掉后过渡到 -200% → 真正滑出（修复自动轮播「瞬切」）。
                if (slideBoot) return { transform: 'translateX(-100%)', transition: 'none' };
                return { transform: 'translateX(-200%)', transition: `transform ${SLIDE_MS}ms cubic-bezier(0.45, 0, 0.25, 1)` };
              }
              if (slideAnim === 'backward') {
                if (slideBoot) return { transform: 'translateX(-100%)', transition: 'none' };
                return { transform: 'translateX(0%)', transition: `transform ${SLIDE_MS}ms cubic-bezier(0.45, 0, 0.25, 1)` };
              }
              if (bounceBack) {
                // 回弹：从当前拖拽位置（dragOffset）平滑回到 -100%。
                // 缓动 cubic-bezier(0.4, 0, 0.2, 1) 无过冲、慢收尾，时长 BOUNCE_MS（比翻页长），
                // 回弹舒缓不「咔一下瞬回」；配合下方「极小拖拽不回弹」逻辑避免无谓晃动。
                return {
                  transform: `translateX(calc(-100% + ${dragOffset}px))`,
                  transition: `transform ${BOUNCE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                };
              }
              return { transform: 'translateX(-100%)' };
            })()}
          >
            {trackIndices.map((idx, pos) => {
              const item = displayItems[idx];
              if (!item) return null;
              const backdropPath = item.backdropPath || item.backdrop_path || '';
              const backdropUrl = buildImageUrl(backdropPath, 'w1280') || '';
              const backdropSrcSet = buildImageSrcSet(backdropPath, ['w780', 'w1280']);
              return (
                <div key={`${item.id}-${pos}`} className="hero-banner__slide">
                  <img
                    src={backdropUrl}
                    srcSet={backdropSrcSet || undefined}
                    sizes="(max-width: 767px) 100vw, 80vw"
                    alt=""
                    aria-hidden="true"
                    loading="eager"
                    decoding="async"
                    draggable={false}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="hero-banner__mask" style={{ background: HERO_MASK_BG }} />

        {/* 内容叠加（标题/评分/简介/CTA）：文字 track 与背景图 track 同构。
            拖拽 / 回弹时文字随 banner 一起水平位移（问题 #2，任何距离都跟随）；
            切换时不水平位移、新文本以 6px 垂直位移错峰淡入（问题 #3）。
            拖拽 / 回弹期间不挂 is-sliding，右侧下一张文本 opacity 保持 0（问题 #1）；
            静止当前文字的入场仅在不处于拖拽/切换且允许入场（is-rise）时播。 */}
        <div className="hero-banner__content">
          <div
            className={`hero-banner__text-track${slideAnim !== null ? ' is-switching' : ''}${textRiseEnabled && slideAnim === null && !isDragging && !bounceBack ? ' is-rise' : ''}`}
            style={textTrackStyle as React.CSSProperties}
          >
            {textTrackIndices.map((idx, pos) => {
              const item = displayItems[idx];
              if (!item) return null;
              const isCurrent = pos === 1;
              // 切换中（slideAnim）中心槽即新文本（textCenter=safeSwitchIndex），标记为入场；
              // 拖拽/回弹不标 is-incoming（无 is-sliding 类，下一张文本 opacity 保持 0，见问题 #1）
              const isIncoming = slideAnim !== null && isCurrent;
              return (
                <div
                  key={`t-${pos}`}
                  className={`hero-banner__text-slide${isCurrent ? ' hero-banner__text-slide--current' : ''}${isIncoming ? ' is-incoming' : ''}`}
                >
                  <div className="hero-banner__text">{renderText(item)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 右侧缩略图列（桌面端，横图 + 悬浮标题；窗口化，选中居中） ──
          banner 未就绪时显示固定数量骨架占位（立即出现），
          banner 渲染完成后揭示真实缩略图（每个缩略图自身也有加载骨架）。
          ⚠️ 不挂 key={categoryId}（2026-08-13）：分类切换时列不重挂载，
          HeroThumb 组件按 key={pos} 复用 → item 引用变化走「预加载完成再换图 +
          双层交叉淡入」，旧海报保持显示直至新海报就绪淡入（平滑过渡动画），
          不再「骨架→图」硬切换。同分类窗口滑动逻辑不受影响。 */}
      {!isMobile && (
        <div
          className="hero-banner__thumbs"
          style={{ ['--hero-thumb-count' as string]: maxCount } as React.CSSProperties}
        >
          {!bannerReady ? (
            Array.from({ length: maxCount }).map((_, i) => (
              <div key={`sk-${i}`} className="hero-banner__thumb hero-banner__thumb--skeleton" aria-hidden="true">
                <span className="hero-banner__thumb-skeleton thumbnail-skeleton-bg" />
              </div>
            ))
          ) : (
            <>
              {thumbSlots.map((idx, pos) => (
                <HeroThumb
                  key={pos}
                  item={displayItems[idx]}
                  active={idx === (safeHoveredIndex !== null ? safeHoveredIndex : safeSwitchIndex)}
                  onEnter={() => handleThumbEnter(idx)}
                  onClick={() => onItemClick?.(displayItems[idx])}
                />
              ))}
            </>
          )}
        </div>
      )}
      </section>
    </div>
  );
}

/**
 * HeroThumb — 单个右侧缩略图（自包含）
 * - 图片加载完成前显示骨架占位（shimmer），加载完成后淡入图片与标题
 * - 用 ref 检查 img.complete 兜底，避免已缓存图片不触发 onLoad 而永久卡在骨架
 * - memo 化：窗口滑动一格时仅「新进入窗口」的缩略图重渲染，其余（item 引用 + active 未变）
 *   跳过渲染，减少快速滑动时的无谓重渲染与换图预加载
 */
const HeroThumb = memo(
  function HeroThumb({
    item,
    active,
    onEnter,
    onClick,
  }: {
    item: HeroItem;
    active: boolean;
    onEnter: () => void;
    onClick: () => void;
  }) {
  const thumbPath = item.backdropPath || item.backdrop_path || '';
  // 复用主图 URL（w1280），通过 CSS 缩放显示，减少 HTTP 请求数
  // 主图加载后缩略图可直接使用已缓存的资源，提升切换流畅度
  const thumbUrl = thumbPath ? buildImageUrl(thumbPath, 'w1280') : '';
  const title = item.name || item.title || '';

  // 双层 + 预加载就绪再换图（2026-08-13 增强为交叉淡入）：
  // 切换目标 url 时先用 new Image() 预加载，完成（已进缓存）才更新 img.src；
  // 旧图快照进 prevSrc 垫底层，新图（cur 层）先置 --switching（opacity 0）再
  // onLoad 后淡入（opacity transition 0.3s）→ 淡入完成清理 prev 层。
  // 加载期间旧图持续显示，从根上避免露白闪烁与突变跳变。
  const [currentSrc, setCurrentSrc] = useState(thumbUrl);
  const [prevSrc, setPrevSrc] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [ready, setReady] = useState(false);
  const currentSrcRef = useRef(thumbUrl);
  currentSrcRef.current = currentSrc;
  const loadingRef = useRef<string | null>(null);
  // 上次 thumbUrl 变化时间戳：识别「快速连续切换」以跳过淡入避免闪烁
  const thumbLastChangeRef = useRef(0);

  useEffect(() => {
    if (!thumbUrl) {
      currentSrcRef.current = '';
      setCurrentSrc('');
      setPrevSrc(null);
      setSwitching(false);
      setReady(false);
      loadingRef.current = null;
      return;
    }
    // 已是当前显示图：无需切换
    if (thumbUrl === currentSrcRef.current) {
      loadingRef.current = null;
      return;
    }
    const now = Date.now();
    const rapid = now - thumbLastChangeRef.current < 250;
    thumbLastChangeRef.current = now;
    // 统一用「旧图垫底 + 新图淡入」：无论是否命中缓存，旧图持续显示直到新图就绪，
    // 再走 0.3s 交叉淡入。消除「未缓存路径落到骨架灰白图、无过渡直接硬切」的问题。
    const oldSrc = currentSrcRef.current;
    loadingRef.current = thumbUrl;
    setPrevSrc(oldSrc || null);
    setCurrentSrc(thumbUrl);
    setSwitching(true);
    setReady(true); // 旧图已垫底，无需骨架占位（灰白闪烁根源）
    if (rapid) {
      // 快速连续切换：跳过旧图垫底淡入、直接落底，避免连续淡入叠加闪烁
      setPrevSrc(null);
      const cached = isImageLoaded(thumbUrl);
      setSwitching(!cached);
    }
  }, [thumbUrl]);

  // 新图淡入完成后清理垫底层（不依赖动画事件，延时兜底）
  // 注：switching 状态由 onLoad 清除，不用超时——未缓存图片加载期间 switching 保持 true，
  // 骨架持续显示，避免快速滑动时骨架提前消失导致闪烁。
  useEffect(() => {
    if (!prevSrc) return;
    const t = window.setTimeout(() => setPrevSrc(null), 320);
    return () => window.clearTimeout(t);
  }, [prevSrc, currentSrc]);

  return (
    <button
      type="button"
      className={`hero-banner__thumb${active ? ' is-active' : ''}`}
      onMouseEnter={onEnter}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={title}
      aria-current={active ? 'true' : undefined}
    >
      {prevSrc && (
        <img
          className="hero-banner__thumb-img hero-banner__thumb-img--prev"
          src={prevSrc}
          alt=""
          loading="eager"
          draggable={false}
          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
        />
      )}
      {currentSrc ? (
        <img
          key={currentSrc}
          className={`hero-banner__thumb-img${switching ? ' hero-banner__thumb-img--switching' : ''}`}
          src={currentSrc}
          alt=""
          loading="eager"
          draggable={false}
          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          onLoad={() => {
            if (currentSrc) markImageLoaded(currentSrc);
            setReady(true);
            // 确保起始帧（opacity:0）已绘制后再淡入，避免浏览器缓存命中时
            // onLoad 过早触发、缺少起始帧导致「无过渡直接硬切」
            requestAnimationFrame(() => setSwitching(false));
          }}
        />
      ) : null}
      {!ready && <span className="hero-banner__thumb-skeleton thumbnail-skeleton-bg" aria-hidden="true" />}
      <span className="hero-banner__thumb-title">{title}</span>
    </button>
  );
},
heroThumbPropsEqual,
);

/** memo 比较：仅 item 引用与激活态变化才重渲染（onEnter/onClick 为稳定闭包捕获 idx，item 不变时 idx 不变） */
function heroThumbPropsEqual(
  prev: { item: HeroItem; active: boolean },
  next: { item: HeroItem; active: boolean },
): boolean {
  return prev.item === next.item && prev.active === next.active;
}
