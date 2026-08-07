/**
 * cloudflare — 一键部署 Cloudflare Worker
 *
 * [2026-08-07 一键配置代理]
 * - 从 public/proxy-scripts/*.js fetch 脚本源码（由 worker/*.js 复制而来）
 * - 用 Cloudflare Workers API 上传脚本：PUT /client/v4/accounts/{acct}/workers/scripts/{name}
 * - 返回 Worker 默认 URL：https://{name}.{subdomain}.workers.dev
 */

export interface CFDeployResult {
  scriptName: string;
  /** Worker 默认部署地址（不带子路径） */
  workersUrl: string;
}

/** 获取账号的 workers subdomain（用于拼 Worker 默认 URL） */
export async function getWorkersSubdomain(token: string, accountId: string): Promise<string> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`获取 Workers subdomain 失败 (HTTP ${res.status})`);
  const data = (await res.json()) as { success: boolean; result?: { subdomain?: string }; errors?: unknown[] };
  if (!data.success || !data.result?.subdomain) {
    throw new Error('无法获取账号 Workers subdomain，请确认 API Token 有 Workers 权限');
  }
  return data.result.subdomain;
}

/** 校验 token（调用 /user/tokens/verify） */
export async function verifyToken(token: string): Promise<void> {
  const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Token 校验失败 (HTTP ${res.status})`);
  const data = (await res.json()) as { success: boolean; result?: { status?: string }; errors?: unknown[] };
  if (!data.success) throw new Error('Token 校验失败：无效或已过期');
  if (data.result?.status !== 'active') throw new Error('Token 状态非 active，请检查权限');
}

/** 上传 Worker 脚本 */
export async function deployWorkerScript(
  token: string,
  accountId: string,
  scriptName: string,
  scriptSource: string,
): Promise<void> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/javascript',
      },
      body: scriptSource,
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { errors?: Array<{ message?: string }> } | null;
    const msg = err?.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`上传 Worker 脚本失败：${msg}`);
  }
}

/** fetch public 目录中的 Worker 脚本源码 */
export async function fetchWorkerSource(kind: 'cors' | 'iptv'): Promise<string> {
  const path = kind === 'cors' ? '/proxy-scripts/cors-proxy.js' : '/proxy-scripts/m3u8-proxy.js';
  const res = await fetch(path);
  if (!res.ok) throw new Error(`获取脚本源码失败 (HTTP ${res.status})`);
  return await res.text();
}

export type DeployLogType = 'info' | 'success' | 'error' | 'warn';

/**
 * 完整部署流程：校验 → 取 subdomain → 上传脚本 → 返回默认 URL
 * onLog 每次关键步骤回调（用于日志方框实时进度）
 */
export async function deployProxyWorker(
  token: string,
  accountId: string,
  kind: 'cors' | 'iptv',
  onLog?: (msg: string, type?: DeployLogType) => void,
): Promise<CFDeployResult> {
  const scriptName = kind === 'cors' ? 'kino-cors-proxy' : 'kino-iptv-proxy';
  const kindLabel = kind === 'cors' ? 'CORS' : 'IPTV';

  onLog?.('校验 Cloudflare 凭据...', 'info');
  await verifyToken(token);
  onLog?.('[1/4] 凭据校验通过', 'success');

  onLog?.('获取 Workers 子域...', 'info');
  const subdomain = await getWorkersSubdomain(token, accountId);
  onLog?.('[2/4] 子域获取成功', 'success');

  onLog?.(`[3/4] 上传 ${kindLabel} 代理 Worker 脚本...`, 'info');
  const source = await fetchWorkerSource(kind);
  await deployWorkerScript(token, accountId, scriptName, source);
  onLog?.('[3/4] 脚本上传成功', 'success');

  const workersUrl = `https://${scriptName}.${subdomain}.workers.dev`;
  onLog?.('[4/4] 部署完成', 'success');

  return { scriptName, workersUrl };
}
