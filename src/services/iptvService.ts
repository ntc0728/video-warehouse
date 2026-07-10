/**
 * IPTV 服务
 * 负责 M3U/M3U8 播放列表的获取、解析和频道可用性检测
 * 支持多源类型识别（单流/多频道）、代理转发和频道批量可用性检查
 *
 * [批次2重命名] SourceType 已重命名为 PlaylistSourceType
 * 原因：避免与 types/video.ts 中的 SourceType（'mp4' | 'm3u8' | 'dash' | 'pan'）冲突
 */
import type { IPTVChannel, IPTVSettings } from '@/types/iptv';
import { PlaylistSourceType } from '@/types/iptv';
import { getText } from './httpClient';

export { PlaylistSourceType } from '@/types/iptv';

export interface SourceAnalysis {
  type: PlaylistSourceType;
  channelCount: number;
  rawContent: string;
}

/**
 * 检测 M3U 内容的源类型
 * 通过分析 #EXTINF 标签数量和 #EXT-X-STREAM-INF 等特征判断
 */
export function detectSourceType(content: string): SourceAnalysis {
  const channelMatches = content.match(/#EXTINF:/g) || [];
  const channelCount = channelMatches.length;

  if (channelCount > 1) {
    return { type: PlaylistSourceType.MULTI_CHANNEL, channelCount, rawContent: content };
  }

  if (channelCount === 1) {
    return { type: PlaylistSourceType.MULTI_CHANNEL, channelCount, rawContent: content };
  }

  // 无 #EXTINF 但包含 HLS Master Playlist 特征，视为单流
  if (content.includes('#EXTM3U') && (content.includes('#EXT-X-STREAM-INF') || content.includes('#EXT-X-MEDIA'))) {
    return { type: PlaylistSourceType.SINGLE_STREAM, channelCount: 1, rawContent: content };
  }

  if (content.startsWith('#EXTM3U') || content.startsWith('#EXTINF:')) {
    return { type: PlaylistSourceType.MULTI_CHANNEL, channelCount: 1, rawContent: content };
  }

  return { type: PlaylistSourceType.SINGLE_STREAM, channelCount: 1, rawContent: content };
}

async function fetchContent(url: string): Promise<string> {
  return getText(url, { timeout: 15000, retries: 1 });
}

/**
 * 判断 URL 是否需要通过代理访问
 * 根据配置的代理URL和正则模式匹配决定
 * pattern 正则匹配到的 URL 不走代理（被跳过）
 */
function shouldProxy(url: string, proxyUrl?: string, pattern?: string): boolean {
  if (!proxyUrl) return false;
  // 防止双重代理：如果 URL 已经是代理 URL，不再代理
  // 匹配完整 URL（proxyUrl/m3u8-proxy?url=）和相对路径（/m3u8-proxy?url=）
  if (url.includes('/m3u8-proxy?url=') || url.includes('/ts-proxy?url=')) return false;
  if (!pattern) return true;
  try {
    return !new RegExp(pattern).test(url);
  } catch {
    return true;
  }
}

/** 拼接代理后的播放 URL */
function buildProxyUrl(url: string, proxyUrl: string): string {
  return `${proxyUrl}/m3u8-proxy?url=${encodeURIComponent(url)}`;
}

export { shouldProxy, buildProxyUrl };

export function detectVideoSourceType(url: string): 'mp4' | 'm3u8' | 'dash' | 'pan' {
  const lower = url.toLowerCase();
  if (lower.includes('.mp4')) return 'mp4';
  if (lower.includes('.mpd') || lower.includes('/dash/')) return 'dash';
  if (lower.includes('pan.') || lower.includes('/pan/')) return 'pan';
  return 'm3u8';
}

/**
 * 初步检测频道源是否可能支持时移/DVR 回看。
 * 
 * 检测策略：
 * 1. URL 特征匹配：常见的支持时移的CDN域名
 * 2. 根据源类型判断：M3U8 直播流更可能支持 DVR
 * 
 * 注意：这只是客户端启发式检测，真正的 DVR 能力需要
 * 在播放器中通过 HLS.js 的 live details 确认。
 */
export function detectTimeshiftSupport(url: string, type: string): boolean {
  if (type !== 'm3u8') return false;

  // 常见支持 DVR 的 CDN 特征
  const dvrPatterns = [
    'livepull',
    'timeshift',
    'dvr',
    'tplay',
    'ott',
    'livedvr',
  ];

  const lower = url.toLowerCase();
  for (const pattern of dvrPatterns) {
    if (lower.includes(pattern)) return true;
  }

  // 默认假设 M3U8 直播流可能支持时移
  // 实际能力由 HLSAdapter 在播放时确认
  return lower.includes('.m3u8');
}

/**
 * 从远程获取并解析 M3U 播放列表
 * 源地址直接请求（不走代理），频道播放 URL 由前端按需走代理
 */
export async function fetchAndParsePlaylist(settings?: Partial<IPTVSettings>): Promise<{
  channels: IPTVChannel[];
  sourceType: PlaylistSourceType;
  sourceErrors: Array<{ index: number; url: string; error: string }>;
}> {
  const urls = settings?.aggregatorUrls?.length
    ? settings.aggregatorUrls
    : settings?.aggregatorUrl
      ? [settings.aggregatorUrl]
      : [];

  if (urls.length === 0) {
    throw new Error('IPTV 源未配置，请在设置中选择数据源');
  }

  // 并行获取所有源
  const results = await Promise.allSettled(
    urls.map(async (url, index) => {
      const proxyUrl = settings?.proxyUrl ?? '';
      const fetchUrl = shouldProxy(url, proxyUrl, settings?.proxyPattern)
        ? buildProxyUrl(url, proxyUrl)
        : url;
      const rawContent = await fetchContent(fetchUrl);
      const channels = parseM3U8Content(rawContent, url);
      return channels.map(ch => ({
        ...ch,
        id: `${index}-${ch.id}`,
        sourceId: `source-${index}`,
      }));
    })
  );

  const allChannels: IPTVChannel[] = [];
  const sourceErrors: Array<{ index: number; url: string; error: string }> = [];
  let sourceType = PlaylistSourceType.UNKNOWN;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      allChannels.push(...result.value);
      if (result.value.length > 0 && sourceType === PlaylistSourceType.UNKNOWN) {
        sourceType = PlaylistSourceType.MULTI_CHANNEL;
      }
    } else {
      sourceErrors.push({
        index: i,
        url: urls[i],
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  // 去重：同名同组的频道只保留第一个
  const seen = new Set<string>();
  const uniqueChannels = allChannels.filter(ch => {
    const key = `${ch.name}-${ch.group || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    channels: uniqueChannels,
    sourceType,
    sourceErrors,
  };
}

/**
 * 解析 HLS Master Playlist，提取子流 URL
 * 当 M3U8 内容为 Master Playlist 时，从中提取 .m3u 子流地址
 */
function resolveMasterPlaylistUrl(content: string, baseUrl: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('.m3u')) {
      if (trimmed.startsWith('http')) {
        return trimmed;
      }
      // 相对路径拼接为完整 URL
      try {
        const base = new URL(baseUrl);
        return new URL(trimmed, base).href;
      } catch {
        return trimmed;
      }
    }
  }
  return baseUrl;
}

/**
 * 解析 M3U/M3U8 内容为频道列表
 * 解析 #EXTINF 标签提取频道名称、Logo、分组等信息
 * 若标准解析无结果，尝试识别为 Master Playlist 或单流源
 */
function parseM3U8Content(content: string, sourceUrl?: string): IPTVChannel[] {
  const channels: IPTVChannel[] = [];
  const lines = content.split('\n');

  let currentChannel: Partial<IPTVChannel> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      const info = line.replace('#EXTINF:', '');
      const parts = info.split(',');

      currentChannel = {
        id: `channel-${channels.length}`,
        name: parts[1]?.trim() || `Channel ${channels.length}`,
      };

      // 从属性中提取 Logo、分组信息和 tvg-id
      const attributes = parts[0];
      const logoMatch = attributes.match(/tvg-logo="([^"]*)"/);
      const groupMatch = attributes.match(/group-title="([^"]*)"/);
      const tvgIdMatch = attributes.match(/tvg-id="([^"]*)"/);

      if (logoMatch) currentChannel.logo = logoMatch[1];
      if (groupMatch) currentChannel.group = groupMatch[1];
      if (tvgIdMatch) currentChannel.tvgId = tvgIdMatch[1];
    } else if (line && !line.startsWith('#')) {
      // 非 # 开头的行视为频道 URL
      currentChannel.url = line;

      if (currentChannel.name && currentChannel.url) {
        channels.push(currentChannel as IPTVChannel);
      }
      currentChannel = {};
    }
  }

  // 标准解析无结果时，尝试其他格式识别
  if (channels.length === 0 && sourceUrl) {
    const hasMasterPlaylist = content.includes('#EXT-X-STREAM-INF') || content.includes('#EXT-X-MEDIA');
    if (hasMasterPlaylist) {
      const resolvedUrl = resolveMasterPlaylistUrl(content, sourceUrl);
      channels.push({
        id: 'channel-single-1',
        name: '直播',
        url: resolvedUrl,
        group: '直播',
      });
    } else if (content.includes('#EXTM3U')) {
      channels.push({
        id: 'channel-single-1',
        name: '直播',
        url: sourceUrl,
        group: '直播',
      });
    } else if (sourceUrl.includes('.m3u') || sourceUrl.includes('.m3u8')) {
      channels.push({
        id: 'channel-single-1',
        name: '直播',
        url: sourceUrl,
        group: '直播',
      });
    }
  }

  return channels;
}

/**
 * 检测单个频道的可用性
 * 通过创建隐藏的 video 元素尝试加载频道 URL
 * 优先使用 canplay / loadeddata 判定；iOS 上 canplay 可能因自动播放策略不触发，
 * 因此用 loadeddata 作为备用信号，loadedmetadata 后短暂等待作为最终兜底。
 */
export async function checkChannelAvailability(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.volume = 0;

    let metadataTimeoutId: ReturnType<typeof setTimeout>;
    let resolved = false;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      clearTimeout(metadataTimeoutId);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('error', onError);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeAttribute('src');
      video.load();
      video.src = '';
    };

    const onSuccess = () => {
      cleanup();
      resolve(true);
    };

    const onCanPlay = () => {
      if (video.readyState >= 2) {
        onSuccess();
      }
    };

    const onLoadedData = () => {
      onSuccess();
    };

    const onLoadedMetadata = () => {
      // 元数据加载成功说明流可解析，给 3s 让数据到达
      metadataTimeoutId = setTimeout(() => {
        cleanup();
        resolve(true);
      }, 3000);
    };

    const onError = () => {
      cleanup();
      resolve(false);
    };

    video.addEventListener('canplay', onCanPlay, { once: true });
    video.addEventListener('loadeddata', onLoadedData, { once: true });
    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    video.addEventListener('error', onError, { once: true });

    // 全局超时保护，防止长时间无响应
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(false);
    }, 10000);

    video.src = url;
    video.load();
  });
}

/**
 * 批量检测频道可用性
 * 逐个检测频道，每次检测间隔 100ms 以避免过度并发
 * 支持通过 AbortSignal 中断检测过程
 */
export async function checkChannelsAvailability(
  channels: Array<{ id: string; url: string }>,
  onProgress?: (checked: number, total: number) => void,
  signal?: AbortSignal
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  const total = channels.length;
  let checked = 0;

  const checkWithAbort = async (url: string): Promise<boolean> => {
    if (signal?.aborted) {
      return false;
    }
    return checkChannelAvailability(url);
  };

  for (const channel of channels) {
    if (signal?.aborted) break;

    const available = await checkWithAbort(channel.url);
    results.set(channel.id, available);
    checked++;
    onProgress?.(checked, total);

    // 检测间隔，避免过度并发占用带宽
    if (checked < total && !signal?.aborted) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}
