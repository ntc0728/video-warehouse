// 类型声明：Cloudflare Worker 入口（m3u8/ts/dash/file 流代理）
// 与 m3u8-proxy.js 同目录，供前端单测通过 ESM 导入其命名导出时使用。

export function rewriteM3U8(
  content: string,
  baseUrl: string,
  headers: object,
  workerUrl: string
): string;

export function rewriteMPD(
  content: string,
  mpdUrl: string,
  headers: object,
  workerUrl: string
): string;

export function extractUrlParam(rawQuery: string): string | null;

declare const _default: {
  fetch(request: Request): Promise<Response>;
};
export default _default;
