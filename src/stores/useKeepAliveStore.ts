/**
 * 有限 Keep-Alive 控制
 *
 * 仅 detail 页采用「条件挂起」策略：
 * - 从 detail 点播放进入 /play 时，detail 被 pin 挂起（保留实例与滚动/内容）；
 * - 从 /play 返回 detail 时，复用被挂起的实例，瞬时恢复（不重新加载）；
 * - 其他进入 detail 的路径（首页 / Browse / 推荐跳转 / 浏览器前进后退）不缓存，
 *   detail 重新挂载并重新加载，从源头消除 Keep-Alive 单实例复用导致的
 *   hero 残留上一个 detail 内容的问题。
 *
 * 与 AppLayout 默认「访问即常驻」的 Keep-Alive 不同，本 store 让 detail 的缓存
 * 行为变成 opt-in（仅 play 路径才 pin），其余路由仍走原有常驻逻辑。
 */
import { create } from 'zustand';

interface KeepAliveState {
  /** 当前被 pin 挂起的 detail id；null 表示 detail 不缓存 */
  pinnedDetailId: string | null;
  pinDetail: (id: string) => void;
  unpinDetail: () => void;
}

export const useKeepAliveStore = create<KeepAliveState>((set) => ({
  pinnedDetailId: null,
  pinDetail: (id) => set({ pinnedDetailId: id }),
  unpinDetail: () => set({ pinnedDetailId: null }),
}));
