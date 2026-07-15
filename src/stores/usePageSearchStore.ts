/**
 * 页面搜索状态管理
 * 页面注册搜索回调，顶部导航栏 SearchBox 读取并使用
 * 解决 StickyHeader 在 AppLayout 层级无法读取页面级 React Context 的问题
 */
import { create } from 'zustand';

interface PageSearchState {
  search: string;
  onSearch: ((query: string) => void) | null;
  placeholder: string;
  setPageSearch: (search: string, onSearch: (query: string) => void, placeholder: string) => void;
  clearSearch: () => void;
  clearPageSearch: () => void;
}

export const usePageSearchStore = create<PageSearchState>()((set) => ({
  search: '',
  onSearch: null,
  placeholder: '搜索影片、剧集…',
  setPageSearch: (search, onSearch, placeholder) => set({ search, onSearch, placeholder }),
  clearSearch: () => set({ search: '' }),
  clearPageSearch: () => set({ search: '', onSearch: null, placeholder: '搜索影片、剧集…' }),
}));
