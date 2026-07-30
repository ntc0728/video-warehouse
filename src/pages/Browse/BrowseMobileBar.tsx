'use client'

import { useEffect, useState } from 'react'
import { SlidersHorizontal, ArrowDownUp } from 'lucide-react'
import type { TMDBGenre } from '@/types/tmdb'
import { fetchTrending } from '@/services/tmdbService'
import {
  SORT_OPTIONS,
  REGION_OPTIONS,
  type FilterBarValue,
} from '@/components/FilterBar/constants'
import FilterBar, { type FilterBarProps } from '@/components/FilterBar/FilterBar'
import Drawer from '@/components/ui/Drawer'
import './BrowseMobileBar.css'

const LS_KEY = 'bw_last_filter_v1'

/** 判断当前筛选是否为「全部」（排除 excludedGenreIds 后） */
function isDefaultValue(v: FilterBarValue, excluded: number[]): boolean {
  const visibleGenres = v.genreIds.filter((id) => !excluded.includes(id))
  return (
    v.mediaType === 'all' &&
    visibleGenres.length === 0 &&
    v.region === null &&
    v.year === null &&
    !v.olderThan2015 &&
    v.sortIdx === 0
  )
}

function genreName(id: number, allGenres: TMDBGenre[]): string {
  const g = allGenres.find((x) => x.id === id)
  return g ? g.name : `类型${id}`
}

function regionLabel(code: string | null): string {
  const r = REGION_OPTIONS.find((x) => x.code === code)
  return r ? r.label : code ?? ''
}

function eqArr(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

interface BrowseMobileBarProps {
  filterBarProps: FilterBarProps
  allGenres: TMDBGenre[]
}

interface PresetItem {
  key: string
  icon: string
  label: string
  desc: string
  apply: Partial<FilterBarValue>
}

/**
 * 移动端 Browse 命令栏（方案②）
 * - 动态预设行：TMDB trending 热门类型 + 用户「记忆上次选择」（localStorage）
 * - 已选轨：可逐项移除当前筛选
 * - 排序 / 筛选入口：筛选打开右滑全屏面板（内含 FilterBar，全展开）
 */
export default function BrowseMobileBar({ filterBarProps, allGenres }: BrowseMobileBarProps) {
  const { value, onChange, excludedGenreIds = [] } = filterBarProps
  const [open, setOpen] = useState(false)
  const [trendingGenres, setTrendingGenres] = useState<number[]>([])
  const [memo, setMemo] = useState<FilterBarValue | null>(null)

  // 读取记忆（上次筛选）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setMemo(JSON.parse(raw) as FilterBarValue)
    } catch {
      /* ignore */
    }
  }, [])

  // 懒加载 trending 热门类型（取原始 genre_ids 频次 Top2，与 SearchBox 同源但独立拉取）
  useEffect(() => {
    let cancelled = false
    fetchTrending('all', 'day')
      .then((data) => {
        if (cancelled) return
        const counts: Record<number, number> = {}
        data.results.forEach((t) => {
          ;(t.genre_ids ?? []).forEach((g) => {
            counts[g] = (counts[g] ?? 0) + 1
          })
        })
        const top = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([g]) => Number(g))
        setTrendingGenres(top)
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 记忆：非默认筛选时写入（下次进入可直接「继续上次」）
  useEffect(() => {
    if (!isDefaultValue(value, excludedGenreIds)) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(value))
      } catch {
        /* ignore */
      }
      setMemo(value)
    }
  }, [value, excludedGenreIds])

  const presets: PresetItem[] = []
  if (memo && !isDefaultValue(memo, excludedGenreIds)) {
    presets.push({
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
  trendingGenres.forEach((gid) => {
    presets.push({
      key: 'tr' + gid,
      icon: '🔥',
      label: '热门·' + genreName(gid, allGenres),
      desc: '本周趋势',
      apply: {
        mediaType: 'all',
        genreIds: [gid],
        region: null,
        year: null,
        olderThan2015: false,
        sortIdx: 0,
      },
    })
  })

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

  const clearMemo = () => {
    try {
      localStorage.removeItem(LS_KEY)
    } catch {
      /* ignore */
    }
    setMemo(null)
  }

  // 已选轨
  const chips: { key: string; label: string; onRemove: () => void }[] = []
  const visibleGenres = value.genreIds.filter((id) => !excludedGenreIds.includes(id))
  visibleGenres.forEach((id) => {
    chips.push({
      key: 'g' + id,
      label: '分类·' + genreName(id, allGenres),
      onRemove: () => onChange({ ...value, genreIds: value.genreIds.filter((x) => x !== id) }),
    })
  })
  if (value.region) {
    chips.push({
      key: 'r',
      label: '地区·' + regionLabel(value.region),
      onRemove: () => onChange({ ...value, region: null }),
    })
  }
  if (value.year) {
    chips.push({
      key: 'y',
      label: '年份·' + value.year,
      onRemove: () => onChange({ ...value, year: null, olderThan2015: false }),
    })
  }
  if (value.olderThan2015) {
    chips.push({
      key: 'yo',
      label: '年份·其他',
      onRemove: () => onChange({ ...value, olderThan2015: false }),
    })
  }

  const handleReset = () => {
    onChange({
      ...value,
      genreIds: [...excludedGenreIds],
      region: null,
      year: null,
      olderThan2015: false,
      sortIdx: 0,
    })
  }

  const cycleSort = () => {
    onChange({ ...value, sortIdx: (value.sortIdx + 1) % SORT_OPTIONS.length })
  }

  return (
    <div className="bmb">
      <div className="bmb-presets">
        <div className="bmb-presets-scroll">
          {presets.length === 0 && (
            <span className="bmb-presets-empty">根据 TMDB 趋势动态生成</span>
          )}
          {presets.map((p) => {
            const visVal = value.genreIds.filter((id) => !excludedGenreIds.includes(id))
            const on =
              value.mediaType === 'all' &&
              eqArr(visVal, p.apply.genreIds ?? []) &&
              value.region === (p.apply.region ?? null) &&
              value.year === (p.apply.year ?? null) &&
              value.olderThan2015 === (p.apply.olderThan2015 ?? false) &&
              value.sortIdx === (p.apply.sortIdx ?? 0)
            return (
              <button
                key={p.key}
                type="button"
                className={`bmb-preset${on ? ' active' : ''}`}
                aria-pressed={on}
                title={p.desc}
                onClick={() => applyPreset(p)}
              >
                <span className="bmb-preset-icon">{p.icon}</span>
                {p.label}
              </button>
            )
          })}
        </div>
        {memo && (
          <button type="button" className="bmb-clear-memo" onClick={clearMemo}>
            清除记忆
          </button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="bmb-rail">
          {chips.map((c) => (
            <span key={c.key} className="bmb-chip">
              <span className="bmb-chip-label">{c.label}</span>
              <button
                type="button"
                className="bmb-chip-x"
                aria-label={`移除 ${c.label}`}
                onClick={c.onRemove}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="bmb-rail-reset" onClick={handleReset}>
            重置
          </button>
        </div>
      )}

      <div className="bmb-actions">
        <button type="button" className="bmb-btn" onClick={cycleSort}>
          <ArrowDownUp size={16} />
          {SORT_OPTIONS[value.sortIdx]?.label ?? '排序'}
        </button>
        <button
          type="button"
          className="bmb-btn bmb-btn--primary"
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal size={16} />
          筛选{chips.length > 0 ? `（${chips.length}）` : ''}
        </button>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="筛选">
        <FilterBar {...filterBarProps} hideFooter={false} />
        <div className="bmb-drawer-foot">
          <button type="button" className="bmb-foot-btn" onClick={handleReset}>
            重置
          </button>
          <button
            type="button"
            className="bmb-foot-btn bmb-foot-btn--primary"
            onClick={() => setOpen(false)}
          >
            完成
          </button>
        </div>
      </Drawer>
    </div>
  )
}
