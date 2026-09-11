/**
 * 结果区分页器（2026-09-12 用户拍板：右栏由无限滚动改为分页切换）
 *
 * 两种形态由数据侧能力决定，不是样式偏好：
 * - `numbered`：数字页码条。仅 TMDB 可用 —— store 暴露 totalPages，可任意跳页。
 * - `simple`：上一页 / 下一页 + 「第 N 页」。用于 CMS —— MacCMS 返回体只有 `total`
 *   没有 `limit`/`pagecount`，算不出总页数，页码条无从渲染。
 *
 * CMS 做不出数字页码这点别试图绕过：探测式翻页会把最后一页渲染成空态，体验更差。
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import './Browse.css';

export interface BrowsePaginationProps {
  /** `numbered` 数字页码（TMDB）；`simple` 仅上下页（CMS） */
  variant: 'numbered' | 'simple';
  /** 当前页码（1 起） */
  page: number;
  /** 总页数；simple 形态下不使用（传 0 即可） */
  totalPages: number;
  /** 上一页是否可用 */
  canGoBack: boolean;
  /** 下一页是否可用 */
  hasNext: boolean;
  /** 请求飞行中：禁用所有按钮，避免连点叠加请求 */
  disabled?: boolean;
  /** 页码变化回调（由调用方负责滚动回顶） */
  onChange: (page: number) => void;
}

/**
 * 页码窗口：首页与末页常驻，当前页 ±1 常驻，其余折叠为省略号。
 * 总页数 ≤ 7 时全量展开（省略号反而比数字还占地方）。
 */
function buildPageItems(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items: (number | 'gap')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) items.push('gap');
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push('gap');
  items.push(total);
  return items;
}

export default function BrowsePagination({
  variant,
  page,
  totalPages,
  canGoBack,
  hasNext,
  disabled = false,
  onChange,
}: BrowsePaginationProps) {
  const items = variant === 'numbered' ? buildPageItems(page, totalPages) : [];

  // ── 手动跳页（2026-09-12 用户需求）：数字页码形态下提供「页码输入 + 跳转」，
  //    输入钳制到 [1, totalPages]，非法/越界输入不动；Enter 与按钮均可提交。 ──
  const [jumpValue, setJumpValue] = useState('');
  const commitJump = () => {
    const n = parseInt(jumpValue.trim(), 10);
    setJumpValue('');
    if (!Number.isFinite(n) || disabled) return;
    const target = Math.min(Math.max(n, 1), totalPages);
    if (target === page) return;
    onChange(target);
  };

  return (
    <nav className="browse-pagination" aria-label="结果分页">
      <button
        type="button"
        className="browse-pagination__step"
        disabled={!canGoBack || disabled}
        onClick={() => onChange(page - 1)}
      >
        <Icon icon={ChevronLeft} size="xs" />
        <span>上一页</span>
      </button>

      {variant === 'numbered' ? (
        <div className="browse-pagination__pages">
          {items.map((it, i) =>
            it === 'gap' ? (
              <span key={`gap-${i}`} className="browse-pagination__gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={it}
                type="button"
                className={`browse-pagination__page${it === page ? ' browse-pagination__page--active' : ''}`}
                aria-current={it === page ? 'page' : undefined}
                disabled={disabled}
                onClick={() => onChange(it)}
              >
                {it}
              </button>
            ),
          )}
          <span className="browse-pagination__jump">
            <input
              type="number"
              min={1}
              max={totalPages}
              className="browse-pagination__jump-input"
              aria-label="跳转到指定页"
              placeholder={`${page}`}
              value={jumpValue}
              disabled={disabled}
              onChange={(e) => setJumpValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitJump();
              }}
            />
            <button
              type="button"
              className="browse-pagination__jump-btn"
              disabled={disabled}
              onClick={commitJump}
            >
              跳转
            </button>
          </span>
        </div>
      ) : (
        <span className="browse-pagination__label" aria-live="polite">
          第 {page} 页
        </span>
      )}

      <button
        type="button"
        className="browse-pagination__step"
        disabled={!hasNext || disabled}
        onClick={() => onChange(page + 1)}
      >
        <span>下一页</span>
        <Icon icon={ChevronRight} size="xs" />
      </button>
    </nav>
  );
}
