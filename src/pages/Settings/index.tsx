/**
 * 设置页面
 * 提供主题切换、数据源配置、IPTV 代理设置、翻译 API 配置等功能
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Switch, Button, Modal, toast, HelpPopover } from '@/components/ui';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { useSettingsStore, useTMDBStore } from '@/stores';
import { getVideoSources, getIPTVSources, getEPGSources } from '@/services/sourceService';
import { fetchTrending } from '@/services/tmdbService';
import httpClient from '@/services/httpClient';
import { useDropdownPosition } from '@/hooks/useDropdownPosition';
import { PortalDropdown } from '@/components/common/PortalDropdown';
import { useDocumentTitle } from '@/hooks';
import type { EPGSourceConfig } from '@/types';
import type { VideoSourceConfig, IPTVSourceConfig } from '@/types/source';
import './Settings.css';

// 校验工具函数
const validators = {
  url: (value: string): string | null => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return '请输入有效的 URL 格式（如 https://example.com）';
    }
  },
  required: (value: string): string | null => {
    return value.trim() ? null : '此字段为必填项';
  },
  regex: (value: string): string | null => {
    if (!value) return null;
    try {
      new RegExp(value);
      return null;
    } catch {
      return '请输入有效的正则表达式';
    }
  },
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { translationAppId, translationApiKey, setTranslationAppId, setTranslationApiKey, autoTranslate, setAutoTranslate } = useSettingsStore();
  const { settings: iptvSettings, setSettings: setIPTVSettings } = useIPTVStore();
  const fetchAllHomeData = useTMDBStore(s => s.fetchAllHomeData);

  // 源检测入口（连续点击3次版本号）
  const versionClickCount = useRef(0);
  const versionClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useDocumentTitle();
  const {
    theme,
    setTheme,
    videoSourceIndices,
    iptvSourceIndices,
    setVideoSourceIndices,
    setIPTVSourceIndices,
    setIPTVSourceIndex,
    corsProxy,
    setCorsProxy,
    epgUrls,
    setEpgUrls,
    epgUpdateInterval,
    setEpgUpdateInterval,
    rememberVolume,
    setRememberVolume,
    tmdbAccessToken,
    setTMDBToken,
    tmdbLanguage,
    setTMDBLanguage,
    skipIntro,
    setSkipIntro,
    skipOutro,
    setSkipOutro,
    skipIntroDuration,
    setSkipIntroDuration,
    skipOutroDuration,
    setSkipOutroDuration,
    autoPlay,
    setAutoPlay,
    skin,
    setSkin,
  } = useSettingsStore();

  const [videoSources, setVideoSources] = useState<VideoSourceConfig[]>([]);
  const [iptvSources, setIptvSources] = useState<IPTVSourceConfig[]>([]);
  const [epgSources, setEpgSources] = useState<EPGSourceConfig[]>([]);
  const [showApiInput, setShowApiInput] = useState(false);
  const [appIdInput, setAppIdInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showProxyInput, setShowProxyInput] = useState(false);
  const [proxyUrlInput, setProxyUrlInput] = useState('');
  const [showPatternInput, setShowPatternInput] = useState(false);
  const [patternInput, setPatternInput] = useState('');
  const DEFAULT_PROXY_PATTERN = '';
  const [showCorsProxyInput, setShowCorsProxyInput] = useState(false);
  const [corsProxyInput, setCorsProxyInput] = useState('');
  const [showTMDBTokenInput, setShowTMDBTokenInput] = useState(false);
  const [tmdbTokenInput, setTMDBTokenInput] = useState('');
  const [showMultiSelect, setShowMultiSelect] = useState(false);
  const [showIptvMultiSelect, setShowIptvMultiSelect] = useState(false);
  const [showEpgMultiSelect, setShowEpgMultiSelect] = useState(false);
  const [showTmdbLangSelect, setShowTmdbLangSelect] = useState(false);

  // 表单校验状态
  const [corsProxyError, setCorsProxyError] = useState<string | null>(null);
  const [proxyUrlError, setProxyUrlError] = useState<string | null>(null);
  const [tmdbTokenError, setTmdbTokenError] = useState<string | null>(null);

  // 测试连接状态
  const [isTestingTmdb, setIsTestingTmdb] = useState(false);
  const [testTmdbResult, setTestTmdbResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isTestingProxy, setIsTestingProxy] = useState(false);
  const [testProxyResult, setTestProxyResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isTestingCorsProxy, setIsTestingCorsProxy] = useState(false);
  const [testCorsProxyResult, setTestCorsProxyResult] = useState<{ ok: boolean; message: string } | null>(null);

  const videoDropdown = useDropdownPosition(showMultiSelect);
  const iptvDropdown = useDropdownPosition(showIptvMultiSelect);
  const epgDropdown = useDropdownPosition(showEpgMultiSelect);
  const tmdbLangDropdown = useDropdownPosition(showTmdbLangSelect);

  const closeAllDropdowns = useCallback(() => {
    setShowMultiSelect(false);
    setShowIptvMultiSelect(false);
    setShowEpgMultiSelect(false);
    setShowTmdbLangSelect(false);
  }, []);

  /** 版本号点击进入源检测（连续点击3次） */
  const handleVersionClick = useCallback(() => {
    versionClickCount.current += 1;

    if (versionClickTimer.current) {
      clearTimeout(versionClickTimer.current);
    }

    const remaining = 3 - versionClickCount.current;
    if (remaining > 0) {
      toast.replace({ content: `再点击 ${remaining} 次进入源检测页`, duration: 3000 });
      versionClickTimer.current = setTimeout(() => {
        versionClickCount.current = 0;
      }, 3000);
    } else {
      versionClickCount.current = 0;
      navigate('/source-checker');
    }
  }, [navigate]);

  /** 初始化时加载视频、IPTV 和 EPG 数据源配置 */
  useEffect(() => {
    const loadSources = async () => {
      const [videos, iptvs, epgs] = await Promise.all([
        getVideoSources(),
        getIPTVSources(),
        getEPGSources(),
      ]);
      setVideoSources(videos);
      setIptvSources(iptvs);
      setEpgSources(epgs);
    };
    loadSources();
  }, []);

  const handleSaveApiKey = () => {
    setTranslationAppId(appIdInput.trim());
    setTranslationApiKey(apiKeyInput.trim());
    toast.show('翻译 API 配置已保存');
    setShowApiInput(false);
  };

  /** 多选视频数据源 */
  const handleVideoSourceToggle = (index: number) => {
    const current = videoSourceIndices || [0];
    let newIndices: number[];

    if (current.includes(index)) {
      newIndices = current.filter(i => i !== index);
      if (newIndices.length === 0) {
        newIndices = [0];
        toast.show({ content: '至少需要保留一个数据源', duration: 2000 });
      }
    } else {
      if (current.length >= 6) {
        toast.show({ content: '最多选择6个数据源', duration: 2000 });
        return;
      }
      newIndices = [...current, index];
    }

    setVideoSourceIndices(newIndices);
  };

  /** 多选 IPTV 数据源（最多3个，停止操作1s后调用接口） */
  const iptvRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleIPTVSourceToggle = (index: number) => {
    const current = iptvSourceIndices || [0];
    let newIndices: number[];

    if (current.includes(index)) {
      newIndices = current.filter(i => i !== index);
      if (newIndices.length === 0) {
        newIndices = [0];
        toast.show({ content: '至少需要保留一个数据源', duration: 2000 });
      }
    } else {
      if (current.length >= 3) {
        toast.show({ content: '最多选择3个数据源', duration: 2000 });
        return;
      }
      newIndices = [...current, index];
    }

    setIPTVSourceIndices(newIndices);
    setIPTVSourceIndex(newIndices[0]);

    // 获取所有选中源的 URL 和名称
    getIPTVSources().then(sources => {
      const validIndices = newIndices.filter(i => sources[i]?.url);
      const urls = validIndices.map(i => sources[i]!.url);
      const names = validIndices.map(i => sources[i]!.name || `源 ${i + 1}`);
      setIPTVSettings({
        aggregatorUrl: urls[0] || '',
        aggregatorUrls: urls,
        sourceNames: names,
      });
      // 防抖：快速切换多个源时只触发一次刷新
      if (iptvRefreshTimerRef.current) clearTimeout(iptvRefreshTimerRef.current);
      iptvRefreshTimerRef.current = setTimeout(() => {
        useIPTVStore.getState().refreshChannels();
      }, 1000);
    });
  };

  /** 多选 EPG 数据源（最多3个，停止操作1s后调用接口） */
  const epgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEpgToggle = (url: string) => {
    const current = epgUrls || [];
    let newUrls: string[];

    if (current.includes(url)) {
      newUrls = current.filter(u => u !== url);
    } else {
      if (current.length >= 3) {
        toast.show({ content: '最多选择3个节目单源', duration: 2000 });
        return;
      }
      newUrls = [...current, url];
    }

    setEpgUrls(newUrls);

    if (epgTimerRef.current) clearTimeout(epgTimerRef.current);
    epgTimerRef.current = setTimeout(async () => {
      try {
        const { fetchAndParseEPG } = await import('@/services/epgService');
        await fetchAndParseEPG();
        toast.show('节目单数据已更新');
      } catch { /* ignore */ }
    }, 1000);
  };

  const handleSaveProxyUrl = () => {
    const error = validators.url(proxyUrlInput.trim());
    setProxyUrlError(error);
    if (error) return;
    setIPTVSettings({ proxyUrl: proxyUrlInput.trim() });
    toast.show(proxyUrlInput.trim() ? '代理地址已保存' : '代理地址已清除');
    setShowProxyInput(false);
  };

  const handleSavePattern = () => {
    const error = validators.regex(patternInput.trim());
    if (error) {
      toast.show({ content: error, duration: 3000 });
      return;
    }
    setIPTVSettings({ proxyPattern: patternInput.trim() });
    toast.show(patternInput.trim() ? '代理规则已保存' : '代理规则已清除');
    setShowPatternInput(false);
  };

  const handleSaveTMDBToken = () => {
    const token = tmdbTokenInput.trim();
    setTmdbTokenError(null);
    setTMDBToken(token);
    setShowTMDBTokenInput(false);
    if (token) {
      toast.show('TMDB Token 已保存,正在加载数据…');
      void fetchAllHomeData();
    } else {
      toast.show('TMDB Token 已清除');
    }
  };

  const testTmdbConnection = async () => {
    setIsTestingTmdb(true);
    setTestTmdbResult(null);
    try {
      await fetchTrending('all', 'week');
      setTestTmdbResult({ ok: true, message: 'TMDB 连接正常' });
    } catch (err) {
      setTestTmdbResult({ ok: false, message: `连接失败：${err instanceof Error ? err.message : '未知错误'}` });
    } finally {
      setIsTestingTmdb(false);
    }
  };

  const testProxyConnection = async (proxyUrl: string) => {
    setIsTestingProxy(true);
    setTestProxyResult(null);
    try {
      await httpClient.head(proxyUrl, { timeout: 5000 });
      setTestProxyResult({ ok: true, message: '代理连接正常' });
    } catch (err) {
      setTestProxyResult({ ok: false, message: `连接失败：${err instanceof Error ? err.message : '未知错误'}` });
    } finally {
      setIsTestingProxy(false);
    }
  };

  const testCorsProxyConnection = async (proxyUrl: string) => {
    setIsTestingCorsProxy(true);
    setTestCorsProxyResult(null);
    try {
      const testTarget = 'https://httpbin.org/get';
      const proxy = proxyUrl.trim();
      let fullUrl = proxy;
      if (!proxy.includes('/proxy')) {
        fullUrl = proxy.replace(/\/$/, '') + '/proxy?url=' + encodeURIComponent(testTarget);
      } else if (!proxy.endsWith('url=') && !proxy.endsWith('url=%')) {
        fullUrl = proxy.endsWith('?')
          ? proxy + 'url=' + encodeURIComponent(testTarget)
          : proxy.endsWith('/')
            ? proxy + 'url=' + encodeURIComponent(testTarget)
            : proxy + '?url=' + encodeURIComponent(testTarget);
      } else {
        fullUrl = proxy + encodeURIComponent(testTarget);
      }
      const resp = await fetch(fullUrl, { method: 'GET', signal: AbortSignal.timeout(8000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      if (!text || text.length < 10) throw new Error('响应内容异常');
      setTestCorsProxyResult({ ok: true, message: 'CORS 代理连接正常' });
    } catch (err) {
      setTestCorsProxyResult({ ok: false, message: `连接失败：${err instanceof Error ? err.message : '未知错误'}` });
    } finally {
      setIsTestingCorsProxy(false);
    }
  };

  return (
    <div className="page-padding settings-page w-full space-y-4 lg:grid lg:grid-cols-2 lg:gap-[var(--space-sm)] lg:space-y-0">
      <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm">
        <List header="外观">
          <List.Item
            title="主题模式"
            extra={
              <div className="theme-switcher">
                <button
                  className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                  aria-label="浅色模式"
                >
                  <Sun size={18} />
                </button>
                <button
                  className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                  aria-label="深色模式"
                >
                  <Moon size={18} />
                </button>
                <button
                  className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
                  onClick={() => setTheme('system')}
                  aria-label="跟随系统"
                >
                  <Monitor size={18} />
                </button>
              </div>
            }
          />
          <List.Item
            title="皮肤"
            description="为页面叠加美术资源"
            extra={
              <div className="skin-switcher">
                {([
                  { value: 'default', label: '默认', bg: '' },
                  { value: 'cartoon', label: '卡通', bg: '/art-skins/cartoon/bg.svg' },
                  { value: 'mechanical', label: '机械', bg: '/art-skins/mechanical/bg.svg' },
                  { value: 'retro', label: '复古', bg: '/art-skins/retro/bg.svg' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`skin-btn ${skin === opt.value ? 'active' : ''}`}
                    onClick={() => setSkin(opt.value)}
                    aria-label={opt.label}
                  >
                    <span
                      className="skin-btn__swatch"
                      style={opt.bg ? { backgroundImage: `url(${opt.bg})` } : undefined}
                    />
                    <span className="skin-btn__label">{opt.label}</span>
                  </button>
                ))}
              </div>
            }
          />
        </List>
      </section>

      <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm">
        <List header="TMDB">
          <List.Item
            title="TMDB Access Token"
            description={tmdbAccessToken ? '已配置' : '未配置（首页 TMDB 发现将不可用）'}
            extra={
              <Button size="sm" className="settings-btn-mini" onClick={() => {
                setTMDBTokenInput(tmdbAccessToken || '');
                setShowTMDBTokenInput(true);
              }}>
                配置
              </Button>
            }
          />
          <List.Item
            title="TMDB 语言"
            description="影响影片标题、简介等信息的显示语言"
            extra={
              <div className="source-multi-dropdown">
                <button
                  ref={tmdbLangDropdown.triggerRef}
                  className="source-multi-trigger"
                  onClick={() => setShowTmdbLangSelect(!showTmdbLangSelect)}
                >
                  <span>{({ 'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'en-US': 'English', 'ja-JP': '日本語', 'ko-KR': '한국어' } as Record<string, string>)[tmdbLanguage] || tmdbLanguage}</span>
                  <ChevronDown size={14} className={showTmdbLangSelect ? 'rotated' : ''} />
                </button>
                <PortalDropdown isOpen={showTmdbLangSelect} position={tmdbLangDropdown.position} onClose={closeAllDropdowns} triggerRef={tmdbLangDropdown.triggerRef}>
                  {([
                    { value: 'zh-CN', label: '简体中文' },
                    { value: 'zh-TW', label: '繁體中文' },
                    { value: 'en-US', label: 'English' },
                    { value: 'ja-JP', label: '日本語' },
                    { value: 'ko-KR', label: '한국어' },
                  ]).map((opt) => (
                    <label key={opt.value} className="source-multi-option">
                      <input
                        type="radio"
                        name="tmdb-lang"
                        checked={tmdbLanguage === opt.value}
                        onChange={() => { setTMDBLanguage(opt.value); setShowTmdbLangSelect(false); }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </PortalDropdown>
              </div>
            }
          />
        </List>
      </section>

      <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm">
        <List header="视频源">
          <List.Item
            title={
              <>
                视频数据源
                <HelpPopover title="视频数据源" content="选择视频采集API数据源。支持多选（最多6个），播放时会同时从多个源搜索匹配资源。" />
              </>
            }
            description="选择视频数据源（最多6个）"
            extra={
              <div className="source-multi-dropdown">
                <button
                  ref={videoDropdown.triggerRef}
                  className="source-multi-trigger"
                  onClick={() => setShowMultiSelect(!showMultiSelect)}
                >
                  <span>已选 {(videoSourceIndices || []).length} 项</span>
                  <ChevronDown size={14} className={showMultiSelect ? 'rotated' : ''} />
                </button>
                <PortalDropdown isOpen={showMultiSelect} position={videoDropdown.position} onClose={closeAllDropdowns} triggerRef={videoDropdown.triggerRef}>
                  {videoSources.map((source, index) => (
                    <label key={index} className="source-multi-option">
                      <input
                        type="checkbox"
                        checked={(videoSourceIndices || [0]).includes(index)}
                        onChange={() => handleVideoSourceToggle(index)}
                      />
                      <span>{source.name}</span>
                    </label>
                  ))}
                </PortalDropdown>
              </div>
            }
          />
          <List.Item
            title={
              <>
                视频采集CORS 代理
                <HelpPopover title="CORS 代理" content="CORS（跨域资源共享）代理用于绕过浏览器的跨域限制，让应用能访问其他服务器的视频数据。如果遇到跨域错误，请配置代理地址。留空则使用默认代理。" />
              </>
            }
            description={corsProxy || '默认: 不使用代理'}
            extra={
              <Button size="sm" className="settings-btn-mini" onClick={() => {
                setCorsProxyInput(corsProxy || '');
                setShowCorsProxyInput(true);
              }}>
                配置
              </Button>
            }
          />
          <List.Item
            title={
              <>
                音量记忆
                <HelpPopover title="音量记忆" content="开启后会记住上次播放时的音量大小，下次打开播放器时自动恢复。" />
              </>
            }
            description="记住上次播放时的音量大小"
            extra={
              <Switch
                checked={rememberVolume}
                onChange={setRememberVolume}
              />
            }
          />
          <List.Item
            title={
              <>
                自动翻译字幕
                <HelpPopover title="自动翻译字幕" content="开启后会自动调用百度翻译API将字幕翻译成目标语言。需要先配置百度翻译API。" />
              </>
            }
            description="开启后自动将字幕翻译成目标语言"
            extra={
              <Switch
                checked={autoTranslate}
                onChange={setAutoTranslate}
              />
            }
          />
          <List.Item
            title={
              <>
                百度翻译 API
                <HelpPopover title="百度翻译 API" content="配置百度翻译开放平台的App ID和密钥，用于自动翻译字幕功能。" />
              </>
            }
            description={translationAppId && translationApiKey ? '已配置' : '未配置'}
            extra={
              <Button size="sm" className="settings-btn-mini" onClick={() => {
                setAppIdInput(translationAppId || '');
                setApiKeyInput(translationApiKey || '');
                setShowApiInput(true);
              }}>
                {translationAppId && translationApiKey ? '修改' : '配置'}
              </Button>
            }
          />
        </List>
      </section>

      <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm">
        <List header="播放设置">
          <List.Item
            title={
              <>
                跳过片头
                <HelpPopover title="跳过片头" content="开启后播放视频时自动跳过片头部分。可在下方设置跳过时长。" />
              </>
            }
            description="播放时自动跳过片头"
            extra={
              <Switch
                checked={skipIntro}
                onChange={setSkipIntro}
              />
            }
          />
          <List.Item
            title="片头跳过时长"
            description={`${skipIntroDuration} 秒`}
            extra={
              <div className="settings-counter">
                <button
                  className="settings-counter-btn"
                  onClick={() => setSkipIntroDuration(Math.max(10, skipIntroDuration - 10))}
                  disabled={skipIntroDuration <= 10}
                >
                  -
                </button>
                <span className="settings-counter-value">{skipIntroDuration}</span>
                <button
                  className="settings-counter-btn"
                  onClick={() => setSkipIntroDuration(Math.min(300, skipIntroDuration + 10))}
                  disabled={skipIntroDuration >= 300}
                >
                  +
                </button>
              </div>
            }
          />
          <List.Item
            title={
              <>
                跳过片尾
                <HelpPopover title="跳过片尾" content="开启后播放视频接近结尾时自动跳转到下一集或结束播放。可在下方设置提前多少秒触发。" />
              </>
            }
            description="播放时自动跳过片尾"
            extra={
              <Switch
                checked={skipOutro}
                onChange={setSkipOutro}
              />
            }
          />
          <List.Item
            title="片尾跳过时长"
            description={`${skipOutroDuration} 秒`}
            extra={
              <div className="settings-counter">
                <button
                  className="settings-counter-btn"
                  onClick={() => setSkipOutroDuration(Math.max(10, skipOutroDuration - 10))}
                  disabled={skipOutroDuration <= 10}
                >
                  -
                </button>
                <span className="settings-counter-value">{skipOutroDuration}</span>
                <button
                  className="settings-counter-btn"
                  onClick={() => setSkipOutroDuration(Math.min(300, skipOutroDuration + 10))}
                  disabled={skipOutroDuration >= 300}
                >
                  +
                </button>
              </div>
            }
          />
          <List.Item
            title={
              <>
                自动连播
                <HelpPopover title="自动连播" content="剧集播放结束后自动播放下一集。关闭后需要手动点击播放下一集。" />
              </>
            }
            description="剧集播放结束后自动播放下一集"
            extra={
              <Switch
                checked={autoPlay}
                onChange={setAutoPlay}
              />
            }
          />
        </List>
      </section>

      <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm">
        <List header="IPTV">
          <List.Item
            title={
              <>
                IPTV 数据源
                <HelpPopover title="IPTV 数据源" content="选择IPTV M3U播放列表数据源。支持多选（最多3个），可同时加载多个源的频道。" />
              </>
            }
            description="选择IPTV数据源（支持多选，最多3个）"
            extra={
              <div className="source-multi-dropdown">
                <button
                  ref={iptvDropdown.triggerRef}
                  className="source-multi-trigger"
                  onClick={() => setShowIptvMultiSelect(!showIptvMultiSelect)}
                >
                  <span>已选 {(iptvSourceIndices || []).length} 项</span>
                  <ChevronDown size={14} className={showIptvMultiSelect ? 'rotated' : ''} />
                </button>
                <PortalDropdown isOpen={showIptvMultiSelect} position={iptvDropdown.position} onClose={closeAllDropdowns} triggerRef={iptvDropdown.triggerRef}>
                  {iptvSources.map((source, index) => (
                    <label key={index} className="source-multi-option">
                      <input
                        type="checkbox"
                        checked={(iptvSourceIndices || [0]).includes(index)}
                        onChange={() => handleIPTVSourceToggle(index)}
                      />
                      <span>{source.name}</span>
                    </label>
                  ))}
                </PortalDropdown>
              </div>
            }
          />
          <List.Item
            title={
              <>
                节目单源
                <HelpPopover title="节目单源" content="EPG（电子节目单）用于显示频道当前播放的节目信息。选择节目单数据源，支持多选，可从多个源获取节目数据。" />
              </>
            }
            description="选择节目单数据源（支持多选）"
            extra={
              <div className="source-multi-dropdown">
                <button
                  ref={epgDropdown.triggerRef}
                  className="source-multi-trigger"
                  onClick={() => setShowEpgMultiSelect(!showEpgMultiSelect)}
                >
                  <span>已选 {epgUrls.length} 项</span>
                  <ChevronDown size={14} className={showEpgMultiSelect ? 'rotated' : ''} />
                </button>
                <PortalDropdown isOpen={showEpgMultiSelect} position={epgDropdown.position} onClose={closeAllDropdowns} triggerRef={epgDropdown.triggerRef}>
                  {epgSources.map((source) => (
                    <label key={source.url} className="source-multi-option">
                      <input
                        type="checkbox"
                        checked={epgUrls.includes(source.url)}
                        onChange={() => handleEpgToggle(source.url)}
                      />
                      <span>{source.name}</span>
                    </label>
                  ))}
                </PortalDropdown>
              </div>
            }
          />
          <List.Item
            title={
              <>
                节目单更新间隔
                <HelpPopover title="节目单更新间隔" content="设置节目单数据的自动更新间隔时间。建议6-12小时更新一次，避免频繁请求。" />
              </>
            }
            description={`${epgUpdateInterval} 小时`}
            extra={
              <div className="settings-counter">
                <button
                  className="settings-counter-btn"
                  onClick={() => setEpgUpdateInterval(Math.max(1, epgUpdateInterval - 1))}
                  disabled={epgUpdateInterval <= 1}
                >
                  -
                </button>
                <span className="settings-counter-value">{epgUpdateInterval}</span>
                <button
                  className="settings-counter-btn"
                  onClick={() => setEpgUpdateInterval(Math.min(24, epgUpdateInterval + 1))}
                  disabled={epgUpdateInterval >= 24}
                >
                  +
                </button>
              </div>
            }
          />
          <List.Item
            title={
              <>
                  IPTV代理服务器地址
                <HelpPopover title="流代理地址" content="IPTV 播放依赖此代理绕过浏览器跨域限制，未配置将可能无法播放。部署 Cloudflare Worker 后填入地址，格式如 https://your-worker.workers.dev" />
              </>
            }
            description={iptvSettings.proxyUrl || '未配置'}
            extra={
              <Button size="sm" className="settings-btn-mini" onClick={() => {
                setProxyUrlInput(iptvSettings.proxyUrl || '');
                setProxyUrlError(null);
                setShowProxyInput(true);
              }}>
                配置
              </Button>
            }
          />
          <List.Item
            title={
              <>
                代理规则
                <HelpPopover title="代理规则" content="设置代理规则正则表达式。匹配正则的URL不走代理，其余走代理。留空则所有地址都走代理。用于区分需要代理和不需要代理的流地址。" />
              </>
            }
            description={iptvSettings.proxyPattern || '默认: 全部走代理（留空即全部代理）'}
            extra={
              <Button size="sm" className="settings-btn-mini" onClick={() => {
                setPatternInput(iptvSettings.proxyPattern || DEFAULT_PROXY_PATTERN);
                setShowPatternInput(true);
              }}>
                配置
              </Button>
            }
          />
          <List.Item
            title={
              <>
                自动刷新频道
                <HelpPopover title="自动刷新频道" content="开启后会定期从数据源拉取最新的频道列表并更新缓存。" />
              </>
            }
            description="定期自动更新频道列表"
            extra={
              <Switch
                checked={iptvSettings.autoRefresh}
                onChange={(v) => setIPTVSettings({ autoRefresh: v })}
              />
            }
          />
          <List.Item
            title={
              <>
                刷新间隔
                <HelpPopover title="刷新间隔" content="设置频道列表的自动刷新间隔时间。建议6-24小时更新一次，避免频繁请求。" />
              </>
            }
            description={`${iptvSettings.refreshIntervalHours} 小时`}
            extra={
              <div className="settings-counter">
                <button
                  className="settings-counter-btn"
                  onClick={() => setIPTVSettings({ refreshIntervalHours: Math.max(1, iptvSettings.refreshIntervalHours - 1) })}
                  disabled={iptvSettings.refreshIntervalHours <= 1}
                >
                  -
                </button>
                <span className="settings-counter-value">{iptvSettings.refreshIntervalHours}</span>
                <button
                  className="settings-counter-btn"
                  onClick={() => setIPTVSettings({ refreshIntervalHours: Math.min(72, iptvSettings.refreshIntervalHours + 1) })}
                  disabled={iptvSettings.refreshIntervalHours >= 72}
                >
                  +
                </button>
              </div>
            }
          />
        </List>
      </section>

      <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm">
        <List header="关于">
          <div className="version-item">
            <List.Item title="版本" extra="1.0.0" onClick={handleVersionClick} clickable />
          </div>
          <List.Item title="影视大全" description="聚合影视剧和IPTV资源" />
        </List>
      </section>

      <Modal
        visible={showApiInput}
        title="配置百度翻译 API"
        className="modal-content--settings"
        content={
          <div className="setting-modal-content">
            <div className="setting-modal-desc">
              在百度翻译开放平台申请通用翻译API，获取 App ID 和密钥
            </div>
            <div className="settings-input-group">
              <label htmlFor="baidu-translate-app-id" className="settings-label">
                App ID
              </label>
              <div className="settings-input-wrapper">
                <input
                  id="baidu-translate-app-id"
                  type="text"
                  name="baiduTranslateAppId"
                  autoComplete="off"
                  placeholder="请输入 App ID"
                  value={appIdInput}
                  onChange={(e) => setAppIdInput(e.target.value)}
                  className={`setting-modal-input ${appIdInput ? 'setting-modal-input--has-clear' : ''}`}
                />
                {appIdInput && (
                  <button
                    type="button"
                    className="settings-input-clear"
                    onClick={() => setAppIdInput('')}
                    aria-label="清除"
                  >&#x2715;</button>
                )}
              </div>
            </div>
            <div className="settings-input-group">
              <label htmlFor="baidu-translate-secret-key" className="settings-label">
                Secret Key <span className="settings-required">*</span>
              </label>
              <div className="settings-input-wrapper">
                <input
                  id="baidu-translate-secret-key"
                  type="password"
                  name="baiduTranslateSecretKey"
                  autoComplete="off"
                  placeholder="请输入 Secret Key"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className={`setting-modal-input ${apiKeyInput ? 'setting-modal-input--has-clear' : ''}`}
                  aria-describedby="baidu-translate-secret-key-help"
                  aria-required="true"
                />
                {apiKeyInput && (
                  <button
                    type="button"
                    className="settings-input-clear"
                    onClick={() => setApiKeyInput('')}
                    aria-label="清除"
                  >&#x2715;</button>
                )}
              </div>
              <p id="baidu-translate-secret-key-help" className="settings-help">
                在百度翻译开放平台的"开发者信息"中获取
              </p>
            </div>
            <div className="setting-modal-actions">
              <Button size="sm" onClick={() => setShowApiInput(false)}>取消</Button>
              <Button size="sm" variant="default" onClick={handleSaveApiKey}>保存</Button>
            </div>
          </div>
        }
        closeOnAction
        onClose={() => setShowApiInput(false)}
      />

      <Modal
        visible={showProxyInput}
        title="配置流代理地址"
        className="modal-content--settings"
        content={
          <div className="setting-modal-content">
            <div className="setting-modal-desc">
              部署 worker/m3u8-proxy.js 到 Cloudflare Workers 后，将 Worker URL 填入此处。<br />
              <a href="https://dash.cloudflare.com/?to=/:account/workers-and-pages" target="_blank" rel="noopener noreferrer" className="settings-link">
                前往 Cloudflare Workers 控制台
              </a>
            </div>
            <div className="settings-input-group">
              <label htmlFor="stream-proxy-url" className="settings-label">
                代理服务器地址
              </label>
              <div className="settings-input-wrapper">
                <input
                  id="stream-proxy-url"
                  type="url"
                  name="streamProxyUrl"
                  autoComplete="off"
                  placeholder="https://your-worker.workers.dev"
                  value={proxyUrlInput}
                  onChange={(e) => {
                    setProxyUrlInput(e.target.value);
                    setProxyUrlError(null);
                  }}
                  className={`setting-modal-input ${proxyUrlInput ? 'setting-modal-input--has-clear' : ''} ${proxyUrlError ? 'settings-input--error' : ''}`}
                  aria-describedby="stream-proxy-url-help stream-proxy-url-error"
                />
                {proxyUrlInput && (
                  <button
                    type="button"
                    className="settings-input-clear"
                    onClick={() => { setProxyUrlInput(''); setProxyUrlError(null); }}
                    aria-label="清除"
                  >&#x2715;</button>
                )}
              </div>
              <p id="stream-proxy-url-help" className="settings-help">
                格式：https://your-worker.workers.dev
              </p>
              {proxyUrlError && (
                <p id="stream-proxy-url-error" className="settings-error" role="alert">
                  {proxyUrlError}
                </p>
              )}
            </div>
            <div className="settings-test-row">
              <Button
                size="sm"
                onClick={() => testProxyConnection(proxyUrlInput.trim())}
                disabled={isTestingProxy || !proxyUrlInput.trim()}
              >
                {isTestingProxy ? '测试中...' : '测试连接'}
              </Button>
              {testProxyResult && (
                <span className={testProxyResult.ok ? 'text-success' : 'text-error'}>
                  {testProxyResult.message}
                </span>
              )}
            </div>
            <div className="setting-modal-actions">
              <Button size="sm" onClick={() => setShowProxyInput(false)}>取消</Button>
              <Button size="sm" variant="default" onClick={handleSaveProxyUrl}>保存</Button>
            </div>
          </div>
        }
        closeOnAction
        onClose={() => setShowProxyInput(false)}
      />

      <Modal
        visible={showPatternInput}
        title="配置代理规则"
        className="modal-content--settings"
        content={
          <div className="setting-modal-content">
            <div className="setting-modal-desc">
              匹配正则的 URL 不走代理，其余走代理。<br />
              留空则所有地址都走代理。
            </div>
            <div className="settings-input-group">
              <label htmlFor="proxy-pattern" className="settings-label">
                正则表达式
              </label>
              <div className="settings-input-wrapper">
                <input
                  id="proxy-pattern"
                  type="text"
                  name="proxyPattern"
                  autoComplete="off"
                  placeholder="miguvideo\\.com|101\\.35\\.240\\.114"
                  value={patternInput}
                  onChange={(e) => setPatternInput(e.target.value)}
                  className={`setting-modal-input ${patternInput ? 'setting-modal-input--has-clear' : ''}`}
                  aria-describedby="proxy-pattern-help"
                />
                {patternInput && (
                  <button
                    type="button"
                    className="settings-input-clear"
                    onClick={() => setPatternInput('')}
                    aria-label="清除"
                  >&#x2715;</button>
                )}
              </div>
              <p id="proxy-pattern-help" className="settings-help">
                匹配的 URL 不走代理，其余走代理
              </p>
            </div>
            <div className="setting-modal-actions">
              <Button size="sm" onClick={() => {
                setPatternInput(DEFAULT_PROXY_PATTERN);
              }}>恢复默认</Button>
              <Button size="sm" onClick={() => setShowPatternInput(false)}>取消</Button>
              <Button size="sm" variant="default" onClick={handleSavePattern}>保存</Button>
            </div>
          </div>
        }
        closeOnAction
        onClose={() => setShowPatternInput(false)}
      />

      <Modal
        visible={showCorsProxyInput}
        title="配置 CORS 代理地址"
        className="modal-content--settings"
        content={
          <div className="setting-modal-content">
            <div className="setting-modal-desc">
              CORS（跨域资源共享）代理用于绕过浏览器的跨域限制，让应用能访问其他服务器的视频数据。<br />
              留空则使用默认代理 corsproxy.io。<br />
              常见格式: https://your-proxy.workers.dev<br />
              <a href="https://dash.cloudflare.com/?to=/:account/workers-and-pages" target="_blank" rel="noopener noreferrer" className="settings-link">
                前往 Cloudflare Workers 控制台
              </a>
            </div>
            <div className="settings-input-group">
              <label htmlFor="cors-proxy-url" className="settings-label">
                代理服务器地址（可选）
              </label>
              <div className="settings-input-wrapper">
                <input
                  id="cors-proxy-url"
                  type="url"
                  name="corsProxyUrl"
                  autoComplete="off"
                  placeholder="https://your-worker.workers.dev"
                  value={corsProxyInput}
                  onChange={(e) => {
                    setCorsProxyInput(e.target.value);
                    setCorsProxyError(null);
                  }}
                  className={`setting-modal-input ${corsProxyInput ? 'setting-modal-input--has-clear' : ''} ${corsProxyError ? 'settings-input--error' : ''}`}
                  aria-describedby="cors-proxy-url-help cors-proxy-url-error"
                />
                {corsProxyInput && (
                  <button
                    type="button"
                    className="settings-input-clear"
                    onClick={() => { setCorsProxyInput(''); setCorsProxyError(null); }}
                    aria-label="清除"
                  >&#x2715;</button>
                )}
              </div>
              <p id="cors-proxy-url-help" className="settings-help">
                格式：https://your-worker.workers.dev（可选，留空使用默认代理）
              </p>
              {corsProxyError && (
                <p id="cors-proxy-url-error" className="settings-error" role="alert">
                  {corsProxyError}
                </p>
              )}
            </div>
            <div className="settings-test-row">
              <Button
                size="sm"
                onClick={() => testCorsProxyConnection(corsProxyInput.trim())}
                disabled={isTestingCorsProxy || !corsProxyInput.trim()}
              >
                {isTestingCorsProxy ? '测试中...' : '测试连接'}
              </Button>
              {testCorsProxyResult && (
                <span className={testCorsProxyResult.ok ? 'text-success' : 'text-error'}>
                  {testCorsProxyResult.message}
                </span>
              )}
            </div>
            <div className="setting-modal-actions">
              <Button size="sm" onClick={() => setShowCorsProxyInput(false)}>取消</Button>
              <Button size="sm" variant="default" onClick={() => {
                const error = validators.url(corsProxyInput.trim());
                setCorsProxyError(error);
                if (error) return;
                setCorsProxy(corsProxyInput.trim());
                setShowCorsProxyInput(false);
                toast.show(corsProxyInput.trim() ? 'CORS 代理已保存' : 'CORS 代理已清空');
              }}>保存</Button>
            </div>
          </div>
        }
        closeOnAction
        onClose={() => setShowCorsProxyInput(false)}
      />

      <Modal
        visible={showTMDBTokenInput}
        title="配置 TMDB Access Token"
        className="modal-content--settings"
        content={
          <div className="setting-modal-content">
            <div className="setting-modal-desc">
              TMDB（The Movie Database）是一个免费的电影数据库，提供影片信息、海报、评分等。配置 Token 后可获取更丰富的影片详情。<br />
              请前往 <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="settings-link">themoviedb.org/settings/api</a> 申请 API 密钥（免费），<br />
              在 API 密钥页面获取 "API 读访问令牌 (v4 auth)" 或 "Bearer Token"。
            </div>
            <div className="settings-input-group">
              <label htmlFor="tmdb-access-token" className="settings-label">
                Access Token <span className="settings-required">*</span>
              </label>
              <div className="settings-input-wrapper">
                <input
                  id="tmdb-access-token"
                  type="password"
                  name="tmdbAccessToken"
                  autoComplete="off"
                  placeholder="输入 TMDB Access Token（Bearer Token）"
                  value={tmdbTokenInput}
                  onChange={(e) => {
                    setTMDBTokenInput(e.target.value);
                    setTmdbTokenError(null);
                  }}
                  className={`setting-modal-input ${tmdbTokenInput ? 'setting-modal-input--has-clear' : ''} ${tmdbTokenError ? 'settings-input--error' : ''}`}
                  aria-describedby="tmdb-access-token-help tmdb-access-token-error"
                  aria-required="true"
                />
                {tmdbTokenInput && (
                  <button
                    type="button"
                    className="settings-input-clear"
                    onClick={() => { setTMDBTokenInput(''); setTmdbTokenError(null); }}
                    aria-label="清除"
                  >&#x2715;</button>
                )}
              </div>
              <p id="tmdb-access-token-help" className="settings-help">
                格式：eyJhbGciOi...（在 TMDB 网站获取）
              </p>
              {tmdbTokenError && (
                <p id="tmdb-access-token-error" className="settings-error" role="alert">
                  {tmdbTokenError}
                </p>
              )}
            </div>
            <div className="settings-test-row">
              <Button
                size="sm"
                onClick={() => testTmdbConnection()}
                disabled={isTestingTmdb || !tmdbTokenInput.trim()}
              >
                {isTestingTmdb ? '测试中...' : '测试连接'}
              </Button>
              {testTmdbResult && (
                <span className={testTmdbResult.ok ? 'text-success' : 'text-error'}>
                  {testTmdbResult.message}
                </span>
              )}
            </div>
            <div className="setting-modal-actions">
              <Button size="sm" onClick={() => setShowTMDBTokenInput(false)}>取消</Button>
              <Button size="sm" variant="default" onClick={handleSaveTMDBToken}>保存</Button>
            </div>
          </div>
        }
        closeOnAction
        onClose={() => setShowTMDBTokenInput(false)}
      />

    </div>
  );
}
