/**
 * 台标缓存持久化通道（IndexedDB settings 仓库，零 schema 变更）
 *
 * 存储两类可复用数据（与「收藏/历史」用户数据隔离，可被 clearAllCaches 安全清除）：
 * - logo-library：在线台标库文件名清单（fanmingming tv/ + wanglindl img/），TTL 7 天。
 *   猜测前本地预判「库里有没有」，库外频道不再发起注定 404 的请求。
 * - logo-state：URL 级成败记忆（跨会话）。ok 的 URL 直接复用、fail 的 URL 不再请求，
 *   避免每次刷新后对同一批无效台标重复发起请求。
 *
 * 所有读写失败静默降级（返回 null / no-op），不影响台标解析主流程。
 */
import { getDB } from './database';

/** 台标库文件名清单（无扩展名的规范化文件名） */
export interface LogoLibrary {
  fanmingming: string[];
  wanglindl: string[];
}

/** URL 级台标状态 */
export interface LogoStateEntry {
  /** true=上次加载成功（可复用），false=失败（不再请求） */
  ok: boolean;
  /** 记录时间戳（ms），用于 TTL 过期校验 */
  ts: number;
}

const LOGO_LIBRARY_KEY = 'logo-library';
const LOGO_STATE_KEY = 'logo-state';
const LOGO_LIBRARY_TTL = 7 * 24 * 60 * 60 * 1000; // 台标清单 7 天
const LOGO_STATE_TTL = 30 * 24 * 60 * 60 * 1000;  // 成败记忆 30 天

/** 读取台标库清单；缺失/过期/异常返回 null（调用方触发重新拉取） */
export async function loadLogoLibrary(): Promise<LogoLibrary | null> {
  try {
    const db = await getDB();
    const cached = await db.get('settings', LOGO_LIBRARY_KEY) as
      | ({ timestamp: number } & LogoLibrary)
      | undefined;
    if (!cached) return null;
    if (Date.now() - cached.timestamp > LOGO_LIBRARY_TTL) return null;
    return { fanmingming: cached.fanmingming ?? [], wanglindl: cached.wanglindl ?? [] };
  } catch {
    return null;
  }
}

/** 写入台标库清单 */
export async function saveLogoLibrary(lib: LogoLibrary): Promise<void> {
  try {
    const db = await getDB();
    await db.put('settings', { key: LOGO_LIBRARY_KEY, ...lib, timestamp: Date.now() });
  } catch { /* 写入失败不影响主流程 */ }
}

/** 读取 URL 级成败记忆；缺失/过期/异常返回 null */
export async function loadLogoState(): Promise<Record<string, LogoStateEntry> | null> {
  try {
    const db = await getDB();
    const cached = await db.get('settings', LOGO_STATE_KEY) as
      | ({ timestamp: number; entries: Record<string, LogoStateEntry> })
      | undefined;
    if (!cached) return null;
    if (Date.now() - cached.timestamp > LOGO_STATE_TTL) return null;
    return cached.entries ?? null;
  } catch {
    return null;
  }
}

/** 写入 URL 级成败记忆（全量快照，由 channelLogo 防抖批量调用） */
export async function saveLogoState(entries: Record<string, LogoStateEntry>): Promise<void> {
  try {
    const db = await getDB();
    await db.put('settings', { key: LOGO_STATE_KEY, entries, timestamp: Date.now() });
  } catch { /* 写入失败不影响主流程 */ }
}
