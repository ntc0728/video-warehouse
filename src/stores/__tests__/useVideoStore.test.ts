import { describe, it, expect, beforeEach } from 'vitest'
import { useVideoStore } from '../useVideoStore'
import type { Video } from '@/types/video'

const mockVideos: Video[] = [
  {
    id: '1',
    title: 'Test Movie',
    type: 'movie',
    year: 2024,
    region: '中国大陆',
    tags: ['动作', '科幻'],
    actors: ['Actor A', 'Actor B'],
    director: 'Director X',
    cover: '',
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: '2',
    title: 'Another Film',
    type: 'tv',
    year: 2023,
    region: '美国',
    tags: ['剧情'],
    actors: ['Actor C'],
    director: 'Director Y',
    cover: '',
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: '3',
    title: 'Action Hero Movie',
    type: 'movie',
    year: 2024,
    region: '中国大陆',
    tags: ['动作'],
    actors: ['Actor A'],
    director: 'Director X',
    cover: '',
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

describe('useVideoStore', () => {
  beforeEach(() => {
    useVideoStore.setState({
      videos: [],
      filter: {},
      isLoading: false,
      error: null,
      currentSourceIndex: -1,
    })
  })

  it('should have correct initial state', () => {
    const state = useVideoStore.getState()
    expect(state.videos).toEqual([])
    expect(state.filter).toEqual({})
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.currentSourceIndex).toBe(-1)
  })

  it('should set videos', () => {
    useVideoStore.getState().setVideos(mockVideos, 0)
    const state = useVideoStore.getState()
    expect(state.videos).toEqual(mockVideos)
    expect(state.currentSourceIndex).toBe(0)
  })

  it('should set filter', () => {
    useVideoStore.getState().setFilter({ type: 'movie' })
    expect(useVideoStore.getState().filter.type).toBe('movie')

    useVideoStore.getState().setFilter({ year: 2024 })
    const filter = useVideoStore.getState().filter
    expect(filter.type).toBe('movie')
    expect(filter.year).toBe(2024)
  })

  it('should clear filter', () => {
    useVideoStore.getState().setFilter({ type: 'movie', year: 2024 })
    useVideoStore.getState().clearFilter()
    expect(useVideoStore.getState().filter).toEqual({})
  })

  it('should filter videos by type', () => {
    useVideoStore.getState().setVideos(mockVideos)
    useVideoStore.getState().setFilter({ type: 'movie' })
    const filtered = useVideoStore.getState().getFilteredVideos()
    expect(filtered).toHaveLength(2)
    expect(filtered.every((v) => v.type === 'movie')).toBe(true)
  })

  it('should filter videos by year', () => {
    useVideoStore.getState().setVideos(mockVideos)
    useVideoStore.getState().setFilter({ year: 2023 })
    const filtered = useVideoStore.getState().getFilteredVideos()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('2')
  })

  it('should filter videos by keyword in title', () => {
    useVideoStore.getState().setVideos(mockVideos)
    useVideoStore.getState().setFilter({ keyword: 'action' })
    const filtered = useVideoStore.getState().getFilteredVideos()
    // keyword 'action' matches title "Action Hero Movie" (id:3) only
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('3')
  })

  it('should filter videos by keyword in actor', () => {
    useVideoStore.getState().setVideos(mockVideos)
    useVideoStore.getState().setFilter({ keyword: 'actor c' })
    const filtered = useVideoStore.getState().getFilteredVideos()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('2')
  })

  it('should filter videos by multiple tags', () => {
    useVideoStore.getState().setVideos(mockVideos)
    useVideoStore.getState().setFilter({ tags: ['动作', '科幻'] })
    const filtered = useVideoStore.getState().getFilteredVideos()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('1')
  })

  it('should clear videos', () => {
    useVideoStore.getState().setVideos(mockVideos, 0)
    useVideoStore.getState().clearVideos()
    const state = useVideoStore.getState()
    expect(state.videos).toEqual([])
    expect(state.currentSourceIndex).toBe(-1)
    expect(state.error).toBeNull()
  })
})
