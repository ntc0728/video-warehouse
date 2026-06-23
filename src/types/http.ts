/**
 * HTTP 请求相关类型定义
 * 定义 Axios 请求的自定义配置选项
 */
import type { AxiosRequestConfig } from 'axios';

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
