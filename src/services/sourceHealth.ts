import { useSettingsStore } from '@/stores/useSettingsStore';

/**
 * CMS 源健康度（纯本地、零额外请求）
 *
 * 数据来源 = 真实请求结果的副产品：聚合探测命中记成功，**网络类失败**（超时/限流/异常）
 * 记失败；业务「未找到匹配资源」不计（只是这部片该源没有，源本身健康）。
 *
 * 用途（全部不阻断、不影响可用性）：
 * - 聚合池排序：连续失败 ≥ DEGRADE_THRESHOLD 的源排到后面（仍照常请求）；
 * - 面板标注：源名降一档透明度 + title 提示。
 *
 * 失效策略：30 天衰减 + 代理配置指纹（换代理/换网络后旧统计自动作废）。
 */
const STORAGE_KEY = 'kinotv-source-health';
/** 记录保留时长（30 天） */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** 连续网络失败达到该次数即视为「最近不可用」 */
const DEGRADE_THRESHOLD = 2;
/** 写入节流：一次聚合可能连续记录多个源，合并成一次 localStorage 写 */
const FLUSH_DELAY_MS = 500;

interface HealthEntry {
  /** 最近一次成功时间 */
  okAt?: number;
  /** 最近一次网络类失败时间 */
  failAt?: number;
  /** 连续网络失败次数（成功即清零） */
  failStreak: number;
  /** 记录时的代理配置指纹 */
  proxySig: string;
}

type HealthMap = Record<string, HealthEntry>;

let cache: HealthMap | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** 代理配置指纹：换代理后旧统计不再适用 */
function proxySig(): string {
  try {
    return useSettingsStore.getState().corsProxy || '';
  } catch {
    return '';
  }
}

function prune(map: HealthMap): HealthMap {
  const now = Date.now();
  const sig = proxySig();
  const next: HealthMap = {};
  for (const [id, e] of Object.entries(map)) {
    if (e.proxySig !== sig) continue;
    const lastAt = Math.max(e.okAt ?? 0, e.failAt ?? 0);
    if (lastAt === 0 || now - lastAt > TTL_MS) continue;
    next[id] = e;
  }
  return next;
}

function load(): HealthMap {
  if (cache) return cache;
  let raw: HealthMap = {};
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as HealthMap;
  } catch {
    raw = {};
  }
  cache = prune(raw);
  return cache;
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      if (cache) localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch {
      /* 隐私模式/超额：静默放弃，健康度退化为会话内 */
    }
  }, FLUSH_DELAY_MS);
}

/**
 * 记录一次源请求结果。
 * @param ok true = 命中且有可播内容；false = 网络类失败（业务「未找到」不要调用本函数）
 */
export function recordSourceResult(sourceId: string | undefined, ok: boolean): void {
  if (!sourceId) return;
  const map = load();
  const sig = proxySig();
  const entry = map[sourceId];
  if (ok) {
    map[sourceId] = { okAt: Date.now(), failAt: entry?.failAt, failStreak: 0, proxySig: sig };
  } else {
    map[sourceId] = {
      okAt: entry?.okAt,
      failAt: Date.now(),
      failStreak: (entry?.failStreak ?? 0) + 1,
      proxySig: sig,
    };
  }
  scheduleFlush();
}

/** 该源是否「最近不可用」（连续网络失败 ≥ 2 且在有效期内）。无记录 = false。 */
export function isSourceDegraded(sourceId?: string): boolean {
  if (!sourceId) return false;
  const entry = load()[sourceId];
  if (!entry) return false;
  if (entry.failStreak < DEGRADE_THRESHOLD) return false;
  if (Date.now() - (entry.failAt ?? 0) > TTL_MS) return false;
  return true;
}

/** 把索引列表按健康度稳定排序：健康源保持原顺序在前，标记为不可用的源整体后移。 */
export function orderIndicesByHealth(indices: number[], sourceIdAt: (idx: number) => string | undefined): number[] {
  const healthy: number[] = [];
  const degraded: number[] = [];
  for (const idx of indices) {
    (isSourceDegraded(sourceIdAt(idx)) ? degraded : healthy).push(idx);
  }
  return degraded.length === 0 ? indices : [...healthy, ...degraded];
}
