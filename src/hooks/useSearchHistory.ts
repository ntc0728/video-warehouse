/**
 * useSearchHistory — 搜索历史管理 Hook
 *
 * 功能：
 *  - 搜索历史存储在 localStorage，最多 10 条，按时间倒序
 *  - 历史项带元数据（类型/年份，来自 /search/multi 实时建议点击，2026-11-08）
 *  - 添加历史项：按「关键词+类型+年份」三元组去重（2026-11-08 用户拍板「增量更新」：
 *    同词不同类型/年份各占一条，如「神秘博士·剧集2005」与「神秘博士·电影2023」并存；
 *    完全相同项移到最前），无元数据的普通搜索按旧格式共存
 *  - 删除单条历史
 *  - 清空全部历史
 *  - 持久化 + 跨标签页同步（storage event）
 *  - 兼容旧格式：存量数据是纯字符串数组，加载时归一化为无元数据项
 */
import { useCallback, useEffect, useState } from 'react';

/** 搜索历史项：query 必填；mediaType/year 为实时建议携带的元数据（可缺省） */
export interface SearchHistoryItem {
  query: string;
  mediaType?: 'movie' | 'tv';
  year?: number;
}

/** addHistory 的入参形态：纯字符串（旧调用/回车搜索）或带元数据对象 */
export type SearchHistoryInput = string | SearchHistoryItem;

/**
 * 每个页面顶部搜索框使用独立的 scope，搜索历史互不影响。
 * scope 为空时回退到全局 key（兼容历史调用）。
 */
function buildStorageKey(scope: string): string {
  return scope ? `search-history-${scope}` : 'search-history';
}

const MAX_ITEMS = 10;

function normalizeItem(input: SearchHistoryInput): SearchHistoryItem | null {
  const item = typeof input === 'string' ? { query: input } : input;
  const query = item.query?.trim();
  if (!query) return null;
  return {
    query,
    mediaType: item.mediaType === 'movie' || item.mediaType === 'tv' ? item.mediaType : undefined,
    year: typeof item.year === 'number' && Number.isFinite(item.year) ? item.year : undefined,
  };
}

/** 去重键：关键词 + 类型 + 年份三元组（缺省元数据为空串） */
function itemKey(item: SearchHistoryItem): string {
  return `${item.query}|${item.mediaType ?? ''}|${item.year ?? ''}`;
}

/** 从 localStorage 加载搜索历史（兼容旧版纯字符串数组，逐条归一化） */
function loadHistory(storageKey: string): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items: SearchHistoryItem[] = [];
    for (const entry of parsed) {
      // 旧格式字符串 / 新格式对象都收，其余形态丢弃
      if (typeof entry === 'string') {
        const item = normalizeItem(entry);
        if (item) items.push(item);
      } else if (entry && typeof entry === 'object' && typeof (entry as { query?: unknown }).query === 'string') {
        const item = normalizeItem(entry as SearchHistoryItem);
        if (item) items.push(item);
      }
    }
    return items;
  } catch {
    return [];
  }
}

/** 将搜索历史保存到 localStorage */
function saveHistory(storageKey: string, history: SearchHistoryItem[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(history));
  } catch {
    // localStorage 被禁用或满，静默失败
  }
}

/** 搜索历史管理 Hook，支持增删清空，最多保留 10 条，跨标签页同步 */
export function useSearchHistory(scope: string = 'global') {
  const storageKey = buildStorageKey(scope);
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => loadHistory(storageKey));

  // 跨标签页同步
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        setHistory(loadHistory(storageKey));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storageKey]);

  const addHistory = useCallback((input: SearchHistoryInput) => {
    const item = normalizeItem(input);
    if (!item) return;

    setHistory((prev) => {
      // 增量去重：仅移除「关键词+类型+年份」完全相同的项（同词不同元数据各自保留）
      const key = itemKey(item);
      const filtered = prev.filter((prevItem) => itemKey(prevItem) !== key);
      // 命中的项移到最前面，最多保留 MAX_ITEMS 条
      const next = [item, ...filtered].slice(0, MAX_ITEMS);
      saveHistory(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const removeHistory = useCallback((input: SearchHistoryInput) => {
    const item = normalizeItem(input);
    if (!item) return;
    const key = itemKey(item);
    setHistory((prev) => {
      const next = prev.filter((prevItem) => itemKey(prevItem) !== key);
      saveHistory(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory(storageKey, []);
  }, [storageKey]);

  return {
    history,
    addHistory,
    removeHistory,
    clearHistory,
  };
}
