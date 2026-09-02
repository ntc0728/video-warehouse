/**
 * worker/cors-proxy.js 的纯函数单元测试（放 src 下以满足 vitest include）
 *
 * 覆盖 wd 双重编码缺陷的两道防线：
 * 1. extractUrlParam：url 参数未整体编码时从原始 query 提取完整目标地址
 *    （searchParams.get("url") 会在第一个 & 处截断）
 * 2. unwrapSelfNested：历史版本前端重试曾把已包装代理地址再包一层
 *    （proxy?url=proxy?url=...），多出的编码层泄漏到目标站（wd 带字面量 %）。
 *    输入约定：handleRequest 中 searchParams.get("url") 已解码一次的 targetUrl；
 *    若它仍指向自身 /proxy（自嵌套残留），解开一层得到真实目标地址。
 */
import { describe, it, expect } from 'vitest';
import { extractUrlParam, unwrapSelfNested } from '../../worker/cors-proxy.js';

const WORKER_ORIGIN = 'https://cms-proxy.example.com';
const SEARCH_URL = 'https://api.example.com/api.php/provide/vod?ac=videolist&wd=%E5%A4%8D%E4%BB%87';

describe('extractUrlParam', () => {
  it('url 参数整体编码时完整提取并解码', () => {
    const target = 'https://api.example.com/api.php/provide/vod?ac=videolist&wd=复仇者';
    const query = `url=${encodeURIComponent(target)}`;
    expect(extractUrlParam(query)).toBe(target);
  });

  it('url 参数未编码时取到下一个顶层 & 之前的完整值', () => {
    const query = 'url=https://api.example.com/vod?ac=videolist&wd=abc&pg=2';
    expect(extractUrlParam(query)).toBe('https://api.example.com/vod?ac=videolist&wd=abc');
  });

  it('目标 URL 内嵌套 ? 后的 & 视为目标自身的一部分，仅顶层 & 截断', () => {
    const query = 'url=https://api.example.com/vod?a=1?b=2&c=3&tail=9';
    // 嵌套 ? 使深度 +1：&c=3 递减深度、&tail=9 递减至 0 后无剩余顶层 & → 完整保留
    expect(extractUrlParam(query)).toBe('https://api.example.com/vod?a=1?b=2&c=3&tail=9');
  });

  it('无 url 参数时返回 null', () => {
    expect(extractUrlParam('foo=bar')).toBeNull();
  });
});

describe('unwrapSelfNested', () => {
  it('自嵌套残留（targetUrl 仍指向自身 /proxy）解开一层得到真实目标', () => {
    // 前端双重包装请求到达 worker：get("url") 解码一次后 targetUrl 仍是
    // 「单层包装地址」，unwrapSelfNested 再解一层应得到真实搜索 URL（wd 保持单次编码）
    const singleWrapped = `${WORKER_ORIGIN}/proxy?url=${encodeURIComponent(SEARCH_URL)}`;
    expect(unwrapSelfNested(singleWrapped, WORKER_ORIGIN)).toBe(SEARCH_URL);
  });

  it('普通目标地址原样返回（不解码单层包装的等价路径）', () => {
    expect(unwrapSelfNested(SEARCH_URL, WORKER_ORIGIN)).toBe(SEARCH_URL);
  });

  it('同路径但不同 origin 的代理地址不误拆', () => {
    const other = `https://other-proxy.example.com/proxy?url=${encodeURIComponent(SEARCH_URL)}`;
    expect(unwrapSelfNested(other, WORKER_ORIGIN)).toBe(other);
  });

  it('空值安全返回', () => {
    expect(unwrapSelfNested('', WORKER_ORIGIN)).toBe('');
  });
});
