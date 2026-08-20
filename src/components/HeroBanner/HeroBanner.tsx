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
import { buildImageUrl, buildImageSrcSet, HERO_THUMB_SIZE } from '@/services/tmdbService';
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

export default function HeroBanner({
  items,
  autoPlayInterval = 5000,
  onItemClick,
  onContinuePlay,
  historyMap,
  loading = false,
  active = true,
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
  // 滑动方向（所有客户端）：'left' = 新图从右滑入（前进），'right' = 新图从左滑入（后退）
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  // 主 banner 图是否已渲染完成（首张背景图 onLoad 后置 true）。
  // 用于控制右侧缩略图列：渲染完成前显示骨架占位，完成后才揭示真实缩略图。
  const [bannerReady, setBannerReady] = useState(false);
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
  // banner 根元素 ref：用于实测其实际高度（含 max-height 截断）注入 --hero-banner-h，
  // 供右侧缩略图列宽计算，避免 100cqh 首帧回退（详见下方 useLayoutEffect）。
  const bannerRef = useRef<HTMLElement>(null);
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
    setBgIndices([0]);
    // C1-4（2026-08-04）：分类切换时清空滑动方向类——否则新分类首项挂载时若残留
    // slideDir（如切分类前最后一次是自动轮播/拖拽的 slide-left），会误播 slide 动画
    // 而非本应出现的 crossfade，导致「切分类后首次切换方向异常」。
    setSlideDir(null);

    const prevLen = prevItemsLenRef.current;
    const curLen = displayItems.length;
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
          // 目标分类首项图无缓存（session 未加载过，如首次进入项目/首次切到该分类）：
          // 不做「旧图滞留 + 预加载门控」——新分类的图片区域本来就是骨架占位，
          // 直接渲染新层让图片走自身加载（加载完成 heroBgFadeIn 淡入），
          // 消除「切过去旧图滞留很久才更新」的慢感知（用户反馈无缓存时切换特别慢）。
          // 有缓存（切回已看过的分类）才保留旧图垫底 → 新图就绪淡入的平滑过渡。
          // 统一「旧图垫底 → 新图就绪淡入」：无论是否命中 session 缓存，都保留旧图作
          // stale 垫底，新层挂起（opacity:0）待 new Image() 预加载 onload 后 switchReady
          // 淡入覆盖。命中缓存时浏览器同步绘制、onload 近乎瞬时，无「旧图滞留变慢」感知；
          // 未缓存时旧图垫底消除「新层淡入露出 bg-placeholder 渐变」导致的 banner 闪窗。
          // 新一轮过渡开始：清掉上一轮残留清除定时器（否则上一轮定时器到期会把新 stale 清掉）
          if (staleClearTimerRef.current) {
            clearTimeout(staleClearTimerRef.current);
            staleClearTimerRef.current = null;
          }
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
      setSlideDir(null);
      setBgIndices([Math.min(activeIndexRef.current, Math.max(0, displayItems.length - 1))]);
      switchLoadRef.current = null;
      if (staleClearTimerRef.current) { clearTimeout(staleClearTimerRef.current); staleClearTimerRef.current = null; }
      setStaleSnapshot(null);
      setSwitchReady(true);
    } else {
      // 离开首页：暂停轮播 + 清过渡态
      setPaused(true);
      setHoveredIndex(null);
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

  // 用 JS 实测 banner 实际高度注入 --hero-banner-h，供右侧缩略图列宽计算。
  // 彻底摆脱对 container-type:size + 100cqh 的依赖：硬重载/首帧 CSS 容器查询
  // 上下文尚未建立时，100cqh 会回退到视口高度（如 100vh），使缩略图列宽异常变宽，
  // 与样式就绪后的真实列宽不一致（清缓存硬重载时「宽度不一致」的根因）。
  // 直接读取渲染后 banner 实际高度最可靠；ResizeObserver 兜底 CSS 注入 / 窗口变化 /
  // 分类切换导致的高度变化，自动纠正。
  useLayoutEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) el.style.setProperty('--hero-banner-h', `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // 预加载下一张背景图 + 即将出现的缩略图，保证轮播切换时图片已就绪
  useEffect(() => {
    if (displayItems.length <= 1) return;
    const total = displayItems.length;

    // 预加载前后各一张背景图（C1-2，2026-08-04）：
    // 自动轮播前进（+1）与手动拖拽后退（-1）的目标索引都覆盖，避免切换时目标图
    // 未预加载 → 动画期间新层空白（滑动「失效」感）+ 大图解码主线程卡顿。
    // 尺寸按视口选择（w780/w1280），preloadImage 内部按 URL 去重，快速滑动不重复解码。
    const bgSize = bgPreloadSize();
    const nextIdx = (activeIndex + 1) % total;
    const prevIdx = (activeIndex - 1 + total) % total;
    for (const idx of [nextIdx, prevIdx]) {
      const p = displayItems[idx]?.backdropPath || displayItems[idx]?.backdrop_path;
      if (p) preloadImage(buildImageUrl(p, bgSize));
    }

    // 预加载即将出现在缩略图窗口中的图片（窗口大小 4，提前预加载前后各 2 张）
    const n = Math.min(4, total);
    const half = Math.floor(n / 2);
    for (let offset = -half; offset < n - half; offset++) {
      const idx = ((activeIndex + offset + 1) % total + total) % total;
      const thumbPath = displayItems[idx]?.backdropPath || displayItems[idx]?.backdrop_path;
      if (thumbPath) preloadImage(buildImageUrl(thumbPath, HERO_THUMB_SIZE));
    }
  }, [activeIndex, displayItems]);

  // 自动轮播（悬停暂停 / 仅 1 项不轮播 / 滑动冷却期内暂停 / 页面隐藏（Keep-Alive 离开）不轮播）
  useEffect(() => {
    if (paused || !active || displayItems.length <= 1) return;
    const timer = window.setInterval(() => {
      // 滑动后 1000ms 内不轮播，避免与滑动动画冲突
      if (Date.now() - swipeCooldownRef.current < 1000) return;
      // 自动轮播前进：新图从右滑入（slideDir='left'），所有客户端统一走滑动切换
      setSlideDir('left');
      setActiveIndex((i) => (i + 1) % displayItems.length);
    }, autoPlayInterval);
    return () => window.clearInterval(timer);
  }, [paused, active, displayItems.length, autoPlayInterval]);

  // 悬停缩略图：预览主图 + 暂停轮播 + 预加载背景图
  const handleThumbEnter = useCallback((idx: number) => {
    // 清除滑动方向类，让预览主图回退为 crossfade（桌面端悬停预览的淡入过渡）
    setSlideDir(null);
    setHoveredIndex(idx);
    setPaused(true);
    const item = displayItems[idx];
    const p = item?.backdropPath || item?.backdrop_path;
    if (p) preloadImage(buildImageUrl(p, 'w1280'));
  }, [displayItems]);

  // 移出整个 hero-banner：将 activeIndex 同步到当前预览项，再取消预览 + 恢复轮播
  const handleBannerLeave = useCallback(() => {
    setHoveredIndex((h) => {
      if (h !== null) setActiveIndex(h);
      return null;
    });
    setPaused(false);
  }, []);

  // 拖拽/滑动切换图片：桌面端鼠标拖拽 + 移动端触摸滑动
  const dragStartX = useRef(0);
  const handleDragStart = useCallback((x: number) => {
    dragStartX.current = x;
  }, []);
  const handleDragEnd = useCallback((x: number) => {
    const dx = x - dragStartX.current;
    if (Math.abs(dx) < 50) return;
    const total = displayItems.length;
    if (total <= 1) return;
    // 标记为用户手动滑动，触发动画
    setSlideDir(Math.sign(dx) > 0 ? 'right' : 'left');
    // 记录滑动时间，冷却期内（1000ms）暂停自动轮播
    swipeCooldownRef.current = Date.now();
    setActiveIndex((i) => (i - Math.sign(dx) + total) % total);
    setHoveredIndex(null);
  }, [displayItems.length]);

  // 空状态：加载中只显示骨架（无文字），加载完成且无数据才显示"暂无推荐"。
  // 注意：即使 items 为空，也立即渲染右侧缩略图骨架列，避免骨架"出现太慢"。
  if (!displayItems.length) {
    return (
      <section ref={bannerRef} className={`hero-banner hero-banner--empty${isTV ? ' hero-banner--tv' : ''}`} aria-label="热门推荐">
        <div className="hero-banner__bg-wrapper">
          <div className="hero-banner__bg-placeholder" />
          <div className="hero-banner__mask" style={{ background: HERO_MASK_BG }} />
        </div>
        {!loading && (
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
    );
  }

  const activeItem = displayItems[displayIndex];
  // 防御性判空：极端情况下（items 切换竞态）displayIndex 仍可能越界，直接返回避免白屏
  if (!activeItem) return null;

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
  const hideNewLayer = crossfadeSwitch || !switchReady;

  const itemData = activeItem as HeroItem;
  const title = itemData.name || itemData.title || '';
  const releaseDate = itemData.releaseDate || itemData.release_date || itemData.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
  const rating = itemData.voteAverage ?? itemData.vote_average ?? 0;
  const overview = activeItem.overview || '';
  const mediaType = itemData.mediaType || itemData.media_type;

  // 缩略图窗口：选中项始终居中，循环显示相邻项（窗口大小 = visibleCount，按 banner 高度计算）
  const thumbSlots: number[] = [];
  if (displayItems.length > 0) {
    const total = displayItems.length;
    const n = Math.min(visibleCount, total);
    const half = Math.floor(n / 2);
    for (let offset = -half; offset < n - half; offset++) {
      thumbSlots.push(((safeActiveIndex + offset) % total + total) % total);
    }
  }

  return (
    <section
      ref={bannerRef}
      className={`hero-banner${isTV ? ' hero-banner--tv' : ''}`}
      aria-roledescription="carousel"
      aria-label="热门推荐"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={handleBannerLeave}
      onMouseDown={(e) => handleDragStart(e.clientX)}
      onMouseUp={(e) => handleDragEnd(e.clientX)}
      onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
      onTouchEnd={(e) => handleDragEnd(e.changedTouches[0].clientX)}
    >
      {/* ── 主图区 ── */}
      {/* slideDir 切换后保持（不重置），避免动画结束后 is-active 层回退到 crossfade
          重新播放导致"闪一下/出现上一张"；悬停预览时由 handleThumbEnter 显式置 null 恢复 crossfade */}
      <div
        className={`hero-banner__main${slideDir ? ` slide-${slideDir}` : ''}`}
      >
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
            // ⚠️ key 必须用 item.id（而非下标 idx）：
            // 切换分类时新分类首项也是下标 0，若用 idx 作 key，React 会复用同一个 <img>
            // DOM 元素仅改 src——浏览器在新图解码完成前会持续显示「上一分类/页面的旧图」，
            // 表现为「banner 还在显示上一个页面的图片，过一会才更新」。改用 item.id 后，
            // 不同条目 key 不同 → 创建全新 <img>、旧层卸载（旧图由 staleLayer 滞留层继续垫底）；
            // 自动轮播/悬停预览仍由 bgIndices 双层层叠 crossfade，表现不变（同 id 元素还可复用缓存）。
            <img
              key={item.id}
              className={`hero-banner__bg-layer${isActive ? ' is-active' : ''}`}
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
                  // 新层真实绘制完成 → 自此起算淡入（0.8s）后移除滞留层（D 项收尾）
                  scheduleStaleClear();
                }
              }}
              onError={() => {
                if (isActive) {
                  setBannerReady(true);
                  // 新图加载失败（fail-open）→ 同样结束过渡，移除滞留层避免旧图永驻
                  scheduleStaleClear();
                }
              }}
              ref={(el) => {
                // 已缓存图片不会触发 onLoad，用 complete 兜底标记就绪 + 缓存标记 + 结束过渡
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
        <div className="hero-banner__mask" style={{ background: HERO_MASK_BG }} />

        {/* 内容叠加（标题/评分/简介/CTA） */}
        <div className="hero-banner__content">
          <div className="hero-banner__text">
            <h1 className="hero-banner__title">{title}</h1>

            <div className="hero-banner__meta">
              {rating > 0 && <span className="hero-banner__rating">★ {rating.toFixed(1)}</span>}
              {year && <span className="hero-banner__year">{year}</span>}
              {mediaType && <span className="hero-banner__type">{mediaType === 'tv' ? '剧集' : '电影'}</span>}
            </div>

            {!isMobile && overview && (
              <p className="hero-banner__desc">{overview.slice(0, 150)}{overview.length > 150 ? '…' : ''}</p>
            )}

            {onItemClick && (
              <div className="hero-banner__actions">
                {historyMap?.has(String(activeItem.id)) && onContinuePlay && (
                  <button className="hero-banner__cta hero-banner__cta--continue" onClick={(e) => { e.stopPropagation(); onContinuePlay(activeItem); }}>
                    <Icon icon={Play} size="sm" fill="currentColor" />
                    <span>继续播放</span>
                  </button>
                )}
                <button className="hero-banner__cta" onClick={(e) => { e.stopPropagation(); onItemClick(activeItem); }}>
                  <Icon icon={Play} size="sm" fill="currentColor" />
                  <span>查看详情</span>
                </button>
              </div>
            )}
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
                  active={idx === displayIndex}
                  onEnter={() => handleThumbEnter(idx)}
                  onClick={() => onItemClick?.(displayItems[idx])}
                />
              ))}
            </>
          )}
        </div>
      )}
    </section>
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
  // 右侧缩略图（backdrop 横图）压缩：w500 → w300，显示宽度仅 ~180–220px，体积更小、解码更快。
  // Hero 主图（buildImageUrl(..., 'w1280')）保持原画质不参与压缩。
  const thumbUrl = thumbPath ? buildImageUrl(thumbPath, HERO_THUMB_SIZE) : '';
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
    // 目标缩略图无缓存（session 未加载过，首次进入/首次切到该分类）：跳过
    // 「预加载完成再换图」门控——图片区域本来就是骨架占位，直接切换 src，
    // 骨架占位持续显示直到新图加载完成淡入（消除旧图滞留的慢感知）。
    // 有缓存（切回已看过的分类）才保留旧图垫底 → 新图就绪交叉淡入的平滑过渡。
    if (!isImageLoaded(thumbUrl)) {
      loadingRef.current = null;
      setPrevSrc(null);
      setCurrentSrc(thumbUrl);
      setSwitching(true);
      setReady(false);
      return;
    }
    // 预加载新图，完成后（缓存就绪）再替换 src，期间旧图持续显示
    const img = new Image();
    loadingRef.current = thumbUrl;
    const apply = () => {
      if (loadingRef.current === thumbUrl) {
        // 旧图快照垫底 → 新图置为待淡入态
        setPrevSrc(currentSrcRef.current);
        setCurrentSrc(thumbUrl);
        setSwitching(true);
        setReady(true);
        loadingRef.current = null;
      }
    };
    img.onload = apply;
    img.onerror = apply;
    img.src = thumbUrl;
  }, [thumbUrl]);

  // 新图淡入（0.3s）完成后清理垫底层
  useEffect(() => {
    if (!switching) return;
    const t = window.setTimeout(() => setSwitching(false), 30);
    return () => window.clearTimeout(t);
  }, [switching]);
  // prev 层在淡入完成后移除（延时兜底，不依赖动画事件）
  useEffect(() => {
    if (!prevSrc) return;
    const t = window.setTimeout(() => setPrevSrc(null), 450);
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
        />
      )}
      {currentSrc ? (
        <img
          className={`hero-banner__thumb-img${switching ? ' hero-banner__thumb-img--switching' : ''}`}
          src={currentSrc}
          alt=""
          loading="eager"
          draggable={false}
          onLoad={() => { if (currentSrc) markImageLoaded(currentSrc); setReady(true); setSwitching(false); }}
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
