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
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
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
}

export default function SearchBox({
  variant = 'header',
  defaultValue,
  placeholder = '搜索影片、剧集…',
  autoFocus = false,
  className = '',
  onSearch,
}: SearchBoxProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const [value, setValue] = useState(defaultValue ?? urlQ);
  const inputRef = useRef<HTMLInputElement>(null);
  // 中文输入法：composition 期间不上抛 Enter
  const isComposingRef = useRef(false);

  // 外部 URL q 变化时同步（如切到不带 q 的页面、跨页 history 变化）
  useEffect(() => {
    setValue(defaultValue ?? urlQ);
  }, [defaultValue, urlQ]);

  const handleSearch = useCallback(() => {
    const q = value.trim();
    if (!q) return;
    if (onSearch) {
      onSearch(q);
    } else {
      navigate(`/browse?q=${encodeURIComponent(q)}`);
    }
  }, [value, onSearch, navigate]);

  const handleClear = useCallback(() => {
    setValue('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isComposingRef.current) {
      e.preventDefault();
      handleSearch();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClear();
    }
  };

  return (
    <div
      className={[
        'search-box-wrap',
        `search-box-wrap--${variant}`,
        className,
      ].filter(Boolean).join(' ')}
      role="search"
    >
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
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; }}
          placeholder={placeholder}
          aria-label="搜索"
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
      {/* 搜索按钮：独立在 search-box 方框外，box 紧贴按钮左侧 */}
      <button
        type="button"
        className="search-box__submit"
        onClick={handleSearch}
        aria-label="执行搜索"
        disabled={!value.trim()}
      >
        <Search size={14} className="search-box__submit-icon" aria-hidden="true" />
        <span className="search-box__submit-text">搜索</span>
      </button>
    </div>
  );
}
