/**
 * imageCache — Session 级图片加载缓存
 *
 * 记录本会话内已成功 onLoad 的图片 URL。
 * 路由切换（Home ↔ IPTV）时 Outlet 子树 unmount/remount，
 * LazyImage 重建会丢掉 isLoaded/isInView state，但 URL 已加载的事实不会丢。
 * 新 mount 的 LazyImage 命中缓存后跳过 IntersectionObserver 等待，
 * 浏览器 HTTP 缓存同步绘制图片，避免 0.5s 的 opacity 渐显动画。
 *
 * 单独成文件是为了避开 react-refresh/only-export-components 警告
 * （组件文件不应同时导出常量/工具函数）。
 */

/** 本会话内已成功 onLoad 的图片 URL 集合 */
const loadedImageCache = new Set<string>();

/** 查询 URL 是否在本会话内已成功加载 */
export function isImageLoaded(url: string): boolean {
  return loadedImageCache.has(url);
}

/** 将 URL 标记为已加载（供 Image() 预热等场景手动调用） */
export function markImageLoaded(url: string): void {
  loadedImageCache.add(url);
}
