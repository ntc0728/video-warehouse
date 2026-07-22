import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { BottomSheet, Modal } from '@/components/ui'
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

  // 追踪上次从弹窗选中的非热门分组（用于保持 tab 显示）
  const [lastNonHotGroup, setLastNonHotGroup] = useState<string | null>(null)

  // tab 折叠状态
  const [expanded, setExpanded] = useState(false)
  const [needsFolding, setNeedsFolding] = useState(false)
  const [twoRowHeight, setTwoRowHeight] = useState(0)
  const tagsRef = useRef<HTMLDivElement>(null)

  const hotGroupNames = useMemo(() => resolveHotGroups(groups), [groups])

  const showDynamicTag = useMemo(() => {
    if (lastNonHotGroup === null) return false
    return !hotGroupNames.includes(lastNonHotGroup)
  }, [lastNonHotGroup, hotGroupNames])

  const dynamicGroup = useMemo(() => {
    if (!showDynamicTag) return null
    return groups.find((g) => g.name === lastNonHotGroup) ?? null
  }, [showDynamicTag, lastNonHotGroup, groups])

  const filteredBySearch = useMemo(() => {
    if (!searchKeyword.trim()) return groups
    const kw = searchKeyword.toLowerCase()
    return groups.filter((g) => g.name.toLowerCase().includes(kw))
  }, [groups, searchKeyword])

  // 检测 hot-tags 是否超过 2 行，超过则需要折叠
  useLayoutEffect(() => {
    const el = tagsRef.current
    if (!el || el.children.length === 0) {
      setNeedsFolding(false)
      return
    }
    // 先移除折叠限制以测量完整布局
    el.style.maxHeight = ''
    el.style.overflow = ''

    const children = Array.from(el.children) as HTMLElement[]
    if (children.length === 0) {
      setNeedsFolding(false)
      return
    }

    const firstTop = children[0].offsetTop

    // 找到第二行的第一个元素
    let secondRowFirst: HTMLElement | null = null
    for (const child of children) {
      if (child.offsetTop > firstTop) {
        secondRowFirst = child
        break
      }
    }

    if (!secondRowFirst) {
      // 全部在一行内，无需折叠
      setNeedsFolding(false)
      setTwoRowHeight(0)
      return
    }

    const secondRowTop = secondRowFirst.offsetTop

    // 检查是否超过 2 行
    const hasMoreThan2Rows = children.some(c => c.offsetTop > secondRowTop)

    if (!hasMoreThan2Rows) {
      setNeedsFolding(false)
      setTwoRowHeight(0)
      return
    }

    // 计算 2 行的精确高度：第二行最底元素的 bottom - 第一行首元素的 top
    const secondRowItems = children.filter(c => c.offsetTop === secondRowTop)
    const lastInSecondRow = secondRowItems[secondRowItems.length - 1]
    // offsetTop 相对 padding box，maxHeight 包含 padding，需加上容器的上下 padding
    const paddingTop = parseFloat(getComputedStyle(el).paddingTop) || 0
    const paddingBottom = parseFloat(getComputedStyle(el).paddingBottom) || 0
    const twoRowH = lastInSecondRow.offsetTop + lastInSecondRow.offsetHeight - firstTop + paddingTop + paddingBottom

    setTwoRowHeight(twoRowH)
    setNeedsFolding(true)
  }, [groups, hotGroupNames, lastNonHotGroup])

  // 是否显示所有分组为内联 tab（桌面端且 ≤50 个分组）
  const showAllInline = groups.length <= 50 && mode !== 'bottom-sheet'
  // 是否显示"更多分类"按钮（>50 个分组 或 移动端）
  const showMoreBtn = groups.length > 50 || mode === 'bottom-sheet'

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
      // 仅从弹窗选中非热门分组时更新 lastNonHotGroup
      if (group !== null && !hotGroupNames.includes(group)) {
        setLastNonHotGroup(group)
      }
      onSelect(group)
      setIsOpen(false)
      setSearchKeyword('')
    },
    [onSelect, hotGroupNames],
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

  // ── 热门分组 tags（含展开/收起 + 更多分类按钮） ──
  const hotTags = (
    <>
      <div
        ref={tagsRef}
        className="grouppicker__hot-tags"
        style={needsFolding && !expanded ? { maxHeight: twoRowHeight, overflow: 'hidden' } : undefined}
      >
        <button
          className={`grouppicker__hot-tag${selectedGroup === null ? ' active' : ''}`}
          onClick={() => onSelect(null)}
        >
          全部 ({totalCount})
        </button>
        {showAllInline ? (
          groups.map((g) => (
            <button
              key={g.name}
              className={`grouppicker__hot-tag${selectedGroup === g.name ? ' active' : ''}`}
              onClick={() => onSelect(g.name)}
            >
              {g.name} ({g.count})
            </button>
          ))
        ) : (
          <>
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
                className={`grouppicker__hot-tag${selectedGroup === dynamicGroup.name ? ' active' : ''}`}
                onClick={() => onSelect(dynamicGroup.name)}
              >
                {dynamicGroup.name} ({dynamicGroup.count})
              </button>
            )}
          </>
        )}
      </div>
      {(needsFolding || showMoreBtn) && (
        <div className="grouppicker__tags-footer">
          {needsFolding && (
            <button
              className="grouppicker__expand-btn"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '收起' : '展开更多'}
            </button>
          )}
          {showMoreBtn && (
            <button
              className="grouppicker__more-btn"
              onClick={() => setIsOpen(true)}
            >
              更多分类
            </button>
          )}
        </div>
      )}
    </>
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

        <Modal visible={isOpen} onClose={handleClose} title="选择分组" className="grouppicker-popup">
          {pickerContent}
        </Modal>
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
