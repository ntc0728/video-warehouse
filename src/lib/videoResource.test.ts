import { describe, it, expect } from 'vitest';
import { isVideoResource } from './videoResource';

describe('isVideoResource', () => {
  it('识别直链 ts URL', () => {
    expect(isVideoResource('https://cdn.example.com/seg-01.ts')).toBe(true);
  });

  it('识别直链 m3u8 URL 带查询参数', () => {
    expect(isVideoResource('https://cdn.example.com/master.m3u8?v=2')).toBe(true);
  });

  it('识别直链 mp4 URL', () => {
    expect(isVideoResource('https://cdn.example.com/movie.mp4')).toBe(true);
  });

  it('识别直链 m4s URL', () => {
    expect(isVideoResource('https://cdn.example.com/seg-1.m4s')).toBe(true);
  });

  it('识别直链 mpd (DASH) URL', () => {
    expect(isVideoResource('https://cdn.example.com/manifest.mpd')).toBe(true);
  });

  it('识别 m3u 扩展名', () => {
    expect(isVideoResource('https://cdn.example.com/playlist.m3u')).toBe(true);
  });

  it('识别 m4v 扩展名', () => {
    expect(isVideoResource('https://cdn.example.com/clip.m4v')).toBe(true);
  });

  it('识别代理 URL 中的 ts 资源', () => {
    const url = 'https://worker.example.com/ts-proxy?url=' + encodeURIComponent('https://cdn.example.com/seg.ts');
    expect(isVideoResource(url)).toBe(true);
  });

  it('识别代理 URL 中的 m3u8 资源', () => {
    const url = 'https://worker.example.com/m3u8-proxy?url=' + encodeURIComponent('https://cdn.example.com/master.m3u8');
    expect(isVideoResource(url)).toBe(true);
  });

  it('识别代理 URL 中带额外参数的 ts 资源', () => {
    const url = 'https://worker.example.com/ts-proxy?url=' + encodeURIComponent('https://cdn.example.com/seg.ts') + '&headers=%7B%7D';
    expect(isVideoResource(url)).toBe(true);
  });

  it('拒绝非视频资源 URL', () => {
    expect(isVideoResource('https://api.example.com/users')).toBe(false);
  });

  it('拒绝同源 HTML', () => {
    expect(isVideoResource('https://example.com/index.html')).toBe(false);
  });

  it('拒绝空 URL', () => {
    expect(isVideoResource('')).toBe(false);
  });

  it('拒绝代理 URL 中编码的非视频扩展名', () => {
    const url = 'https://worker.example.com/ts-proxy?url=' + encodeURIComponent('https://cdn.example.com/image.jpg');
    expect(isVideoResource(url)).toBe(false);
  });

  it('支持大小写混合扩展名', () => {
    expect(isVideoResource('https://cdn.example.com/SEG.TS')).toBe(true);
  });

  it('拒绝扩展名后跟路径（避免误报）', () => {
    expect(isVideoResource('https://cdn.example.com/seg.ts/redirect')).toBe(false);
  });

  it('识别仅含 url 参数无 path 的代理 URL', () => {
    const url = 'https://worker.example.com/?url=' + encodeURIComponent('https://cdn.example.com/seg.ts');
    expect(isVideoResource(url)).toBe(true);
  });
});
