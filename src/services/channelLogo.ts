/**
 * 频道台标解析器（三级回退链 + 库清单预判 + 跨会话状态记忆）
 *
 * 为 IPTV 频道生成台标候选 URL 列表，按序尝试，全部失败后由调用方走字母占位：
 * 1. M3U 自带 tvg-logo（channel.logo）
 * 2. EPG XMLTV <icon>（经 matchEPGChannel 匹配）
 * 3. 在线台标库按规范化频道名拼 URL（fanmingming/live、wanglindl/TVlogo）
 *
 * 健壮性（借鉴 iptv-org「本地化查询」模式）：
 * - 库清单预判：preloadLogoCache() 拉取在线台标库文件名清单（IndexedDB 缓存 7 天），
 *   猜测前本地判定「库里有没有」——库外频道直接跳过，不再发起注定 404 的请求；
 *   清单未就绪时降级为「不预判直接猜」（保持旧行为）。
 * - 跨会话状态记忆：URL 级 ok/fail 记忆持久化到 IndexedDB（30 天）。
 *   上次成功的 URL 优先复用，失败过的 URL 不再请求，避免每次刷新重复 404。
 * - 模块级 failedLogoUrls 失败记忆：已 404/挂起的 URL 不再返回（会话内即时生效）
 * - http 台标在 https 部署下会被混合内容拦截，经 file-proxy 转 https 或直接丢弃
 */
import type { IPTVChannel } from '@/types/iptv';
import { matchEPGChannel, matchEPGChannelIndexed } from './epgService';
import type { EPGChannelInfo, EPGChannelIndex } from './epgService';
import { getPrimaryIptvProxy } from './iptvService';
import {
  loadLogoLibrary,
  saveLogoLibrary,
  loadLogoState,
  saveLogoState,
} from './channelLogoCache';
import type { LogoLibrary, LogoStateEntry } from './channelLogoCache';

/** 括号注释：[蓝光] / (4K) / 【超清】 等（台标文件名不含这些） */
const LOGO_BRACKET_RE = /[\[【（(][^\]】）)]*[\]】）)]/g;
/** 清晰度/质量标记（4K/8K 保留：它们是部分频道品牌名的一部分，如 CCTV-4K） */
const LOGO_RESOLUTION_RE = /高清|HD|超清|标清|极致|极速|流畅|蓝光/gi;
/** 尾部频道定位词：逐轮剥除，覆盖「新闻综合」「国防军事」等组合 */
const LOGO_CHANNEL_TYPE_WORDS = /(综合|新闻|文艺|体育|影视|财经|纪录|科教|戏曲|少儿|音乐|国防军事|农业农村|社会与法|频道)$/;
/** 分隔符：空格/连字符/下划线/点号/间隔号 */
const LOGO_SEPARATOR_RE = /[\s\-_.·]/g;

/**
 * 台标友好名称规范化（与 EPG 匹配的 normalizeName 不同——不能去掉「卫视」等品牌词）：
 * 去括号注释 → 去清晰度标记 → 循环去尾部频道定位词 → 去分隔符。
 * 例：'CCTV-1 综合[蓝光]' → 'CCTV1'；'湖南卫视' 原样保留；'CCTV-5+ 体育' → 'CCTV5+'。
 */
export function toLogoName(name: string): string {
  if (!name) return '';
  let out = name
    .replace(LOGO_BRACKET_RE, '')
    .replace(LOGO_RESOLUTION_RE, '');
  for (let i = 0; i < 3; i++) {
    const next = out.replace(LOGO_CHANNEL_TYPE_WORDS, '');
    if (next === out) break;
    out = next;
  }
  return out.replace(LOGO_SEPARATOR_RE, '');
}

/** 在线台标库定义：key 对应库清单（preloadLogoCache 拉取），build 构造候选 URL */
const ONLINE_LOGO_LIBRARIES: Array<{
  key: keyof LogoLibrary;
  build: (logoName: string) => string;
}> = [
  // fanmingming/live：中文台标最全（tv/ 目录 900+），直连免费，GitHub Actions 自动更新
  { key: 'fanmingming', build: (n) => `https://live.fanmingming.cn/tv/${encodeURIComponent(n)}.png` },
  // wanglindl/TVlogo：GitHub 直链（项目 data/iptv.m3u 本地测试数据同库）
  { key: 'wanglindl', build: (n) => `https://raw.githubusercontent.com/wanglindl/TVlogo/main/img/${encodeURIComponent(n)}.png` },
];

/** 台标库文件名清单（内存态，preloadLogoCache 填充）；null = 未就绪（降级为不预判） */
let logoLibrary: { fanmingming: Set<string>; wanglindl: Set<string> } | null = null;

/** 在线台标库候选 URL（不含 M3U/EPG 来源）。清单就绪时先预判「库里有没有」再拼 URL。 */
export function buildLogoUrlCandidates(name: string): string[] {
  const logoName = toLogoName(name);
  if (!logoName) return [];
  return ONLINE_LOGO_LIBRARIES
    .filter(({ key }) => !logoLibrary || logoLibrary[key].has(logoName))
    .map(({ build }) => build(logoName));
}

/** 台标库清单预判内存态（仅测试用） */
export function __setLogoLibraryForTest(lib: { fanmingming: Set<string>; wanglindl: Set<string> } | null): void {
  logoLibrary = lib;
}

/** http 台标转安全 URL：https 原样；http 经 file-proxy 转 https，无代理则丢弃 */
function toSafeLogoUrl(url: string, proxyUrl?: string): string | null {
  if (/^https:/i.test(url)) return url;
  if (/^http:/i.test(url)) {
    const primary = getPrimaryIptvProxy(proxyUrl);
    if (!primary) return null; // https 部署下 http 图片会被混合内容拦截
    return `${primary}/file-proxy?url=${encodeURIComponent(url)}`;
  }
  return null;
}

/** session 级台标失败记忆：已失败 URL 不再进入候选链 */
const failedLogoUrls = new Set<string>();

/** 跨会话 URL 级成败记忆（preloadLogoCache 从 IndexedDB 恢复；防抖批量持久化） */
const logoState = new Map<string, LogoStateEntry>();

/** 防抖持久化成败记忆（批量合并高频 onError/onLoad 写入） */
let logoStateSaveTimer: number | null = null;
function scheduleSaveLogoState(): void {
  if (logoStateSaveTimer !== null) return;
  logoStateSaveTimer = window.setTimeout(() => {
    logoStateSaveTimer = null;
    const snapshot: Record<string, LogoStateEntry> = {};
    for (const [url, entry] of logoState) snapshot[url] = entry;
    void saveLogoState(snapshot);
  }, 800);
}

export function markLogoFailed(url: string): void {
  if (!url) return;
  failedLogoUrls.add(url);
  logoState.set(url, { ok: false, ts: Date.now() });
  scheduleSaveLogoState();
}

export function isLogoFailed(url: string): boolean {
  return failedLogoUrls.has(url);
}

/** 记录台标加载成功：优先复用（跨会话），并从失败记忆中移除 */
export function markLogoSucceeded(url: string): void {
  if (!url) return;
  failedLogoUrls.delete(url);
  logoState.set(url, { ok: true, ts: Date.now() });
  scheduleSaveLogoState();
}

/** 从 GitHub API 拉取台标库目录文件名清单（无扩展名）；任一步失败 throw（调用方降级） */
async function fetchLogoDirectory(apiUrl: string): Promise<string[]> {
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const items = await res.json() as Array<{ name?: string; type?: string }>;
  return items
    .filter((i) => i.type === 'file' && i.name)
    .map((i) => i.name!.replace(/\.(png|jpe?g|svg|webp)$/i, ''));
}

/**
 * 预载台标缓存（应用启动调用，不阻塞）：
 * 1. 台标库清单：IndexedDB 未过期 → 直接用；否则 GitHub API 拉取 → 写缓存 → 用。
 *    拉取失败保持未就绪 → 降级为「不预判直接猜」（旧行为），下次会话重试。
 * 2. 成败记忆：从 IndexedDB 恢复 ok/fail 状态到内存。
 * 模块级 guard：同一会话只执行一次。
 */
let preloadStarted = false;
export function preloadLogoCache(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  void (async () => {
    try {
      const cached = await loadLogoLibrary();
      if (cached) {
        logoLibrary = {
          fanmingming: new Set(cached.fanmingming),
          wanglindl: new Set(cached.wanglindl),
        };
      } else {
        const [fanmingming, wanglindl] = await Promise.all([
          fetchLogoDirectory('https://api.github.com/repos/fanmingming/live/contents/tv'),
          fetchLogoDirectory('https://api.github.com/repos/wanglindl/TVlogo/contents/img'),
        ]);
        logoLibrary = { fanmingming: new Set(fanmingming), wanglindl: new Set(wanglindl) };
        void saveLogoLibrary({ fanmingming, wanglindl });
      }
    } catch {
      // 清单拉取失败：保持 logoLibrary=null，猜测前不预判（与旧行为一致）
    }
    try {
      const state = await loadLogoState();
      if (state) {
        for (const [url, entry] of Object.entries(state)) {
          logoState.set(url, entry);
          if (entry.ok) failedLogoUrls.delete(url);
          else failedLogoUrls.add(url);
        }
      }
    } catch { /* 状态恢复失败不影响主流程 */ }
  })();
}

/** 清空内存台标缓存（供 clearAllCaches 调用，IndexedDB 侧由 clearLogoCache 处理） */
export function resetLogoCacheInMemory(): void {
  logoLibrary = null;
  logoState.clear();
  failedLogoUrls.clear();
}

/**
 * 生成频道台标候选 URL 列表（三级回退链，去重 + 过滤失败记忆 + 成功记忆优先）。
 * 返回空数组表示无任何可用候选（调用方走字母占位）。
 * 传入 epgIndex（预索引）时 EPG 匹配为 O(1) 查表；否则回退全量遍历。
 */
export function resolveChannelLogoCandidates(
  channel: Pick<IPTVChannel, 'name' | 'logo' | 'tvgId'>,
  epgChannels?: EPGChannelInfo[],
  proxyUrl?: string,
  epgIndex?: EPGChannelIndex
): string[] {
  let out: string[] = [];
  const push = (url: string | null | undefined) => {
    if (!url) return;
    const safe = toSafeLogoUrl(url, proxyUrl);
    if (safe && !failedLogoUrls.has(safe) && !out.includes(safe)) out.push(safe);
  };

  // 一级：M3U 自带 tvg-logo
  push(channel.logo);

  // 二级：EPG XMLTV <icon>（复用 EPG 频道匹配逻辑；优先走预索引 O(1) 匹配）
  if (epgIndex) {
    const matched = matchEPGChannelIndexed(channel.name, channel.tvgId, epgIndex);
    push(matched?.icon);
  } else if (epgChannels && epgChannels.length > 0) {
    const matched = matchEPGChannel(channel.name, channel.tvgId, epgChannels);
    push(matched?.icon);
  }

  // 三级：在线台标库按名拼 URL（清单预判过滤库外频道）
  for (const url of buildLogoUrlCandidates(channel.name)) push(url);

  // 零级：跨会话成功记忆——只对【当前频道候选链内】的 URL 排序，ok 的提到最前优先复用。
  // 注意：绝不引入其他频道的记忆 URL。旧实现遍历全局 logoState，把任意频道成功过的
  // URL 塞进所有频道的候选最前——频道 B 会优先加载频道 A 的台标，这是「串台」根因。
  const remembered: string[] = [];
  for (const url of out) {
    if (logoState.get(url)?.ok) remembered.push(url);
  }
  if (remembered.length > 0) {
    const rest = out.filter((url) => !remembered.includes(url));
    out = [...remembered, ...rest];
  }

  return out;
}
