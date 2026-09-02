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
 * 打开数据库（含超时保护与阻塞处理），返回成功打开的实例。
 *
 * 升级被旧连接阻塞时（多页签场景），openDB 请求会挂起直到旧连接关闭。
 * 设计要点：
 *  - 超时 reject 后调用方放弃，但不尝试取消请求（无法取消）——迟到的成功连接
 *    会在此处立即关闭（孤儿连接回收），避免无主连接永久占住 DB 版本，
 *    导致后续版本升级再次被「孤儿」blocked（自我延续的坑）。
 *  - blocking() 回调 = 本页是「旧连接」（另一页签正以更高版本升级同一 DB，
 *    即 versionchange 事件）。此时自动关闭本连接放行升级；后续 DB 操作
 *    会以新版本自动重连。提示打在真正该处理的旧页签，而非新页签。
 */
async function openWithTimeout(): Promise<IDBPDatabase<VideoWarehouseDB>> {
  const openPromise = openDB<VideoWarehouseDB>(DB_NAME, DB_VERSION, {    upgrade(db) {
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
    blocking() {
      // 旧页签收到 versionchange：本连接阻塞了新版本升级。
      // 静默让路（关闭自身连接放行），不打扰用户；下次 DB 操作以新版本重连。
      console.info('[DB] 本页持有旧版数据库连接，正在自动关闭以放行新版本升级');
      closeDatabase();
    },
    terminated() {
      // 连接被意外终止（如浏览器隐私模式），允许下次重新初始化
      closeDatabase();
    },
  });

  // 孤儿连接回收：仅在本次尝试失败（通常为超时）后挂接——
  // 若 openDB 迟到成功（阻塞它的旧连接刚好关闭），该连接无人认领，
  // 立即关闭，避免无主连接永久占住 DB 版本、阻塞后续升级。
  // （不能提前挂：会先于 dbInstance 赋值执行，误关正常赢家连接。）

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('[DB] openDB 超时：可能被旧页面连接阻塞，请刷新页面')),
      DB_OPEN_TIMEOUT,
    );
  });

  try {
    return await Promise.race([openPromise, timeoutPromise]);
  } catch (err) {
    openPromise
      .then((db) => {
        try { db.close(); } catch { /* 已关闭 */ }
      })
      .catch(() => { /* openPromise 自身也失败（如隐私模式），忽略 */ });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** 进行中的开库尝试（单飞）：并发调用共享同一次 openDB，失败后清空允许下次重试 */
let dbOpenPromise: Promise<IDBPDatabase<VideoWarehouseDB>> | null = null;

/**
 * 关闭当前连接并清空单例状态。
 * 调用方（blocking 让路 / terminated / 测试重置）需确保没有其它进行中的事务。
 * 关闭后下次 getDB/initDB 会以当前 DB_VERSION 自动重开。
 */
export function closeDatabase(): void {
  try {
    dbInstance?.close();
  } catch { /* 已关闭 */ }
  dbInstance = null;
  dbOpenPromise = null;
}

/**
 * 初始化数据库，创建对象仓库和索引
 * 单例 + 单飞：全局同时最多一次 openDB 尝试，杜绝「超时重试叠层」——
 * 旧实现失败后 dbInstance 仍为 null，getDB 的 catch 再调 initDB 会再等一个 6s
 * （一次操作链 12s），且每次重试都留下一枚超时无法取消的孤儿连接。
 */
export async function initDB(): Promise<IDBPDatabase<VideoWarehouseDB>> {
  if (dbInstance) return dbInstance;
  if (!dbOpenPromise) {
    const attempt = openWithTimeout();
    // 先挂成功链（写入 dbInstance），再挂孤儿回收——保证正常路径不会误关赢家连接
    dbOpenPromise = attempt
      .then((db) => {
        dbInstance = db;
        return db;
      })
      .catch((err) => {
        dbOpenPromise = null; // 失败后允许下次调用重试（如用户已关闭阻塞页签）
        throw err;
      });
  }
  return dbOpenPromise;
}

/**
 * 获取数据库实例，未初始化时自动初始化
 * 连接关闭（blocking 让路 / terminated）后自动以新版本重连
 */
export async function getDB(): Promise<IDBPDatabase<VideoWarehouseDB>> {
  return initDB();
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

/** 收藏主键收敛：同一 videoId 全局唯一一条，id 统一为 `col-{videoId}`。
 *  旧实现 id 为 `col-{timestamp}-{random}`（随机主键），跨页签并发收藏时
 *  两页签内存各自判定「未收藏」→ IndexedDB 出现两条同 videoId 记录。
 *  改为确定性主键后，db.put 天然幂等覆盖（含跨页签），DB 层不可能再出现双记录。
 *  页面层语义（每 videoId 一条，Collections/index.tsx 以 videoId 作 key）与此一致。 */
function collectionCanonicalId(videoId: string): string {
  return `col-${videoId}`;
}

/**
 * 获取所有收藏记录，按添加时间倒序排列
 * 附带「惰性收敛」：历史上遗留的随机 id / 同 videoId 双记录在读取时自愈——
 * 每组 videoId 保留 addedAt 最新一条并重键为 col-{videoId}，其余删除。
 */
export async function getCollections(): Promise<CollectionRecord[]> {
  try {
    const db = await getDB();
    const all = await db.getAll('collections');

    // 快路径：快照已满足约束（全部为 col-{videoId} 且无同 videoId 重复）→ 直接返回
    const canonicalIds = new Set<string>();
    let needsHeal = false;
    for (const c of all) {
      const cid = collectionCanonicalId(c.videoId);
      if (c.id !== cid || canonicalIds.has(cid)) { needsHeal = true; break; }
      canonicalIds.add(cid);
    }
    if (!needsHeal) return all.sort((a, b) => b.addedAt - a.addedAt);

    // 自愈：按 videoId 分组 → 组内保留 addedAt 最新一条重键为 col-{videoId}，删除其余原 id
    const groups = new Map<string, CollectionRecord[]>();
    for (const c of all) {
      const g = groups.get(c.videoId);
      if (g) g.push(c);
      else groups.set(c.videoId, [c]);
    }

    const healed: CollectionRecord[] = [];
    const tx = db.transaction('collections', 'readwrite');
    for (const [videoId, recs] of groups) {
      const cid = collectionCanonicalId(videoId);
      let best = recs[0];
      for (const r of recs) {
        if (r.addedAt > best.addedAt) best = r;
      }
      // 唯一合法值写入；随后删除组内所有非 col-{videoId} 的旧 id
      await tx.store.put({ ...best, id: cid });
      healed.push({ ...best, id: cid });
      for (const r of recs) {
        if (r.id !== cid) await tx.store.delete(r.id);
      }
    }
    await tx.done;

    return healed.sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

/** 添加收藏记录（id 由 videoId 派生，幂等覆盖，跨页签安全） */
export async function addCollectionRecord(record: CollectionRecord): Promise<void> {
  try {
    const db = await getDB();
    await db.put('collections', { ...record, id: collectionCanonicalId(record.videoId) });
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

/**
 * 批量更新观看历史（节流 flush 专用）。
 * 跨页签守卫：写前读取 DB 现值，仅当本地记录不比 DB 新（updatedAt 较新）才写入，
 * 否则跳过。防止「关页签 pagehide flush / 残留旧脏记录」用过期进度覆盖另一页签
 * 刚写入的新进度。
 */
export async function upsertHistoryRecords(records: HistoryRecord[]): Promise<void> {
  if (records.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('history', 'readwrite');
  for (const r of records) {
    const cur = await tx.store.get(r.id);
    if (!cur || r.updatedAt >= cur.updatedAt) {
      await tx.store.put(r);
    }
  }
  await tx.done;
}

/** 删除观看历史记录（按 id） */
export async function removeHistoryRecord(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('history', id);
  } catch { /* 删除失败不影响主流程 */ }
}
