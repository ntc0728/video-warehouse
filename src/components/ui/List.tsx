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
      className={`group flex w-full items-center gap-3 px-4 py-3 text-left${
        clickable
          ? ' cursor-pointer transition-colors duration-150 hover:bg-[var(--color-surface-hover)] focus:bg-[var(--color-surface-hover)] focus:outline-none'
          : ''
      }`}
      onClick={clickable ? onClick : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {prefix && <span className="flex-shrink-0">{prefix}</span>}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && (
          <span className="inline-flex flex-wrap items-center gap-1 text-sm" style={{ color: 'var(--color-text)' }}>
            {title}
          </span>
        )}
        {description && (
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {description}
          </span>
        )}
        {children}
      </div>
      {extra && <span className="flex-shrink-0">{extra}</span>}
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
