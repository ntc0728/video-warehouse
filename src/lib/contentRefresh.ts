/**
 * 软刷新（fab「刷新」）期间的页面重挂载标记。
 *
 * AppLayout 收到 `kino:content-refresh` 后给当前路由换 key 重挂载 —— 这次重挂载
 * **不是一次新导航**。useScrollRestore 的 `restoreFrom` 门控（收藏/历史仅从
 * detail/play 进入才恢复）与页面「挂载即回顶」effect 若把它当新进入，
 * 刷新后滚动位置会归零 → 依赖 scrollTop 的 fab-stack 随之消失。
 *
 * 时序：AppLayout 的 layout effect 负责清除（子组件 layout effect 先于父级执行，
 * 因此页面 hook 在本次提交里都能读到）；页面内被动 effect 各自按「筛选/id 真正变化」
 * 判定，不依赖本标记。
 */
let refreshing = false;

export function beginContentRefresh(): void {
  refreshing = true;
}

export function endContentRefresh(): void {
  refreshing = false;
}

export function isContentRefreshing(): boolean {
  return refreshing;
}
