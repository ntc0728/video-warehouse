/** worker/cors-proxy.js 纯函数的类型声明（供 src 下的测试 import 时获得正确签名） */

/**
 * 从原始查询字符串中提取 url 参数的完整值（url 参数未整体编码时的容错提取）。
 * 无 url 参数时返回 null。
 */
export declare function extractUrlParam(rawQuery: string): string | null;

/**
 * 防御自嵌套包装：targetUrl 若指向同 origin 的 /proxy（历史版本前端重试
 * 双重包装的残留），解开一层返回内层 url 参数值；否则原样返回。
 */
export declare function unwrapSelfNested(targetUrl: string, requestOrigin: string): string;
