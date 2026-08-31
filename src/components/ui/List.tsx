import type { ReactNode, FC } from 'react'

interface ListProps {
  header?: string | ReactNode
  children?: ReactNode
}

interface ListItemProps {
  title?: string | ReactNode
  extra?: ReactNode
  description?: string | ReactNode
  prefix?: ReactNode
  clickable?: boolean
  onClick?: () => void
  children?: ReactNode
}

const ListItem: FC<ListItemProps> = ({
  title,
  extra,
  description,
  prefix,
  clickable = false,
  onClick,
  children,
}) => {
  const Component = clickable ? 'button' : 'div'

  return (
    <Component
      className={`list-item group flex w-full flex-col text-left${
        clickable ? ' list-item--clickable cursor-pointer' : ''
      }`}
      onClick={clickable ? onClick : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {/* 第一行：prefix + 标题（flex-1）+ 控件（紧贴标题，间距由卡片宽度约束） */}
      <div className="list-item__row flex w-full items-center gap-3 px-4 pt-3 pb-1">
        {prefix && <span className="flex-shrink-0">{prefix}</span>}
        <span className="list-item__title inline-flex min-w-0 flex-1 flex-wrap items-center gap-1 text-base" style={{ color: 'var(--color-text)' }}>
          {title}
        </span>
        {extra && <span className="flex-shrink-0">{extra}</span>}
      </div>
      {/* 第二行：描述独立整行（block 级，占满整行、垂直 padding 撑开高度、背景铺满） */}
      {description && (
        <span
          className="list-item__desc block w-full max-w-full px-4 pb-3 text-sm"
          style={{ color: 'var(--color-text-tertiary)' }}
          title={typeof description === 'string' ? description : undefined}
        >
          {description}
        </span>
      )}
      {children}
    </Component>
  )
}

const List: FC<ListProps> & { Item: FC<ListItemProps> } = ({ header, children }) => {
  return (
    <div className="flex flex-col">
      {header && (
        <div
          className="px-4 py-2 text-sm font-medium"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {header}
        </div>
      )}
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

List.Item = ListItem

export default List
export type { ListProps, ListItemProps }
