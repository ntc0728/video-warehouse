/**
 * 视频资源 URL 识别工具
 *
 * 用于 PerformanceObserver / PerformanceResourceTiming 过滤：
 * 1. 支持识别直链视频资源（.ts/.m3u8/.m3u/.mp4/.m4s/.m4v/.mpd）
 * 2. 支持识别经过 Cloudflare Worker 代理的 URL（/m3u8-proxy?url=...、/ts-proxy?url=...）
 *    代理 URL 的真实资源地址在 query 参数 url 中，需解码后再匹配扩展名
 */

/** 匹配视频资源扩展名（结尾或后跟查询参数，但不允许后跟路径） */
const VIDEO_EXT_REGEX = /\.(ts|m3u8|m3u|mp4|m4s|m4v|mpd)(\?|$)/i;

/** 提取 query 参数中的 url 值 */
const PROXY_URL_PARAM = /[?&]url=([^&]+)/;

/**
 * 判断给定 URL 是否为视频资源
 *
 * @param url 完整 URL（可能是直链或代理 URL）
 * @returns true 表示是视频资源
 *
 * @example
 * isVideoResource('https://cdn.example.com/seg.ts') // true
 * isVideoResource('https://worker.example.com/ts-proxy?url=' + encodeURIComponent('https://cdn.example.com/seg.ts')) // true
 * isVideoResource('https://api.example.com/users') // false
 */
export function isVideoResource(url: string): boolean {
  if (!url) return false;

  // 提取代理 URL 中编码的真实资源地址
  const proxyMatch = url.match(PROXY_URL_PARAM);
  const candidate = proxyMatch ? decodeURIComponent(proxyMatch[1]) : url;

  return VIDEO_EXT_REGEX.test(candidate);
}
