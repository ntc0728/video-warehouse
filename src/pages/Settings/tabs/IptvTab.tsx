import { useCallback, useEffect, useRef, useState } from 'react';
import { List, Switch, Button, HelpPopover, SettingsStatusTag, toast } from '@/components/ui';
import { Tv } from 'lucide-react';
import type { ManagedIPTVSource, ManagedEPGSource, SourceScene } from '@/types/source';
import { Icon } from "@/components/ui/Icon";
import SourceManager from '@/components/SourceManager/SourceManager';
import SourceModal, { EMPTY_FORM, type SourceModalFormValue } from '@/components/SourceManager/SourceModal';
import {
  exportIPTVToFile,
  exportIPTVToText,
  exportEPGToFile,
  exportEPGToText,
  importFromRemoteUrl,
  importURLFromFile,
  importURLFromText,
  summarizeImport,
} from '@/components/SourceManager/importExport';
import { useSourceManagerStore } from '@/stores/useSourceManagerStore';
import { buildProxyUrl as buildCorsProxyUrl } from '@/services/httpClient';

interface IptvTabProps {
  iptvSettings: {
    proxyUrl: string;
    proxyPattern: string;
    autoRefresh: boolean;
    refreshIntervalHours: number;
  };
  setIPTVSettings: (s: Partial<IptvTabProps['iptvSettings']>) => void;
  epgUpdateInterval: number;
  setEpgUpdateInterval: (v: number) => void;
  onEditIptvProxy: () => void;
  onEditIptvPattern: () => void;
}

export default function IptvTab({
  iptvSettings, setIPTVSettings,
  epgUpdateInterval, setEpgUpdateInterval,
  onEditIptvProxy, onEditIptvPattern,
}: IptvTabProps) {
  /* ── 源管理（SourceManager）────────────────── */
  const managedIptv = useSourceManagerStore((s) => s.iptv);
  const managedEpg = useSourceManagerStore((s) => s.epg);
  const addCustomIPTV = useSourceManagerStore((s) => s.addCustomIPTVSource);
  const addCustomEPG = useSourceManagerStore((s) => s.addCustomEPGSource);
  const updateIPTV = useSourceManagerStore((s) => s.updateIPTVSource);
  const updateEPG = useSourceManagerStore((s) => s.updateEPGSource);
  const deleteCustomIPTV = useSourceManagerStore((s) => s.deleteCustomIPTVSource);
  const deleteCustomEPG = useSourceManagerStore((s) => s.deleteCustomEPGSource);
  const setEnabled = useSourceManagerStore((s) => s.setEnabled);
  const setLatencies = useSourceManagerStore((s) => s.setLatencies);
  const bootstrap = useSourceManagerStore((s) => s.bootstrap);

  // 挂载时注入默认源（store 内部有模块级 guard；不在 render 调用避免 setState-in-render）
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  /* IPTV 弹窗 */
  const [iptvVisible, setIptvVisible] = useState(false);
  const [iptvMode, setIptvMode] = useState<'add' | 'edit'>('add');
  const [editingIptv, setEditingIptv] = useState<ManagedIPTVSource | null>(null);
  const [iptvForm, setIptvForm] = useState<SourceModalFormValue>(EMPTY_FORM);

  const openIptvAdd = useCallback(() => {
    setEditingIptv(null);
    setIptvMode('add');
    setIptvForm(EMPTY_FORM);
    setIptvVisible(true);
  }, []);
  const openIptvEdit = useCallback((item: ManagedIPTVSource) => {
    setEditingIptv(item);
    setIptvMode('edit');
    setIptvForm({ name: item.name, url: item.url, detail: '', enabled: item.status.enabled, showAdvanced: false, customId: '', timeoutMs: 3000, retries: 3 });
    setIptvVisible(true);
  }, []);
  const closeIptv = useCallback(() => {
    setIptvVisible(false);
    setEditingIptv(null);
  }, []);
  const submitIptv = useCallback(() => {
    if (iptvMode === 'add') {
      const c = addCustomIPTV({ name: iptvForm.name.trim(), url: iptvForm.url.trim(), enabled: iptvForm.enabled });
      toast.show({ content: `已添加 IPTV 源「${c.name}」`, type: 'success' });
    } else if (editingIptv) {
      updateIPTV(editingIptv.id, { name: iptvForm.name.trim(), url: iptvForm.url.trim(), status: { ...editingIptv.status, enabled: iptvForm.enabled } } as Partial<ManagedIPTVSource>);
      toast.show({ content: '已保存', type: 'success' });
    }
    closeIptv();
  }, [iptvMode, iptvForm, editingIptv, addCustomIPTV, updateIPTV, closeIptv]);

  /* EPG 弹窗 */
  const [epgVisible, setEpgVisible] = useState(false);
  const [epgMode, setEpgMode] = useState<'add' | 'edit'>('add');
  const [editingEpg, setEditingEpg] = useState<ManagedEPGSource | null>(null);
  const [epgForm, setEpgForm] = useState<SourceModalFormValue>(EMPTY_FORM);
  const openEpgAdd = useCallback(() => {
    setEditingEpg(null);
    setEpgMode('add');
    setEpgForm(EMPTY_FORM);
    setEpgVisible(true);
  }, []);
  const openEpgEdit = useCallback((item: ManagedEPGSource) => {
    setEditingEpg(item);
    setEpgMode('edit');
    setEpgForm({ name: item.name, url: item.url, detail: '', enabled: item.status.enabled, showAdvanced: false, customId: '', timeoutMs: 3000, retries: 3 });
    setEpgVisible(true);
  }, []);
  const closeEpg = useCallback(() => {
    setEpgVisible(false);
    setEditingEpg(null);
  }, []);
  const submitEpg = useCallback(() => {
    if (epgMode === 'add') {
      const c = addCustomEPG({ name: epgForm.name.trim(), url: epgForm.url.trim(), enabled: epgForm.enabled });
      toast.show({ content: `已添加节目单源「${c.name}」`, type: 'success' });
    } else if (editingEpg) {
      updateEPG(editingEpg.id, { name: epgForm.name.trim(), url: epgForm.url.trim(), status: { ...editingEpg.status, enabled: epgForm.enabled } } as Partial<ManagedEPGSource>);
      toast.show({ content: '已保存', type: 'success' });
    }
    closeEpg();
  }, [epgMode, epgForm, editingEpg, addCustomEPG, updateEPG, closeEpg]);

  /* IPTV 导入导出 */
  const iptvFileRef = useRef<HTMLInputElement | null>(null);
  const importIptvFromFile = useCallback(() => iptvFileRef.current?.click(), []);
  const importIptvFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const parsed = await importURLFromFile(file);
        summarizeImport('iptv', parsed, (it) => Boolean(addCustomIPTV({ name: it.name, url: it.url, enabled: true })));
      } catch (err) {
        toast.show({ content: `文件导入失败：${(err as Error).message}`, type: 'error' });
      }
    },
    [addCustomIPTV],
  );
  const importIptvFromUrl = useCallback(() => {
    const url = prompt('请输入远程 URL');
    if (!url) return;
    (async () => {
      try {
        const text = await importFromRemoteUrl(url);
        const parsed = importURLFromText(text);
        summarizeImport('iptv', parsed, (it) => Boolean(addCustomIPTV({ name: it.name, url: it.url, enabled: true })));
      } catch (err) {
        toast.show({ content: `URL 导入失败：${(err as Error).message}`, type: 'error' });
      }
    })();
  }, [addCustomIPTV]);
  const importIptvFromText = useCallback(() => {
    const text = prompt('请粘贴 IPTV 源文本（每行：名称:::URL 或 JSON 数组）');
    if (!text) return;
    try {
      const parsed = importURLFromText(text);
      summarizeImport('iptv', parsed, (it) => Boolean(addCustomIPTV({ name: it.name, url: it.url, enabled: true })));
    } catch (err) {
      toast.show({ content: `文本导入失败：${(err as Error).message}`, type: 'error' });
    }
  }, [addCustomIPTV]);
  const exportIptvToFile = useCallback(() => exportIPTVToFile(managedIptv), [managedIptv]);
  const exportIptvToText = useCallback(() => exportIPTVToText(managedIptv), [managedIptv]);

  /* EPG 导入导出 */
  const epgFileRef = useRef<HTMLInputElement | null>(null);
  const importEpgFromFile = useCallback(() => epgFileRef.current?.click(), []);
  const importEpgFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const parsed = await importURLFromFile(file);
        summarizeImport('epg', parsed, (it) => Boolean(addCustomEPG({ name: it.name, url: it.url, enabled: true })));
      } catch (err) {
        toast.show({ content: `文件导入失败：${(err as Error).message}`, type: 'error' });
      }
    },
    [addCustomEPG],
  );
  const importEpgFromUrl = useCallback(() => {
    const url = prompt('请输入远程 URL');
    if (!url) return;
    (async () => {
      try {
        const text = await importFromRemoteUrl(url);
        const parsed = importURLFromText(text);
        summarizeImport('epg', parsed, (it) => Boolean(addCustomEPG({ name: it.name, url: it.url, enabled: true })));
      } catch (err) {
        toast.show({ content: `URL 导入失败：${(err as Error).message}`, type: 'error' });
      }
    })();
  }, [addCustomEPG]);
  const importEpgFromText = useCallback(() => {
    const text = prompt('请粘贴节目单源文本（每行：名称:::URL 或 JSON 数组）');
    if (!text) return;
    try {
      const parsed = importURLFromText(text);
      summarizeImport('epg', parsed, (it) => Boolean(addCustomEPG({ name: it.name, url: it.url, enabled: true })));
    } catch (err) {
      toast.show({ content: `文本导入失败：${(err as Error).message}`, type: 'error' });
    }
  }, [addCustomEPG]);
  const exportEpgToFile = useCallback(() => exportEPGToFile(managedEpg), [managedEpg]);
  const exportEpgToText = useCallback(() => exportEPGToText(managedEpg), [managedEpg]);

  return (
    <section>
      <List header={<span className="settings-section-header"><Icon icon={Tv} size="lg" /> IPTV</span>}>
        <List.Item
          title={<>节目单更新间隔<HelpPopover title="节目单更新间隔" content="设置节目单数据的自动更新间隔时间。建议6-12小时更新一次，避免频繁请求。" /></>}
          description={`${epgUpdateInterval} 小时`}
          extra={
            <div className="settings-counter">
              <button className="settings-counter-btn" onClick={() => setEpgUpdateInterval(Math.max(1, epgUpdateInterval - 1))} disabled={epgUpdateInterval <= 1}>-</button>
              <span className="settings-counter-value">{epgUpdateInterval}</span>
              <button className="settings-counter-btn" onClick={() => setEpgUpdateInterval(Math.min(24, epgUpdateInterval + 1))} disabled={epgUpdateInterval >= 24}>+</button>
            </div>
          }
        />
        <List.Item
          title={<>
            IPTV代理服务器地址
            <HelpPopover title="流代理地址" content="IPTV 播放依赖此代理绕过浏览器跨域限制，未配置将可能无法播放。部署 Cloudflare Worker 后填入地址，格式如 https://your-worker.workers.dev" />
            <SettingsStatusTag tone={iptvSettings.proxyUrl ? 'ok' : 'warn'}>
              {iptvSettings.proxyUrl ? '已配置' : '未配置'}
            </SettingsStatusTag>
          </>}
          description={iptvSettings.proxyUrl || '未配置'}
          extra={<Button size="sm" className="settings-btn-mini" onClick={onEditIptvProxy}>{iptvSettings.proxyUrl ? '修改' : '配置'}</Button>}
        />
        <List.Item
          title={<>
            代理规则
            <HelpPopover title="代理规则" content="设置代理规则正则表达式。匹配正则的URL不走代理，其余走代理。留空则所有地址都走代理。用于区分需要代理和不需要代理的流地址。" />
            <SettingsStatusTag tone={iptvSettings.proxyPattern ? 'ok' : 'warn'}>
              {iptvSettings.proxyPattern ? '已配置' : '默认规则'}
            </SettingsStatusTag>
          </>}
          description={iptvSettings.proxyPattern || '默认: 内置直连白名单（咪咕/腾讯云/阿里 CDN 等直连，其余走代理）'}
          extra={<Button size="sm" className="settings-btn-mini" onClick={onEditIptvPattern}>{iptvSettings.proxyPattern ? '修改' : '配置'}</Button>}
        />
        <List.Item
          title={<>自动刷新频道<HelpPopover title="自动刷新频道" content="开启后会定期从数据源拉取最新的频道列表并更新缓存。" /></>}
          description="定期自动更新频道列表"
          extra={<Switch checked={iptvSettings.autoRefresh} onChange={(v) => setIPTVSettings({ autoRefresh: v })} />}
        />
        <List.Item
          title={<>刷新间隔<HelpPopover title="刷新间隔" content="设置频道列表的自动刷新间隔时间。建议6-24小时更新一次，避免频繁请求。" /></>}
          description={`${iptvSettings.refreshIntervalHours} 小时`}
          extra={
            <div className="settings-counter">
              <button className="settings-counter-btn" onClick={() => setIPTVSettings({ refreshIntervalHours: Math.max(1, iptvSettings.refreshIntervalHours - 1) })} disabled={iptvSettings.refreshIntervalHours <= 1}>-</button>
              <span className="settings-counter-value">{iptvSettings.refreshIntervalHours}</span>
              <button className="settings-counter-btn" onClick={() => setIPTVSettings({ refreshIntervalHours: Math.min(72, iptvSettings.refreshIntervalHours + 1) })} disabled={iptvSettings.refreshIntervalHours >= 72}>+</button>
            </div>
          }
        />
      </List>

      {/* 节目单（EPG）源管理面板 —— 置于 IPTV 源之前 */}
      <div className="settings-source-section">
        <SourceManager
          scene="epg"
          items={managedEpg}
          onAdd={(input) => addCustomEPG({ name: input.name, url: input.url, enabled: true })}
          onUpdate={(id, patch) => updateEPG(id, patch as Partial<ManagedEPGSource>)}
          onDelete={deleteCustomEPG}
          onToggle={(id, e) => setEnabled('epg', id, e)}
          getLatencyUrl={(item) => buildCorsProxyUrl(item.url)}
          onLatencies={(map) => setLatencies('epg', map)}
          onOpenAddModal={openEpgAdd}
          onOpenEditModal={openEpgEdit}
          onImportFromFile={importEpgFromFile}
          onImportFromUrl={importEpgFromUrl}
          onImportFromText={importEpgFromText}
          onExportToFile={exportEpgToFile}
          onExportToText={exportEpgToText}
        />
      </div>

      {/* IPTV 源管理面板 */}
      <div className="settings-source-section">
        <SourceManager
          scene="iptv"
          items={managedIptv}
          onAdd={(input) => addCustomIPTV({ name: input.name, url: input.url, enabled: true })}
          onUpdate={(id, patch) => updateIPTV(id, patch as Partial<ManagedIPTVSource>)}
          onDelete={deleteCustomIPTV}
          onToggle={(id, e) => setEnabled('iptv', id, e)}
          getLatencyUrl={(item) => buildCorsProxyUrl(item.url)}
          onLatencies={(map) => setLatencies('iptv', map)}
          onOpenAddModal={openIptvAdd}
          onOpenEditModal={openIptvEdit}
          onImportFromFile={importIptvFromFile}
          onImportFromUrl={importIptvFromUrl}
          onImportFromText={importIptvFromText}
          onExportToFile={exportIptvToFile}
          onExportToText={exportIptvToText}
        />
      </div>

      {/* 弹窗 */}
      <SourceModal
        visible={iptvVisible}
        scene={'iptv' as SourceScene}
        mode={iptvMode}
        value={iptvForm}
        onChange={(patch) => setIptvForm((prev) => ({ ...prev, ...patch }))}
        onClose={closeIptv}
        onSubmit={submitIptv}
      />
      <SourceModal
        visible={epgVisible}
        scene={'epg' as SourceScene}
        mode={epgMode}
        value={epgForm}
        onChange={(patch) => setEpgForm((prev) => ({ ...prev, ...patch }))}
        onClose={closeEpg}
        onSubmit={submitEpg}
      />

      {/* 隐藏文件 input */}
      <input ref={iptvFileRef} type="file" accept=".json,.txt,application/json,text/plain" onChange={importIptvFileSelected} style={{ display: 'none' }} />
      <input ref={epgFileRef} type="file" accept=".json,.txt,application/json,text/plain" onChange={importEpgFileSelected} style={{ display: 'none' }} />
    </section>
  );
}
