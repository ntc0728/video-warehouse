/**
 * highlight — 搜索关键词高亮工具
 *
 * 将文本中的匹配词用 <mark> 标签包裹，用于搜索结果高亮。
 * 使用 useHook 模式避免每次渲染重复 split/regex。
 */
import { useMemo } from 'react';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 高亮文本 hook：返回 ReactNode，匹配部分用 <mark> 包裹。
 * query 为空或纯空白时返回原始文本。
 */
export function useHighlightedText(text: string, query: string) {
  return useMemo(() => {
    const q = query.trim();
    if (!q) return text;
    const regex = new RegExp(`(${escapeRegex(q)})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="search-highlight">{part}</mark>
      ) : (
        part
      ),
    );
  }, [text, query]);
}
