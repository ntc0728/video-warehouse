/**
 * FilterBar — 公共筛选组件
 * 分类 · 类型 · 地区 · 排序 — 横向 chip 筛选，支持 TMDB discover 参数
 * 主题感知：Light/Dark 自动适配
 * 点击任意 chip 即触发搜索（无「应用筛选」按钮）
 * 分类行：多行 wrap 展示；单选（点击其他自动替换，不可经 chip 取消）
 * 类型行：仅在 category=all 时显示（全部/电影/剧集）
 * 地区/分类 label 可点击：点击 = 回到该行「全部」状态，默认即高亮
 * 排序 label 不可选（纯文本）
 *
 * 移动端：超出 1 行时显示"更多"按钮，点击打开底部弹窗
 */
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile, useIsRealMobile } from '@/hooks/useMediaQuery';
import type { TMDBGenre } from '@/types/tmdb';
import { MEDIA_OPTIONS, REGION_OPTIONS, SORT_OPTIONS, YEAR_OPTIONS, YEAR_OLDER_LABEL, type FilterBarValue } from './constants';
import BottomSheet from '@/components/ui/BottomSheet';
import './FilterBar.css';

// ── 限高滚动 Hook ─────────────────────────────────────

interface UseLimitedScrollOptions {
  /** 最大显示行数（默认 2） */
  maxRows?: number;
}

interface UseLimitedScrollReturn {
  /** 容器 ref */
  containerRef: React.RefObject<HTMLDivElement>;
  /** 内容区 ref */
  contentRef: React.RefObject<HTMLDivElement>;
  /** 是否需要水平滚动（内容超出 maxRows 行时切换为单行滚动） */
  needsScroll: boolean;
  /** 是否可以向左滚动 */
  canScrollLeft: boolean;
  /** 是否可以向右滚动 */
  canScrollRight: boolean;
  /** 向左滚动 */
  scrollLeft: () => void;
  /** 向右滚动 */
  scrollRight: () => void;
}

function useLimitedScroll({ maxRows = 2 }: UseLimitedScrollOptions = {}): UseLimitedScrollReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // 检测是否需要滚动
  // 策略：用离屏克隆元素测量 wrap 和 nowrap 模式下的高度差异
  const checkNeedsScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    const firstChild = el.firstElementChild as HTMLElement | null;
    if (!firstChild) {
      setNeedsScroll(false);
      return;
    }

    // 创建离屏克隆容器进行测量（避免影响布局）
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.position = 'absolute';
    clone.style.visibility = 'hidden';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.flexWrap = 'wrap';
    clone.style.width = `${el.clientWidth}px`;
    document.body.appendChild(clone);

    // 确保 chip 不压缩
    const cloneChips = Array.from(clone.children) as HTMLElement[];
    cloneChips.forEach(c => { c.style.flexShrink = '0'; c.style.flexBasis = 'auto'; });

    const gap = parseFloat(getComputedStyle(clone).gap) || 8;
    const chipHeight = firstChild.offsetHeight;
    const wrapContentHeight = clone.scrollHeight;
    const maxAllowedHeight = chipHeight * maxRows + gap * (maxRows - 1);
    const exceedsRows = wrapContentHeight > maxAllowedHeight + 1;

    let hasHorizontalOverflow = false;

    if (exceedsRows) {
      // 切换为 nowrap 测量水平溢出
      clone.style.flexWrap = 'nowrap';
      hasHorizontalOverflow = clone.scrollWidth > clone.clientWidth + 1;
    }

    document.body.removeChild(clone);

    setNeedsScroll(hasHorizontalOverflow);
  }, [maxRows]);

  // 检测滚动位置
  const checkScrollPosition = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // 监听内容变化
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      checkNeedsScroll();
      // 延迟检测滚动位置，等待浏览器完成布局
      requestAnimationFrame(() => checkScrollPosition());
    });

    observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    // 初始检测
    checkNeedsScroll();
    requestAnimationFrame(() => checkScrollPosition());

    return () => observer.disconnect();
  }, [checkNeedsScroll, checkScrollPosition]);

  // needsScroll 变化后，等待 React 重新渲染 + 浏览器布局完成再检测滚动位置
  useEffect(() => {
    if (!needsScroll) return;
    const raf = requestAnimationFrame(() => {
      checkScrollPosition();
    });
    return () => cancelAnimationFrame(raf);
  }, [needsScroll, checkScrollPosition]);

  // 监听窗口 resize
  useEffect(() => {
    const handleResize = () => {
      checkNeedsScroll();
      checkScrollPosition();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkNeedsScroll, checkScrollPosition]);

  // 滚动事件监听
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkScrollPosition, { passive: true });
    return () => el.removeEventListener('scroll', checkScrollPosition);
  }, [checkScrollPosition]);

  const scrollLeft = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    el.scrollBy({ left: -400, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    el.scrollBy({ left: 400, behavior: 'smooth' });
  }, []);

  return {
    containerRef,
    contentRef,
    needsScroll,
    canScrollLeft,
    canScrollRight,
    scrollLeft,
    scrollRight,
  };
}

// ── 限高筛选行 Props ─────────────────────────────────

interface LimitedRowProps {
  /** 行 label */
  label: string;
  /** 最大显示行数 */
  maxRows?: number;
  /** 子内容 */
  children: React.ReactNode;
  /** 底部弹窗标题（移动端使用） */
  sheetTitle?: string;
}

// ── 限高筛选行组件 ───────────────────────────────────

function LimitedRow({
  label,
  maxRows = 2,
  children,
  sheetTitle,
}: LimitedRowProps) {
  // 使用真实移动设备检测（User-Agent），不依赖视口宽度
  const isRealMobile = useIsRealMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    containerRef,
    contentRef,
    needsScroll,
    canScrollLeft,
    canScrollRight,
    scrollLeft,
    scrollRight,
  } = useLimitedScroll({ maxRows });

  // 真实移动设备：显示"更多"按钮 + 底部弹窗
  if (isRealMobile) {
    // 点击弹窗中的 chip 后关闭弹窗
    const handleSheetChipClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.filter-bar__chip')) {
        setTimeout(() => setSheetOpen(false), 150);
      }
    };

    return (
      <>
        <div
          className="filter-bar__row filter-bar__row--limited"
          ref={containerRef}
        >
          <span
            className="filter-bar__label"
          >
            {label}
          </span>
          <div
            className={`filter-bar__chips-limited${needsScroll ? ' filter-bar__chips-limited--collapsed' : ''}`}
            ref={contentRef}
          >
            {children}
          </div>
          {needsScroll && (
            <button
              type="button"
              className="filter-bar__more-btn"
              onClick={() => setSheetOpen(true)}
              aria-label="查看更多"
            >
              更多
            </button>
          )}
        </div>
        <BottomSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={sheetTitle || label}
        >
          <div className="filter-bar__sheet-content" onClick={handleSheetChipClick}>
            {children}
          </div>
        </BottomSheet>
      </>
    );
  }

  // 桌面端：显示左右箭头（但当前桌面端不使用 LimitedRow，此分支保留兼容）
  return (
    <div
      className={`filter-bar__row filter-bar__row--limited${needsScroll ? ' filter-bar__row--truncated' : ''}`}
      ref={containerRef}
    >
      <span className="filter-bar__label">
        {label}
      </span>
      <div
        className={`filter-bar__chips-limited${needsScroll ? ' filter-bar__chips-limited--scroll' : ''}`}
        ref={contentRef}
      >
        {children}
      </div>
      {needsScroll && (
        <div className="filter-bar__scroll-arrows">
          <button
            type="button"
            className="filter-bar__scroll-arrow"
            onClick={scrollLeft}
            disabled={!canScrollLeft}
            aria-label="向左滚动"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="filter-bar__scroll-arrow"
            onClick={scrollRight}
            disabled={!canScrollRight}
            aria-label="向右滚动"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── FilterBar Props ───────────────────────────────────

interface FilterBarProps {
  value: FilterBarValue;
  onChange: (value: FilterBarValue) => void;
  /** 当前分类下可选的类型列表（来自 store） */
  genres?: TMDBGenre[];
  /** 是否隐藏地区行（预留） */
  hideRegion?: boolean;
  /** 需要从显示中排除的 genreIds（这些 id 仍参与 filterValue.genreIds / API 调用） */
  excludedGenreIds?: number[];
  /** 父组件在 debounce / fetch 期间置 true：右上角显示 "更新中…" spinner */
  isUpdating?: boolean;
  /** 结果总数 */
  totalResults?: number;
  /** 当前分类显示名称（替换默认的"分类"label） */
  categoryLabel?: string;
  /** 隐藏排序+结果数 footer（用于将 footer 移到父组件其他位置） */
  hideFooter?: boolean;
}

// ── 组件 ────────────────────────────────────────────

export default function FilterBar({
  value,
  onChange,
  genres = [],
  hideRegion = false,
  excludedGenreIds = [],
  isUpdating = false,
  totalResults = 0,
  categoryLabel,
  hideFooter = false,
}: FilterBarProps) {
  const isMobile = useIsMobile();

  // 过滤掉分类自身默认的 genre（仍在 value.genreIds 中参与 API）
  const visibleGenres = useMemo(
    () => genres.filter((g) => !excludedGenreIds.includes(g.id)),
    [genres, excludedGenreIds],
  );

  const update = useCallback(
    (patch: Partial<FilterBarValue>) => {
      onChange({ ...value, ...patch });
    },
    [value, onChange],
  );

  // 单选 genre：点击其他自动替换；点击同一项 no-op（必须经 label 清空）
  const selectGenre = useCallback(
    (genreId: number) => {
      if (value.genreIds.includes(genreId)) return;
      // 保留 excludedGenreIds 中被隐藏的默认项（API 仍需要）
      onChange({ ...value, genreIds: [...excludedGenreIds, genreId] });
    },
    [value, onChange, excludedGenreIds],
  );

  // 类型切换：清空可见分类的选择（不同类型的 genre id 不通用）
  const selectMediaType = useCallback(
    (v: 'all' | 'movie' | 'tv') => {
      onChange({ ...value, mediaType: v, genreIds: [...excludedGenreIds] });
    },
    [value, onChange, excludedGenreIds],
  );

  // ── 「全部」状态计算 ────────────────────────────────────
  // 分类：可见 genre 中无任何被勾选
  const isAllGenres = !value.genreIds.some((id) => !excludedGenreIds.includes(id));
  // 地区：null
  const isAllRegion = value.region === null;
  // 年份：null
  const isAllYear = value.year === null;

  // ── label 点击 = 回到「全部」───────────────────────────
  const selectAllGenres = useCallback(
    () => onChange({ ...value, genreIds: [...excludedGenreIds] }),
    [value, onChange, excludedGenreIds],
  );
  const selectAllRegion = useCallback(
    () => onChange({ ...value, region: null }),
    [value, onChange],
  );
  const selectAllYear = useCallback(
    () => onChange({ ...value, year: null, olderThan2015: false }),
    [value, onChange],
  );

  return (
    <div className={`filter-bar${isMobile ? ' filter-bar--mobile' : ''}`}>
      {/* 父组件控制的全局更新指示器（debounce / fetch 期间） */}
      {isUpdating && (
        <div className="filter-bar__updating" role="status" aria-live="polite">
          <span className="filter-bar__spinner" aria-hidden="true" />
          <span className="filter-bar__updating-text">更新中…</span>
        </div>
      )}

      {/* 类型 — 仅「全部」category 显示（全部/电影/剧集），只有 3 个选项，不需要限高 */}
      {value.category === 'all' && (
        <div className="filter-bar__row filter-bar__row--scroll">
          <span className="filter-bar__label">类型</span>
          <div className="filter-bar__chips-scroll">
            {MEDIA_OPTIONS.map((m) => (
              <button
                key={m.value}
                className={`filter-bar__chip${value.mediaType === m.value ? ' filter-bar__chip--active' : ''}`}
                onClick={() => selectMediaType(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 分类（细分类型）— 移动端限高滚动，桌面端正常换行 */}
      {visibleGenres.length > 0 && isMobile ? (
        <LimitedRow
          label={categoryLabel || '分类'}
          maxRows={1}
        >
          <button
            type="button"
            className={`filter-bar__chip${isAllGenres ? ' filter-bar__chip--active' : ''}`}
            onClick={selectAllGenres}
          >
            全部
          </button>
          {visibleGenres.map((g) => (
            <button
              key={g.id}
              className={`filter-bar__chip${value.genreIds.includes(g.id) ? ' filter-bar__chip--active' : ''}`}
              onClick={() => selectGenre(g.id)}
            >
              {g.name}
            </button>
          ))}
        </LimitedRow>
      ) : visibleGenres.length > 0 ? (
        <div className="filter-bar__row filter-bar__row--wrap">
          <span className="filter-bar__label filter-bar__chip filter-bar__label--as-chip">
            {categoryLabel || '分类'}
          </span>
          <div className="filter-bar__chips-wrap">
            <button
              type="button"
              className={`filter-bar__chip${isAllGenres ? ' filter-bar__chip--active' : ''}`}
              onClick={selectAllGenres}
            >
              全部
            </button>
            {visibleGenres.map((g) => (
              <button
                key={g.id}
                className={`filter-bar__chip${value.genreIds.includes(g.id) ? ' filter-bar__chip--active' : ''}`}
                onClick={() => selectGenre(g.id)}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 地区 — 移动端限高滚动，桌面端正常换行 */}
      {!hideRegion && isMobile ? (
        <LimitedRow
          label="地区"
          maxRows={1}
        >
          <button
            type="button"
            className={`filter-bar__chip${isAllRegion ? ' filter-bar__chip--active' : ''}`}
            onClick={selectAllRegion}
          >
            全部
          </button>
          {REGION_OPTIONS.map((r) => (
            <button
              key={r.code ?? 'all'}
              className={`filter-bar__chip${value.region === r.code ? ' filter-bar__chip--active' : ''}`}
              onClick={() => update({ region: r.code })}
            >
              {r.label}
            </button>
          ))}
        </LimitedRow>
      ) : !hideRegion ? (
        <div className="filter-bar__row filter-bar__row--scroll">
          <span className="filter-bar__label">
            地区
          </span>
          <div className="filter-bar__chips-scroll">
            <button
              type="button"
              className={`filter-bar__chip${isAllRegion ? ' filter-bar__chip--active' : ''}`}
              onClick={selectAllRegion}
            >
              全部
            </button>
            {REGION_OPTIONS.map((r) => (
              <button
                key={r.code ?? 'all'}
                className={`filter-bar__chip${value.region === r.code ? ' filter-bar__chip--active' : ''}`}
                onClick={() => update({ region: r.code })}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 年份 — 移动端限高滚动，桌面端正常换行 */}
      {isMobile ? (
        <LimitedRow
          label="年份"
          maxRows={1}
        >
          <button
            type="button"
            className={`filter-bar__chip${isAllYear ? ' filter-bar__chip--active' : ''}`}
            onClick={selectAllYear}
          >
            全部
          </button>
          {YEAR_OPTIONS.map((y) => (
            <button
              key={y.value}
              className={`filter-bar__chip${value.year === y.value && !value.olderThan2015 ? ' filter-bar__chip--active' : ''}`}
              onClick={() => update({ year: y.value, olderThan2015: false })}
            >
              {y.label}
            </button>
          ))}
          <button
            type="button"
            className={`filter-bar__chip${value.olderThan2015 ? ' filter-bar__chip--active' : ''}`}
            onClick={() => update({ year: null, olderThan2015: true })}
          >
            {YEAR_OLDER_LABEL}
          </button>
        </LimitedRow>
      ) : (
        <div className="filter-bar__row filter-bar__row--scroll">
          <span className="filter-bar__label">
            年份
          </span>
          <div className="filter-bar__chips-scroll">
            <button
              type="button"
              className={`filter-bar__chip${isAllYear ? ' filter-bar__chip--active' : ''}`}
              onClick={selectAllYear}
            >
              全部
            </button>
            {YEAR_OPTIONS.map((y) => (
              <button
                key={y.value}
                className={`filter-bar__chip${value.year === y.value && !value.olderThan2015 ? ' filter-bar__chip--active' : ''}`}
                onClick={() => update({ year: y.value, olderThan2015: false })}
              >
                {y.label}
              </button>
            ))}
            <button
              type="button"
              className={`filter-bar__chip${value.olderThan2015 ? ' filter-bar__chip--active' : ''}`}
              onClick={() => update({ year: null, olderThan2015: true })}
            >
              {YEAR_OLDER_LABEL}
            </button>
          </div>
        </div>
      )}

      {/* 排序 + 结果数 */}
      {!hideFooter && (
        <div className="filter-bar__footer">
          <div className="filter-bar__sort">
            {SORT_OPTIONS.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`filter-bar__sort-btn${value.sortIdx === i ? ' filter-bar__sort-btn--active' : ''}`}
                onClick={() => update({ sortIdx: i })}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="filter-bar__count" aria-live="polite">
            共 {totalResults.toLocaleString('zh-CN')} 条
          </span>
        </div>
      )}
    </div>
  );
}
