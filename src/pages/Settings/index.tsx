/**
 * SettingsPage — 设置页
 *
 * 响应式布局：
 *   桌面（≥768px）：TabBar 切换 6 个 tab，内容区 inline 直接渲染对应 tab 组件
 *   移动（≤767px）：MenuList 首层菜单 → 选中的 tab 以 SubPage 形式滑动进入
 *   所有编辑操作通过 Modal 弹窗完成
 */
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDocumentTitle } from '@/hooks';
import { Modal, Button } from '@/components/ui';
import SettingsMobileProfile from './SettingsMobileProfile';
import { useSettingsState } from './hooks/useSettingsState';
import SettingsTabBar from './SettingsTabBar';
import SettingsMenuList, { filterSettingsItems } from './SettingsMenuList';
import { usePageSearchStore } from '@/stores/usePageSearchStore';
import SettingsSubPage from './SettingsSubPage';
import AppearanceTab from './tabs/AppearanceTab';
import VideoTab from './tabs/VideoTab';
import PlaybackTab from './tabs/PlaybackTab';
import IptvTab from './tabs/IptvTab';
import PersonalTab from './tabs/PersonalTab';
import AboutTab from './tabs/AboutTab';
import ChangelogContent from './components/ChangelogContent';
import changelog from '../../../CHANGELOG.md?raw';
import type { SettingsTabKey } from './SettingsTabBar';
import './Settings.css';

// 合法设置 tab（用于 ?tab= 深链校验）
const SETTINGS_TAB_KEYS: SettingsTabKey[] = [
  'appearance', 'video', 'playback', 'iptv', 'personal', 'about',
];

export default function SettingsPage() {
  useDocumentTitle();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const pageRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('appearance');
  const [mobileSubPage, setMobileSubPage] = useState<SettingsTabKey | null>(null);

  const state = useSettingsState();
  const { appearance, video, playback, iptv, about, modals } = state;

  const handleSelectTab = useCallback((tab: SettingsTabKey) => {
    setActiveTab(tab);
  }, []);

  const handleSelectMenu = useCallback((tab: SettingsTabKey) => {
    setActiveTab(tab);
    setMobileSubPage(tab);
  }, []);

  const handleSubPageBack = useCallback(() => {
    setMobileSubPage(null);
  }, []);

  // ── 离开设置页时关闭移动端子页 portal ─────
  // SettingsSubPage 用 createPortal 挂到 document.body（全屏覆盖层，z-index 60），
  // 不受 AppLayout Keep-Alive 的 display:none 控制。若在子页内 navigate 到独立路由页
  // （源检测 / 一键配置代理），portal 仍覆盖在 body 上，造成「路由变了、页面内容没变」
  // 的假象（点返回卸载 portal 后才露出真正页面）。监听 pathname 离开 /settings 即关闭。
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== '/settings') {
      setMobileSubPage(null);
    }
  }, [location.pathname]);
  const [searchQuery, setSearchQuery] = useState('');
  const handleSearchSettings = useCallback((q: string) => setSearchQuery(q), []);

  useEffect(() => {
    if (location.pathname !== '/settings') return;
    const store = usePageSearchStore.getState();
    store.setPageSearch('', handleSearchSettings, '搜索设置项...');
    return () => {
      store.clearPageSearch();
      setSearchQuery('');
    };
  }, [handleSearchSettings, location.pathname]);

  // 过滤后的设置项（移动端菜单 + 桌面端 TabBar 共用）
  const filteredItems = useMemo(() => filterSettingsItems(searchQuery), [searchQuery]);
  const desktopTabs = useMemo(
    () => filteredItems.map(({ key, label }) => ({ key, label })),
    [filteredItems],
  );

  // 当前激活 tab 被过滤掉时，自动切到第一个可见项
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;
    const keys = filteredItems.map((i) => i.key);
    if (keys.length && !keys.includes(activeTab)) {
      setActiveTab(keys[0]);
    }
  }, [searchQuery, filteredItems, activeTab]);

  // ── 深链：/settings?tab=xxx 一键直达具体设置项 ─────
  // 进入设置页时若 URL 带合法 tab 参数，直接激活对应 tab（移动端同时打开 SubPage）。
  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab && (SETTINGS_TAB_KEYS as string[]).includes(tab)) {
      setActiveTab(tab as SettingsTabKey);
      if (!isDesktop) setMobileSubPage(tab as SettingsTabKey);
    }
  }, [location.search, isDesktop]);

  const renderContent = () => {
    switch (activeTab) {
      case 'appearance':
        return <AppearanceTab theme={appearance.theme} setTheme={appearance.setTheme} skin={appearance.skin} setSkin={appearance.setSkin} tvMode={appearance.tvMode} setTvMode={appearance.setTvMode} tvOverscan={appearance.tvOverscan} setTvOverscan={appearance.setTvOverscan} />;
      case 'video':
        return (
          <VideoTab
            tmdbAccessToken={video.tmdbAccessToken}
            tmdbLanguage={video.tmdbLanguage}
            setTMDBLanguage={video.setTMDBLanguage}
            corsProxy={video.corsProxy}
            rememberVolume={video.rememberVolume}
            setRememberVolume={video.setRememberVolume}
            autoTranslate={video.autoTranslate}
            setAutoTranslate={video.setAutoTranslate}
            translationAppId={video.translationAppId}
            translationApiKey={video.translationApiKey}
            onEditTMDBToken={modals.openTMDBTokenModal}
            onEditCorsProxy={modals.openCorsProxyModal}
            onEditBaiduApi={modals.openBaiduApiModal}
          />
        );
      case 'playback':
        return <PlaybackTab {...playback} />;
      case 'iptv':
        return (
          <IptvTab
            iptvSettings={iptv.iptvSettings}
            setIPTVSettings={iptv.setIPTVSettings}
            epgUpdateInterval={iptv.epgUpdateInterval}
            setEpgUpdateInterval={iptv.setEpgUpdateInterval}
            onEditIptvProxy={modals.openIptvProxyModal}
            onEditIptvPattern={modals.openIptvPatternModal}
          />
        );
      case 'personal':
        return <PersonalTab />;
      case 'about':
        return <AboutTab onVersionClick={about.handleVersionClick} onChangelogClick={about.openChangelog} />;
    }
  };

  return (
    <div ref={pageRef} className="page-padding settings-page page-transition-enter">
      {mobileSubPage ? (
        <SettingsSubPage key={mobileSubPage} tab={mobileSubPage} onBack={handleSubPageBack}>
          {renderContent()}
        </SettingsSubPage>
      ) : isDesktop ? (
        <div className="settings-desktop-card">
          <SettingsTabBar activeTab={activeTab} onChange={handleSelectTab} tabs={desktopTabs} />
          {/* key=activeTab：切换 tab 时整体重挂载，触发进入动画；section 仍是 .settings-content 直接子级，桌面布局选择器不受影响 */}
          <div key={activeTab} className="settings-content settings-content--animate">
            {filteredItems.length === 0 ? (
              <div className="settings-search-empty">未找到匹配的设置项</div>
            ) : (
              renderContent()
            )}
          </div>
        </div>
      ) : (
        <>
          <SettingsMobileProfile onProfileClick={() => handleSelectMenu('personal')} />
          <SettingsMenuList onSelect={handleSelectMenu} query={searchQuery} />
        </>
      )}

      {/* Baidu Translate API Modal */}
      <Modal visible={modals.showApiInput} title="配置百度翻译 API" onClose={modals.closeAllModals} className="settings-modal">
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
                value={modals.appIdInput}
                onChange={(e) => modals.setAppIdInput(e.target.value)}
                className={`setting-modal-input ${modals.appIdInput ? 'setting-modal-input--has-clear' : ''}`}
              />
              {modals.appIdInput && (
                <button
                  type="button"
                  className="settings-input-clear"
                  onClick={() => modals.setAppIdInput('')}
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
                value={modals.apiKeyInput}
                onChange={(e) => modals.setApiKeyInput(e.target.value)}
                className={`setting-modal-input ${modals.apiKeyInput ? 'setting-modal-input--has-clear' : ''}`}
                aria-describedby="baidu-translate-secret-key-help"
                aria-required="true"
              />
              {modals.apiKeyInput && (
                <button
                  type="button"
                  className="settings-input-clear"
                  onClick={() => modals.setApiKeyInput('')}
                  aria-label="清除"
                >&#x2715;</button>
              )}
            </div>
            <p id="baidu-translate-secret-key-help" className="settings-help">
              在百度翻译开放平台的"开发者信息"中获取
            </p>
          </div>
          <div className="setting-modal-actions">
            <Button size="sm" onClick={modals.closeAllModals}>取消</Button>
            <Button size="sm" variant="default" onClick={modals.handleSaveApiKey}>保存</Button>
          </div>
        </div>
      </Modal>

      {/* IPTV / Stream Proxy Modal */}
      <Modal visible={modals.showProxyInput} title="配置流代理地址" onClose={modals.closeAllModals} className="settings-modal">
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
                value={modals.proxyUrlInput}
                onChange={(e) => { modals.setProxyUrlInput(e.target.value); modals.setProxyUrlError(null); }}
                className={`setting-modal-input ${modals.proxyUrlInput ? 'setting-modal-input--has-clear' : ''} ${modals.proxyUrlError ? 'settings-input--error' : ''}`}
                aria-describedby="stream-proxy-url-help stream-proxy-url-error"
              />
              {modals.proxyUrlInput && (
                <button type="button" className="settings-input-clear" onClick={() => { modals.setProxyUrlInput(''); modals.setProxyUrlError(null); }} aria-label="清除">&#x2715;</button>
              )}
            </div>
            <p id="stream-proxy-url-help" className="settings-help">
              格式：https://your-worker.workers.dev
            </p>
            {modals.proxyUrlError && (
              <p id="stream-proxy-url-error" className="settings-error" role="alert">
                {modals.proxyUrlError}
              </p>
            )}
          </div>
          <div className="setting-modal-actions">
            <Button size="sm" onClick={modals.closeAllModals}>取消</Button>
            <Button size="sm" variant="default" onClick={modals.handleSaveProxyUrl}>保存</Button>
          </div>
        </div>
      </Modal>

      {/* Proxy Pattern Modal */}
      <Modal visible={modals.showPatternInput} title="配置代理规则" onClose={modals.closeAllModals} className="settings-modal">
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
                placeholder="liveplay\\.(miguvideo|myqcloud)|livecdn\\.aliyun|oss-cn-.*aliyuncs|raw\\.githubusercontent|jsdelivr"
                value={modals.patternInput}
                onChange={(e) => modals.setPatternInput(e.target.value)}
                className={`setting-modal-input ${modals.patternInput ? 'setting-modal-input--has-clear' : ''}`}
                aria-describedby="proxy-pattern-help"
              />
              {modals.patternInput && (
                <button type="button" className="settings-input-clear" onClick={() => modals.setPatternInput('')} aria-label="清除">&#x2715;</button>
              )}
            </div>
            <p id="proxy-pattern-help" className="settings-help">
              匹配的 URL 不走代理，其余走代理
            </p>
          </div>
          <div className="setting-modal-actions">
            <Button size="sm" onClick={() => modals.setPatternInput('')}>恢复默认</Button>
            <Button size="sm" onClick={modals.closeAllModals}>取消</Button>
            <Button size="sm" variant="default" onClick={modals.handleSavePattern}>保存</Button>
          </div>
        </div>
      </Modal>

      {/* CORS Proxy Modal */}
      <Modal visible={modals.showCorsProxyInput} title="配置 CORS 代理地址" onClose={modals.closeAllModals} className="settings-modal">
        <div className="setting-modal-content">
          <div className="setting-modal-desc">
            CORS（跨域资源共享）代理用于绕过浏览器的跨域限制，让应用能访问其他服务器的视频数据。<br />
            留空则直连（浏览器跨域限制下视频源可能不可用，请配置代理）。<br />
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
                value={modals.corsProxyInput}
                onChange={(e) => { modals.setCorsProxyInput(e.target.value); modals.setCorsProxyError(null); }}
                className={`setting-modal-input ${modals.corsProxyInput ? 'setting-modal-input--has-clear' : ''} ${modals.corsProxyError ? 'settings-input--error' : ''}`}
                aria-describedby="cors-proxy-url-help cors-proxy-url-error"
              />
              {modals.corsProxyInput && (
                <button type="button" className="settings-input-clear" onClick={() => { modals.setCorsProxyInput(''); modals.setCorsProxyError(null); }} aria-label="清除">&#x2715;</button>
              )}
            </div>
            <p id="cors-proxy-url-help" className="settings-help">
              格式：https://your-worker.workers.dev（可选，留空则直连）
            </p>
            {modals.corsProxyError && (
              <p id="cors-proxy-url-error" className="settings-error" role="alert">
                {modals.corsProxyError}
              </p>
            )}
          </div>
          <div className="setting-modal-actions">
            <Button size="sm" onClick={modals.closeAllModals}>取消</Button>
            <Button size="sm" variant="default" onClick={modals.handleSaveCorsProxy}>保存</Button>
          </div>
        </div>
      </Modal>

      {/* TMDB Token Modal */}
      <Modal visible={modals.showTMDBTokenInput} title="配置 TMDB Access Token" onClose={modals.closeAllModals} className="settings-modal">
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
                value={modals.tmdbTokenInput}
                onChange={(e) => { modals.setTMDBTokenInput(e.target.value); modals.setTmdbTokenError(null); }}
                className={`setting-modal-input ${modals.tmdbTokenInput ? 'setting-modal-input--has-clear' : ''} ${modals.tmdbTokenError ? 'settings-input--error' : ''}`}
                aria-describedby="tmdb-access-token-help tmdb-access-token-error"
                aria-required="true"
              />
              {modals.tmdbTokenInput && (
                <button type="button" className="settings-input-clear" onClick={() => { modals.setTMDBTokenInput(''); modals.setTmdbTokenError(null); }} aria-label="清除">&#x2715;</button>
              )}
            </div>
            <p id="tmdb-access-token-help" className="settings-help">
              格式：eyJhbGciOi...（在 TMDB 网站获取）
            </p>
            {modals.tmdbTokenError && (
              <p id="tmdb-access-token-error" className="settings-error" role="alert">
                {modals.tmdbTokenError}
              </p>
            )}
          </div>
          <div className="setting-modal-actions">
            <Button size="sm" onClick={modals.closeAllModals}>取消</Button>
            <Button size="sm" variant="default" onClick={modals.handleSaveTMDBToken}>保存</Button>
          </div>
        </div>
      </Modal>

      {/* Changelog Modal */}
      <Modal
        visible={about.showChangelog}
        title="更新日志"
        onClose={about.closeChangelog}
        className="settings-modal changelog-modal"
      >
        <ChangelogContent raw={changelog} />
      </Modal>
    </div>
  );
}
