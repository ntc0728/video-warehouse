/** rewriteM3U8 的类型声明（供 src 下的测试 import 时获得正确签名） */
export interface RewriteM3U8Options {
  /** 源站响应带 CORS 头时，分片保持源站直连（worker 仅代理清单，省请求量） */
  directSegments?: boolean;
}

export declare function rewriteM3U8(
  content: string,
  baseUrl: string,
  headers: object,
  workerUrl: string,
  options?: RewriteM3U8Options,
): string;

export declare function rewriteMPD(
  content: string,
  baseUrl: string,
  headers: object,
  workerUrl: string,
): string;

export declare function extractUrlParam(query: string): string;

/** D1 裸流识别：判断内容是否为 HLS 清单（#EXTM3U 开头，兼容 UTF-8 BOM） */
export declare function isM3U8Content(content: string): boolean;
