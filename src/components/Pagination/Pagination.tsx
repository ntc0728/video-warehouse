/**
 * 分页组件
 * 提供首页/末页/上下页导航、页码显示和跳转功能
 */
import { useScrollContainer } from '@/hooks/useScrollContext';
import './Pagination.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  showPageSize?: boolean;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  showPageSize = false
}: PaginationProps) {
  const scrollContainerRef = useScrollContainer();
  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (totalPages <= 1 && !showPageSize) {
    return null;
  }

  const handleFirstPage = () => {
    if (currentPage > 1) {
      onPageChange(1);
      scrollToTop();
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
      scrollToTop();
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
      scrollToTop();
    }
  };

  const handleLastPage = () => {
    if (currentPage < totalPages) {
      onPageChange(totalPages);
      scrollToTop();
    }
  };

  /** 输入框回车跳转到指定页码 */
  const handleJumpToPage = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const input = e.currentTarget;
      const page = parseInt(input.value, 10);
      if (page >= 1 && page <= totalPages) {
        onPageChange(page);
        input.value = '';
        scrollToTop();
      }
    }
  };

  return (
    <div className="pagination-container">
      {showPageSize && (
        <span className="pagination-info">
          共 {totalItems} 条
        </span>
      )}

      <div className="pagination">
        <button
          className="page-btn"
          disabled={currentPage <= 1}
          onClick={handleFirstPage}
          title="首页"
        >
          首页
        </button>
        <button
          className="page-btn"
          disabled={currentPage <= 1}
          onClick={handlePrevPage}
          title="上一页"
        >
          上一页
        </button>

        <span className="page-info">
          {currentPage} / {totalPages}
        </span>

        {showPageSize && (
          <span className="page-info">
            ({totalItems} 个)
          </span>
        )}

        <button
          className="page-btn"
          disabled={currentPage >= totalPages}
          onClick={handleNextPage}
          title="下一页"
        >
          下一页
        </button>
        <button
          className="page-btn"
          disabled={currentPage >= totalPages}
          onClick={handleLastPage}
          title="末页"
        >
          末页
        </button>

        <input
          className="page-jump-input"
          type="number"
          min={1}
          max={totalPages}
          placeholder="跳"
          onKeyDown={handleJumpToPage}
        />
        <button
          className="page-btn go-btn"
          onClick={(e) => {
            const input = e.currentTarget.previousSibling as HTMLInputElement;
            const page = parseInt(input.value, 10);
            if (page >= 1 && page <= totalPages) {
              onPageChange(page);
              input.value = '';
              scrollToTop();
            }
          }}
        >
          GO
        </button>
      </div>
    </div>
  );
}
