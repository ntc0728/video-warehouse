/**
 * 公共 HTTP 客户端（基于 Axios）
 * 集中管理所有接口请求的：
 * - 请求拦截：CORS 代理 / 通用请求头 / 缓存破坏
 * - 响应拦截：错误规范化 / 重试
 */
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { useSettingsStore } from '@/stores';
import { isNativePlatform } from '@/lib/platform';

// ============================================================
// 类型
// ============================================================

/** 扩展 Axios 配置，增加自定义选项 */
export interface CustomRequestConfig {
  /** 是否通过 CORS 代理发送（默认 false） */
  useProxy?: boolean;
  /** 是否添加时间戳参数防缓存（默认 false） */
  cacheBust?: boolean;
  /** 重试次数（默认 0），仅对幂等请求生效 */
  retries?: number;
  /** 重试间隔基数（ms） */
  retryDelay?: number;
}

export type RequestOptions = CustomRequestConfig & AxiosRequestConfig;

// ============================================================
// 配置
// ============================================================

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRY_DELAY = 500;

// ============================================================
// CORS 代理
// ============================================================

export function getCorsProxy(): string {
  try {
    const proxy = useSettingsStore.getState().corsProxy;
    if (proxy && proxy.trim()) {
      let url = proxy.trim();
      if (!url.includes('/proxy')) {
        url += '/proxy?url=';
      } else if (!url.endsWith('url=') && !url.endsWith('url=%')) {
        if (url.endsWith('?')) url += 'url=';
        else if (!url.endsWith('/')) url += '?url=';
        else url += 'url=';
      }
      return url;
    }
  } catch { /* ignore */ }
  return '';
}

export function buildProxyUrl(targetUrl: string): string {
  const proxy = getCorsProxy();
  if (!proxy) return targetUrl;
  return proxy + encodeURIComponent(targetUrl);
}

function cacheBustUrl(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_t=${Date.now()}`;
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
    // 缓存破坏
    if (cfg.cacheBust && config.url) {
      config.url = cacheBustUrl(config.url);
    }
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

/** GET JSON 数据 */
export async function getJSON<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
  const response = await httpClient.get<T>(url, options as AxiosRequestConfig);
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
