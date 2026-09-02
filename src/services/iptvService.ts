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
  // 20s 单次超时 + 不重试：M3U 列表对失效源重试收益极低；
  // 超时不宜过紧（8s 会误杀经代理响应慢但健康的源），配合竞速窗口「首个成功即收尾」
  // 与「零成功时等全部 settle 快速失败」，慢源不阻塞快源。
  return getText(url, { timeout: 20000, retries: 0 });
}

/**
 * 判断 URL 是否需要通过代理访问
 * 根据配置的代理URL和正则模式匹配决定
 * pattern 正则匹配到的 URL 不走代理（被跳过）
 */
/**
 * 解析 IPTV 代理为列表（支持英文 ; 分隔多个代理）。
 * 返回裸代理 URL 数组（如 https://your-worker.workers.dev），过滤空。
 */
export function getIptvProxyList(proxyConfig?: string): string[] {
  if (!proxyConfig) return [];
  return proxyConfig
    .split(';')
    .map((s) => s.trim().replace(/\/+$/, '')) // 去尾部斜杠，便于拼接
    .filter(Boolean);
}

/**
 * 取第一个代理（多值配置的"主代理"）。IPTV 代理本期"解析 + 取第一个"。
 */
export function getPrimaryIptvProxy(proxyConfig?: string): string {
  return getIptvProxyList(proxyConfig)[0] ?? '';
}

/**
 * 判断 URL 是否已经是“当前配置的代理”代理过的地址。
 * 支持多值代理：URL origin 命中"任一已配置代理"的 origin、且路径为某 *-proxy?url= 时才视为“自己的代理”，
 * 避免把其他代理（如 gh-proxy.com）预先代理过的频道地址误判为本代理而漏代理。
 */
function isOwnProxy(url: string, proxyUrl?: string): boolean {
  const list = getIptvProxyList(proxyUrl);
  if (list.length === 0) return false;
  try {
    const u = new URL(url);
    const isOwn = list.some((p) => {
      try {
        return new URL(p).origin === u.origin;
      } catch {
        return false;
      }
    });
    if (!isOwn) return false;
    return /\/(m3u8|ts|dash|file)-proxy\?url=/.test(u.pathname + u.search);
  } catch {
    return false;
  }
}

/** 代理路径匹配：形如 /m3u8-proxy、/ts-proxy、/dash-proxy、/file-proxy 且带 ?url= 参数 */
const PROXY_PATH_RE = /^\/(?:m3u8|ts|dash|file)-proxy\/?$/i;

/** 安全取 origin，解析失败返回空串 */
function safeOrigin(u?: string): string {
  if (!u) return '';
  try {
    return new URL(u).origin;
  } catch {
    return '';
  }
}

/** 对代理参数做（最多 3 次）解码，处理源站双重/多重编码的情况 */
function decodeProxyParam(raw: string): string {
  let out = raw;
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(out);
      if (decoded === out) break;
      out = decoded;
    } catch {
      break;
    }
  }
  return out;
}

/**
 * 解包“第三方代理前缀”，提取真实地址。
 * 许多 IPTV 源会把频道地址预先包一层代理（如 gh-proxy.com/m3u8-proxy?url=<内层>），
 * 直接拿去播放往往因为那个中间代理失效/被墙而失败。这里把内层真实地址抽出来，
 * 改走我们配置的代理（nmz996 等），绕开失效的中间代理。
 *
 * - 仅当包装者 origin 与 ownProxyUrl 不同（即不是本代理）才解包，保留“防双重代理”语义；
 * - 递归解包多层包装（a-proxy?url=<b-proxy?url=<源站>>），直到拿到非代理包装的真实地址；
 * - 不是 *-proxy?url= 形态的地址原样返回，避免误伤正常 URL。
 */
export function unwrapProxy(url: string, ownProxyUrl?: string): string {
  let current = url;
  const ownOrigin = safeOrigin(ownProxyUrl);
  for (let i = 0; i < 5; i++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return current;
    }
    if (ownOrigin && parsed.origin === ownOrigin) return current; // 本代理，保持不动
    if (!PROXY_PATH_RE.test(parsed.pathname)) return current; // 不是代理包装
    const raw = parsed.searchParams.get('url');
    if (!raw) return current;
    const inner = decodeProxyParam(raw);
    if (!inner || inner === current) return current;
    current = inner;
  }
  return current;
}

function shouldProxy(url: string, proxyUrl?: string, pattern?: string): boolean {
  // 多值代理：统一取第一个（主代理）
  proxyUrl = getPrimaryIptvProxy(proxyUrl);
  // 解包第三方代理前缀（如 gh-proxy.com/m3u8-proxy?url=<内层>）：
  // 抽出真实地址改走我们配置的代理，绕开失效/被墙的中间代理。
  const target = unwrapProxy(url, proxyUrl);
  url = target;
  if (!proxyUrl) {
    return false;
  }
  // 防止双重代理：仅当 URL 已经是“当前配置的代理”地址时才跳过；
  // 若是其他代理（如 gh-proxy.com）预先代理过的地址，仍走我们的代理重走，确保自定义代理生效
  if (isOwnProxy(url, proxyUrl)) {
    return false;
  }
  if (!pattern) {
    return true;
  }
  try {
    const matched = new RegExp(pattern).test(url);
    return !matched;
  } catch {
    return true;
  }
}

/** 拼接代理后的播放 URL，按资源类型选择代理端点（m3u8→/m3u8-proxy，dash→/dash-proxy 重写清单，其余单文件→/file-proxy 透传）
 *  可选 headers 追加为 &headers=<JSON> 参数（worker 代理层原生合并到源站请求头，覆盖默认 UA/Referer） */
function buildProxyUrl(url: string, proxyUrl: string, headers?: Record<string, string>): string {
  // 多值代理：统一取第一个
  proxyUrl = getPrimaryIptvProxy(proxyUrl);
  url = unwrapProxy(url, proxyUrl);
  const type = detectVideoSourceType(url);
  const path = type === 'm3u8' ? 'm3u8-proxy' : type === 'dash' ? 'dash-proxy' : 'file-proxy';
  let result = `${proxyUrl}/${path}?url=${encodeURIComponent(url)}`;
  if (headers && Object.keys(headers).length > 0) {
    result += `&headers=${encodeURIComponent(JSON.stringify(headers))}`;
  }
  return result;
}

/**
 * 预留开关：是否消费频道的 M3U http-user-agent / http-referrer 属性。
 * 默认 false——iptv-org 等国际源依赖精确 UA/Referer，但国内源多数无需；
 * 且浏览器禁止直连时设置 UA 头（forbidden header），仅代理路径可携带。
 * 开启后代理路径自动携带频道属性，无需其他改动（worker 已支持 headers 参数合并）。
 */
const IPTV_CHANNEL_HEADERS_ENABLED = false;

/**
 * 构建频道播放地址（统一入口：频道列表点击 / IPTVPlayer 切频道 / 播放页初始化）。
 * 默认行为与「shouldProxy + buildProxyUrl」完全一致；预留开关开启后，
 * 代理路径额外携带频道的 UA/Referer 属性（M3U http-user-agent/http-referrer）。
 */
export function buildChannelPlayUrl(
  channel: Pick<IPTVChannel, 'url' | 'userAgent' | 'referrer'>,
  proxyUrl?: string,
  pattern?: string
): string {
  if (!shouldProxy(channel.url, proxyUrl, pattern)) return channel.url;
  let headers: Record<string, string> | undefined;
  if (IPTV_CHANNEL_HEADERS_ENABLED) {
    if (channel.userAgent) headers = { ...headers, 'User-Agent': channel.userAgent };
    if (channel.referrer) headers = { ...headers, 'Referer': channel.referrer };
  }
  return buildProxyUrl(channel.url, proxyUrl ?? '', headers);
}

/**
 * 拼接 IPTV 源接口代理 URL —— 强制走 /m3u8-proxy 端点（源拉取的就是 M3U 文本播放列表）。
 * 与频道播放链接不同：源接口【无条件走代理】，不经过 shouldProxy 的直连白名单/proxyPattern 判断。
 * 未配置代理时返回原 URL（直连兜底）。
 */
export function buildSourceProxyUrl(url: string, proxyUrl?: string): string {
  const primary = getPrimaryIptvProxy(proxyUrl);
  if (!primary) return url;
  const target = unwrapProxy(url, primary);
  return `${primary}/m3u8-proxy?url=${encodeURIComponent(target)}`;
}

export { shouldProxy, buildProxyUrl };

export function detectVideoSourceType(url: string): 'mp4' | 'm3u8' | 'dash' | 'pan' | 'flv' {
  const lower = url.toLowerCase();
  if (lower.includes('.mp4')) return 'mp4';
  if (
    lower.includes('.mpd') ||
    lower.includes('/dash/') ||
    // ?type=dash / ?format=dash / ?playType=dash 等参数形式（部分源不以 .mpd 结尾）
    /[?&](type|format|playType|playtype)=dash/i.test(lower)
  ) return 'dash';
  if (lower.includes('pan.') || lower.includes('/pan/')) return 'pan';
  // C3 兜底：FLV 流 / 裸 TS 流（非 HLS 分片）→ mpegts.js 播放
  if (lower.includes('.flv') || /[?&](type|format|playType)=flv/i.test(lower)) return 'flv';
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

/** 竞速窗口关闭时被放弃的源标记（非真实网络错误，不计入 sourceErrors） */
const PENDING_ABANDONED = 'pending-abandoned-in-window';

/**
 * 竞速窗口等待：并行等待所有 promise，但限制总等待时长：
 * - 首个 fulfilled 到达后，最多再等 settleMs 收尾（合并其余快源结果，保留多源聚合语义）
 * - 全程最多 maxWaitMs（无任何成功源时也强制返回，防止慢源/失效源无限拖尾）
 * 未完成项以 rejected(PENDING_ABANDONED) 标记，由调用方区分「真实失败」与「放弃等待」。
 */
function settleWithWindow<T>(
  promises: Promise<T>[],
  settleMs: number,
  maxWaitMs: number
): Promise<PromiseSettledResult<T>[]> {
  return new Promise((resolve) => {
    const results: Array<PromiseSettledResult<T> | undefined> = new Array(promises.length);
    let settledCount = 0;
    let firstFulfilledAt = 0;
    let done = false;
    let maxTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (done) return;
      done = true;
      if (maxTimer) clearTimeout(maxTimer);
      // 未完成项标记为「放弃等待」：不算真实失败
      for (let i = 0; i < results.length; i++) {
        if (!results[i]) {
          results[i] = { status: 'rejected', reason: PENDING_ABANDONED };
        }
      }
      resolve(results as PromiseSettledResult<T>[]);
    };

    maxTimer = setTimeout(finish, maxWaitMs);

    promises.forEach((promise, i) => {
      promise
        .then(
          (value) => {
            results[i] = { status: 'fulfilled', value };
            if (firstFulfilledAt === 0) {
              firstFulfilledAt = Date.now();
              // 首个成功源到达：启动收尾窗口，等其余快源一起合并返回
              setTimeout(finish, settleMs);
            }
          },
          (reason) => {
            results[i] = { status: 'rejected', reason };
          }
        )
        .finally(() => {
          settledCount += 1;
          if (settledCount === promises.length) finish();
        });
    });
  });
}

/**
 * 从远程获取并解析 M3U 播放列表
 * 源接口【无条件走 IPTV 代理】（buildSourceProxyUrl，/m3u8-proxy 端点），
 * 不经过 shouldProxy 的直连白名单/proxyPattern 判断——只有频道播放链接才走代理规则逻辑。
 *
 * 加载策略（防慢源拖尾）：并行拉取所有源，但走竞速窗口——
 * 首个成功源到达后最多再等 1.5s 收尾即返回（正常情况 2~4s 出结果），
 * 全程最多 20s 兜底（与单源超时一致），不再等全部源 settle。
 */
/**
 * 拼接 CORS 代理 URL（/proxy?url= 端点）。
 * 注意：IPTV 源 M3U 拉取已改用 IPTV 代理（见 fetchAndParsePlaylist），
 * 本函数仅保留给测试与其余视频/EPG 文本拉取场景使用（video 代理体系）。
 * proxyPattern 命中「直连白名单」时原样返回不走代理。
 */
export function buildCorsProxyUrl(url: string, corsProxy: string, pattern?: string): string {
  const base = corsProxy.replace(/\/+$/, '');
  if (pattern) {
    try {
      if (new RegExp(pattern).test(url)) return url;
    } catch { /* 非法规则回退走代理 */ }
  }
  return `${base}/proxy?url=${encodeURIComponent(url)}`;
}

export async function fetchAndParsePlaylist(
  settings?: Partial<IPTVSettings>
): Promise<{
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

  // 并行获取所有源（竞速窗口：首个成功 + 1.5s 收尾；零成功时等全部 settle 快速失败，
  // 绝对上限 20s 兜底——上限过紧（8s）会误杀响应慢但健康的源，导致“全部源加载失败”）
  const results = await settleWithWindow(
    urls.map(async (url, index) => {
      // 源 M3U 接口【无条件走 IPTV 代理】（settings.proxyUrl，/m3u8-proxy 端点）：
      // 不经过 shouldProxy 的直连白名单/proxyPattern 判断——只有频道播放链接才走代理规则逻辑。
      // 未配置代理时直连兜底。
      const fetchUrl = buildSourceProxyUrl(url, settings?.proxyUrl);
      const rawContent = await fetchContent(fetchUrl);
      const channels = parseM3U8Content(rawContent, url);
      return channels.map(ch => ({
        ...ch,
        id: `${index}-${ch.id}`,
        sourceId: `source-${index}`,
      }));
    }),
    1500, // 首个成功源到达后的收尾窗口
    20000 // 绝对上限（与单源超时一致）
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
      // 竞速窗口关闭时放弃的源不计入失败（非真实网络错误）
      if (result.reason === PENDING_ABANDONED) continue;
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
 * 导出供单元测试与外部复用
 */
export function parseM3U8Content(content: string, sourceUrl?: string): IPTVChannel[] {
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

      // 预留属性：catchup 回放（标准 M3U catchup 规范）与 http-user-agent/http-referrer（源站请求头）。
      // 仅解析存储——消费由 buildChannelPlayUrl 的 IPTV_CHANNEL_HEADERS_ENABLED 开关控制（默认关闭）。
      const catchupMatch = attributes.match(/catchup="([^"]*)"/);
      const catchupSourceMatch = attributes.match(/catchup-source="([^"]*)"/);
      const catchupDaysMatch = attributes.match(/catchup-days="?(\d+)"?/);
      const userAgentMatch = attributes.match(/http-user-agent="([^"]*)"/);
      const referrerMatch = attributes.match(/http-referrer="([^"]*)"|http-referer="([^"]*)"/);

      if (catchupMatch) currentChannel.catchup = catchupMatch[1];
      if (catchupSourceMatch) currentChannel.catchupSource = catchupSourceMatch[1];
      if (catchupDaysMatch) currentChannel.catchupDays = Number(catchupDaysMatch[1]);
      if (userAgentMatch) currentChannel.userAgent = userAgentMatch[1];
      if (referrerMatch) currentChannel.referrer = referrerMatch[1] || referrerMatch[2];
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

  for (const channel of channels) {
    if (signal?.aborted) break;

    const available = signal?.aborted ? false : await checkChannelAvailability(channel.url);
    results.set(channel.id, available);
    checked++;
    onProgress?.(checked, total);

    // 检测间隔，避免过度并发占用带宽
    if (checked < total && !signal?.aborted) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 100);
        signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
  }

  return results;
}
