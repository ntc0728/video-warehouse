/**
 * ProxySetup — 一键配置代理页（隐藏入口：设置页「关于」点 KinoTV 3 次）
 *
 * [2026-08-07 一键配置代理]
 * - 两个独立入口：视频采集 CORS 代理 / IPTV 流代理（分开处理，互不关联）
 * - 深色日志方框实时显示命令进度
 * - 登录 Cloudflare（API Token + Account ID）→ 一键上传 Worker 脚本
 * - 自定义域名（可选，默认 .workers.dev 链接）
 * - 复制链接 / 自动写入项目设置
 * - 走 AppLayout 常规路由（侧边栏保留）、Design Token 主题适配、宽度占容器剩余空间
 */
import { useCallback, useRef, useState } from 'react';
import { Activity, Cloud, Copy, Globe, Rocket, ShieldCheck, Wifi } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import SubPageHeader from '@/components/common/SubPageHeader/SubPageHeader';
import { toast } from '@/components/ui/toastBus';
import { Icon } from '@/components/ui/Icon';
import {
  deployProxyWorker,
  type DeployLogType,
} from './cloudflare';
import './ProxySetup.css';

type SetupKind = 'cors' | 'iptv' | null;

interface LogLine {
  time: string;
  msg: string;
  type: DeployLogType;
}

function nowTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function ProxySetup() {
  const setCorsProxy = useSettingsStore((s) => s.setCorsProxy);
  const setIptvSettings = useIPTVStore((s) => s.setSettings);

  // 移动端：渲染 SubPageHeader（返回+标题）替代全局顶部导航栏，与设置页子页一致
  const isMobile = useMediaQuery('(max-width: 767px)');

  // 状态
  const [kind, setKind] = useState<SetupKind>(null);
  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [domain, setDomain] = useState('');
  const [logs, setLogs] = useState<LogLine[]>([
    { time: nowTime(), msg: '> 等待配置开始，请在上方选择一个配置入口...', type: 'info' },
  ]);
  const [deploying, setDeploying] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [showToken, setShowToken] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  const appendLog = useCallback((msg: string, type: DeployLogType = 'info') => {
    setLogs((prev) => [...prev, { time: nowTime(), msg, type }]);
  }, []);

  const handleSelectKind = useCallback((k: 'cors' | 'iptv') => {
    setKind(k);
    setResultUrl('');
    appendLog(k === 'cors' ? '已选择：视频采集 CORS 代理' : '已选择：IPTV 流代理', 'info');
  }, [appendLog]);

  const openCloudflareLogin = useCallback(() => {
    window.open('https://dash.cloudflare.com/profile/api-tokens', '_blank', 'noopener');
    appendLog('已打开 Cloudflare 登录/Token 页面，请创建 Token 后粘贴回此页', 'warn');
  }, [appendLog]);

  /** 一键部署 */
  const handleDeploy = useCallback(async () => {
    if (!kind) {
      appendLog('请先选择一个配置入口', 'error');
      return;
    }
    if (!token.trim() || !accountId.trim()) {
      appendLog('请填写 Cloudflare API Token 与 Account ID', 'error');
      return;
    }
    setDeploying(true);
    setResultUrl('');
    appendLog(`开始配置「${kind === 'cors' ? '视频采集 CORS 代理' : 'IPTV 流代理'}」...`, 'info');
    try {
      const res = await deployProxyWorker(token.trim(), accountId.trim(), kind, (msg, type = 'info') => appendLog(msg, type));
      // 自定义域名（可选）
      let finalUrl = res.workersUrl;
      if (domain.trim()) {
        finalUrl = domain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
        appendLog(`已使用自定义域名：https://${finalUrl}`, 'success');
      } else {
        appendLog(`已使用 Worker 默认链接：${finalUrl}`, 'success');
      }
      setResultUrl(finalUrl);
      appendLog('配置完成！请复制链接并粘贴到项目设置相应位置。', 'success');
    } catch (e) {
      appendLog(`配置失败：${(e as Error).message ?? '未知错误'}`, 'error');
      toast.show({ content: `配置失败：${(e as Error).message}`, type: 'error' });
    } finally {
      setDeploying(false);
    }
  }, [kind, token, accountId, domain, appendLog]);

  const copyResult = useCallback(async () => {
    if (!resultUrl) {
      appendLog('暂无链接可复制，请先完成配置', 'warn');
      return;
    }
    try {
      await navigator.clipboard.writeText(resultUrl);
      appendLog('已复制到剪贴板：' + resultUrl, 'success');
      toast.show({ content: '已复制链接', type: 'success' });
    } catch {
      appendLog('复制失败，请手动复制', 'error');
    }
  }, [resultUrl, appendLog]);

  /** 自动写入设置 */
  const writeToSettings = useCallback(() => {
    if (!resultUrl) {
      appendLog('暂无链接可写入，请先完成配置', 'warn');
      return;
    }
    if (kind === 'cors') {
      setCorsProxy(resultUrl);
      appendLog(`已写入「视频采集 CORS 代理」：${resultUrl}`, 'success');
    } else if (kind === 'iptv') {
      setIptvSettings({ proxyUrl: resultUrl });
      appendLog(`已写入「IPTV 代理服务器地址」：${resultUrl}`, 'success');
    }
    toast.show({ content: '已写入项目设置，可跳转设置页确认', type: 'success' });
  }, [resultUrl, kind, setCorsProxy, setIptvSettings, appendLog]);

  return (
    <div className="proxy-setup page-transition-enter">
      {/* 移动端子页顶栏：返回 + 标题，覆盖全局导航栏（与其他设置子页一致） */}
      {isMobile && <SubPageHeader title="一键配置代理" />}
      <div className="proxy-setup__inner">
        <header className="proxy-setup__header">
          <h2 className="proxy-setup__title">
            <Icon icon={Cloud} size="md" /> 一键配置代理
          </h2>
          <p className="proxy-setup__sub">
            无需手动部署 Cloudflare Worker，跟随向导即可完成视频采集 CORS 代理与 IPTV 流代理配置。
            Token 仅保存在内存中，离开页面自动清除。
          </p>
        </header>

        {/* 两个独立入口 */}
        <div className="proxy-setup__grid">
          <button
            type="button"
            className={`proxy-setup__card${kind === 'cors' ? ' is-selected' : ''}`}
            onClick={() => handleSelectKind('cors')}
          >
            <div className="proxy-setup__card-head">
              <Icon icon={Wifi} size="md" />
              <span>视频采集 CORS 代理</span>
            </div>
            <p className="proxy-setup__card-desc">绕过浏览器跨域限制，访问 CMS 采集站数据</p>
          </button>
          <button
            type="button"
            className={`proxy-setup__card${kind === 'iptv' ? ' is-selected' : ''}`}
            onClick={() => handleSelectKind('iptv')}
          >
            <div className="proxy-setup__card-head">
              <Icon icon={Activity} size="md" />
              <span>IPTV 流代理</span>
            </div>
            <p className="proxy-setup__card-desc">转发 IPTV 直播流（m3u8 / dash / ts）</p>
          </button>
        </div>

        {/* 日志方框 */}
        <div className="proxy-setup__console" ref={logRef}>
          {logs.map((l, i) => (
            <span key={i} className={`proxy-setup__log proxy-setup__log--${l.type}`}>
              <span className="proxy-setup__log-time">[{l.time}]</span> {l.msg}
            </span>
          ))}
        </div>

        {/* 登录 Cloudflare */}
        <div className="proxy-setup__panel">
          <h3 className="proxy-setup__panel-title"><Icon icon={ShieldCheck} size="sm" /> 登录 Cloudflare</h3>
          <button type="button" className="proxy-setup__btn proxy-setup__btn--link" onClick={openCloudflareLogin}>
            <span className="proxy-setup__btn-label">打开 Cloudflare 登录 / 创建 API Token</span>
          </button>
          <div className="proxy-setup__field">
            <label htmlFor="cf-token">Cloudflare API Token</label>
            <div className="proxy-setup__input-row">
              <input
                id="cf-token"
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="粘贴 API Token（Workers Scripts → Edit 权限）"
              />
              <button type="button" className="proxy-setup__btn proxy-setup__btn--ghost" onClick={() => setShowToken((v) => !v)}>
                {showToken ? '隐藏' : '显示'}
              </button>
            </div>
          </div>
          <div className="proxy-setup__field">
            <label htmlFor="cf-account">Cloudflare Account ID</label>
            <input
              id="cf-account"
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="dash.cloudflare.com 右侧可查"
            />
          </div>
        </div>

        {/* 开始配置 */}
        <div className="proxy-setup__panel">
          <div className="proxy-setup__action-row">
            <button
              type="button"
              className="proxy-setup__btn proxy-setup__btn--primary proxy-setup__btn--lg"
              onClick={handleDeploy}
              disabled={deploying}
            >
              {deploying ? <Icon icon={Activity} size="sm" className="spin" /> : <Icon icon={Rocket} size="sm" />}
              {deploying ? '配置中...' : '开始一键配置 Worker'}
            </button>
            <span className="proxy-setup__action-hint">将上传 worker 脚本并创建 Workers 代理，需先填写上方 Token 与 Account ID。</span>
          </div>
        </div>

        {/* 自定义域名 + 结果 */}
        <div className="proxy-setup__panel">
          <div className="proxy-setup__field">
            <label htmlFor="cf-domain">自定义域名 <span className="proxy-setup__optional">（可选，留空则使用 Worker 默认链接）</span></label>
            <input
              id="cf-domain"
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="proxy.example.com（需在 Cloudflare DNS 配置 CNAME）"
            />
          </div>
          {resultUrl && (
            <div className="proxy-setup__result">
              <div className="proxy-setup__result-label">配置完成，复制以下链接到项目设置：</div>
              <div className="proxy-setup__result-url">{resultUrl}</div>
              <div className="proxy-setup__result-actions">
                <button type="button" className="proxy-setup__btn" onClick={copyResult}>
                  <Icon icon={Copy} size="sm" /> 复制链接
                </button>
                <button type="button" className="proxy-setup__btn proxy-setup__btn--primary" onClick={writeToSettings}>
                  <Icon icon={Globe} size="sm" /> 自动写入设置
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
