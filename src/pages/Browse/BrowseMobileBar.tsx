import { useState } from 'react'
import './BrowseMobileBar.css'
import type { FilterBarProps } from '@/components/FilterBar/FilterBar'
import { REGION_OPTIONS, YEAR_OLDER_LABEL } from '@/components/FilterBar/constants'
import FilterBar from '@/components/FilterBar/FilterBar'
import Drawer from '@/components/ui/Drawer'

type SearchMode = 'smart' | 'cms'

interface BrowseMobileBarProps {
  searchMode: SearchMode
  onModeChange: (mode: SearchMode) => void
  filterBarProps: FilterBarProps
  allGenres: { id: number; name: string }[]
}

function genreName(id: number, all: { id: number; name: string }[]): string {
  return all.find((g) => g.id === id)?.name ?? ''
}
function regionLabel(code: string): string {
  return REGION_OPTIONS.find((r) => r.code === code)?.label ?? code
}

export default function BrowseMobileBar({
  searchMode,
  onModeChange,
  filterBarProps,
  allGenres,
}: BrowseMobileBarProps) {
  const { value, onChange, excludedGenreIds = [] } = filterBarProps
  const [open, setOpen] = useState(false)

  const visibleGenres = value.genreIds.filter((id) => !excludedGenreIds.includes(id))

  const resetValue = () => {
    onChange({
      ...value,
      mediaType: 'all',
      genreIds: [...excludedGenreIds],
      region: null,
      year: null,
      olderThan2015: false,
      sortIdx: 0,
    })
  }

  const activeCount =
    (value.mediaType !== 'all' ? 1 : 0) +
    visibleGenres.length +
    (value.region ? 1 : 0) +
    (value.year || value.olderThan2015 ? 1 : 0)

  // 已选轨
  const chips: { key: string; label: string; onRemove: () => void }[] = []
  if (value.mediaType !== 'all') {
    chips.push({
      key: 'mt',
      label: value.mediaType === 'movie' ? '电影' : '剧集',
      onRemove: () => onChange({ ...value, mediaType: 'all' }),
    })
  }
  visibleGenres.forEach((id) => {
    chips.push({
      key: `g-${id}`,
      label: genreName(id, allGenres),
      onRemove: () => onChange({ ...value, genreIds: value.genreIds.filter((g) => g !== id) }),
    })
  })
  if (value.region) {
    chips.push({
      key: 'region',
      label: regionLabel(value.region),
      onRemove: () => onChange({ ...value, region: null }),
    })
  }
  if (value.year) {
    chips.push({
      key: 'year',
      label: `年份 · ${value.year}`,
      onRemove: () => onChange({ ...value, year: null }),
    })
  }
  if (value.olderThan2015) {
    chips.push({
      key: 'older',
      label: YEAR_OLDER_LABEL,
      onRemove: () => onChange({ ...value, olderThan2015: false }),
    })
  }

  return (
    <div className="bmb">
      {/* 命令栏两行：第一行模式切换居中，第二行「筛选」按钮 + 结果数两端对齐 */}
      <div className="bmb-cmdbar">
        <div className="bmb-mode-row">
          <div className="bmb-mode-seg">
            <button
              type="button"
              className={`bmb-seg${searchMode === 'smart' ? ' on' : ''}`}
              aria-pressed={searchMode === 'smart'}
              onClick={() => onModeChange('smart')}
            >
              智能检索
            </button>
            <button
              type="button"
              className={`bmb-seg${searchMode === 'cms' ? ' on' : ''}`}
              aria-pressed={searchMode === 'cms'}
              onClick={() => onModeChange('cms')}
            >
              直链搜索
            </button>
          </div>
        </div>
        {/* 筛选入口仅「智能检索」模式展示：直链搜索无 FilterBar / SortBar */}
        {searchMode === 'smart' && (
          <div className="bmb-bar-row">
            <button type="button" className="bmb-filter-trigger" onClick={() => setOpen(true)}>
              <svg className="bmb-filter-ico" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M3 5h18a1 1 0 0 1 .8 1.6L14 13.5V19a1 1 0 0 1-1.4.9l-2-1A1 1 0 0 1 10 18v-4.5L2.2 6.6A1 1 0 0 1 3 5Z"
                />
              </svg>
              筛选
              <span className={`bmb-badge${activeCount === 0 ? ' zero' : ''}`}>{activeCount}</span>
            </button>
            <span className="bmb-result-count">共 12,345 条</span>
          </div>
        )}
      </div>

      {/* 已选轨（仅智能检索模式展示：直链搜索无 FilterBar，不渲染已选轨） */}
      {searchMode === 'smart' && chips.length > 0 && (
        <div className="bmb-rail">
          {chips.map((c) => (
            <span key={c.key} className="bmb-chip">
              <span>{c.label}</span>
              <button type="button" className="bmb-x" aria-label="移除" onClick={c.onRemove}>
                ×
              </button>
            </span>
          ))}
          <button type="button" className="bmb-chip clear" onClick={resetValue}>
            清除全部
          </button>
        </div>
      )}

      {/* 全屏筛选面板（覆盖整个视口含顶部导航栏，顶栏含返回/重置）；
          FilterBar 强制显示 footer —— 排序作为第五个分组展示（对齐 S3 示例） */}
      <Drawer open={open} onClose={() => setOpen(false)} title="筛选" fullscreen onReset={resetValue}>
        <FilterBar {...filterBarProps} hideFooter={false} />
        <div className="bmb-foot">
          <button type="button" className="bmb-pf-reset" onClick={resetValue}>
            重置
          </button>
          <button type="button" className="bmb-pf-apply" onClick={() => setOpen(false)}>
            完成
          </button>
        </div>
      </Drawer>
    </div>
  )
}
