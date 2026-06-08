/**
 * 页面导航状态管理
 * 离开页面时保存状态，返回时恢复（tab、搜索词、筛选条件等）
 */
import { create } from 'zustand';

interface PageState {
  /** 上次激活的 tab */
  tab?: string;
  /** 搜索关键词 */
  search?: string;
  /** 筛选条件 */
  filter?: Record<string, unknown>;
  /** 滚动位置 */
  scrollTop?: number;
}

interface NavState {
  states: Record<string, PageState>;
  saveState: (page: string, state: PageState) => void;
  getState: (page: string) => PageState | null;
  clearState: (page: string) => void;
}

export const useNavStore = create<NavState>()((set, get) => ({
  states: {},
  saveState: (page, state) =>
    set((s) => ({ states: { ...s.states, [page]: { ...s.states[page], ...state } } })),
  getState: (page) => get().states[page] || null,
  clearState: (page) =>
    set((s) => { const next = { ...s.states }; delete next[page]; return { states: next }; }),
}));
