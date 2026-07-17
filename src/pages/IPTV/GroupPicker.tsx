import { useState, useMemo, useCallback, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { BottomSheet } from '@/components/ui'
import { useScrollContainer } from '@/hooks/useScrollContext'
import { resolveHotGroups } from './hotGroups'
import './GroupPicker.css'

interface GroupPickerProps {
  groups: Array<{ name: string; count: number }>
  totalCount: number
  selectedGroup: string | null
  onSelect: (group: string | null) => void
  /** 'bottom-sheet' = 移动端；'popup' = 桌面端/TV 端小型弹窗 */
  mode?: 'bottom-sheet' | 'popup'
}

export default function GroupPicker({
  groups,
  totalCount,
  selectedGroup,
  onSelect,
  mode = 'bottom-sheet',
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

  // BottomSheet 模式：锁定背景滚动
  useEffect(() => {
    if (mode !== 'bottom-sheet') return
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
  }, [isOpen, scrollContainer, mode])

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

  // 分组 ≤ 3 个：全部内联展示
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

  // ── 热门分组 tags（含"更多分类"按钮） ──
  const hotTags = (
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
      <button
        className="grouppicker__more-btn"
        onClick={() => setIsOpen(true)}
      >
        更多分类
      </button>
      {dynamicGroup && (
        <button
          className="grouppicker__hot-tag active"
          onClick={() => onSelect(dynamicGroup.name)}
        >
          {dynamicGroup.name} ({dynamicGroup.count})
        </button>
      )}
    </div>
  )

  // ── 弹窗内容 ──
  const pickerContent = (
    <>
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
        autoFocus
      />
      <div className="grouppicker__grid">
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
    </>
  )

  // ── Popup 模式（桌面端 / TV 端小型弹窗） ──
  if (mode === 'popup') {
    return (
      <>
        {hotTags}

        <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
          <Dialog.Portal>
            <Dialog.Overlay className="grouppicker-popup__overlay" />
            <Dialog.Content className="grouppicker-popup" aria-describedby="grouppicker-popup-desc">
              <Dialog.Title className="grouppicker-popup__title">选择分组</Dialog.Title>
              <span id="grouppicker-popup-desc" className="sr-only">从列表中选择一个频道分组</span>
              {pickerContent}
              <Dialog.Close asChild>
                <button className="grouppicker-popup__close" aria-label="关闭">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </>
    )
  }

  // ── BottomSheet 模式（移动端） ──
  return (
    <>
      {hotTags}

      <BottomSheet visible={isOpen} onClose={handleClose} title="选择分组">
        {pickerContent}
      </BottomSheet>
    </>
  )
}
