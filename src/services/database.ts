/**
 * IndexedDB 数据库服务
 * 提供本地数据持久化操作，包括视频记录的增删查和观看历史管理
 * 使用 idb 库封装 IndexedDB 操作，支持事务和索引查询
 */
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { CollectionRecord, HistoryRecord } from '@/types/store';
import type { IPTVChannel, IPTVGroup } from '@/types/iptv';

const DB_NAME = 'video-warehouse';
const DB_VERSION = 8;

/**
 * 数据库 Schema 定义
 * 包含 videos、collections、history、iptvChannels 四个对象仓库
 */
interface VideoWarehouseDB extends DBSchema {
  collections: {
    key: string;
    value: CollectionRecord;
    indexes: {
      'by-video': string;
    };
  };
  history: {
    key: string;
    value: HistoryRecord;
    indexes: {
      'by-video': string;
      'by-updated': number;
    };
  };
  settings: {
    key: string;
    value: unknown;
  };
  iptvChannels: {
    key: string;
    value: {
      key: string;
      channels: IPTVChannel[];
      groups: IPTVGroup[];
      sourceType: string;
      timestamp: number;
      sourceUrls: string[];
    };
  };
}

export interface IPTVCacheData {
  channels: IPTVChannel[];
  groups: IPTVGroup[];
  sourceType: string;
  timestamp: number;
  sourceUrls: string[];
}

let dbInstance: IDBPDatabase<VideoWarehouseDB> | null = null;

/**
 * openDB 超时保护：版本升级（如 6→7）时若旧页面/其它标签页仍握着同一 IndexedDB
 * 连接，openDB 会触发 blocked 并永久挂起，导致整页卡在 loading。
 * 超时后主动 reject，让上层回退为空数据，保证应用可继续渲染。
 */
const DB_OPEN_TIMEOUT = 6000;

/** EPG 缓存清除：删除 settings 仓库中的三个 EPG 缓存 key */
export async function clearEPGCache(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('settings', 'readwrite');
    await Promise.all([
      tx.store.delete('epg-cache-data'),
      tx.store.delete('epg-cache-urls'),
      tx.store.delete('epg-cache-time'),
      tx.done,
    ]);
  } catch { /* 缓存清除失败不影响主流程 */ }
}

/** 台标缓存清除：删除 settings 仓库中的台标库清单与成败记忆两个 key */
export async function clearLogoCache(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('settings', 'readwrite');
    await Promise.all([
      tx.store.delete('logo-library'),
      tx.store.delete('logo-state'),
      tx.done,
    ]);
  } catch { /* 缓存清除失败不影响主流程 */ }
}

/** IPTV 频道缓存清除：清空 iptvChannels 对象仓库 */
export async function clearIPTVChannelCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('iptvChannels');
  } catch { /* 缓存清除失败不影响主流程 */ }
}

/**
 * 初始化数据库，创建对象仓库和索引
 * 使用单例模式确保全局只有一个数据库实例
 */
export async function initDB(): Promise<IDBPDatabase<VideoWarehouseDB>> {
  if (dbInstance) return dbInstance;

  const openPromise = openDB<VideoWarehouseDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('collections')) {
        const collectionStore = db.createObjectStore('collections', { keyPath: 'id' });
        collectionStore.createIndex('by-video', 'videoId');
      }

      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'id' });
        historyStore.createIndex('by-video', 'videoId');
        historyStore.createIndex('by-updated', 'updatedAt');
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('iptvChannels')) {
        db.createObjectStore('iptvChannels', { keyPath: 'key' });
      }

      // v7: 移除已废弃的 ratings 对象仓库（评分功能已下线）
      if ((db as IDBPDatabase).objectStoreNames.contains('ratings')) {
        (db as IDBPDatabase).deleteObjectStore('ratings');
      }

      // v8: 移除已废弃的 videos 对象仓库（importVideos 从未被调用，无任何数据）
      if ((db as IDBPDatabase).objectStoreNames.contains('videos')) {
        (db as IDBPDatabase).deleteObjectStore('videos');
      }

      // v3-v5: 新增可选字段（backdrop, episodeLabel），无需 schema 变更
    },
    blocked() {
      console.warn('[DB] database open blocked — 升级被旧连接阻塞，请关闭其它标签页后刷新');
    },
    terminated() {
      // 连接被意外终止（如浏览器隐私模式），允许下次重新初始化
      dbInstance = null;
    },
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('[DB] openDB 超时：可能被旧页面连接阻塞，请刷新页面')),
      DB_OPEN_TIMEOUT,
    ),
  );

  dbInstance = await Promise.race([openPromise, timeoutPromise]);
  return dbInstance;
}

/**
 * 获取数据库实例，未初始化时自动初始化
 * 包含连接关闭时自动重连
 */
export async function getDB(): Promise<IDBPDatabase<VideoWarehouseDB>> {
  try {
    if (!dbInstance) {
      return initDB();
    }
    return dbInstance;
  } catch {
    dbInstance = null;
    return initDB();
  }
}

/**
 * 获取所有观看历史，按更新时间倒序排列
 */
export async function getHistory(): Promise<HistoryRecord[]> {
  const db = await getDB();
  const all = await db.getAll('history');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 清空所有观看历史记录 */
export async function clearHistory(): Promise<void> {
  const db = await getDB();
  await db.clear('history');
}

/**
 * IPTV 频道缓存操作
 */
const IPTV_CACHE_KEY = 'iptv-channels';
const IPTV_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时缓存

/** 从缓存获取 IPTV 频道数据，验证过期时间和源 URL 一致性 */
export async function getCachedIPTVChannels(sourceUrls: string[]): Promise<IPTVCacheData | null> {
  try {
    const db = await getDB();
    const cached = await db.get('iptvChannels', IPTV_CACHE_KEY);
    if (!cached) return null;

    // 检查缓存是否过期
    if (Date.now() - cached.timestamp > IPTV_CACHE_TTL) {
      return null;
    }

    // 检查源 URL 是否变化（保持顺序严格比较）。
    // 此前用 sort() 排序后比较只比对 URL 集合、忽略顺序，导致「源顺序调整但集合相同」
    // 时缓存误命中，而频道 sourceId 依赖刷新时刻的 URL 下标 → sourceId 与顺序错位。
    // 改为保持顺序比较：源顺序一变即视为缓存失效，触发网络刷新，保证 sourceId 与新顺序一致。
    const cachedUrlsStr = JSON.stringify(cached.sourceUrls);
    const currentUrlsStr = JSON.stringify([...sourceUrls]);
    if (cachedUrlsStr !== currentUrlsStr) {
      return null;
    }

    return {
      channels: cached.channels,
      groups: cached.groups,
      sourceType: cached.sourceType,
      timestamp: cached.timestamp,
      sourceUrls: cached.sourceUrls,
    };
  } catch { /* 缓存读取或数据格式异常时返回 null */ return null; }
}

/** 将 IPTV 频道数据写入缓存 */
export async function setCachedIPTVChannels(data: IPTVCacheData): Promise<void> {
  try {
    const db = await getDB();
    await db.put('iptvChannels', {
      key: IPTV_CACHE_KEY,
      channels: data.channels,
      groups: data.groups,
      sourceType: data.sourceType,
      timestamp: data.timestamp,
      sourceUrls: data.sourceUrls,
    });
  } catch { /* 缓存写入失败不影响主流程 */ }
}

// ── 收藏操作 ──────────────────────────────────────────────

/** 获取所有收藏记录，按添加时间倒序排列 */
export async function getCollections(): Promise<CollectionRecord[]> {
  try {
    const db = await getDB();
    const all = await db.getAll('collections');
    return all.sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

/** 添加收藏记录 */
export async function addCollectionRecord(record: CollectionRecord): Promise<void> {
  try {
    const db = await getDB();
    await db.put('collections', record);
  } catch { /* 写入失败不影响主流程 */ }
}

/** 删除收藏记录（按 videoId） */
export async function removeCollectionByVideoId(videoId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('collections', 'readwrite');
    const index = tx.store.index('by-video');
    let cursor = await index.openCursor(videoId);
    while (cursor) {
      cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch { /* 删除失败不影响主流程 */ }
}

/** 清空所有收藏记录 */
export async function clearCollections(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('collections');
  } catch { /* 清空失败不影响主流程 */ }
}

// ── 观看历史操作 ──────────────────────────────────────────

/** 更新或新增观看历史记录 */
export async function upsertHistoryRecord(record: HistoryRecord): Promise<void> {
  try {
    const db = await getDB();
    await db.put('history', record);
  } catch { /* 写入失败不影响主流程 */ }
}

/** 删除观看历史记录（按 id） */
export async function removeHistoryRecord(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('history', id);
  } catch { /* 删除失败不影响主流程 */ }
}
