import { useEffect, useState } from 'react'
import './BrowseMobileBar.css'
import type { FilterBarProps, FilterBarValue } from '@/components/FilterBar/FilterBar'
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
  // 面板内草稿值：打开时从当前 value 快照，「完成」才一次性应用到 onChange，
  // 返回/关闭丢弃草稿 —— 避免筛选过程中实时触发接口（点击「完成」后才调用）
  const [draft, setDraft] = useState<FilterBarValue>(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const visibleGenres = value.genreIds.filter((id) => !excludedGenreIds.includes(id))

  const defaultDraft = (base: FilterBarValue): FilterBarValue => ({
    ...base,
    mediaType: 'all',
    genreIds: [...excludedGenreIds],
    region: null,
    year: null,
    olderThan2015: false,
    sortIdx: 0,
  })

  // 面板内「重置」：仅重置草稿值（不立即触发接口）
  const resetDraft = () => setDraft(defaultDraft(draft))

  // 面板内「完成」：将草稿值一次性应用到父级 onChange（触发接口）
  const applyDraft = () => {
    onChange(draft)
    setOpen(false)
  }

  // 已选轨移除：直接应用到 onChange（轨道在弹窗外，即时生效）
  const patchValue = (patch: Partial<FilterBarValue>) => onChange({ ...value, ...patch })

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
      onRemove: () => patchValue({ mediaType: 'all' }),
    })
  }
  visibleGenres.forEach((id) => {
    chips.push({
      key: `g-${id}`,
      label: genreName(id, allGenres),
      onRemove: () => patchValue({ genreIds: value.genreIds.filter((g) => g !== id) }),
    })
  })
  if (value.region) {
    chips.push({
      key: 'region',
      label: regionLabel(value.region),
      onRemove: () => patchValue({ region: null }),
    })
  }
  if (value.year) {
    chips.push({
      key: 'year',
      label: `年份 · ${value.year}`,
      onRemove: () => patchValue({ year: null }),
    })
  }
  if (value.olderThan2015) {
    chips.push({
      key: 'older',
      label: YEAR_OLDER_LABEL,
      onRemove: () => patchValue({ olderThan2015: false }),
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
          <button
            type="button"
            className="bmb-chip clear"
            onClick={() => patchValue({ mediaType: 'all', genreIds: [...excludedGenreIds], region: null, year: null, olderThan2015: false, sortIdx: 0 })}
          >
            清除全部
          </button>
        </div>
      )}

      {/* 全屏筛选面板（覆盖整个视口含顶部导航栏，顶栏含返回/重置）；
          FilterBar 强制显示 footer —— 排序作为第五个分组展示（对齐 S3 示例）。
          面板内操作用草稿值（draft），点「完成」才应用 → 触发接口。 */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="筛选"
        fullscreen
        onReset={resetDraft}
      >
        <FilterBar
          {...filterBarProps}
          value={draft}
          onChange={setDraft}
          hideFooter={false}
        />
        <div className="bmb-foot">
          <button type="button" className="bmb-pf-reset" onClick={resetDraft}>
            重置
          </button>
          <button type="button" className="bmb-pf-apply" onClick={applyDraft}>
            完成
          </button>
        </div>
      </Drawer>
    </div>
  )
}
