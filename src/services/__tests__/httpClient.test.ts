import { describe, it, expect, beforeEach } from 'vitest'
import { getCorsProxy, buildProxyUrl } from '../httpClient'
import { useSettingsStore } from '@/stores'

describe('httpClient utilities', () => {
  beforeEach(() => {
    useSettingsStore.setState({ corsProxy: '' })
  })

  describe('getCorsProxy', () => {
    it('should return empty string when no proxy configured', () => {
      expect(getCorsProxy()).toBe('')
    })

    it('should return proxy URL with ?url= appended', () => {
      useSettingsStore.setState({ corsProxy: 'https://proxy.example.com' })
      const proxy = getCorsProxy()
      expect(proxy).toContain('https://proxy.example.com?url=')
    })

    it('should handle proxy URL ending with /proxy', () => {
      useSettingsStore.setState({ corsProxy: 'https://proxy.example.com/proxy' })
      const proxy = getCorsProxy()
      expect(proxy).toContain('url=')
    })

    it('should handle proxy URL ending with ?', () => {
      useSettingsStore.setState({ corsProxy: 'https://proxy.example.com/proxy?' })
      const proxy = getCorsProxy()
      expect(proxy).toContain('url=')
    })

    it('should handle proxy URL ending with /', () => {
      useSettingsStore.setState({ corsProxy: 'https://proxy.example.com/proxy/' })
      const proxy = getCorsProxy()
      expect(proxy).toContain('url=')
    })

    it('should handle proxy URL ending with url=%', () => {
      useSettingsStore.setState({ corsProxy: 'https://proxy.example.com/proxy?url=%' })
      const proxy = getCorsProxy()
      expect(proxy).toBe('https://proxy.example.com/proxy?url=%')
    })

    it('should handle whitespace in proxy URL', () => {
      useSettingsStore.setState({ corsProxy: '  https://proxy.example.com  ' })
      const proxy = getCorsProxy()
      expect(proxy).toContain('https://proxy.example.com?url=')
    })
  })

  describe('buildProxyUrl', () => {
    it('should return target URL when no proxy configured', () => {
      const targetUrl = 'https://example.com/api'
      expect(buildProxyUrl(targetUrl)).toBe(targetUrl)
    })

    it('should encode target URL in proxy URL', () => {
      useSettingsStore.setState({ corsProxy: 'https://proxy.example.com' })
      const targetUrl = 'https://example.com/api?foo=bar'
      const result = buildProxyUrl(targetUrl)
      expect(result).toContain(encodeURIComponent(targetUrl))
    })
  })
})
