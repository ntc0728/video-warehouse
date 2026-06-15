/**
 * IndexedDB 数据库服务
 * 提供本地数据持久化操作，包括视频记录的增删查和观看历史管理
 * 使用 idb 库封装 IndexedDB 操作，支持事务和索引查询
 */
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { VideoRecord, CollectionRecord, HistoryRecord } from '@/types/store';
import type { IPTVChannel, IPTVGroup } from '@/types/iptv';

const DB_NAME = 'video-warehouse';
const DB_VERSION = 2;

/**
 * 数据库 Schema 定义
 * 包含 videos、collections、history、settings、iptvChannels 五个对象仓库
 */
interface VideoWarehouseDB extends DBSchema {
  videos: {
    key: string;
    value: VideoRecord;
    indexes: {
      'by-type': string;
      'by-year': number;
      'by-created': number;
    };
  };
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
 * 初始化数据库，创建对象仓库和索引
 * 使用单例模式确保全局只有一个数据库实例
 */
export async function initDB(): Promise<IDBPDatabase<VideoWarehouseDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<VideoWarehouseDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('videos')) {
        const videoStore = db.createObjectStore('videos', { keyPath: 'id' });
        videoStore.createIndex('by-type', 'type');
        videoStore.createIndex('by-year', 'year');
        videoStore.createIndex('by-created', 'createdAt');
      }

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
    },
  });

  return dbInstance;
}

/**
 * 获取数据库实例，未初始化时自动初始化
 */
export async function getDB(): Promise<IDBPDatabase<VideoWarehouseDB>> {
  if (!dbInstance) {
    return initDB();
  }
  return dbInstance;
}

export async function getAllVideos(): Promise<VideoRecord[]> {
  const db = await getDB();
  return db.getAll('videos');
}

export async function getVideo(id: string): Promise<VideoRecord | undefined> {
  const db = await getDB();
  return db.get('videos', id);
}

/**
 * 批量导入视频记录，使用事务确保原子性
 */
export async function importVideos(videos: VideoRecord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('videos', 'readwrite');
  await Promise.all([
    ...videos.map((video) => tx.store.put(video)),
    tx.done,
  ]);
}

/**
 * 获取所有观看历史，按更新时间倒序排列
 */
export async function getHistory(): Promise<HistoryRecord[]> {
  const db = await getDB();
  const all = await db.getAll('history');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function clearHistory(): Promise<void> {
  const db = await getDB();
  await db.clear('history');
}

/**
 * IPTV 频道缓存操作
 */
const IPTV_CACHE_KEY = 'iptv-channels';
const IPTV_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时缓存

export async function getCachedIPTVChannels(sourceUrls: string[]): Promise<IPTVCacheData | null> {
  try {
    const db = await getDB();
    const cached = await db.get('iptvChannels', IPTV_CACHE_KEY);
    if (!cached) return null;

    // 检查缓存是否过期
    if (Date.now() - cached.timestamp > IPTV_CACHE_TTL) {
      return null;
    }

    // 检查源 URL 是否变化
    const cachedUrlsStr = JSON.stringify(cached.sourceUrls.sort());
    const currentUrlsStr = JSON.stringify(sourceUrls.sort());
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
  } catch {
    return null;
  }
}

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
  } catch { /* ignore */ }
}
