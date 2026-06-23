import { describe, it, expect, beforeEach } from 'vitest'
import { useUserStore } from '../useUserStore'

describe('useUserStore', () => {
  beforeEach(() => {
    useUserStore.setState({
      collections: [],
      history: [],
    })
  })

  it('should have correct initial state', () => {
    const state = useUserStore.getState()
    expect(state.collections).toEqual([])
    expect(state.history).toEqual([])
  })

  it('should add collection', () => {
    useUserStore.getState().addCollection('video-1', { title: 'Test Video' })
    const collections = useUserStore.getState().collections
    expect(collections).toHaveLength(1)
    expect(collections[0].videoId).toBe('video-1')
    expect(collections[0].title).toBe('Test Video')
  })

  it('should not add duplicate collection', () => {
    useUserStore.getState().addCollection('video-1', { title: 'Test Video' })
    useUserStore.getState().addCollection('video-1', { title: 'Test Video' })
    expect(useUserStore.getState().collections).toHaveLength(1)
  })

  it('should remove collection', () => {
    useUserStore.getState().addCollection('video-1')
    useUserStore.getState().addCollection('video-2')
    useUserStore.getState().removeCollection('video-1')
    const collections = useUserStore.getState().collections
    expect(collections).toHaveLength(1)
    expect(collections[0].videoId).toBe('video-2')
  })

  it('should check if collected', () => {
    expect(useUserStore.getState().isCollected('video-1')).toBe(false)
    useUserStore.getState().addCollection('video-1')
    expect(useUserStore.getState().isCollected('video-1')).toBe(true)
  })

  it('should clear collections', () => {
    useUserStore.getState().addCollection('video-1')
    useUserStore.getState().addCollection('video-2')
    useUserStore.getState().clearCollections()
    expect(useUserStore.getState().collections).toEqual([])
  })

  it('should add history', () => {
    useUserStore.getState().addHistory({
      videoId: 'video-1',
      episodeId: 'ep-1',
      progress: 50,
      duration: 120,
    })
    const history = useUserStore.getState().history
    expect(history).toHaveLength(1)
    expect(history[0].videoId).toBe('video-1')
    expect(history[0].progress).toBe(50)
  })

  it('should update existing history record', () => {
    useUserStore.getState().addHistory({
      videoId: 'video-1',
      episodeId: 'ep-1',
      progress: 50,
      duration: 120,
    })
    useUserStore.getState().addHistory({
      videoId: 'video-1',
      episodeId: 'ep-1',
      progress: 80,
      duration: 120,
    })
    const history = useUserStore.getState().history
    expect(history).toHaveLength(1)
    expect(history[0].progress).toBe(80)
  })

  it('should update history progress', () => {
    useUserStore.getState().addHistory({
      videoId: 'video-1',
      episodeId: 'ep-1',
      progress: 50,
      duration: 120,
    })
    useUserStore.getState().updateHistoryProgress('video-1', 'ep-1', 75, 120)
    const history = useUserStore.getState().history
    expect(history[0].progress).toBe(75)
  })

  it('should get history by video', () => {
    useUserStore.getState().addHistory({
      videoId: 'video-1',
      episodeId: 'ep-1',
      progress: 50,
      duration: 120,
    })
    const record = useUserStore.getState().getHistoryByVideo('video-1')
    expect(record).toBeDefined()
    expect(record?.videoId).toBe('video-1')

    expect(useUserStore.getState().getHistoryByVideo('video-999')).toBeUndefined()
  })

  it('should remove history', () => {
    useUserStore.getState().addHistory({
      videoId: 'video-1',
      episodeId: 'ep-1',
      progress: 50,
      duration: 120,
    })
    const historyId = useUserStore.getState().history[0].id
    useUserStore.getState().removeHistory(historyId)
    expect(useUserStore.getState().history).toEqual([])
  })

  it('should clear history', () => {
    useUserStore.getState().addHistory({
      videoId: 'video-1',
      episodeId: 'ep-1',
      progress: 50,
      duration: 120,
    })
    useUserStore.getState().addHistory({
      videoId: 'video-2',
      episodeId: undefined,
      progress: 100,
      duration: 200,
    })
    useUserStore.getState().clearHistory()
    expect(useUserStore.getState().history).toEqual([])
  })
})
