/**
 * 一键清除全部缓存
 *
 * 聚合清理所有「可重新获取的缓存数据」，不触碰用户数据：
 * - 用户数据（设置 / 收藏 / 历史 / 播放历史 / 收藏频道 / 搜索历史）**绝不删除**
 * - 仅清除：IndexedDB 频道/EPG 缓存、localStorage 源检测/筛选记忆缓存、
 *   内存 TMDB 首页数据、IPTV 频道列表、图片会话缓存
 *
 * 被清除的数据均可在下一次页面访问时自动重新拉取。
 */
// 直接导入具体 store，避免经 @/stores barrel（与 SourceChecker 等经 barrel 导入 useIPTVStore 形成循环依赖，产生构建 warning）
import { useTMDBStore } from '@/stores/useTMDBStore';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { clearIPTVChannelCache, clearEPGCache, clearLogoCache } from '@/services/database';
import { resetLogoCacheInMemory } from '@/services/channelLogo';
import { clearImageCache } from '@/components/LazyImage/imageCache';

/** localStorage 中可安全清除的缓存 key（固定 key） */
const CACHE_LS_KEYS = [
  'source-checker-cache',      // 源检测结果（30min 过期缓存）
  '__vw_browse-filter-memo',   // Browse 移动端筛选记忆
  'home-active-category',      // 旧版首页类目视图残留（已删除的桌面侧边栏写入）
];

/** localStorage key 前缀：按前缀扫描删除，覆盖历史遗留的首页类目缓存（home-cat-*）。
 *  旧实现枚举 categoryConfig 的 key 名；配置删除后改为前缀扫描，避免漏删历史数据。 */
const CACHE_LS_PREFIXES = ['home-cat-'];

/** 按前缀收集待删除 key（先快照再删，避免边遍历边删除导致索引错位） */
function collectByPrefix(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && CACHE_LS_PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
  }
  return keys;
}

export async function clearAllCaches(): Promise<void> {
  // ── 1. IndexedDB：频道缓存 + EPG 缓存 + 台标缓存（不动收藏/历史仓库） ──
  await Promise.all([clearIPTVChannelCache(), clearEPGCache(), clearLogoCache()]);

  // 台标内存缓存（库清单预判 + 成败记忆）
  resetLogoCacheInMemory();

  // ── 2. localStorage：固定 key + 前缀匹配 key（home-cat-*） ──
  for (const key of [...CACHE_LS_KEYS, ...collectByPrefix()]) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  // ── 3. 内存 store：清空首页 8 区块 + IPTV 频道列表（保留设置/收藏/历史） ──
  useTMDBStore.getState().clearHomeData();
  useIPTVStore.getState().clearChannelsCache();

  // ── 4. 图片会话缓存 ──
  clearImageCache();
}
