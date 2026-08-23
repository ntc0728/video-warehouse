/**
 * preloadRowCovers — 分类切换时预加载 TMDBMovieRow 首屏可见卡片封面图
 *
 * 对齐 HeroBanner 的「就绪替换」策略（2026-08-14）：
 * 分类切换时若立即替换 displayedCategory，卡片 key=item.id 全变 → 整卡卸载重挂 →
 * LazyImage 重建 → 未命中 session 缓存的新图先渲染品牌骨架 → 图片加载完才淡入，
 * 视觉 = 「旧图消失 → 整片骨架 → 新图」硬切（banner 已消除、卡片未处理的"闪一下"）。
 *
 * 本模块在数据就绪后、切换前先预加载目标分类「首屏可见」卡片的封面图
 * （w342 = LazyImage src / session 缓存判定键；w185 = srcSet 低档候选，浏览器可能实际加载），
 * 全部就绪（或超时兜底）后 Home 才 setDisplayedCategory →
 * 新卡片挂载即命中缓存：直接 loaded 态渲染，无骨架、无动画、HTTP 缓存同步绘制。
 *
 * 范围控制：只预加载首屏可见（视口内行数 × 每行可见卡数 + 缓冲），
 * 其余卡片保持原有懒加载（滚动到时正常骨架→图，视口外无感知）。
 */
import type { TMDBVideoItem } from '@/types/tmdb';
import { buildImageUrl } from '@/services/tmdbService';
import { markImageLoaded } from '@/components/LazyImage/imageCache';

/** 预加载超时兜底：坏图/挂起图不能无限阻塞切换 */
export const ROW_COVER_PRELOAD_TIMEOUT = 2000;
/** 总 URL 上限（防极端视口/数据量下请求爆炸） */
export const MAX_PRELOAD_URLS = 48;

/** 估算卡片宽度（px）：桌面 clamp(8rem, 6rem+8vw, 16rem)，移动 33vw */
function estimateCardWidth(viewportWidth: number): number {
  if (viewportWidth <= 767) return viewportWidth * 0.33;
  return Math.min(Math.max(128, viewportWidth * 0.12), 256);
}

/** HeroBanner 占据高度估计（px）：桌面 min(70vh, 28rem) 常见 ~448，移动 ~320。
 *  首屏可见行区域 = 视口高度 - hero 高度，避免把 hero 下方的行也当作「首屏可见」
 *  而预加载过多（当前实现曾按整个视口高度估算，桌面 720px 估出 3 行 → 预加载量虚高、切换更慢）。 */
function estimateHeroHeight(viewportWidth: number): number {
  return viewportWidth <= 767 ? 320 : 448;
}

/** 估算首屏可见行数（行高 ≈ 卡宽×1.5 竖版海报 + 标题/间距；减去 hero 占位高度） */
export function estimateVisibleRows(viewport: { width: number; height: number }, cardWidth: number): number {
  const rowHeight = cardWidth * 1.5 + (viewport.width <= 767 ? 44 : 60);
  const available = Math.max(0, viewport.height - estimateHeroHeight(viewport.width));
  return Math.max(1, Math.ceil(available / rowHeight));
}

/** 便捷封装：根据视口尺寸估算首屏可见行数（Home ready 条件 / 预加载范围共用） */
export function getVisibleRowCount(viewport: { width: number; height: number }): number {
  return estimateVisibleRows(viewport, estimateCardWidth(viewport.width));
}

/** 每行可见卡数 + 2 张缓冲（横向滚动，用户切分类后可能立刻右滑） */
function estimateVisibleCols(viewport: { width: number; height: number }, cardWidth: number): number {
  return Math.max(1, Math.ceil(viewport.width / cardWidth) + 2);
}

/**
 * 收集目标分类首屏可见卡片的封面 URL 列表（w342 src + w185 srcSet 候选，去重）。
 */
export function collectRowCoverUrls(
  rows: { items: TMDBVideoItem[] }[],
  viewport: { width: number; height: number },
): string[] {
  if (rows.length === 0) return [];
  const cardWidth = estimateCardWidth(viewport.width);
  const maxRows = Math.min(rows.length, estimateVisibleRows(viewport, cardWidth) + 1);
  const maxCols = estimateVisibleCols(viewport, cardWidth);
  const urls: string[] = [];

  for (let r = 0; r < Math.min(maxRows, rows.length); r++) {
    const items = rows[r]?.items ?? [];
    for (let c = 0; c < Math.min(maxCols, items.length); c++) {
      const posterPath = items[c]?.posterPath;
      if (!posterPath) continue;
      const w342 = buildImageUrl(posterPath, 'w342');
      const w185 = buildImageUrl(posterPath, 'w185');
      if (w342 && !urls.includes(w342)) urls.push(w342);
      if (w185 && !urls.includes(w185)) urls.push(w185);
      if (urls.length >= MAX_PRELOAD_URLS) return urls;
    }
  }
  return urls;
}

/**
 * 预加载首屏可见卡片封面：new Image() 并发加载，成功后写入 session 缓存。
 * 返回「全部 settle 或超时」的 Promise（内部不 reject）。
 *
 * ⚠️ 尺寸策略（2026-08-14）：**只实际加载 w185，w342 仅写缓存不请求**。
 * 同一 poster 同时 new Image() w342 + w185 时，浏览器并发受限（测试环境
 * image.tmdb.org 同源 ~6 连接）会 abort 其中一个（实测 w342 全部 ERR_ABORTED），
 * 而 LazyImage 的 session 缓存判定键是 src = w342 → 未标记 → 复用卡 isCached=false
 * → 卡片 img 永不渲染（只露一角的卡 IO 10% 阈值也不触发）→ placeholder 永驻。
 * w185 是浏览器实际从 srcSet 选中的渲染尺寸（sizes≈12vw 时首选），加载它即绘制；
 * w342 仅 markImageLoaded 供缓存判定命中（浏览器以 w185 实际渲染，无需 w342 请求）。
 */
export function preloadRowCovers(
  rows: { items: TMDBVideoItem[] }[],
  viewport: { width: number; height: number },
  timeoutMs: number = ROW_COVER_PRELOAD_TIMEOUT,
): Promise<void> {
  const urls = collectRowCoverUrls(rows, viewport);
  if (urls.length === 0) return Promise.resolve();
  // w342 = 缓存判定键（LazyImage src）：只标记、不实际请求
  const cacheKeys = urls.filter((u) => u.includes('/w342/'));
  // 实际加载的只有 w185（浏览器从 srcSet 实际选中的渲染尺寸）
  const loadUrls = urls.filter((u) => u.includes('/w185/'));
  if (loadUrls.length === 0 && cacheKeys.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    let remaining = loadUrls.length;
    const timer = window.setTimeout(done, timeoutMs);

    function done(): void {
      window.clearTimeout(timer);
      resolve();
    }

    // 先标记所有 w342 为已加载（让 LazyImage 命中缓存）
    cacheKeys.forEach((u) => markImageLoaded(u));

    // 再实际加载 w185
    for (const url of loadUrls) {
      const img = new Image();
      img.onload = () => {
        markImageLoaded(url);
        remaining -= 1;
        if (remaining <= 0) done();
      };
      img.onerror = () => {
        // 失败不写缓存（后续正常走 fallback 链），仅计数
        remaining -= 1;
        if (remaining <= 0) done();
      };
      img.src = url;
    }

    // 如果没有 w185 需要加载，直接完成
    if (loadUrls.length === 0) done();
  });
}
