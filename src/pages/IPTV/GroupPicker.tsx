import { useState, useMemo, useCallback, useEffect } from 'react'
import { BottomSheet } from '@/components/ui'
import { useScrollContainer } from '@/hooks/useScrollContext'
import { resolveHotGroups } from './hotGroups'
import './GroupPicker.css'

interface GroupPickerProps {
  groups: Array<{ name: string; count: number }>
  totalCount: number
  selectedGroup: string | null
  onSelect: (group: string | null) => void
}

export default function GroupPicker({
  groups,
  totalCount,
  selectedGroup,
  onSelect,
}: GroupPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const scrollContainer = useScrollContainer()

  const hotGroupNames = useMemo(() => resolveHotGroups(groups), [groups])

  const showDynamicTag = useMemo(() => {
    if (selectedGroup === null) return false
    return !hotGroupNames.includes(selectedGroup)
  }, [selectedGroup, hotGroupNames])

  const dynamicGroup = useMemo(() => {
    if (!showDynamicTag) return null
    return groups.find((g) => g.name === selectedGroup) ?? null
  }, [showDynamicTag, selectedGroup, groups])

  const filteredBySearch = useMemo(() => {
    if (!searchKeyword.trim()) return groups
    const kw = searchKeyword.toLowerCase()
    return groups.filter((g) => g.name.toLowerCase().includes(kw))
  }, [groups, searchKeyword])

  useEffect(() => {
    const el = scrollContainer.current
    if (!el) return
    if (isOpen) {
      el.style.overflow = 'hidden'
    } else {
      el.style.overflow = ''
    }
    return () => {
      if (el) el.style.overflow = ''
    }
  }, [isOpen, scrollContainer])

  const handleSelect = useCallback(
    (group: string | null) => {
      onSelect(group)
      setIsOpen(false)
      setSearchKeyword('')
    },
    [onSelect],
  )

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setSearchKeyword('')
  }, [])

  if (groups.length === 0) return null

  if (groups.length <= 3) {
    return (
      <div className="grouppicker__trigger">
        <div className="grouppicker__hot-tags">
          <button
            className={`grouppicker__hot-tag${selectedGroup === null ? ' active' : ''}`}
            onClick={() => onSelect(null)}
          >
            全部 ({totalCount})
          </button>
          {groups.map((g) => (
            <button
              key={g.name}
              className={`grouppicker__hot-tag${selectedGroup === g.name ? ' active' : ''}`}
              onClick={() => onSelect(g.name)}
            >
              {g.name} ({g.count})
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="grouppicker__trigger">
        <div className="grouppicker__hot-tags">
          <button
            className={`grouppicker__hot-tag${selectedGroup === null ? ' active' : ''}`}
            onClick={() => onSelect(null)}
          >
            全部 ({totalCount})
          </button>
          {hotGroupNames.map((name) => {
            const g = groups.find((gr) => gr.name === name)
            if (!g) return null
            return (
              <button
                key={g.name}
                className={`grouppicker__hot-tag${selectedGroup === g.name ? ' active' : ''}`}
                onClick={() => onSelect(g.name)}
              >
                {g.name} ({g.count})
              </button>
            )
          })}
          {dynamicGroup && (
            <button
              className="grouppicker__hot-tag active"
              onClick={() => onSelect(dynamicGroup.name)}
            >
              {dynamicGroup.name} ({dynamicGroup.count})
            </button>
          )}
        </div>
        <button
          className="grouppicker__more-btn"
          onClick={() => setIsOpen(true)}
        >
          更多分类 ▼
        </button>
      </div>

      <BottomSheet visible={isOpen} onClose={handleClose} title="选择分组">
        <input
          className="grouppicker__search"
          type="text"
          placeholder="搜索分组..."
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              if (searchKeyword) setSearchKeyword('')
            }
          }}
          aria-label="搜索分组"
        />
        <div className="grouppicker__grid">
          <button
            className={`grouppicker__grid-tag${selectedGroup === null ? ' active' : ''}`}
            onClick={() => handleSelect(null)}
          >
            全部 ({totalCount})
          </button>
          {filteredBySearch.map((g) => (
            <button
              key={g.name}
              className={`grouppicker__grid-tag${selectedGroup === g.name ? ' active' : ''}`}
              onClick={() => handleSelect(g.name)}
            >
              {g.name} ({g.count})
            </button>
          ))}
        </div>
        {filteredBySearch.length === 0 && (
          <div className="grouppicker__empty">
            未找到匹配 &ldquo;{searchKeyword}&rdquo; 的分组
          </div>
        )}
      </BottomSheet>
    </>
  )
}
