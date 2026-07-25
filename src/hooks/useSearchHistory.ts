/**
 * useSearchHistory — 搜索历史管理 Hook
 *
 * 功能：
 *  - 搜索历史存储在 localStorage，最多 10 条，按时间倒序
 *  - 添加历史项（自动去重，重复项移到最前）
 *  - 删除单条历史
 *  - 清空全部历史
 *  - 持久化 + 跨标签页同步（storage event）
 */
import { useCallback, useEffect, useState } from 'react';

/**
 * 每个页面顶部搜索框使用独立的 scope，搜索历史互不影响。
 * scope 为空时回退到全局 key（兼容历史调用）。
 */
function buildStorageKey(scope: string): string {
  return scope ? `search-history-${scope}` : 'search-history';
}

const MAX_ITEMS = 10;

/** 从 localStorage 加载搜索历史 */
function loadHistory(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

/** 将搜索历史保存到 localStorage */
function saveHistory(storageKey: string, history: string[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(history));
  } catch {
    // localStorage 被禁用或满，静默失败
  }
}

/** 搜索历史管理 Hook，支持增删清空，最多保留 10 条，跨标签页同步 */
export function useSearchHistory(scope: string = 'global') {
  const storageKey = buildStorageKey(scope);
  const [history, setHistory] = useState<string[]>(() => loadHistory(storageKey));

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

  const addHistory = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setHistory((prev) => {
      // 去重：移除已存在的相同项
      const filtered = prev.filter((item) => item !== trimmed);
      // 新项插入到最前面，最多保留 MAX_ITEMS 条
      const next = [trimmed, ...filtered].slice(0, MAX_ITEMS);
      saveHistory(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const removeHistory = useCallback((query: string) => {
    setHistory((prev) => {
      const next = prev.filter((item) => item !== query);
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
