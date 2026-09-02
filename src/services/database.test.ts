/**
 * database.ts 收敛/守卫逻辑单元测试
 * 覆盖三类修复（2026-09-02，跨页签 IDB 问题）：
 *  1. addCollectionRecord 确定性主键 col-{videoId} → 跨页签重复收藏幂等收敛
 *  2. getCollections 惰性收敛 → 遗留随机 id / 同 videoId 双记录自愈
 *  3. upsertHistoryRecords 保留 updatedAt 较新者 → 防旧脏 flush 覆盖新进度
 * 用 fake-indexeddb 提供真实 IndexedDB 语义（含主键/索引约束）。
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import {
  addCollectionRecord,
  closeDatabase,
  getCollections,
  upsertHistoryRecords,
} from './database';
import type { CollectionRecord, HistoryRecord } from '@/types/store';

/** 每个用例前重置：关闭模块连接（否则 fake-indexeddb 的 deleteDatabase 永远 blocked）→ 删库 */
beforeEach(async () => {
  closeDatabase();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('video-warehouse');
    const t = setTimeout(() => resolve(), 2000); // 兜底：fake-idb 个别事件不触发
    req.onsuccess = () => { clearTimeout(t); resolve(); };
    req.onerror = () => { clearTimeout(t); resolve(); };
    req.onblocked = () => { clearTimeout(t); resolve(); };
  });
});

/** 用独立连接绕过写入层归一化，直接播种「旧 bug」形态的原始数据。
 *  先调 getCollections 让模块按 DB_VERSION 建好库（删库后裸 openDB 会建出 v1 空库）。 */
async function seedRawCollections(rows: Array<{ id: string; videoId: string; addedAt: number; title?: string }>): Promise<void> {
  await getCollections();
  const raw = await openDB('video-warehouse') as any;
  const tx = raw.transaction('collections', 'readwrite');
  for (const r of rows) await tx.store.put(r);
  await tx.done;
  raw.close();
}

async function seedRawHistory(rows: Array<{ id: string; videoId: string; progress: number; updatedAt: number }>): Promise<void> {
  await getCollections();
  const raw = await openDB('video-warehouse') as any;
  const tx = raw.transaction('history', 'readwrite');
  for (const r of rows) await tx.store.put(r);
  await tx.done;
  raw.close();
}

async function rawCollectionsCount(): Promise<number> {
  const raw = await openDB('video-warehouse') as any;
  const all = await raw.getAll('collections');
  raw.close();
  return all.length;
}

async function rawHistoryGet(id: string): Promise<HistoryRecord | undefined> {
  const raw = await openDB('video-warehouse') as any;
  const cur = await raw.get('history', id);
  raw.close();
  return cur as HistoryRecord | undefined;
}

describe('database 收藏收敛', () => {
  it('addCollectionRecord：同 videoId 两次写入（模拟两页签并发）只留一条 col-{videoId}', async () => {
    await addCollectionRecord({ id: 'col-tab-a', videoId: 'tmdb-movie-1', addedAt: 100, title: 'A' } as CollectionRecord);
    await addCollectionRecord({ id: 'col-tab-b', videoId: 'tmdb-movie-1', addedAt: 200, title: 'B' } as CollectionRecord);

    const all = await getCollections();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('col-tmdb-movie-1');
    expect(all[0].title).toBe('B'); // 同主键 put 覆盖，后写胜出
    expect(await rawCollectionsCount()).toBe(1);
  });

  it('getCollections：遗留同 videoId 双随机 id 记录自愈为一条（保留 addedAt 较新者）', async () => {
    await seedRawCollections([
      { id: 'col-111-aaa', videoId: 'tmdb-movie-2', addedAt: 100, title: '旧' },
      { id: 'col-222-bbb', videoId: 'tmdb-movie-2', addedAt: 300, title: '新' },
    ]);

    const all = await getCollections();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('col-tmdb-movie-2');
    expect(all[0].title).toBe('新');
    // DB 内物理清理：不再残留随机 id 行
    expect(await rawCollectionsCount()).toBe(1);
  });

  it('getCollections：canonical 旧记录 + random 新记录混合时保留最新且键为 canonical', async () => {
    await seedRawCollections([
      { id: 'col-tmdb-movie-3', videoId: 'tmdb-movie-3', addedAt: 100, title: '旧规范' },
      { id: 'col-333-ccc', videoId: 'tmdb-movie-3', addedAt: 500, title: '新随机' },
    ]);

    const all = await getCollections();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('col-tmdb-movie-3');
    expect(all[0].title).toBe('新随机');
    expect(await rawCollectionsCount()).toBe(1);
  });

  it('getCollections：已全部规范化时走快路径，数据原样返回且不增删', async () => {
    await addCollectionRecord({ id: 'col-tmdb-movie-4', videoId: 'tmdb-movie-4', addedAt: 1, title: '甲' } as CollectionRecord);
    await addCollectionRecord({ id: 'col-tmdb-movie-5', videoId: 'tmdb-movie-5', addedAt: 2, title: '乙' } as CollectionRecord);

    const all = await getCollections();
    expect(all.map((c) => c.videoId).sort()).toEqual(['tmdb-movie-4', 'tmdb-movie-5']);
    expect(await rawCollectionsCount()).toBe(2);
  });
});

describe('database 历史 flush 守卫', () => {
  it('upsertHistoryRecords：DB 记录比本地新（updatedAt 更大）→ 跳过不覆盖', async () => {
    await seedRawHistory([{ id: 'hist-x', videoId: 'v', progress: 90, updatedAt: 2000 }]);

    // 本地脏记录是旧的（updatedAt 1000 < DB 2000）——典型「关页签 flush 过期进度」场景
    await upsertHistoryRecords([{ id: 'hist-x', videoId: 'v', progress: 5, updatedAt: 1000 } as HistoryRecord]);

    const cur = await rawHistoryGet('hist-x');
    expect(cur?.progress).toBe(90); // 未被旧进度回滚
    expect(cur?.updatedAt).toBe(2000);
  });

  it('upsertHistoryRecords：本地比 DB 新 / DB 无该记录 → 正常写入', async () => {
    await seedRawHistory([{ id: 'hist-y', videoId: 'v', progress: 30, updatedAt: 500 }]);

    await upsertHistoryRecords([
      { id: 'hist-y', videoId: 'v', progress: 60, updatedAt: 600, duration: 100 },   // 更新
      { id: 'hist-z', videoId: 'v', progress: 10, updatedAt: 700, duration: 100 },   // 新增
    ] as HistoryRecord[]);

    const y = await rawHistoryGet('hist-y');
    const z = await rawHistoryGet('hist-z');
    expect(y?.progress).toBe(60);
    expect(z?.progress).toBe(10);
  });

  it('upsertHistoryRecords：空数组直接返回（不建事务）', async () => {
    await expect(upsertHistoryRecords([])).resolves.toBeUndefined();
  });
});
