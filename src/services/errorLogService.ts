/**
 * 错误日志收集服务（2026-10-11 新增）
 * ─────────────────────────────────────────────────────────────
 * 用途：本地记录 JS 运行错误、未处理 Promise、接口（HTTP/超时）错误，
 * 供「设置 → 个人设置 → 错误日志」弹窗查看与一键清除，帮助排查与维护项目。
 *
 * 设计约束：
 *  · 纯 localStorage 存储（key: kino-error-logs），上限 MAX_ENTRIES 条，超出丢最旧；
 *    本服务不依赖任何其它 service（避免循环 import），httpClient/videoService 单向调用它。
 *  · 防风暴去重：同 (kind+source+message) 指纹在 DEDUP_WINDOW_MS 内只保留一条并累加 count，
 *    避免坏网下重试机制把日志刷爆。
 *  · 写入/读取全程 try-catch —— 日志本身绝不能再产生未捕获错误。
 *  · 订阅：window CustomEvent('kino:error-logs')，同文档内即时刷新（设置页弹窗消费）。
 */

export type ErrorLogKind = 'js' | 'promise' | 'api';

export interface ErrorLogEntry {
  /** 稳定 id（ts+随机数即可，React key 用） */
  id: string;
  /** 记录时间（Unix ms） */
  ts: number;
  kind: ErrorLogKind;
  /** 来源：js/promise = 文件:行；api = 请求 URL（host+path，query 截断） */
  source: string;
  /** 错误信息（截断至 500 字符） */
  message: string;
  /** 去重窗口内累计次数 */
  count: number;
}

const STORAGE_KEY = 'kino-error-logs';
const MAX_ENTRIES = 300;
const DEDUP_WINDOW_MS = 5000;
const MESSAGE_MAX = 500;
export const ERROR_LOGS_EVENT = 'kino:error-logs';

let installed = false;

function readLogs(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // 防御性校验：只接受形状正确的条目（旧版本/手改存储不至于让面板崩）
    return arr.filter(
      (e): e is ErrorLogEntry =>
        !!e && typeof e === 'object' &&
        typeof (e as ErrorLogEntry).ts === 'number' &&
        typeof (e as ErrorLogEntry).message === 'string',
    );
  } catch {
    return [];
  }
}

function writeLogs(list: ErrorLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
    window.dispatchEvent(new CustomEvent(ERROR_LOGS_EVENT));
  } catch {
    /* 配额满 / 隐私模式禁用存储：静默放弃，日志功能绝不影响主流程 */
  }
}

/** url 只留 host+path，query（含 wd= 搜索词等）截断，避免存敏感/超长串 */
function compactSource(url: string): string {
  try {
    const u = new URL(url, location.href);
    const qs = u.search ? `?${u.search.slice(1, 60)}` : '';
    return `${u.host}${u.pathname}${qs}`;
  } catch {
    return url.slice(0, 100);
  }
}

/** 追加一条错误日志（含去重累加）；供全局捕获与 httpClient 等基础设施调用 */
export function addErrorLog(kind: ErrorLogKind, source: string, message: string): void {
  const msg = (message || '').slice(0, MESSAGE_MAX);
  const src = kind === 'api' ? compactSource(source || '') : (source || '').slice(0, 160);
  const now = Date.now();
  try {
    const list = readLogs();
    const dup = list.find(
      e => e.kind === kind && e.source === src && e.message === msg && now - e.ts < DEDUP_WINDOW_MS,
    );
    if (dup) {
      dup.count += 1;
      writeLogs(list);
      return;
    }
    list.unshift({
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      ts: now,
      kind,
      source: src,
      message: msg,
      count: 1,
    });
    writeLogs(list);
  } catch { /* ignore */ }
}

/** 接口错误上报入口（httpClient 拦截器等基础设施单向依赖，避免循环 import） */
export function reportApiError(url: string, message: string): void {
  addErrorLog('api', url, message);
}

export function getErrorLogs(): ErrorLogEntry[] {
  return readLogs();
}

export function clearErrorLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(ERROR_LOGS_EVENT));
  } catch { /* ignore */ }
}

/** 订阅日志变化（写入/清除后触发），返回取消函数 */
export function subscribeErrorLogs(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(ERROR_LOGS_EVENT, handler);
  return () => window.removeEventListener(ERROR_LOGS_EVENT, handler);
}

/**
 * 安装全局错误捕获（main.tsx 尽早调用，幂等）：
 *  · error            —— JS 运行时错误（含跨域脚本的 "Script error." 也记录，便于定位）
 *  · unhandledrejection —— 未处理的 Promise 拒绝（fetch 封装漏 catch 的场景多在此暴露）
 * 资源加载错误（img/script onerror 捕获阶段）暂不记录：量大且多为封面外链 404 类噪声，
 * 如需可后续加开关。
 */
export function installErrorCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e: ErrorEvent) => {
    // JS 运行错误的 target 恒为 window；img/script 资源加载错误 target 是元素（不带有效 message），跳过
    if (e.target !== window) return;
    const where = e.filename ? `${e.filename.split('/').slice(-2).join('/')}:${e.lineno || 0}` : 'window';
    const detail = e.error?.stack ? String(e.error.stack).slice(0, MESSAGE_MAX) : (e.message || 'unknown error');
    addErrorLog('js', where, detail);
  });
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const r = e.reason;
    const message = r instanceof Error ? (r.stack ? String(r.stack).slice(0, MESSAGE_MAX) : r.message) : String(r ?? 'unknown rejection');
    addErrorLog('promise', 'unhandledrejection', message);
  });
}
