import { describe, it, expect, beforeEach } from 'vitest'
import { useUserStore } from '../useUserStore'

describe('useUserStore ratings', () => {
  beforeEach(() => {
    useUserStore.setState({
      collections: [],
      history: [],
      ratings: [],
    })
  })

  it('should have correct initial state', () => {
    expect(useUserStore.getState().ratings).toEqual([])
  })

  it('should set rating', () => {
    useUserStore.getState().setRating('video-1', 4)
    const ratings = useUserStore.getState().ratings
    expect(ratings).toHaveLength(1)
    expect(ratings[0].videoId).toBe('video-1')
    expect(ratings[0].rating).toBe(4)
  })

  it('should clamp rating to 1-5 range', () => {
    useUserStore.getState().setRating('video-1', 0)
    expect(useUserStore.getState().ratings[0].rating).toBe(1)

    useUserStore.getState().setRating('video-1', 10)
    expect(useUserStore.getState().ratings[0].rating).toBe(5)

    useUserStore.getState().setRating('video-1', 3.7)
    expect(useUserStore.getState().ratings[0].rating).toBe(4)
  })

  it('should update existing rating', () => {
    useUserStore.getState().setRating('video-1', 3)
    useUserStore.getState().setRating('video-1', 5)
    const ratings = useUserStore.getState().ratings
    expect(ratings).toHaveLength(1)
    expect(ratings[0].rating).toBe(5)
  })

  it('should get rating', () => {
    expect(useUserStore.getState().getRating('video-1')).toBe(0)
    useUserStore.getState().setRating('video-1', 4)
    expect(useUserStore.getState().getRating('video-1')).toBe(4)
  })

  it('should remove rating', () => {
    useUserStore.getState().setRating('video-1', 4)
    useUserStore.getState().setRating('video-2', 5)
    useUserStore.getState().removeRating('video-1')
    const ratings = useUserStore.getState().ratings
    expect(ratings).toHaveLength(1)
    expect(ratings[0].videoId).toBe('video-2')
  })

  it('should calculate average rating', () => {
    expect(useUserStore.getState().getAverageRating()).toBe(0)

    useUserStore.getState().setRating('video-1', 4)
    expect(useUserStore.getState().getAverageRating()).toBe(4)

    useUserStore.getState().setRating('video-2', 2)
    expect(useUserStore.getState().getAverageRating()).toBe(3)

    useUserStore.getState().setRating('video-3', 5)
    expect(useUserStore.getState().getAverageRating()).toBeCloseTo(3.67, 1)
  })
})
