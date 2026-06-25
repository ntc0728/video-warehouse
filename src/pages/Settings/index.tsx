/**
 * 设置页面
 * 提供主题切换、数据源配置、IPTV 代理设置、翻译 API 配置等功能
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { List, Switch, Button, Modal, toast, HelpPopover } from '@/components/ui';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useIPTVStore, useSettingsStore, useTMDBStore } from '@/stores';
import { getVideoSources, getIPTVSources, getEPGSources } from '@/services/sourceService';
import { useDropdownPosition } from '@/hooks/useDropdownPosition';
import { PortalDropdown } from '@/components/common/PortalDropdown';
import type { EPGSourceConfig } from '@/types';
import type { VideoSourceConfig, IPTVSourceConfig } from '@/types/source';
import './Settings.css';

export default function SettingsPage() {
  const { translationAppId, translationApiKey, setTranslationAppId, setTranslationApiKey, autoTranslate, setAutoTranslate } = useSettingsStore();
  const { settings: iptvSettings, setSettings: setIPTVSettings } = useIPTVStore();
  const tmdbStore = useTMDBStore();
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
  const DEFAULT_PROXY_PATTERN = 'miguvideo\\.com|101\\.35\\.240\\.114';
  const [showCorsProxyInput, setShowCorsProxyInput] = useState(false);
  const [corsProxyInput, setCorsProxyInput] = useState('');
  const [showTMDBTokenInput, setShowTMDBTokenInput] = useState(false);
  const [tmdbTokenInput, setTMDBTokenInput] = useState('');
  const [showMultiSelect, setShowMultiSelect] = useState(false);
  const [showIptvMultiSelect, setShowIptvMultiSelect] = useState(false);
  const [showEpgMultiSelect, setShowEpgMultiSelect] = useState(false);
  const [showTmdbLangSelect, setShowTmdbLangSelect] = useState(false);

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
    if (newIndices.length > 0) {
      setVideoSourceIndices(newIndices);
    }
  };

  /** 多选 IPTV 数据源（最多3个） */
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
      useIPTVStore.getState().refreshChannels();
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
    setIPTVSettings({ proxyUrl: proxyUrlInput.trim() });
    toast.show(proxyUrlInput.trim() ? '代理地址已保存' : '代理地址已清除');
    setShowProxyInput(false);
  };

  const handleSavePattern = () => {
    setIPTVSettings({ proxyPattern: patternInput.trim() });
    toast.show(patternInput.trim() ? '代理规则已保存' : '代理规则已清除');
    setShowPatternInput(false);
  };

  const handleSaveTMDBToken = () => {
    const token = tmdbTokenInput.trim();
    setTMDBToken(token);
    setShowTMDBTokenInput(false);
    if (token) {
      toast.show('TMDB Token 已保存,正在加载数据…');
      void tmdbStore.fetchAllHomeData();
    } else {
      toast.show('TMDB Token 已清除');
    }
  };

  return (
    <div className="settings-page w-full space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
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
        </List>
      </section>

      <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm">
        <List header="TMDB">
        <List.Item
          title="TMDB Access Token"
          description={tmdbAccessToken ? '已配置' : '未配置（首页 TMDB 发现将不可用）'}
          extra={
            <Button size="small" className="settings-btn-mini" onClick={() => {
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
              <HelpPopover title="CORS 代理" content="用于代理视频源API请求，解决浏览器跨域限制。如果视频源有CORS问题，请配置代理地址。留空则使用默认代理。" />
            </>
          }
          description={corsProxy || '默认: 不使用代理'}
          extra={
            <Button size="small" className="settings-btn-mini" onClick={() => {
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
            <Button size="small" className="settings-btn-mini" onClick={() => {
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
              <HelpPopover title="节目单源" content="选择EPG节目单数据源，用于显示频道当前播放的节目信息。支持多选，可从多个源获取节目数据。" />
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
              流代理地址
              <HelpPopover title="流代理地址" content="配置Cloudflare Worker代理地址，用于代理IPTV流媒体请求，解决跨域问题。" />
            </>
          }
          description={iptvSettings.proxyUrl || '未配置'}
          extra={
            <Button size="small" className="settings-btn-mini" onClick={() => {
              setProxyUrlInput(iptvSettings.proxyUrl || '');
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
          description={iptvSettings.proxyPattern || '默认: 匹配 miguvideo.com 和 IP 不走代理'}
          extra={
            <Button size="small" className="settings-btn-mini" onClick={() => {
              setPatternInput(iptvSettings.proxyPattern || DEFAULT_PROXY_PATTERN);
              setShowPatternInput(true);
            }}>
              配置
            </Button>
          }
        />
        </List>
      </section>

      <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm lg:col-span-2">
        <List header="关于">
        <List.Item title="版本" extra="1.0.0" />
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
            <input
              type="text"
              placeholder="请输入 App ID"
              value={appIdInput}
              onChange={(e) => setAppIdInput(e.target.value)}
              className="setting-modal-input"
            />
            <input
              type="text"
              placeholder="请输入 Secret Key"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="setting-modal-input"
            />
            <div className="setting-modal-actions">
              <Button size="small" onClick={() => setShowApiInput(false)}>取消</Button>
              <Button size="small" color="primary" onClick={handleSaveApiKey}>保存</Button>
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
              部署 worker/m3u8-proxy.js 到 Cloudflare Workers 后，将 Worker URL 填入此处
            </div>
            <input
              type="text"
              placeholder="https://your-worker.workers.dev"
              value={proxyUrlInput}
              onChange={(e) => setProxyUrlInput(e.target.value)}
              className="setting-modal-input"
            />
            <div className="setting-modal-actions">
              {proxyUrlInput && (
                <Button size="small" onClick={() => {
                  setProxyUrlInput('');
                }}>清除</Button>
              )}
              <Button size="small" onClick={() => setShowProxyInput(false)}>取消</Button>
              <Button size="small" color="primary" onClick={handleSaveProxyUrl}>保存</Button>
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
            <input
              type="text"
              placeholder="miguvideo\\.com|101\\.35\\.240\\.114"
              value={patternInput}
              onChange={(e) => setPatternInput(e.target.value)}
              className="setting-modal-input"
            />
            <div className="setting-modal-actions">
              {patternInput && (
                <Button size="small" onClick={() => {
                  setPatternInput('');
                }}>清除</Button>
              )}
              <Button size="small" onClick={() => {
                setPatternInput(DEFAULT_PROXY_PATTERN);
              }}>恢复默认</Button>
              <Button size="small" onClick={() => setShowPatternInput(false)}>取消</Button>
              <Button size="small" color="primary" onClick={handleSavePattern}>保存</Button>
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
              用于代理视频源 API 请求，解决浏览器跨域限制。<br />
              留空则使用默认代理 corsproxy.io。<br />
              常见格式: https://your-proxy.workers.dev
            </div>
            <input
              type="text"
              placeholder="https://your-worker.workers.dev"
              value={corsProxyInput}
              onChange={(e) => setCorsProxyInput(e.target.value)}
              className="setting-modal-input"
            />
            <div className="setting-modal-actions">
              {corsProxyInput && (
                <Button size="small" onClick={() => {
                  setCorsProxyInput('');
                }}>恢复默认</Button>
              )}
              <Button size="small" onClick={() => setShowCorsProxyInput(false)}>取消</Button>
              <Button size="small" color="primary" onClick={() => {
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
              用于访问 TMDB API 获取电影和剧集数据。<br />
              请前往 <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>themoviedb.org/settings/api</a> 申请 API 密钥（免费），<br />
              在 API 密钥页面获取 "API 读访问令牌 (v4 auth)" 或 "Bearer Token"。
            </div>
            <input
              type="password"
              placeholder="输入 TMDB Access Token（Bearer Token）"
              value={tmdbTokenInput}
              onChange={(e) => setTMDBTokenInput(e.target.value)}
              className="setting-modal-input"
            />
            <div className="setting-modal-actions">
              {tmdbTokenInput && (
                <Button size="small" onClick={() => {
                  setTMDBTokenInput('');
                }}>清除</Button>
              )}
              <Button size="small" onClick={() => setShowTMDBTokenInput(false)}>取消</Button>
              <Button size="small" color="primary" onClick={handleSaveTMDBToken}>保存</Button>
            </div>
          </div>
        }
        closeOnAction
        onClose={() => setShowTMDBTokenInput(false)}
      />

    </div>
  );
}
