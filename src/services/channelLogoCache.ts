/**
 * 台标缓存持久化通道（IndexedDB settings 仓库，零 schema 变更）
 *
 * 存储 URL 级成败记忆（跨会话，与「收藏/历史」用户数据隔离，可被 clearAllCaches 安全清除）：
 * ok 的 URL 直接复用、fail 的 URL 不再请求，避免每次刷新后对同一批无效台标重复发起请求。
 * 台标来源已定稿为 iptv-org logos.json 单一来源，旧「在线台标库清单」（logo-library）已下线。
 *
 * 所有读写失败静默降级（返回 null / no-op），不影响台标解析主流程。
 */
import { getDB } from './database';

/** URL 级台标状态 */
export interface LogoStateEntry {
  /** true=上次加载成功（可复用），false=失败（不再请求） */
  ok: boolean;
  /** 记录时间戳（ms），用于 TTL 过期校验 */
  ts: number;
}

const LOGO_STATE_KEY = 'logo-state';
const LOGO_STATE_TTL = 30 * 24 * 60 * 60 * 1000;  // 成败记忆 30 天

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
