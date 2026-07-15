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
  type KeyboardEvent,
} from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Search, X, Clock, Trash2 } from 'lucide-react';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useTMDBStore } from '@/stores';
import './SearchBox.css';

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
  /**
   * 搜索回调。不传则默认跳转到 /browse?q=<query>。
   * 已 trim 空白的 query 作为参数。
   */
  onSearch?: (query: string) => void;
  /** 输入值变化回调（含 trim 前的原始值） */
  onValueChange?: (value: string) => void;
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
  onSearch,
  onValueChange,
}: SearchBoxProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const [value, setValue] = useState(defaultValue ?? urlQ);
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 搜索历史 ─────────────────────────────────────
  const { history, addHistory, removeHistory, clearHistory } = useSearchHistory();

  // ── 热门搜索（从 trending 数据取标题） ──────────────
  const trending = useTMDBStore((s) => s.trending);
  const fetchTrending = useTMDBStore((s) => s.fetchTrending);
  const hotItems = trending
    .filter((item) => item.title)
    .slice(0, MAX_HOT_IN_DROPDOWN);

  // 首次挂载时确保 trending 数据已加载
  useEffect(() => {
    if (trending.length === 0) {
      void fetchTrending('day');
    }
  }, [trending.length, fetchTrending]);

  // ── Dropdown 状态 ──────────────────────────────────
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const showDropdown = isDropdownOpen && (history.length > 0 || hotItems.length > 0);
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
      navigate('/browse', { state: { q }, viewTransition: true });
    }
  }, [value, onSearch, navigate, addHistory]);

  const handleClear = useCallback(() => {
    setValue('');
    lastSearchedRef.current = '';
    setIsDropdownOpen(false);
    if (onSearch) {
      onSearch('');
    }
  }, [onSearch]);

  // 输入值变化时实时触发搜索（支持 backspace/select+delete 场景）
  // 仅在有 onSearch 回调时生效（页面内过滤场景），导航场景保持 Enter 触发
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onValueChange?.(newValue);
    if (onSearch) {
      onSearch(newValue.trim());
    }
  }, [onSearch, onValueChange]);

  // ── Dropdown 交互 ──────────────────────────────────
  const handleFocus = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setIsDropdownOpen(true);
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
        setDropdownMaxHeight(Math.min(spaceBelow, 448));
        setDropdownAbove(false);
      } else if (spaceAbove >= 200) {
        setDropdownMaxHeight(Math.min(spaceAbove, 448));
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
          <Search size={16} className="search-box__icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className="search-box__input"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            placeholder={placeholder}
            aria-label="搜索"
            aria-haspopup="listbox"
            aria-expanded={showDropdown}
            autoFocus={autoFocus}
            maxLength={100}
            enterKeyHint="search"
            autoComplete="off"
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
            <X size={14} aria-hidden="true" />
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
          style={{ maxHeight: dropdownMaxHeight }}
        >
          {/* 搜索历史 */}
          {history.length > 0 && (
            <>
              <div className="search-box-dropdown__header">
                <span className="search-box-dropdown__title">
                  <Clock size={12} aria-hidden="true" />
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
                      <X size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="search-box-dropdown__clear"
                onClick={handleClearHistory}
              >
                <Trash2 size={12} aria-hidden="true" />
                清空搜索历史
              </button>
            </>
          )}

          {/* 分隔线：历史和热门都存在时显示 */}
          {history.length > 0 && hotItems.length > 0 && (
            <div className="search-box-dropdown__divider" />
          )}

          {/* 热门搜索 */}
          {hotItems.length > 0 && (
            <>
              <div className="search-box-dropdown__header">
                <span className="search-box-dropdown__title">
                  🔥 热门搜索
                </span>
              </div>
              <ul className="search-box-dropdown__list">
                {hotItems.map((item, idx) => (
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
