import { render, type RenderOptions } from '@testing-library/react'
import { type ReactElement } from 'react'

function customRender(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { ...options })
}

// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react'
export { customRender as render }
