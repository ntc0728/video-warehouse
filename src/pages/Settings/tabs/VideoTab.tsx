import { useCallback, useEffect, useRef, useState } from 'react';
import { List, Switch, Button, HelpPopover, Select, SettingsStatusTag, toast } from '@/components/ui';
import { Film, RadioTower } from 'lucide-react';
import type { ManagedVideoSource, SourceScene } from '@/types/source';
import { Icon } from "@/components/ui/Icon";
import SourceManager from '@/components/SourceManager/SourceManager';
import SourceModal, { EMPTY_FORM, type SourceModalFormValue } from '@/components/SourceManager/SourceModal';
import {
  exportVideoToFile,
  exportVideoToText,
  importFromRemoteUrl,
  importVideoFromFile,
  importVideoFromText,
  summarizeImport,
} from '@/components/SourceManager/importExport';
import { useSourceManagerStore } from '@/stores/useSourceManagerStore';
import { buildProxyUrl as buildCorsProxyUrl } from '@/services/httpClient';

interface VideoTabProps {
  tmdbAccessToken: string;
  tmdbLanguage: string;
  setTMDBLanguage: (l: string) => void;
  corsProxy: string;
  rememberVolume: boolean;
  setRememberVolume: (v: boolean) => void;
  autoTranslate: boolean;
  setAutoTranslate: (v: boolean) => void;
  translationAppId: string;
  translationApiKey: string;
  onEditTMDBToken: () => void;
  onEditCorsProxy: () => void;
  onEditBaiduApi: () => void;
}

const TMDB_LANGUAGES = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
];

export default function VideoTab({
  tmdbAccessToken, tmdbLanguage, setTMDBLanguage,
  corsProxy,
  rememberVolume, setRememberVolume,
  autoTranslate, setAutoTranslate,
  translationAppId, translationApiKey,
  onEditTMDBToken, onEditCorsProxy, onEditBaiduApi,
}: VideoTabProps) {
  /* ── 源管理（SourceManager）────────────────── */
  const managedVideo = useSourceManagerStore((s) => s.video);
  const addCustomVideoSource = useSourceManagerStore((s) => s.addCustomVideoSource);
  const updateVideoSource = useSourceManagerStore((s) => s.updateVideoSource);
  const deleteCustomVideoSource = useSourceManagerStore((s) => s.deleteCustomVideoSource);
  const setVideoEnabled = useSourceManagerStore((s) => s.setEnabled);
  const setAllVideoEnabled = useSourceManagerStore((s) => s.setAllEnabled);
  const setVideoLatencies = useSourceManagerStore((s) => s.setLatencies);
  const bootstrap = useSourceManagerStore((s) => s.bootstrap);

  // 挂载时注入默认源（store 内部有模块级 guard，仅执行一次；不在 render 调用避免 setState-in-render）
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  /* 弹窗（add/edit） */
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editing, setEditing] = useState<ManagedVideoSource | null>(null);
  const [form, setForm] = useState<SourceModalFormValue>(EMPTY_FORM);
  const [modalScene] = useState<SourceScene>('video');

  const openAddModal = useCallback(() => {
    setEditing(null);
    setModalMode('add');
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }, []);
  const openEditModal = useCallback((item: ManagedVideoSource) => {
    setEditing(item);
    setModalMode('edit');
    setForm({
      name: item.name,
      url: item.api,
      detail: item.detail,
      enabled: item.status.enabled,
      showAdvanced: false,
      customId: '',
      timeoutMs: (item as ManagedVideoSource & { timeoutMs?: number }).timeoutMs ?? 3000,
      retries: (item as ManagedVideoSource & { retries?: number }).retries ?? 3,
    });
    setModalVisible(true);
  }, []);
  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditing(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (modalMode === 'add') {
      const created = addCustomVideoSource({
        name: form.name.trim(),
        api: form.url.trim(),
        detail: (form.detail.trim() || form.url.trim()),
        enabled: form.enabled,
        timeoutMs: form.timeoutMs,
        retries: form.retries,
      });
      toast.show({ content: `已添加视频源「${created.name}」`, type: 'success' });
    } else if (editing) {
      updateVideoSource(editing.id, {
        name: form.name.trim(),
        api: form.url.trim(),
        detail: (form.detail.trim() || form.url.trim()),
        status: { ...editing.status, enabled: form.enabled },
        timeoutMs: form.timeoutMs,
        retries: form.retries,
      } as unknown as Partial<ManagedVideoSource>);
      toast.show({ content: '已保存', type: 'success' });
    }
    closeModal();
  }, [modalMode, form, editing, addCustomVideoSource, updateVideoSource, closeModal]);

  /* 导入 */
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleImportFromFile = useCallback(() => fileInputRef.current?.click(), []);
  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const parsed = await importVideoFromFile(file);
        summarizeImport('video', parsed, (item) =>
          Boolean(addCustomVideoSource({ name: item.name, api: item.api, detail: item.detail, enabled: true })),
        );
      } catch (err) {
        toast.show({ content: `文件导入失败：${(err as Error).message}`, type: 'error' });
      }
    },
    [addCustomVideoSource],
  );
  const handleImportFromUrl = useCallback(() => {
    const url = prompt('请输入远程 URL（应可直接访问 JSON / 文本）');
    if (!url) return;
    (async () => {
      try {
        const text = await importFromRemoteUrl(url);
        const parsed = importVideoFromText(text);
        summarizeImport('video', parsed, (item) =>
          Boolean(addCustomVideoSource({ name: item.name, api: item.api, detail: item.detail, enabled: true })),
        );
      } catch (err) {
        toast.show({ content: `URL 导入失败：${(err as Error).message}`, type: 'error' });
      }
    })();
  }, [addCustomVideoSource]);
  const handleImportFromText = useCallback(() => {
    const text = prompt('请粘贴源文本（每行：名称:::URL[:::详情URL] 或 JSON 数组）');
    if (!text) return;
    try {
      const parsed = importVideoFromText(text);
      summarizeImport('video', parsed, (item) =>
        Boolean(addCustomVideoSource({ name: item.name, api: item.api, detail: item.detail, enabled: true })),
      );
    } catch (err) {
      toast.show({ content: `文本导入失败：${(err as Error).message}`, type: 'error' });
    }
  }, [addCustomVideoSource]);

  /* 导出 */
  const handleExportToFile = useCallback(() => exportVideoToFile(managedVideo), [managedVideo]);
  const handleExportToText = useCallback(() => exportVideoToText(managedVideo), [managedVideo]);

  return (
    <>
      <section>
        <List header={<span className="settings-section-header"><Icon icon={Film} size="lg" /> TMDB</span>}>
          <List.Item
            title={
              <>
                TMDB Access Token
                <SettingsStatusTag tone={tmdbAccessToken ? 'ok' : 'warn'}>
                  {tmdbAccessToken ? '已配置' : '未配置'}
                </SettingsStatusTag>
              </>
            }
            description={tmdbAccessToken ? '已配置（首页 TMDB 发现可用）' : '未配置（首页 TMDB 发现将不可用）'}
            extra={
              <Button size="sm" className="settings-btn-mini" onClick={onEditTMDBToken}>
                {tmdbAccessToken ? '修改' : '配置'}
              </Button>
            }
          />
          <List.Item
            title="TMDB 语言"
            description="影响影片标题、简介等信息的显示语言"
            extra={
              <Select
                options={TMDB_LANGUAGES}
                value={tmdbLanguage}
                onChange={setTMDBLanguage}
              />
            }
          />
        </List>
      </section>

      <section>
        <List header={<span className="settings-section-header"><Icon icon={RadioTower} size="lg" /> 视频源</span>}>
          <List.Item
            title={
              <>
                视频采集CORS 代理
                <HelpPopover title="CORS 代理" content="CORS（跨域资源共享）代理用于绕过浏览器的跨域限制，让应用能访问其他服务器的视频数据。如果遇到跨域错误，请配置代理地址。留空则直连。" />
                <SettingsStatusTag tone={corsProxy ? 'ok' : 'warn'}>
                  {corsProxy ? '已配置' : '未配置'}
                </SettingsStatusTag>
              </>
            }
            description={corsProxy || '默认: 不使用代理'}
            extra={
              <Button size="sm" className="settings-btn-mini" onClick={onEditCorsProxy}>
                {corsProxy ? '修改' : '配置'}
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
            extra={<Switch checked={rememberVolume} onChange={setRememberVolume} />}
          />
          <List.Item
            title={
              <>
                自动翻译字幕
                <HelpPopover title="自动翻译字幕" content="开启后会自动调用百度翻译API将字幕翻译成目标语言。需要先配置百度翻译API。" />
              </>
            }
            description="开启后自动将字幕翻译成目标语言"
            extra={<Switch checked={autoTranslate} onChange={setAutoTranslate} />}
          />
          <List.Item
            title={
              <>
                百度翻译 API
                <HelpPopover title="百度翻译 API" content="配置百度翻译开放平台的App ID和密钥，用于自动翻译字幕功能。" />
                <SettingsStatusTag tone={translationAppId && translationApiKey ? 'ok' : 'warn'}>
                  {translationAppId && translationApiKey ? '已配置' : '未配置'}
                </SettingsStatusTag>
              </>
            }
            description={translationAppId && translationApiKey ? '已配置' : '未配置'}
            extra={
              <Button size="sm" className="settings-btn-mini" onClick={onEditBaiduApi}>
                {translationAppId && translationApiKey ? '修改' : '配置'}
              </Button>
            }
          />
        </List>

        {/* 视频源管理面板（SourceManager） */}
        <div className="settings-source-section">
          <SourceManager
            scene="video"
            items={managedVideo}
            onAdd={(input) =>
              addCustomVideoSource({ name: input.name, api: input.url, detail: input.detail ?? input.url })
            }
            onUpdate={(id, patch) => updateVideoSource(id, patch as Partial<ManagedVideoSource>)}
            onDelete={deleteCustomVideoSource}
            onToggle={(id, e) => {
              // 达到上限时禁止启用（store 内部有保护）
              setVideoEnabled('video', id, e);
            }}
            onSetAllEnabled={(enabled) => setAllVideoEnabled('video', enabled)}
            getLatencyUrl={(item) => buildCorsProxyUrl(item.api)}
            onLatencies={(map) => setVideoLatencies('video', map)}
            onOpenAddModal={openAddModal}
            onOpenEditModal={openEditModal}
            onImportFromFile={handleImportFromFile}
            onImportFromUrl={handleImportFromUrl}
            onImportFromText={handleImportFromText}
            onExportToFile={handleExportToFile}
            onExportToText={handleExportToText}
          />
        </div>
      </section>

      {/* 弹窗 */}
      <SourceModal
        visible={modalVisible}
        scene={modalScene}
        mode={modalMode}
        value={form}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.txt,application/json,text/plain"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />
    </>
  );
}
