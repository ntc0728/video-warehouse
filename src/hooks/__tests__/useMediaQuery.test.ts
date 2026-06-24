import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaQuery, useIsMobile, useIsTablet, useIsDesktop } from '../useMediaQuery'

describe('useMediaQuery', () => {
  let mockMatchMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockMatchMedia = vi.fn()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return initial match value', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('should return false when no match', () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('should update when media query changes', () => {
    let handler: ((e: MediaQueryListEvent) => void) | undefined
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: (_event: string, cb: (e: MediaQueryListEvent) => void) => {
        handler = cb
      },
      removeEventListener: vi.fn(),
    })

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)

    act(() => {
      handler?.({ matches: true } as MediaQueryListEvent)
    })
    expect(result.current).toBe(true)
  })
})

describe('useIsMobile', () => {
  const mockMatchMedia = vi.fn()

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return boolean', () => {
    const { result } = renderHook(() => useIsMobile())
    expect(typeof result.current).toBe('boolean')
  })

  it('should return true when viewport <= 1023px', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('should return true regardless of touch capability', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { writable: true, value: 0 })
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('should return true for TV device if viewport <= 1023px', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (WebOS; webOS/TV) AppleWebKit/537.36',
    })
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('should return false when viewport > 1023px', () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })
})

describe('useIsTablet', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
  })

  it('should return boolean', () => {
    const { result } = renderHook(() => useIsTablet())
    expect(typeof result.current).toBe('boolean')
  })
})

describe('useIsDesktop', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
  })

  it('should return boolean', () => {
    const { result } = renderHook(() => useIsDesktop())
    expect(typeof result.current).toBe('boolean')
  })
})
