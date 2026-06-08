/**
 * 设置页面
 * 提供主题切换、数据源配置、IPTV 代理设置、翻译 API 配置等功能
 */
import { useState, useEffect } from 'react';
import { List, Switch, Button, Modal, toast } from '@/components/ui';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useSubtitleStore, useIPTVStore, useSettingsStore, useVideoStore, useTMDBStore } from '@/stores';
import { getVideoSources, getIPTVSources } from '@/services/sourceService';
import { fetchVideosBySource, fetchIPTVUrl } from '@/services/videoService';
import type { VideoSourceConfig, IPTVSourceConfig } from '@/types/source';
import './Settings.css';

export default function SettingsPage() {
  const { translationAppId, translationApiKey, setAppId, setApiKey, autoTranslate, setAutoTranslate } = useSubtitleStore();
  const { settings: iptvSettings, setSettings: setIPTVSettings } = useIPTVStore();
  const { setVideos, clearVideos } = useVideoStore();
  const tmdbStore = useTMDBStore();
  const {
    theme,
    setTheme,
    videoSourceIndex,
    iptvSourceIndex,
    setVideoSourceIndex,
    setIPTVSourceIndex,
    corsProxy,
    setCorsProxy,
    epgUrl,
    setEpgUrl,
    rememberVolume,
    setRememberVolume,
    tmdbAccessToken,
    setTMDBToken,
    tmdbLanguage,
    setTMDBLanguage,
  } = useSettingsStore();

  const [videoSources, setVideoSources] = useState<VideoSourceConfig[]>([]);
  const [iptvSources, setIptvSources] = useState<IPTVSourceConfig[]>([]);
  const [showApiInput, setShowApiInput] = useState(false);
  const [appIdInput, setAppIdInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showProxyInput, setShowProxyInput] = useState(false);
  const [proxyUrlInput, setProxyUrlInput] = useState('');
  const [showPatternInput, setShowPatternInput] = useState(false);
  const [patternInput, setPatternInput] = useState('');
  const [showCorsProxyInput, setShowCorsProxyInput] = useState(false);
  const [corsProxyInput, setCorsProxyInput] = useState('');
  const [showEpgInput, setShowEpgInput] = useState(false);
  const [epgUrlInput, setEpgUrlInput] = useState('');
  const [showTMDBTokenInput, setShowTMDBTokenInput] = useState(false);
  const [tmdbTokenInput, setTMDBTokenInput] = useState('');

  /** 初始化时加载视频和 IPTV 数据源配置 */
  useEffect(() => {
    const loadSources = async () => {
      const [videos, iptvs] = await Promise.all([
        getVideoSources(),
        getIPTVSources(),
      ]);
      setVideoSources(videos);
      setIptvSources(iptvs);
    };
    loadSources();
  }, []);

  const handleSaveApiKey = () => {
    setAppId(appIdInput.trim());
    setApiKey(apiKeyInput.trim());
    toast.show('翻译 API 配置已保存');
    setShowApiInput(false);
  };

  /** 切换视频数据源并重新加载视频列表 */
  const handleVideoSourceSelect = async (index: number) => {
    clearVideos();
    setVideoSourceIndex(index);
    const result = await fetchVideosBySource(index);
    setVideos(result.videos, index);
    toast.show({ content: `视频数据源已切换为: ${videoSources[index]?.name || '未知'}`, duration: 2000 });
  };

  /** 切换 IPTV 数据源并刷新频道列表 */
  const handleIPTVSourceSelect = async (index: number) => {
    setIPTVSourceIndex(index);
    const url = await fetchIPTVUrl(index);
    setIPTVSettings({ aggregatorUrl: url });
    toast.show({ content: `IPTV 源已切换为: ${iptvSources[index]?.name || '未知'}`, duration: 2000 });
    useIPTVStore.getState().refreshChannels();
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

  const handleSaveEpgUrl = () => {
    setEpgUrl(epgUrlInput.trim());
    toast.show(epgUrlInput.trim() ? '节目单源已保存' : '节目单源已恢复默认');
    setShowEpgInput(false);
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
    <div className="settings-page w-full space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0" style={{ padding: 'var(--space-md)' }}>
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
        <List header="视频源">
        <List.Item
          title="视频数据源"
          extra={
            <select
              className="source-select"
              value={videoSourceIndex}
              onChange={(e) => handleVideoSourceSelect(Number(e.target.value))}
            >
              {videoSources.map((source, index) => (
                <option key={index} value={index}>{source.name}</option>
              ))}
            </select>
          }
        />
        <List.Item
          title="视频采集CORS 代理"
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
            <select
              className="source-select"
              value={tmdbLanguage}
              onChange={(e) => setTMDBLanguage(e.target.value)}
            >
              <option value="zh-CN">简体中文</option>
              <option value="zh-TW">繁體中文</option>
              <option value="en-US">English</option>
              <option value="ja-JP">日本語</option>
              <option value="ko-KR">한국어</option>
            </select>
          }
        />
        </List>
      </section>

      <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm">
        <List header="IPTV">
        <List.Item
          title="IPTV 数据源"
          extra={
            <select
              className="source-select"
              value={iptvSourceIndex}
              onChange={(e) => handleIPTVSourceSelect(Number(e.target.value))}
            >
              {iptvSources.map((source, index) => (
                <option key={index} value={index}>{source.name}</option>
              ))}
            </select>
          }
        />
        <List.Item
          title="节目单源"
          description={epgUrl || '默认: epg.51zmt.top'}
          extra={
            <Button size="small" className="settings-btn-mini" onClick={() => {
              setEpgUrlInput(epgUrl || '');
              setShowEpgInput(true);
            }}>
              配置
            </Button>
          }
        />
        <List.Item
          title="流代理地址"
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
          title="代理规则"
          description={iptvSettings.proxyPattern || '未设置（全走代理）'}
          extra={
            <Button size="small" className="settings-btn-mini" onClick={() => {
              setPatternInput(iptvSettings.proxyPattern || '');
              setShowPatternInput(true);
            }}>
              配置
            </Button>
          }
        />
        </List>
      </section>

      <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm">
        <List header="通用">
        <List.Item
          title="音量记忆"
          description="记住上次播放时的音量大小"
          extra={
            <Switch
              checked={rememberVolume}
              onChange={setRememberVolume}
            />
          }
        />
        <List.Item
          title="自动翻译字幕"
          description="开启后自动将字幕翻译成目标语言"
          extra={
            <Switch
              checked={autoTranslate}
              onChange={setAutoTranslate}
            />
          }
        />
        <List.Item
          title="百度翻译 API"
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

      <section className="md:rounded-lg md:border md:border-[var(--color-border-light)] md:bg-[var(--color-surface)] md:shadow-sm lg:col-span-2">
        <List header="关于">
        <List.Item title="版本" extra="1.0.0" />
        <List.Item title="影视大全" description="聚合网盘和爬虫影视资源" />
        </List>
      </section>

      <Modal
        visible={showApiInput}
        title="配置百度翻译 API"
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
                  setIPTVSettings({ proxyUrl: '' });
                  setShowProxyInput(false);
                  toast.show('代理地址已清除');
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
        content={
          <div className="setting-modal-content">
            <div className="setting-modal-desc">
              只有匹配正则的 URL 才走代理。默认匹配 IP 地址类 URL。<br />
              留空则所有地址都走代理。
            </div>
            <input
              type="text"
              placeholder="^https?://\\d+\\.\\d+\\.\\d+\\.\\d+"
              value={patternInput}
              onChange={(e) => setPatternInput(e.target.value)}
              className="setting-modal-input"
            />
            <div className="setting-modal-actions">
              {patternInput && (
                <Button size="small" onClick={() => {
                  setPatternInput('');
                  setIPTVSettings({ proxyPattern: '' });
                  setShowPatternInput(false);
                  toast.show('代理规则已清除');
                }}>清除</Button>
              )}
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
        content={
          <div className="setting-modal-content">
            <div className="setting-modal-desc">
              用于代理视频源 API 请求，解决浏览器跨域限制。<br />
              留空则使用默认代理 corsproxy.io。<br />
              常见格式: https://your-proxy.workers.dev/
            </div>
            <input
              type="text"
              placeholder="https://corsproxy.io/"
              value={corsProxyInput}
              onChange={(e) => setCorsProxyInput(e.target.value)}
              className="setting-modal-input"
            />
            <div className="setting-modal-actions">
              {corsProxyInput && (
                <Button size="small" onClick={() => {
                  setCorsProxyInput('');
                  setCorsProxy('');
                  setShowCorsProxyInput(false);
                  toast.show('CORS 代理已恢复默认');
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
                  setTMDBToken('');
                  setShowTMDBTokenInput(false);
                  toast.show('TMDB Token 已清除');
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

      <Modal
        visible={showEpgInput}
        title="配置节目单源"
        content={
          <div className="setting-modal-content">
            <div className="setting-modal-desc">
              输入 XMLTV 格式的节目单源地址，用于显示当前频道的节目信息。<br />
              留空则使用默认地址。
            </div>
            <input
              type="text"
              placeholder="http://epg.51zmt.top:8000/e.xml"
              value={epgUrlInput}
              onChange={(e) => setEpgUrlInput(e.target.value)}
              className="setting-modal-input"
            />
            <div className="setting-modal-actions">
              {epgUrlInput && (
                <Button size="small" onClick={() => {
                  setEpgUrlInput('');
                  setEpgUrl('');
                  setShowEpgInput(false);
                  toast.show('节目单源已恢复默认');
                }}>恢复默认</Button>
              )}
              <Button size="small" onClick={() => setShowEpgInput(false)}>取消</Button>
              <Button size="small" color="primary" onClick={handleSaveEpgUrl}>保存</Button>
            </div>
          </div>
        }
        closeOnAction
        onClose={() => setShowEpgInput(false)}
      />
    </div>
  );
}
