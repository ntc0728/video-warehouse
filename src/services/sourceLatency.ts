/**
 * sourceLatency — 设置页"测速"工具
 *
 * [2026-08-07 源管理整改] 批量并发测速（限速 6），避免对源站/代理造成风暴。
 *
 * 设计：
 * - 测速用 axios + AbortController：直接请求源地址（不走 httpClient 拦截器，避开 corsProxy 注入），
 *   通过 AbortController 强制短超时（默认 8000ms），可手动 cancel。
 * - 限速：手写简易 p-limit（并发上限 6）。一批 Promise 同时启动，任意完成就从池里补一个。
 * - 返回 id → latency (ms|null) 映射；超时/失败为 null。
 * - 进度回调：每完成一个调用 onProgress(done, total)。
 */

import axios, { type AxiosRequestConfig } from 'axios';

export interface LatencyTask<TId = string> {
  id: TId;
  url: string;
  /** 自定义方法（默认 GET） */
  method?: 'GET' | 'HEAD';
  /** 自定义超时（默认 8000ms） */
  timeoutMs?: number;
}

export interface LatencyProgress {
  done: number;
  total: number;
}

export type LatencyResult<TId = string> = [TId, number | null];

/** 简易并发限速器（p-limit 风格）：同时最多 limit 个 in-flight */
function createLimiter(limit: number) {
  let inFlight = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (inFlight >= limit || queue.length === 0) return;
    inFlight++;
    const job = queue.shift()!;
    job();
  };
  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        queue.push(() => {
          fn().then(resolve, reject).finally(() => {
            inFlight--;
            next();
          });
        });
        next();
      });
    },
  };
}

/** 单源测速：返回延迟 ms（成功）或 null（超时/失败） */
export async function measureOne(
  url: string,
  options: { method?: 'GET' | 'HEAD'; timeoutMs?: number } = {},
): Promise<number | null> {
  const { method = 'HEAD', timeoutMs = 8000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    const config: AxiosRequestConfig = {
      method,
      url,
      signal: controller.signal,
      // HEAD 对很多源站不一定支持（CMS API 通常 GET 才有响应），失败时 GET 兜底
      validateStatus: () => true,
      // 不走 httpClient 拦截器：避免 corsProxy 默认注入 / 错误规范化干扰
      transformResponse: (d) => d,
    };
    await axios.request(config);
    return Math.round(performance.now() - t0);
  } catch {
    // HEAD 失败时回退一次 GET（部分源站禁 HEAD）
    if (method === 'HEAD') {
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), timeoutMs);
      try {
        const t1 = performance.now();
        await axios.request({
          method: 'GET',
          url,
          signal: controller2.signal,
          validateStatus: () => true,
          transformResponse: (d) => d,
        });
        return Math.round(performance.now() - t1);
      } catch {
        return null;
      } finally {
        clearTimeout(timer2);
      }
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 批量测速（并发限速 6）
 * - tasks 数量为 0 直接返回空
 * - onProgress 每完成一个调用（不保证顺序）
 * - 返回 Map<id, latency|null>
 */
export async function measureBatch<TId = string>(
  tasks: LatencyTask<TId>[],
  options: { concurrency?: number; onProgress?: (p: LatencyProgress) => void; defaultTimeoutMs?: number } = {},
): Promise<Map<TId, number | null>> {
  const concurrency = options.concurrency ?? 6;
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 8000;
  const result = new Map<TId, number | null>();
  if (tasks.length === 0) return result;

  const limiter = createLimiter(concurrency);
  let done = 0;
  const total = tasks.length;

  await Promise.all(
    tasks.map((task) =>
      limiter.run(async () => {
        const latency = await measureOne(task.url, {
          method: task.method,
          timeoutMs: task.timeoutMs ?? defaultTimeoutMs,
        });
        result.set(task.id, latency);
        done++;
        options.onProgress?.({ done, total });
      }),
    ),
  );
  return result;
}

/** 仅用于"取消所有"的 AbortController 集合（当前 measureOne 内部用，不暴露取消 API 简化） */
export function createLatencyAbortController(): AbortController {
  return new AbortController();
}
