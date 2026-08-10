import { useEffect, useMemo, useState } from 'react'
import './BrowseMobileBar.css'
import type { FilterBarProps, FilterBarValue } from '@/components/FilterBar/FilterBar'
import type { TMDBGenre } from '@/types/tmdb'
import { useTMDBStore } from '@/stores/useTMDBStore'
import { REGION_OPTIONS, YEAR_OLDER_LABEL } from '@/components/FilterBar/constants'
import FilterBar from '@/components/FilterBar/FilterBar'
import Drawer from '@/components/ui/Drawer'

const MEMO_KEY = '__vw_browse-filter-memo'

type SearchMode = 'smart' | 'cms'

interface PresetItem {
  key: string
  icon: string
  label: string
  desc: string
  apply: Partial<FilterBarValue>
}

interface BrowseMobileBarProps {
  searchMode: SearchMode
  onModeChange: (mode: SearchMode) => void
  filterBarProps: FilterBarProps
  allGenres: TMDBGenre[]
}

function genreName(id: number, all: TMDBGenre[]): string {
  return all.find((g) => g.id === id)?.name ?? ''
}
function regionLabel(code: string): string {
  return REGION_OPTIONS.find((r) => r.code === code)?.label ?? code
}
function eqArr(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

/** 判断某筛选值是否为「未做任何选择」的默认态（排除分类自身默认 genre） */
function isDefault(v: FilterBarValue, excluded: number[]): boolean {
  return (
    v.mediaType === 'all' &&
    eqArr(v.genreIds, excluded) &&
    v.region === null &&
    v.year === null &&
    !v.olderThan2015
  )
}

export default function BrowseMobileBar({
  searchMode,
  onModeChange,
  filterBarProps,
  allGenres,
}: BrowseMobileBarProps) {
  const { value, onChange, excludedGenreIds = [] } = filterBarProps
  const trending = useTMDBStore((s) => s.trending)
  const [open, setOpen] = useState(false)
  const [memo, setMemo] = useState<FilterBarValue | null>(() => {
    try {
      const raw = localStorage.getItem(MEMO_KEY)
      return raw ? (JSON.parse(raw) as FilterBarValue) : null
    } catch {
      return null
    }
  })

  // trending 未加载时按需拉取（支撑「热门」预设；与 SearchBox 同源）
  useEffect(() => {
    if (trending.length === 0) {
      useTMDBStore.getState().fetchTrending('day').catch(() => {})
    }
  }, [trending.length])

  // 写入「上次选择」记忆（仅非默认时）；默认态不清除，保证「继续上次」跨会话保留
  useEffect(() => {
    if (isDefault(value, excludedGenreIds)) return
    const snap = JSON.parse(JSON.stringify(value)) as FilterBarValue
    setMemo(snap)
    localStorage.setItem(MEMO_KEY, JSON.stringify(snap))
  }, [value, excludedGenreIds])

  const visibleGenres = value.genreIds.filter((id) => !excludedGenreIds.includes(id))

  // 动态预设：trending 热门类型（Top2）+ 记忆（继续上次）
  const presets = useMemo<PresetItem[]>(() => {
    const list: PresetItem[] = []
    if (searchMode === 'smart' && trending.length) {
      const freq: Record<number, number> = {}
      trending.forEach((it) => (it.genreIds ?? []).forEach((g) => (freq[g] = (freq[g] ?? 0) + 1)))
      const top = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([g]) => Number(g))
      if (top.length) {
        const names = top.map((g) => genreName(g, allGenres)).filter(Boolean)
        list.push({
          key: 'hot',
          icon: '🔥',
          label: names.length ? `热门·${names.join('·')}` : '热门类型',
          desc: names.length ? `TMDB 趋势 ${names.join(' / ')} 热播中` : 'TMDB 趋势热播中',
          apply: { genreIds: top, region: null, year: null, olderThan2015: false },
        })
      }
    }
    if (memo && !isDefault(memo, excludedGenreIds)) {
      list.push({
        key: 'last',
        icon: '↩',
        label: '继续上次',
        desc: [
          memo.mediaType !== 'all' ? (memo.mediaType === 'movie' ? '电影' : '剧集') : '',
          ...memo.genreIds
            .filter((id) => !excludedGenreIds.includes(id))
            .map((id) => genreName(id, allGenres)),
          memo.region ? regionLabel(memo.region) : '',
          memo.year ? String(memo.year) : '',
        ]
          .filter(Boolean)
          .join(' · '),
        // 记忆存的是完整筛选值（含 excludedGenreIds），这里仅保留可见部分，
        // 应用时由 applyPreset 统一与 excludedGenreIds 合并，避免重复/丢失
        apply: { ...memo, genreIds: memo.genreIds.filter((id) => !excludedGenreIds.includes(id)) },
      })
    }
    return list
  }, [searchMode, trending, memo, excludedGenreIds, allGenres])

  const matchPreset = (p: PresetItem): boolean =>
    value.mediaType === 'all' &&
    eqArr(visibleGenres, p.apply.genreIds ?? []) &&
    value.region === (p.apply.region ?? null) &&
    value.year === (p.apply.year ?? null) &&
    value.olderThan2015 === (p.apply.olderThan2015 ?? false) &&
    value.sortIdx === (p.apply.sortIdx ?? 0)

  const applyPreset = (p: PresetItem) => {
    // 合并 excludedGenreIds（分类自身默认 genre 需常驻于筛选值/API），去重
    const nextGenreIds = [...new Set([...excludedGenreIds, ...(p.apply.genreIds ?? [])])]
    onChange({
      ...value,
      mediaType: 'all',
      genreIds: nextGenreIds,
      region: p.apply.region ?? null,
      year: p.apply.year ?? null,
      olderThan2015: p.apply.olderThan2015 ?? false,
      sortIdx: p.apply.sortIdx ?? 0,
    })
  }

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

  const clearMemo = () => {
    setMemo(null)
    localStorage.removeItem(MEMO_KEY)
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

      {/* 动态预设横滚（仅智能检索模式展示；直链搜索无预设，不渲染） */}
      {searchMode === 'smart' && presets.length > 0 && (
        <div className="bmb-presets">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`bmb-preset${matchPreset(p) ? ' on' : ''}`}
              aria-pressed={matchPreset(p)}
              title={p.desc}
              onClick={() => applyPreset(p)}
            >
              <span className="bmb-pi">{p.icon}</span>
              {p.label}
            </button>
          ))}
          {memo && (
            <button type="button" className="bmb-preset aux" onClick={clearMemo}>
              清除记忆
            </button>
          )}
        </div>
      )}

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

      {/* 全屏筛选面板（覆盖整个视口含顶部导航栏，顶栏含返回/重置） */}
      <Drawer open={open} onClose={() => setOpen(false)} title="筛选" fullscreen onReset={resetValue}>
        <FilterBar {...filterBarProps} hideFooter />
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
