/**
 * ProxySetup — 一键配置代理页（隐藏入口：设置页「关于」点 KinoTV 3 次）
 *
 * [2026-08-07 一键配置代理]  [2026-10-10 落地「己 · 三栏分步向导」]
 * - 三栏：左步骤导航（① 选部署项 → ② 登录凭证 → ③ 部署回写）/ 中当前步面板（上一步·下一步）/ 右深色控制台常驻
 * - 两个独立入口：视频采集 CORS 代理 / IPTV 流代理（互不关联）
 * - 登录 Cloudflare（API Token + Account ID）→ 一键上传 Worker 脚本；部署按钮仅在第 3 步
 * - 自定义域名（可选，真实功能：填了覆盖 Worker 链接；DNS CNAME 需自行在 Cloudflare 配）
 * - 成功后自动写入项目设置，手动按钮兜底
 * - 走 AppLayout 常规路由（侧边栏保留）、Design Token 主题适配
 */
import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeft, ArrowRight, Cloud, Copy, Rocket } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { useIsMobileLayout } from '@/hooks/useMediaQuery';
import { useDocumentTitle, useIsDesktop } from '@/hooks';
import SubPage from '@/components/common/SubPage/SubPage';
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

/** worker 脚本名（与 cloudflare.ts deployProxyWorker 内部命名一致，CTA hint 展示用） */
const WORKER_NAME: Record<'cors' | 'iptv', string> = {
  cors: 'kino-cors-proxy',
  iptv: 'kino-iptv-proxy',
};

function nowTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function ProxySetup() {
  const setCorsProxy = useSettingsStore((s) => s.setCorsProxy);
  const setIptvSettings = useIPTVStore((s) => s.setSettings);

  // 移动端：整页 portal 为全屏子页（SubPage，对齐设置页 SettingsSubPage），顶栏替代全局导航栏。
  const isMobile = useIsMobileLayout();
  const isDesktop = useIsDesktop();

  // 浏览器页签标题（此前未设，补齐）
  useDocumentTitle('一键配置代理');

  // 状态
  const [kind, setKind] = useState<SetupKind>(null);
  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [domain, setDomain] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hint, setHint] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>(() => [
    // 初始提示方位随布局变：≥1024 非 app 三栏在左侧；app/窄视口步骤导航横排居顶部（原固定「上方」为误）
    { time: nowTime(), msg: `> 等待配置开始，请在${isDesktop && !isMobile ? '左侧' : '上方'}选择一个配置入口...`, type: 'info' },
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
    setHint(null);
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
      setStep(1);
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
      // 自动回写：部署成功即写入设置，手动按钮保留作兜底
      if (kind === 'cors') {
        setCorsProxy(finalUrl);
        appendLog(`已自动写入「视频采集 CORS 代理」：${finalUrl}`, 'success');
      } else {
        setIptvSettings({ proxyUrl: finalUrl });
        appendLog(`已自动写入「IPTV 代理服务器地址」：${finalUrl}`, 'success');
      }
      appendLog('配置完成！可「回源检测复检」验证代理链路。', 'success');
      toast.show({ content: '配置完成，已自动写入项目设置', type: 'success' });
    } catch (e) {
      appendLog(`配置失败：${(e as Error).message ?? '未知错误'}`, 'error');
      toast.show({ content: `配置失败：${(e as Error).message}`, type: 'error' });
    } finally {
      setDeploying(false);
    }
  }, [kind, token, accountId, domain, appendLog, setCorsProxy, setIptvSettings]);

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

  /** 写入设置（兜底手动，自动回写已执行） */
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

  // 步骤完成态（派生展示，用于左导航 is-done/is-on）
  const stepDone = {
    1: kind !== null,
    2: Boolean(token.trim() && accountId.trim()),
    3: Boolean(resultUrl),
  };
  const stepCls = (s: 1 | 2 | 3) =>
    `proxy-setup__stepnav-item${stepDone[s] ? ' is-done' : ''}${step === s ? ' is-on' : ''}${hint && step === s ? ' is-error' : ''}`;

  // 下一步校验：点击时提示、不拦截（不置灰，未填完停留本步 + 页内红字提示）
  const stepValid1 = kind !== null;
  const stepValid2 = Boolean(token.trim() && accountId.trim());
  const goNext = useCallback(() => {
    if (step === 1) {
      if (!stepValid1) { setHint('请先选择一个部署项'); return; }
      setHint(null); setStep(2);
    } else if (step === 2) {
      if (!stepValid2) { setHint('请填写 API Token 与 Account ID'); return; }
      setHint(null); setStep(3);
    }
  }, [step, stepValid1, stepValid2]);
  const goStep = useCallback((n: 1 | 2 | 3) => { setHint(null); setStep(n); }, []);

  // 第3步「部署确认摘要」（真实字段派生）
  const normDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const summaryRows: { k: string; v: string; muted?: boolean }[] = [
    { k: '部署项', v: kind === 'cors' ? '视频采集 CORS 代理' : kind === 'iptv' ? 'IPTV 流代理' : '未选择', muted: !kind },
    { k: '目标 Worker', v: kind ? WORKER_NAME[kind] : '—', muted: !kind },
    { k: '访问链接', v: normDomain ? `https://${normDomain}` : '默认 .workers.dev 链接', muted: !normDomain },
    { k: 'Account', v: accountId.trim() ? `…${accountId.trim().slice(-6)}` : '未填写', muted: !accountId.trim() },
  ];

  const page = (
    <div className="proxy-setup">
      <div className="proxy-setup__inner">
        <header className="proxy-setup__header">
          <div className="proxy-setup__headline">
            <h2 className="proxy-setup__title">
              <Icon icon={Cloud} size="md" /> 一键配置代理
            </h2>
            <p className="proxy-setup__sub">
              Cloudflare Worker 部署向导 · Token 仅保存在内存中，离开页面自动清除。
            </p>
          </div>
          <span className="proxy-setup__context">
            当前部署项：<b>{kind === 'cors' ? '视频采集 CORS 代理' : kind === 'iptv' ? 'IPTV 流代理' : '未选择'}</b>
          </span>
        </header>

        <div className="proxy-setup__cols">
          {/* 左：步骤导航 */}
          <nav className="proxy-setup__stepnav" aria-label="部署步骤">
            <h4>部署步骤</h4>
            <button type="button" className={stepCls(1)} onClick={() => goStep(1)}>
              <span className="proxy-setup__stepnav-no">①</span> 选择部署项
            </button>
            <button type="button" className={stepCls(2)} onClick={() => goStep(2)}>
              <span className="proxy-setup__stepnav-no">②</span> 登录凭证
            </button>
            <button type="button" className={stepCls(3)} onClick={() => goStep(3)}>
              <span className="proxy-setup__stepnav-no">③</span> 部署与回写
            </button>
          </nav>

          {/* 中：当前步面板（一次一步 + 上/下一步） */}
          <div className="proxy-setup__main">
            <div className="proxy-setup__panel" hidden={step !== 1}>
              <h3 className="proxy-setup__panel-title"><Icon icon={Cloud} size="sm" /> 选择部署项</h3>
              <p className="proxy-setup__panel-desc">两种代理互不关联，可分别部署。</p>
              <div className="proxy-setup__grid">
                <button
                  type="button"
                  className={`proxy-setup__card${kind === 'cors' ? ' is-selected' : ''}`}
                  onClick={() => handleSelectKind('cors')}
                >
                  <span className="proxy-setup__entry-dot" />
                  <span className="proxy-setup__entry-name">视频采集 CORS 代理</span>
                  <span className="proxy-setup__card-desc">绕过浏览器跨域限制，访问 CMS 采集站数据</span>
                </button>
                <button
                  type="button"
                  className={`proxy-setup__card${kind === 'iptv' ? ' is-selected' : ''}`}
                  onClick={() => handleSelectKind('iptv')}
                >
                  <span className="proxy-setup__entry-dot" />
                  <span className="proxy-setup__entry-name">IPTV 流代理</span>
                  <span className="proxy-setup__card-desc">转发 IPTV 直播流（m3u8 / dash / ts）</span>
                </button>
              </div>
              <div className="proxy-setup__nav-row">
                <span />
                <button type="button" className="proxy-setup__btn proxy-setup__btn--primary proxy-setup__btn--sm" onClick={goNext}>
                  下一步：填凭证 <Icon icon={ArrowRight} size="sm" />
                </button>
              </div>
              {hint && step === 1 && <p className="proxy-setup__hint proxy-setup__hint--error">{hint}</p>}
            </div>

            <div className="proxy-setup__panel" hidden={step !== 2}>
              <h3 className="proxy-setup__panel-title"><Icon icon={Cloud} size="sm" /> 登录凭证</h3>
              <div className="proxy-setup__field">
                <label htmlFor="cf-token">API Token</label>
                <div className="proxy-setup__input-row">
                  <input
                    id="cf-token"
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => { setToken(e.target.value); setHint(null); }}
                    className={hint && !token.trim() ? ' is-invalid' : ''}
                    placeholder="粘贴 API Token（Workers Scripts → Edit 权限）"
                  />
                  <button type="button" className="proxy-setup__btn proxy-setup__btn--ghost" onClick={() => setShowToken((v) => !v)}>
                    {showToken ? '隐藏' : '显示'}
                  </button>
                </div>
                <p className="proxy-setup__hint">
                  仅在内存中使用，离开页面自动清除 ·
                  <button type="button" className="proxy-setup__hint-link" onClick={openCloudflareLogin}>打开 Cloudflare 创建 Token</button>
                </p>
              </div>
              <div className="proxy-setup__field">
                <label htmlFor="cf-account">Account ID</label>
                <input
                  id="cf-account"
                  type="text"
                  value={accountId}
                  onChange={(e) => { setAccountId(e.target.value); setHint(null); }}
                  className={hint && !accountId.trim() ? ' is-invalid' : ''}
                  placeholder="dash.cloudflare.com 右侧可查"
                />
              </div>
              <div className="proxy-setup__field">
                <label htmlFor="cf-domain">自定义域名 <span className="proxy-setup__optional">（可选，留空则使用 Worker 默认链接；需自行在 Cloudflare DNS 配 CNAME）</span></label>
                <input
                  id="cf-domain"
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="proxy.example.com"
                />
              </div>
              <div className="proxy-setup__nav-row">
                <button type="button" className="proxy-setup__btn proxy-setup__btn--sm" onClick={() => goStep(1)}>
                  <Icon icon={ArrowLeft} size="sm" /> 上一步
                </button>
                <button type="button" className="proxy-setup__btn proxy-setup__btn--primary proxy-setup__btn--sm" onClick={goNext}>
                  下一步：部署 <Icon icon={ArrowRight} size="sm" />
                </button>
              </div>
              {hint && step === 2 && <p className="proxy-setup__hint proxy-setup__hint--error">{hint}</p>}
            </div>

            <div className="proxy-setup__panel" hidden={step !== 3}>
              <h3 className="proxy-setup__panel-title"><Icon icon={Rocket} size="sm" /> 部署与回写</h3>
              <dl className="proxy-setup__summary">
                {summaryRows.map((s) => (
                  <div key={s.k} className="proxy-setup__summary-row">
                    <dt>{s.k}</dt>
                    <dd className={s.muted ? ' is-muted' : ''}>{s.v}</dd>
                  </div>
                ))}
              </dl>
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
                <span className="proxy-setup__action-hint">
                  将创建/更新 <code className="proxy-setup__cta-code">{kind ? WORKER_NAME[kind] : 'Worker'}</code>，成功后自动回写项目设置
                </span>
              </div>
              <div className="proxy-setup__nav-row">
                <button type="button" className="proxy-setup__btn proxy-setup__btn--sm" onClick={() => goStep(2)}>
                  <Icon icon={ArrowLeft} size="sm" /> 上一步
                </button>
              </div>

              {resultUrl && (
                <div className="proxy-setup__result">
                  <div className="proxy-setup__result-main">
                    <span className="proxy-setup__result-pill">部署成功</span>
                    <b className="proxy-setup__result-url">{resultUrl}</b>
                  </div>
                  <div className="proxy-setup__result-actions">
                    <button type="button" className="proxy-setup__btn" onClick={copyResult}>
                      <Icon icon={Copy} size="sm" /> 复制链接
                    </button>
                    <button type="button" className="proxy-setup__btn" onClick={writeToSettings}>
                      <Icon icon={Cloud} size="sm" /> 重新写入设置
                    </button>
                    <Link className="proxy-setup__btn proxy-setup__btn--ok" to="/source-checker">
                      回源检测复检 →
                    </Link>
                  </div>
                  <p className="proxy-setup__result-note">已自动写入「设置 → 代理」，下次检测将走代理链路。</p>
                </div>
              )}
            </div>
          </div>

          {/* 右：深色控制台常驻 */}
          <div className="proxy-setup__console-wrap">
            <div className="proxy-setup__console-bar" aria-hidden="true">
              <span className="proxy-setup__console-dot" />
              <span className="proxy-setup__console-dot" />
              <span className="proxy-setup__console-dot" />
              <span className="proxy-setup__console-file">deploy.log</span>
            </div>
            <div className="proxy-setup__console" ref={logRef}>
              {logs.map((l, i) => (
                <span key={i} className={`proxy-setup__log proxy-setup__log--${l.type}`}>
                  <span className="proxy-setup__log-time">[{l.time}]</span> {l.msg}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 移动端：整页 portal 挂 body（fixed inset:0 覆盖全视口），顶栏替代全局导航栏
  return isMobile ? <SubPage title="一键配置代理">{page}</SubPage> : page;
}
