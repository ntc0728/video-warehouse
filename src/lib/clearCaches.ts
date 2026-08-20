/**
 * 一键清除全部缓存
 *
 * 聚合清理所有「可重新获取的缓存数据」，不触碰用户数据：
 * - 用户数据（设置 / 收藏 / 历史 / 播放历史 / 收藏频道 / 搜索历史）**绝不删除**
 * - 仅清除：IndexedDB 频道/EPG 缓存、localStorage 类目/源检测/筛选记忆缓存、
 *   内存 TMDB 首页数据、首页类目数据、图片会话缓存
 *
 * 被清除的数据均可在下一次页面访问时自动重新拉取。
 */
// 直接导入具体 store，避免经 @/stores barrel（与 SourceChecker 等经 barrel 导入 useIPTVStore 形成循环依赖，产生构建 warning）
import { useTMDBStore } from '@/stores/useTMDBStore';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { useHomeCategoryStore } from '@/stores/useHomeCategoryStore';
import { CATEGORY_CONFIG } from '@/pages/Home/categoryConfig';
import { clearIPTVChannelCache, clearEPGCache, clearLogoCache } from '@/services/database';
import { resetLogoCacheInMemory } from '@/services/channelLogo';
import { clearImageCache } from '@/components/LazyImage/imageCache';

/** localStorage 中可安全清除的缓存 key（类目缓存按前缀单独处理） */
const CACHE_LS_KEYS = [
  'source-checker-cache',      // 源检测结果（30min 过期缓存）
  '__vw_browse-filter-memo',   // Browse 移动端筛选记忆
];

export async function clearAllCaches(): Promise<void> {
  // ── 1. IndexedDB：频道缓存 + EPG 缓存 + 台标缓存（不动收藏/历史仓库） ──
  await Promise.all([clearIPTVChannelCache(), clearEPGCache(), clearLogoCache()]);

  // 台标内存缓存（库清单预判 + 成败记忆）
  resetLogoCacheInMemory();

  // ── 2. localStorage：固定 key + 首页类目 key（home-cat-*） ──
  for (const key of CACHE_LS_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
  for (const key of Object.keys(CATEGORY_CONFIG)) {
    try { localStorage.removeItem(`home-cat-${key}`); } catch { /* ignore */ }
  }

  // ── 3. 内存 store：清空首页 8 区块 + IPTV 频道列表（保留设置/收藏/历史） ──
  useTMDBStore.getState().clearHomeData();
  useIPTVStore.getState().clearChannelsCache();
  useHomeCategoryStore.getState().clearCache();

  // ── 4. 图片会话缓存 ──
  clearImageCache();
}
