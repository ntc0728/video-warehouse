/**
 * useSettingsState — 设置页模态框状态与操作
 *
 * 集中管理所有 Modal 的 open/close/handler，以及文本输入验证逻辑，
 * 各 tab 组件通过解构获取自身需要的 state 和回调。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCustomNavigate } from '@/lib/navigation';
import { toast } from '@/components/ui';
import { useIPTVStore } from '@/stores/useIPTVStore';
import { useSettingsStore } from '@/stores';
import { useTMDBStore } from '@/stores/useTMDBStore';
import { getVideoSources, getIPTVSources, getEPGSources } from '@/services/sourceService';
import type { EPGSourceConfig } from '@/types';
import type { VideoSourceConfig, IPTVSourceConfig } from '@/types/source';

const validators = {
  url: (value: string): string | null => {
    if (!value) return null;
    try { new URL(value); return null; }
    catch { return '请输入有效的 URL 格式（如 https://example.com）'; }
  },
  required: (value: string): string | null => {
    return value.trim() ? null : '此字段为必填项';
  },
  regex: (value: string): string | null => {
    if (!value) return null;
    try { new RegExp(value); return null; }
    catch { return '请输入有效的正则表达式'; }
  },
};

const DEFAULT_PROXY_PATTERN = '';

export function useSettingsState() {
  const navigate = useCustomNavigate();
  const { translationAppId, translationApiKey, setTranslationAppId, setTranslationApiKey, autoTranslate, setAutoTranslate } = useSettingsStore();
  const { settings: iptvSettings, setSettings: setIPTVSettings } = useIPTVStore();
  const fetchAllHomeData = useTMDBStore(s => s.fetchAllHomeData);

  const versionClickCount = useRef(0);
  const versionClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    theme, setTheme, videoSourceIndices, iptvSourceIndices,
    setVideoSourceIndices, setIPTVSourceIndices, setIPTVSourceIndex,
    corsProxy, setCorsProxy, epgUrls, setEpgUrls,
    epgUpdateInterval, setEpgUpdateInterval,
    rememberVolume, setRememberVolume,
    tmdbAccessToken, setTMDBToken,
    tmdbLanguage, setTMDBLanguage,
    skipIntro, setSkipIntro, skipOutro, setSkipOutro,
    skipIntroDuration, setSkipIntroDuration,
    skipOutroDuration, setSkipOutroDuration,
    autoPlay, setAutoPlay, skin, setSkin,
    tvMode, setTvMode, tvOverscan, setTvOverscan,
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
  const [showCorsProxyInput, setShowCorsProxyInput] = useState(false);
  const [corsProxyInput, setCorsProxyInput] = useState('');
  const [showTMDBTokenInput, setShowTMDBTokenInput] = useState(false);
  const [tmdbTokenInput, setTMDBTokenInput] = useState('');

  const [corsProxyError, setCorsProxyError] = useState<string | null>(null);
  const [proxyUrlError, setProxyUrlError] = useState<string | null>(null);
  const [tmdbTokenError, setTmdbTokenError] = useState<string | null>(null);

  const [showChangelog, setShowChangelog] = useState(false);
  const openChangelog = useCallback(() => setShowChangelog(true), []);
  const closeChangelog = useCallback(() => setShowChangelog(false), []);


  const iptvRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const epgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleVersionClick = useCallback(() => {
    versionClickCount.current += 1;
    if (versionClickTimer.current) clearTimeout(versionClickTimer.current);
    const remaining = 3 - versionClickCount.current;
    if (remaining > 0) {
      toast.replace({ content: `再点击${remaining} 次进入源检测页` });
      versionClickTimer.current = setTimeout(() => { versionClickCount.current = 0; }, 3000);
    } else {
      versionClickCount.current = 0;
      navigate('/source-checker');
    }
  }, [navigate]);

  const handleSaveApiKey = () => {
    setTranslationAppId(appIdInput.trim());
    setTranslationApiKey(apiKeyInput.trim());
    toast.success('翻译 API 配置已保存');
    setShowApiInput(false);
  };

  const handleSaveCorsProxy = () => {
    const error = validators.url(corsProxyInput.trim());
    setCorsProxyError(error);
    if (error) return;
    setCorsProxy(corsProxyInput.trim());
    toast.success(corsProxyInput.trim() ? 'CORS 代理地址已保存' : 'CORS 代理地址已清除');
    setShowCorsProxyInput(false);
  };

  const handleVideoSourcesChange = (values: string[]) => {
    const newIndices = values.map(Number);
    if (newIndices.length === 0) {
      toast.show({ content: '至少需要保留一个数据源', type: 'warning' });
      setVideoSourceIndices([0]);
      return;
    }
    setVideoSourceIndices(newIndices);
  };

  const handleIptvSourcesChange = (values: string[]) => {
    let newIndices = values.map(Number);
    if (newIndices.length === 0) {
      toast.show({ content: '至少需要保留一个数据源', type: 'warning' });
      newIndices = [0];
    }
    setIPTVSourceIndices(newIndices);
    setIPTVSourceIndex(newIndices[0]);
    getIPTVSources().then(sources => {
      const validIndices = newIndices.filter(i => sources[i]?.url);
      const urls = validIndices.map(i => sources[i]!.url);
      const names = validIndices.map(i => sources[i]!.name || `源${i + 1}`);
      setIPTVSettings({ aggregatorUrl: urls[0] || '', aggregatorUrls: urls, sourceNames: names });
      if (iptvRefreshTimerRef.current) clearTimeout(iptvRefreshTimerRef.current);
      iptvRefreshTimerRef.current = setTimeout(() => {
        useIPTVStore.getState().refreshChannels();
      }, 1000);
    });
  };

  const handleEpgChange = (values: string[]) => {
    const newUrls = values;
    setEpgUrls(newUrls);
    if (epgTimerRef.current) clearTimeout(epgTimerRef.current);
    epgTimerRef.current = setTimeout(async () => {
      try {
        const { fetchAndParseEPG } = await import('@/services/epgService');
        await fetchAndParseEPG();
        toast.success('节目单数据已更新');
      } catch { /* ignore */ }
    }, 1000);
  };

  const handleSaveProxyUrl = () => {
    const error = validators.url(proxyUrlInput.trim());
    setProxyUrlError(error);
    if (error) return;
    setIPTVSettings({ proxyUrl: proxyUrlInput.trim() });
    toast.success(proxyUrlInput.trim() ? '代理地址已保存' : '代理地址已清除');
    setShowProxyInput(false);
  };

  const handleSavePattern = () => {
    const error = validators.regex(patternInput.trim());
    if (error) {
      toast.show({ content: error, type: 'error' });
      return;
    }
    setIPTVSettings({ proxyPattern: patternInput.trim() });
    toast.success(patternInput.trim() ? '代理规则已保存' : '代理规则已清除');
    setShowPatternInput(false);
  };

  const handleSaveTMDBToken = () => {
    const token = tmdbTokenInput.trim();
    setTmdbTokenError(null);
    setTMDBToken(token);
    setShowTMDBTokenInput(false);
    if (token) {
      toast.success('TMDB Token 已保存，正在加载数据...');
      void fetchAllHomeData();
    } else {
      toast.success('TMDB Token 已清除');
    }
  };

  const openTMDBTokenModal = useCallback(() => {
    setTMDBTokenInput(tmdbAccessToken || '');
    setTmdbTokenError(null);
    setShowTMDBTokenInput(true);
  }, [tmdbAccessToken]);

  const openCorsProxyModal = useCallback(() => {
    setCorsProxyInput(corsProxy || '');
    setCorsProxyError(null);
    setShowCorsProxyInput(true);
  }, [corsProxy]);

  const openBaiduApiModal = useCallback(() => {
    setAppIdInput(translationAppId || '');
    setApiKeyInput(translationApiKey || '');
    setShowApiInput(true);
  }, [translationAppId, translationApiKey]);

  const openIptvProxyModal = useCallback(() => {
    setProxyUrlInput(iptvSettings.proxyUrl || '');
    setProxyUrlError(null);
    setShowProxyInput(true);
  }, [iptvSettings.proxyUrl]);

  const openIptvPatternModal = useCallback(() => {
    setPatternInput(iptvSettings.proxyPattern || DEFAULT_PROXY_PATTERN);
    setShowPatternInput(true);
  }, [iptvSettings.proxyPattern]);

  const closeAllModals = useCallback(() => {
    setShowApiInput(false);
    setShowProxyInput(false);
    setShowPatternInput(false);
    setShowCorsProxyInput(false);
    setShowTMDBTokenInput(false);
  }, []);

  return {
    navigate,
    appearance: { theme, setTheme, skin, setSkin, tvMode, setTvMode, tvOverscan, setTvOverscan },
    video: {
      tmdbAccessToken, setTMDBToken,
      tmdbLanguage, setTMDBLanguage,
      videoSourceIndices, setVideoSourceIndices,
      corsProxy, setCorsProxy,
      rememberVolume, setRememberVolume,
      autoTranslate, setAutoTranslate,
      translationAppId, translationApiKey,
      videoSources, setVideoSources,
      handleVideoSourcesChange,
    },
    playback: {
      skipIntro, setSkipIntro, skipIntroDuration, setSkipIntroDuration,
      skipOutro, setSkipOutro, skipOutroDuration, setSkipOutroDuration,
      autoPlay, setAutoPlay,
    },
    iptv: {
      iptvSettings, setIPTVSettings,
      iptvSourceIndices, setIPTVSourceIndices,
      epgUrls, epgUpdateInterval, setEpgUpdateInterval,
      iptvSources, epgSources,
      handleIptvSourcesChange, handleEpgChange,
      iptvRefreshTimerRef, epgTimerRef,
    },
    about: {
      handleVersionClick,
      showChangelog,
      openChangelog,
      closeChangelog,
    },
    sources: { videoSources, iptvSources, epgSources },
    modals: {
      showTMDBTokenInput, setShowTMDBTokenInput,
      tmdbTokenInput, setTMDBTokenInput,
      tmdbTokenError, setTmdbTokenError,
      handleSaveTMDBToken, openTMDBTokenModal,

      showCorsProxyInput, setShowCorsProxyInput,
      corsProxyInput, setCorsProxyInput,
      corsProxyError, setCorsProxyError,
      openCorsProxyModal,
      handleSaveCorsProxy,

      showApiInput, setShowApiInput,
      appIdInput, setAppIdInput,
      apiKeyInput, setApiKeyInput,
      handleSaveApiKey, openBaiduApiModal,

      showProxyInput, setShowProxyInput,
      proxyUrlInput, setProxyUrlInput,
      proxyUrlError, setProxyUrlError,
      handleSaveProxyUrl, openIptvProxyModal,

      showPatternInput, setShowPatternInput,
      patternInput, setPatternInput,
      handleSavePattern, openIptvPatternModal,

      closeAllModals,
    },
  };
}
