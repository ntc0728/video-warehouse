/**
 * 公共 HTTP 客户端（基于 Axios）
 * 集中管理所有接口请求的：
 * - 请求拦截：CORS 代理 / 通用请求头 / 缓存破坏
 * - 响应拦截：错误规范化 / 重试
 */
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { useSettingsStore } from '@/stores';
import { isNativePlatform } from '@/lib/platform';
import type { RequestOptions } from '@/types/http';

// 为向后兼容重新导出类型
export type { CustomRequestConfig, RequestOptions } from '@/types/http';

// ============================================================
// 配置
// ============================================================

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRY_DELAY = 500;

// ============================================================
// CORS 代理
// ============================================================

/**
 * 获取 CORS 代理 URL
 *
 * 行为说明：
 * - 无 `/proxy` 时：追加 `/proxy?url=`
 * - 有 `/proxy` 但无 `url=` 时：根据尾部字符追加 `url=` 或 `?url=`
 * - 已有 `url=` 或 `url=%` 时：直接返回
 */
/**
 * 解析 CORS 代理为完整前缀列表（支持英文 ; 分隔多个代理）。
 * 每个元素都是已拼接 `/proxy?url=` 的完整前缀（或包含 url= 的完整前缀）。
 * 无配置时返回空数组。
 */
export function getCorsProxyList(): string[] {
  try {
    const raw = useSettingsStore.getState().corsProxy;
    if (!raw) return [];
    // 拆分多个代理（; 分隔），逐个拼接
    return raw
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => {
        let url = p;
        if (!url.includes('/proxy')) {
          url += '/proxy?url=';
        } else if (!url.endsWith('url=') && !url.endsWith('url=%')) {
          if (url.endsWith('?')) url += 'url=';
          else if (!url.endsWith('/')) url += '?url=';
          else url += 'url=';
        }
        return url;
      });
  } catch {
    return [];
  }
}

/** 取第一个代理前缀（多值配置的"主代理"）；无配置返回空字符串 */
export function getCorsProxy(): string {
  return getCorsProxyList()[0] ?? '';
}

/** 将目标 URL 包装为完整的代理请求地址 */
export function buildProxyUrl(targetUrl: string): string {
  const proxy = getCorsProxy();
  if (!proxy) return targetUrl;
  return proxy + encodeURIComponent(targetUrl);
}

// ============================================================
// Axios 实例
// ============================================================

const httpClient: AxiosInstance = axios.create({
  timeout: DEFAULT_TIMEOUT,
  headers: {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json;charset=utf-8',
  },
});

// ============================================================
// 请求拦截器
// ============================================================

httpClient.interceptors.request.use(
  (config) => {
    const cfg = config as RequestOptions;
    // CORS 代理：原生平台（Android/iOS）不受 CORS 限制，直连即可
    if (!isNativePlatform() && cfg.useProxy && config.url) {
      config.url = buildProxyUrl(config.url);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ============================================================
// 响应拦截器
// ============================================================

httpClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const config = error.config as RequestOptions;

    // 重试逻辑（网络错误 / 超时 / 5xx）
    const cfg = config as RequestOptions;
    const retriesLeft = cfg.retries ?? 0;
    const shouldRetry =
      retriesLeft > 0 &&
      (!error.response || error.response.status >= 500);

    if (shouldRetry) {
      cfg.retries = retriesLeft - 1;
      const delay = cfg.retryDelay || DEFAULT_RETRY_DELAY;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return httpClient.request(config);
    }

    // 规范化错误消息
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error(`请求超时 (${config.timeout || DEFAULT_TIMEOUT}ms)`));
    }
    if (!error.response) {
      return Promise.reject(new Error('网络连接失败，请检查网络或代理设置'));
    }
    return Promise.reject(error);
  },
);

// ============================================================
// 导出的便捷方法
// ============================================================

/** 通用请求（覆盖默认配置） */
export function request<T = unknown>(url: string, options?: RequestOptions): Promise<AxiosResponse<T>> {
  return httpClient.request({ ...options, url } as AxiosRequestConfig);
}

/** 给请求信号合并一个超时（默认 10s），避免慢源请求无限挂起 */
function withTimeout(signal?: AbortSignal, ms = 10000): AbortSignal {
  const timeoutSignal =
    typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(ms)
      : new AbortController().signal;
  if (signal && typeof AbortSignal !== 'undefined' && 'any' in AbortSignal) {
    return AbortSignal.any([signal, timeoutSignal]);
  }
  return signal ?? timeoutSignal;
}

/** GET JSON 数据 */
export async function getJSON<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
  const opts = (options ?? {}) as AxiosRequestConfig;
  const response = await httpClient.get<T>(url, {
    timeout: 10000,
    ...opts,
    signal: withTimeout(opts.signal as AbortSignal | undefined),
  });
  return response.data as T;
}

/** GET 文本数据 */
export async function getText(url: string, options?: RequestOptions): Promise<string> {
  const response = await httpClient.get<string>(url, {
    ...(options as AxiosRequestConfig),
    responseType: 'text',
  });
  return response.data;
}

/** POST JSON 数据 */
export async function postJSON<T = unknown>(url: string, data?: Record<string, unknown>, options?: RequestOptions): Promise<T> {
  const response = await httpClient.post<T>(url, data, options as AxiosRequestConfig);
  return response.data as T;
}

export default httpClient;
