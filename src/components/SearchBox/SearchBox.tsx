/**
 * SearchBox — 公共搜索框组件
 *
 * 使用场景：
 *  - 顶部导航栏（StickyHeader 中央）：variant="header"，全局可见
 *  - Browse 页 Header 中间：variant="browse"，居中显示
 *
 * 行为：
 *  - 受控 input，value 由内部 state 维护
 *  - URL 已带 ?q= 时（useSearchParams）自动同步 input 值
 *  - 回车 / 点击搜索按钮 → 触发 onSearch(query)
 *  - 未传 onSearch → 默认 navigate('/browse?q=...')
 *  - ESC / 点击清除按钮 → 清空 input 并 focus
 *  - 移动端 submit 按钮隐藏文字仅留图标
 *  - focus 时显示搜索历史 + 热门搜索 dropdown
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useCustomNavigate } from '@/lib/navigation';
import { Search, X, Clock, Trash2 } from 'lucide-react';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useTMDBStore } from '@/stores';
import { searchMulti } from '@/services/tmdbService';
import type { TMDBMultiSearchResult } from '@/types/tmdb';
import './SearchBox.css';
import { Icon } from "@/components/ui/Icon";

export type SearchBoxVariant = 'header' | 'browse';

export interface SearchBoxProps {
  /** 尺寸变体：header（顶部导航）/ browse（Browse 页 Header） */
  variant?: SearchBoxVariant;
  /** 显式初始值（BrowseHeader 从 URL ?q= 读取后传入） */
  defaultValue?: string;
  /** 占位符文本 */
  placeholder?: string;
  /** 进入页面时自动 focus */
  autoFocus?: boolean;
  /** 附加 className */
  className?: string;
  /** 是否显示热门搜索 */
  showHotSearch?: boolean;
  /**
   * 搜索回调。不传则默认跳转到 /browse?q=<query>。
   * 已 trim 空白的 query 作为参数。
   */
  onSearch?: (query: string) => void;
  /** 输入值变化回调（含 trim 前的原始值） */
  onValueChange?: (value: string) => void;
  /**
   * 搜索历史作用域：不同页面的顶部搜索框历史互不影响
   * （如 'global' / 'iptv' / 'settings' / 'browse' / 'collections' / 'history'）
   */
  scope?: string;
}

const MAX_HISTORY_IN_DROPDOWN = 5;
const MAX_HOT_IN_DROPDOWN = 6;
const BLUR_DELAY_MS = 200;

export default function SearchBox({
  variant = 'header',
  defaultValue,
  placeholder = '搜索影片、剧集…',
  autoFocus = false,
  className = '',
  showHotSearch = true,
  onSearch,
  onValueChange,
  scope = 'global',
}: SearchBoxProps) {
  const navigate = useCustomNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const [value, setValue] = useState(defaultValue ?? urlQ);
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rightClickRef = useRef(false);

  // ── 搜索历史 ─────────────────────────────────────
  const { history, addHistory, removeHistory, clearHistory } = useSearchHistory(scope);

  // ── 热门搜索（从 trending 数据取标题） ──────────────
  const trending = useTMDBStore((s) => s.trending);
  const trendingLoading = useTMDBStore((s) => s.loading.trending);
  const trendingError = useTMDBStore((s) => s.errors.trending);
  const fetchTrending = useTMDBStore((s) => s.fetchTrending);
  const hotItems = trending
    .filter((item) => item.title)
    .slice(0, MAX_HOT_IN_DROPDOWN);

  // ── Dropdown 状态 ──────────────────────────────────
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const visibleHotItems = showHotSearch ? hotItems : [];

  // 懒加载热门搜索：仅当下拉打开且需要展示热门搜索时才拉取 trending。
  // SearchBox 常驻顶栏，若在挂载时无条件拉取，会导致「非首页刷新即请求
  // /trending/all/day」；改为按需触发，首页数据仍由 fetchAllHomeData 负责。
  useEffect(() => {
    if (isDropdownOpen && showHotSearch && trending.length === 0 && !trendingLoading) {
      void fetchTrending('day');
    }
  }, [isDropdownOpen, showHotSearch, trending.length, trendingLoading, fetchTrending]);
  // 热门搜索加载中 / 加载失败占位（11.2）：无历史 + 热门加载中时下拉也要渲染，
  // 否则用户点开搜索框看到「空白」——加载失败时展示失败提示，下次打开下拉自动重试。
  const hotLoading = showHotSearch && trending.length === 0 && trendingLoading;
  const hotError = showHotSearch && trending.length === 0 && !trendingLoading && !!trendingError;

  // ── 实时搜索建议（输入词后防抖调 /search/multi） ──────────
  // 输入非空词时，下拉切换为「实时搜索结果」：请求前显示「搜索中」、成功展示结果
  // （左侧搜索图标 + 名称，右侧电影/剧集/人物类型标签）、失败或无数据显示提示。
  // 不写入 TMDB store（避免污染 Browse 的 discoverResults），独立本地 state。
  const [suggestions, setSuggestions] = useState<TMDBMultiSearchResult[]>([]);
  const [suggestStatus, setSuggestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const suggestSeqRef = useRef(0);       // 竞态：仅最新一次搜索可写结果
  const suggestDebounceRef = useRef<number | null>(null); // 300ms 防抖
  const hasQuery = value.trim().length > 0;

  useEffect(() => {
    const q = value.trim();
    if (suggestDebounceRef.current) window.clearTimeout(suggestDebounceRef.current);
    if (!q) {
      setSuggestStatus('idle');
      setSuggestions([]);
      return;
    }
    setSuggestStatus('loading');
    suggestDebounceRef.current = window.setTimeout(async () => {
      const seq = ++suggestSeqRef.current;
      try {
        const data = await searchMulti(q);
        if (seq !== suggestSeqRef.current) return; // 过期响应丢弃（快速连续输入）
        setSuggestions(data.results);
        setSuggestStatus('success');
      } catch {
        if (seq !== suggestSeqRef.current) return;
        setSuggestStatus('error');
      }
    }, 300);
  }, [value]);

  // 卸载清理防抖定时器
  useEffect(() => {
    return () => {
      if (suggestDebounceRef.current) window.clearTimeout(suggestDebounceRef.current);
    };
  }, []);

  const suggestionTypeLabel = (t: TMDBMultiSearchResult['media_type']): string =>
    t === 'tv' ? '剧集' : t === 'person' ? '人物' : '电影';

  const showDropdown = isDropdownOpen && (history.length > 0 || visibleHotItems.length > 0 || hotLoading || hotError || hasQuery);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState<number | undefined>(undefined);
  const [dropdownAbove, setDropdownAbove] = useState(false);

  // 外部 defaultValue 变化时同步（PageSearch 切页场景 + URL ?q= 场景）
  // 路由变化时也触发同步，确保切换页面时搜索词正确重置
  useEffect(() => {
    const next = defaultValue ?? urlQ;
    setValue(next);
    onValueChange?.(next);
  }, [defaultValue, urlQ, location.pathname]);

  // ── 防止浏览器回退恢复焦点：路由变化时 blur 搜索框 ──
  useEffect(() => {
    if (!autoFocus) {
      requestAnimationFrame(() => {
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
        }
      });
    }
  }, [autoFocus, location.pathname, location.search]);

  // ── 搜索逻辑 ──────────────────────────────────────
  const lastSearchedRef = useRef('');

  // 路由变化时重置 lastSearchedRef：
  // 顶部导航栏 SearchBox 常驻挂载，搜索 "test" 后 lastSearchedRef 锁定为 "test"，
  // 若不重置，返回首页再次搜索相同词会被 handleSearch 的去重判断拦截，导致无法导航。
  useEffect(() => {
    lastSearchedRef.current = '';
  }, [location.pathname]);

  const handleSearch = useCallback((query?: string) => {
    const q = (query ?? value).trim();
    if (!q) return;
    // 有 onSearch 回调时（如 Browse 页）不做去重 —— 允许重复搜索同一关键词；
    // 无 onSearch 时（如顶部导航栏）保留去重，避免重复 navigate。
    if (!onSearch && q === lastSearchedRef.current) return;
    lastSearchedRef.current = q;
    addHistory(q);
    setIsDropdownOpen(false);
    if (onSearch) {
      onSearch(q);
    } else {
      navigate('/browse', { state: { q } });
    }
  }, [value, onSearch, navigate, addHistory]);

  const handleSuggestionClick = useCallback((item: TMDBMultiSearchResult) => {
    // 点击建议 → 跳转到 Browse 页并填入关键词搜索（不再直达详情页）
    const q = item.name || item.title || item.original_name || item.original_title || '';
    setValue(q);
    handleSearch(q);
    inputRef.current?.blur();
    setIsDropdownOpen(false);
  }, [handleSearch]);

  const handleClear = useCallback(() => {
    setValue('');
    lastSearchedRef.current = '';
    setIsDropdownOpen(false);
    if (onSearch) {
      onSearch('');
    }
  }, [onSearch]);

  // 输入值变化时仅更新 state，不触发搜索
  // 搜索仅在以下场景触发：点击搜索按钮 / 按回车 / 清空搜索框
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onValueChange?.(newValue);
  }, [onValueChange]);

  // ── Dropdown 交互 ──────────────────────────────────
  const handleFocus = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    if (!rightClickRef.current) {
      setIsDropdownOpen(true);
    }
  }, []);

  // pointerdown 在 focus 之前触发，可拦截右键（button=2）阻止 dropdown 弹出
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) {
      rightClickRef.current = true;
      setTimeout(() => { rightClickRef.current = false; }, 100);
    }
  }, []);

  // 计算 dropdown 位置，防止超出视口
  useEffect(() => {
    if (!showDropdown) return;
    const id = requestAnimationFrame(() => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      if (spaceBelow >= 200) {
        setDropdownMaxHeight(spaceBelow);
        setDropdownAbove(false);
      } else if (spaceAbove >= 200) {
        setDropdownMaxHeight(spaceAbove);
        setDropdownAbove(true);
      } else {
        setDropdownMaxHeight(Math.max(spaceBelow, spaceAbove));
        setDropdownAbove(spaceAbove > spaceBelow);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [showDropdown]);

  const handleBlur = useCallback(() => {
    blurTimerRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
      blurTimerRef.current = null;
    }, BLUR_DELAY_MS);
  }, []);

  const handleDropdownMouseDown = useCallback((e: React.MouseEvent) => {
    // 阻止默认行为，防止 input 失去焦点
    e.preventDefault();
  }, []);

  const handleHistoryClick = useCallback((item: string) => {
    setValue(item);
    handleSearch(item);
    // 选中后 blur input：dropdown 的 onMouseDown 阻止了默认失焦行为，
    // 若不手动 blur，下次点击搜索框不会触发 onFocus → 下拉框无法再次弹出。
    inputRef.current?.blur();
  }, [handleSearch]);

  const handleHistoryRemove = useCallback((e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    removeHistory(item);
  }, [removeHistory]);

  const handleClearHistory = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clearHistory();
  }, [clearHistory]);

  // ── 键盘导航 ──────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isComposingRef.current) {
      e.preventDefault();
      handleSearch();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (showDropdown) {
        setIsDropdownOpen(false);
      } else {
        handleClear();
      }
    }
  }, [handleSearch, handleClear, showDropdown]);

  // 组件卸载时清理 timer
  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  return (
    <div
      className={[
        'search-box-wrap',
        `search-box-wrap--${variant}`,
        className,
      ].filter(Boolean).join(' ')}
      role="search"
    >
      <div className="search-box__field">
        <div
          className={[
            'search-box',
            `search-box--${variant}`,
          ].join(' ')}
        >
          <Icon icon={Search} size="sm" className="search-box__icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className="search-box__input"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onPointerDown={handlePointerDown}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            placeholder={placeholder}
            aria-label="搜索"
            aria-haspopup="listbox"
            aria-expanded={showDropdown}
            autoFocus={autoFocus}
            maxLength={100}
            enterKeyHint="search"
            autoComplete="new-password"
            spellCheck={false}
          />
          <button
            type="button"
            className="search-box__clear"
            onClick={handleClear}
            aria-label="清空搜索"
            tabIndex={-1}
            data-empty={value ? 'false' : 'true'}
          >
            <Icon icon={X} size="xs" aria-hidden="true" />
          </button>
        </div>
        {/* 搜索按钮 */}
        <button
          type="button"
          className="search-box__submit"
          onClick={() => handleSearch()}
          disabled={!value.trim()}
        >
          <span className="search-box__submit-text">搜索</span>
        </button>
      </div>

      {/* ── 搜索历史 + 热门搜索 Dropdown ──────────────── */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className={[
            'search-box-dropdown',
            dropdownAbove ? 'search-box-dropdown--above' : '',
          ].filter(Boolean).join(' ')}
          role="listbox"
          onMouseDown={handleDropdownMouseDown}
          style={{ '--dropdown-avail-h': dropdownMaxHeight != null ? `${dropdownMaxHeight}px` : undefined } as CSSProperties}
        >
          {hasQuery ? (
            /* ── 实时搜索建议（输入词时优先展示，历史/热门让位） ── */
            <>
              {suggestStatus === 'loading' && (
                <div className="search-box-dropdown__hint">搜索中…</div>
              )}
              {suggestStatus === 'error' && (
                <div className="search-box-dropdown__hint">搜索失败，请重试</div>
              )}
              {suggestStatus === 'success' && suggestions.length === 0 && (
                <div className="search-box-dropdown__hint">未找到相关结果</div>
              )}
              {suggestStatus === 'success' && suggestions.length > 0 && (
                <ul className="search-box-dropdown__list">
                  {suggestions.map((item) => (
                    <li
                      key={`${item.media_type}-${item.id}`}
                      className="search-box-dropdown__item search-box-dropdown__item--suggestion"
                      role="option"
                      onClick={() => handleSuggestionClick(item)}
                    >
                      <Icon icon={Search} size="xs" className="search-box-dropdown__suggestion-icon" aria-hidden="true" />
                      <span className="search-box-dropdown__text">
                        {item.name || item.title || item.original_name || item.original_title || ''}
                      </span>
                      <span className="search-box-dropdown__type">{suggestionTypeLabel(item.media_type)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
          {/* 搜索历史 */}
          {history.length > 0 && (
            <>
              <div className="search-box-dropdown__header">
                <span className="search-box-dropdown__title">
                  <Icon icon={Clock} size="xs" aria-hidden="true" />
                  搜索历史
                </span>
              </div>
              <ul className="search-box-dropdown__list">
                {history.slice(0, MAX_HISTORY_IN_DROPDOWN).map((item) => (
                  <li
                    key={item}
                    className="search-box-dropdown__item"
                    role="option"
                    onClick={() => handleHistoryClick(item)}
                  >
                    <span className="search-box-dropdown__text">{item}</span>
                    <button
                      type="button"
                      className="search-box-dropdown__remove"
                      onClick={(e) => handleHistoryRemove(e, item)}
                      aria-label={`删除 ${item}`}
                    >
                      <Icon icon={X} size="xs" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="search-box-dropdown__clear"
                onClick={handleClearHistory}
              >
                <Icon icon={Trash2} size="xs" aria-hidden="true" />
                清空搜索历史
              </button>
            </>
          )}

          {/* 分隔线：历史和热门（含加载中/失败占位）都存在时显示 */}
          {history.length > 0 && (visibleHotItems.length > 0 || hotLoading || hotError) && (
            <div className="search-box-dropdown__divider" />
          )}

          {/* 热门搜索：加载中/失败占位（11.2）——点开即有反馈，不再「空白无反应」 */}
          {(visibleHotItems.length > 0 || hotLoading || hotError) && (
            <>
              <div className="search-box-dropdown__header">
                <span className="search-box-dropdown__title">
                  🔥 热门搜索
                </span>
              </div>
              {hotLoading ? (
                <div className="search-box-dropdown__hint">热门搜索加载中…</div>
              ) : hotError ? (
                <div className="search-box-dropdown__hint">热门搜索加载失败，重新打开重试</div>
              ) : (
                <ul className="search-box-dropdown__list">
                  {visibleHotItems.map((item, idx) => (
                    <li
                      key={item.id}
                      className="search-box-dropdown__item search-box-dropdown__item--hot"
                      role="option"
                      onClick={() => handleHistoryClick(item.title)}
                    >
                      <span
                        className={[
                          'search-box-dropdown__rank',
                          idx < 3 ? 'search-box-dropdown__rank--top' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {idx + 1}
                      </span>
                      <span className="search-box-dropdown__text">{item.title}</span>
                      {item.year && (
                        <span className="search-box-dropdown__meta">{item.year}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
