import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from '../usePlayerStore'

describe('usePlayerStore', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      currentSrc: null,
      currentType: null,
      isPlaying: false,
      progress: 0,
      duration: 0,
      volume: 1,
      playbackRate: 1,
      sources: [],
      decoderMode: 'native',
      currentLevel: -1,
      levels: [],
      audioTracks: [],
      currentAudioTrack: -1,
      isPiP: false,
      subtitleUrl: null,
      mode: 'video',
      platform: 'desktop',
      isControlsVisible: false,
      isChannelListVisible: false,
      loopMode: 'none',
      bandwidthEstimate: 0,
      isBuffering: false,
      bufferedProgress: 0,
      isFullscreen: false,
    })
  })

  it('should have correct initial state', () => {
    const state = usePlayerStore.getState()
    expect(state.currentSrc).toBeNull()
    expect(state.isPlaying).toBe(false)
    expect(state.progress).toBe(0)
    expect(state.volume).toBe(1)
    expect(state.playbackRate).toBe(1)
    expect(state.decoderMode).toBe('native')
    expect(state.mode).toBe('video')
    expect(state.platform).toBe('desktop')
    expect(state.loopMode).toBe('none')
    expect(state.bufferedProgress).toBe(0)
    expect(state.isFullscreen).toBe(false)
  })

  it('should set source', () => {
    usePlayerStore.getState().setSource('http://example.com/video.mp4', 'mp4')
    const state = usePlayerStore.getState()
    expect(state.currentSrc).toBe('http://example.com/video.mp4')
    expect(state.currentType).toBe('mp4')
  })

  it('should set playing', () => {
    usePlayerStore.getState().setPlaying(true)
    expect(usePlayerStore.getState().isPlaying).toBe(true)

    usePlayerStore.getState().setPlaying(false)
    expect(usePlayerStore.getState().isPlaying).toBe(false)
  })

  it('should set progress', () => {
    usePlayerStore.getState().setProgress(50.5)
    expect(usePlayerStore.getState().progress).toBe(50.5)
  })

  it('should set duration', () => {
    usePlayerStore.getState().setDuration(120)
    expect(usePlayerStore.getState().duration).toBe(120)
  })

  it('should set volume', () => {
    usePlayerStore.getState().setVolume(0.5)
    expect(usePlayerStore.getState().volume).toBe(0.5)
  })

  it('should set playback rate', () => {
    usePlayerStore.getState().setPlaybackRate(1.5)
    expect(usePlayerStore.getState().playbackRate).toBe(1.5)
  })

  it('should set decoder mode', () => {
    usePlayerStore.getState().setDecoderMode('wasm')
    expect(usePlayerStore.getState().decoderMode).toBe('wasm')
  })

  it('should set mode and platform', () => {
    usePlayerStore.getState().setMode('iptv')
    expect(usePlayerStore.getState().mode).toBe('iptv')

    usePlayerStore.getState().setPlatform('mobile')
    expect(usePlayerStore.getState().platform).toBe('mobile')
  })

  it('should set loop mode', () => {
    usePlayerStore.getState().setLoopMode('single')
    expect(usePlayerStore.getState().loopMode).toBe('single')
  })

  it('should set buffered progress', () => {
    usePlayerStore.getState().setBufferedProgress(0.75)
    expect(usePlayerStore.getState().bufferedProgress).toBe(0.75)
  })

  it('should set fullscreen', () => {
    usePlayerStore.getState().setFullscreen(true)
    expect(usePlayerStore.getState().isFullscreen).toBe(true)

    usePlayerStore.getState().setFullscreen(false)
    expect(usePlayerStore.getState().isFullscreen).toBe(false)
  })

  it('should reset to initial state', () => {
    usePlayerStore.getState().setPlaying(true)
    usePlayerStore.getState().setProgress(100)
    usePlayerStore.getState().setVolume(0.3)
    usePlayerStore.getState().setBufferedProgress(0.5)
    usePlayerStore.getState().setFullscreen(true)
    usePlayerStore.getState().reset()

    const state = usePlayerStore.getState()
    expect(state.isPlaying).toBe(false)
    expect(state.progress).toBe(0)
    expect(state.volume).toBe(1)
    expect(state.playbackRate).toBe(1)
    expect(state.bufferedProgress).toBe(0)
    expect(state.isFullscreen).toBe(false)
  })
})
