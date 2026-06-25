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

const STORAGE_KEY = 'search-history';
const MAX_ITEMS = 10;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function saveHistory(history: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage 被禁用或满，静默失败
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(loadHistory);

  // 跨标签页同步
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setHistory(loadHistory());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const addHistory = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setHistory((prev) => {
      // 去重：移除已存在的相同项
      const filtered = prev.filter((item) => item !== trimmed);
      // 新项插入到最前面，最多保留 MAX_ITEMS 条
      const next = [trimmed, ...filtered].slice(0, MAX_ITEMS);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeHistory = useCallback((query: string) => {
    setHistory((prev) => {
      const next = prev.filter((item) => item !== query);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return {
    history,
    addHistory,
    removeHistory,
    clearHistory,
  };
}
