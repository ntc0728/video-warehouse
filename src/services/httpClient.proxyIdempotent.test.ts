/**
 * httpClient 请求拦截器「代理包装幂等」集成测试
 *
 * 背景（wd 双重编码缺陷）：响应拦截器重试时复用 error.config，其中 url 已被
 * 请求拦截器包装成「代理前缀 + encodeURIComponent(原始URL)」；若拦截器不判重，
 * 重试会对整个地址再包一层编码，wd 等查询参数叠加一层编码层。任何一层代理
 * 解码次数与前端编码次数不匹配时，目标站就会收到带 % 字面量的关键词。
 *
 * 本测试锁死不变式：重试请求到达 adapter 的 url 与首次请求完全一致
 * （编码一次、代理解码一次）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios, { AxiosError } from 'axios';
import httpClient, { getJSON } from './httpClient';
import { useSettingsStore } from '@/stores/useSettingsStore';

const PROXY = 'https://proxy.example.com/proxy?url=';
// videoService 实际产出的 CMS 搜索 URL 形态（wd 已由 encodeURIComponent 编码一次）
const CMS_SEARCH_URL = 'https://api.example.com/api.php/provide/vod?ac=videolist&wd=%E5%A4%8D%E4%BB%87';

describe('httpClient 代理包装幂等（重试不重复编码）', () => {
  const originalAdapter = httpClient.defaults.adapter;

  beforeEach(() => {
    useSettingsStore.setState({ corsProxy: PROXY } as Partial<ReturnType<typeof useSettingsStore.getState>>);
  });

  afterEach(() => {
    httpClient.defaults.adapter = originalAdapter;
  });

  it('首次请求按「代理前缀 + 整体编码一次」包装', async () => {
    const seen: string[] = [];
    httpClient.defaults.adapter = async (config) => {
      seen.push(config.url ?? '');
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as never;
    };

    await getJSON(CMS_SEARCH_URL, { useProxy: true });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(PROXY + encodeURIComponent(CMS_SEARCH_URL));
  });

  it('500 重试时到达 adapter 的 url 与首次一致（不叠加编码层）', async () => {
    const seen: string[] = [];
    httpClient.defaults.adapter = async (config) => {
      seen.push(config.url ?? '');
      if (seen.length === 1) {
        throw new AxiosError('boom', AxiosError.ERR_BAD_RESPONSE, config, null, {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          config,
        } as never);
      }
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as never;
    };

    await getJSON(CMS_SEARCH_URL, { useProxy: true, retries: 1, retryDelay: 10 });

    expect(seen).toHaveLength(2);
    const expected = PROXY + encodeURIComponent(CMS_SEARCH_URL);
    expect(seen[0]).toBe(expected);
    // 关键断言：重试请求与首次完全一致——修复前这里会是
    // PROXY + encodeURIComponent(PROXY + encodeURIComponent(CMS_SEARCH_URL))
    expect(seen[1]).toBe(expected);
    expect(seen[1]).not.toContain('%252');
  });

  it('无代理配置时 url 原样透传', async () => {
    useSettingsStore.setState({ corsProxy: '' } as Partial<ReturnType<typeof useSettingsStore.getState>>);
    const seen: string[] = [];
    httpClient.defaults.adapter = async (config) => {
      seen.push(config.url ?? '');
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as never;
    };

    await getJSON(CMS_SEARCH_URL, { useProxy: true });
    expect(seen[0]).toBe(CMS_SEARCH_URL);
  });

  it('axios 默认行为基线：URL 字符串中的已编码 % 不会被 axios 再编码', () => {
    // 基线保护：若 axios 升级改变了对已编码 URL 的处理，此断言会率先暴露
    const wrapped = PROXY + encodeURIComponent(CMS_SEARCH_URL);
    expect(wrapped).toBe(
      'https://proxy.example.com/proxy?url=https%3A%2F%2Fapi.example.com%2Fapi.php%2Fprovide%2Fvod%3Fac%3Dvideolist%26wd%3D%25E5%25A4%258D%25E4%25BB%2587',
    );
    // wd 的 %E5.. 在外层编码后为 %25E5..（一层），而非 %2525..（两层）
    expect(axios.getUri({ url: wrapped })).toBe(wrapped);
  });
});
