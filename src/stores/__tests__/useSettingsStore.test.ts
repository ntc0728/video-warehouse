import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '../useSettingsStore'

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      videoSourceIndex: 0,
      videoSourceIndices: [0],
      iptvSourceIndex: 0,
      iptvSourceIndices: [0],
      theme: 'light',
      corsProxy: '',
      epgUrls: ['http://epg.51zmt.top:8000/e.xml'],
      epgUpdateInterval: 6,
      rememberVolume: false,
      tmdbAccessToken: '',
      tmdbLanguage: 'zh-CN',
    })
  })

  it('should have correct initial state', () => {
    const state = useSettingsStore.getState()
    expect(state.videoSourceIndex).toBe(0)
    expect(state.theme).toBe('light')
    expect(state.corsProxy).toBe('')
    expect(state.rememberVolume).toBe(false)
    expect(state.tmdbLanguage).toBe('zh-CN')
  })

  it('should set video source index', () => {
    useSettingsStore.getState().setVideoSourceIndex(2)
    expect(useSettingsStore.getState().videoSourceIndex).toBe(2)
  })

  it('should set video source indices', () => {
    useSettingsStore.getState().setVideoSourceIndices([0, 1, 2])
    expect(useSettingsStore.getState().videoSourceIndices).toEqual([0, 1, 2])
  })

  it('should set theme', () => {
    useSettingsStore.getState().setTheme('dark')
    expect(useSettingsStore.getState().theme).toBe('dark')
  })

  it('should set cors proxy', () => {
    useSettingsStore.getState().setCorsProxy('https://proxy.example.com')
    expect(useSettingsStore.getState().corsProxy).toBe('https://proxy.example.com')
  })

  it('should set epg update interval with bounds', () => {
    useSettingsStore.getState().setEpgUpdateInterval(12)
    expect(useSettingsStore.getState().epgUpdateInterval).toBe(12)

    useSettingsStore.getState().setEpgUpdateInterval(0)
    expect(useSettingsStore.getState().epgUpdateInterval).toBe(1)

    useSettingsStore.getState().setEpgUpdateInterval(100)
    expect(useSettingsStore.getState().epgUpdateInterval).toBe(24)
  })

  it('should set remember volume', () => {
    useSettingsStore.getState().setRememberVolume(true)
    expect(useSettingsStore.getState().rememberVolume).toBe(true)
  })

  it('should set TMDB token and language', () => {
    useSettingsStore.getState().setTMDBToken('abc123')
    expect(useSettingsStore.getState().tmdbAccessToken).toBe('abc123')

    useSettingsStore.getState().setTMDBLanguage('en-US')
    expect(useSettingsStore.getState().tmdbLanguage).toBe('en-US')
  })

  it('should set IPTV source index and indices', () => {
    useSettingsStore.getState().setIPTVSourceIndex(1)
    expect(useSettingsStore.getState().iptvSourceIndex).toBe(1)

    useSettingsStore.getState().setIPTVSourceIndices([0, 2])
    expect(useSettingsStore.getState().iptvSourceIndices).toEqual([0, 2])
  })
})
