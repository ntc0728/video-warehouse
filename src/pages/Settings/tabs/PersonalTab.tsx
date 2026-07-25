import { useRef, useState, type ChangeEvent } from 'react';
import { Upload, AlertTriangle } from 'lucide-react';
import { Button, ConfirmDialog, toast } from '@/components/ui';
import { useSettingsStore } from '@/stores';
import { useUserStore } from '@/stores';
import ProfileHeader from '../ProfileHeader';
import { exportBackup, parseBackup, applyBackup } from '../settingsBackup';

type ConfirmKind = null | 'reset' | 'collections' | 'history' | 'all';

export default function PersonalTab() {
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);
  const clearCollections = useUserStore((s) => s.clearCollections);
  const clearHistory = useUserStore((s) => s.clearHistory);
  const collectionsCount = useUserStore((s) => s.collections.length);
  const historyCount = useUserStore((s) => s.history.length);

  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      exportBackup();
      toast.show('已导出设置与数据');
    } catch {
      toast.show('导出失败，请重试');
    }
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      applyBackup(parseBackup(text));
      toast.show('已导入并恢复数据');
    } catch (err) {
      toast.show((err as Error).message || '导入失败');
    }
  };

  const doConfirm = () => {
    switch (confirm) {
      case 'reset':
        resetToDefaults();
        toast.show('设置已恢复默认');
        break;
      case 'collections':
        clearCollections();
        toast.show('收藏已清空');
        break;
      case 'history':
        clearHistory();
        toast.show('观看历史已清空');
        break;
      case 'all':
        resetToDefaults();
        clearCollections();
        clearHistory();
        toast.show('已恢复默认并清空收藏、历史');
        break;
    }
    setConfirm(null);
  };

  const confirmTitle =
    confirm === 'all' ? '恢复默认并清空数据'
      : confirm === 'reset' ? '恢复设置默认'
        : confirm === 'collections' ? '清空我的收藏'
          : '清空观看历史';

  const confirmDesc =
    confirm === 'all' ? '将设置页内容全部恢复默认，并清空收藏与观看历史，此操作不可恢复。'
      : confirm === 'reset' ? '仅重置设置项，收藏与观看历史不受影响。'
        : confirm === 'collections' ? `将清空全部 ${collectionsCount} 条收藏，此操作不可恢复。`
          : `将清空全部 ${historyCount} 条观看历史，此操作不可恢复。`;

  return (
    <>
      {/* 个人资料：桌面端 / 移动端统一为 banner 风格 */}
      <ProfileHeader />

      {/* 配置管理 */}
      <section className="settings-personal-section">
        <div className="settings-card__header">
          <h3 className="settings-card__title">配置管理</h3>
          <Button variant="ghost" size="sm" className="settings-action-btn settings-action-btn--inline" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> 一键导入恢复数据
          </Button>
        </div>
        <p className="settings-card__desc">导入 / 导出「设置页内容」以及「我的收藏、观看历史记录」，支持一键导入恢复数据。</p>
        <button type="button" className="settings-row" onClick={handleExport}>
          <span className="settings-row__label">导出设置与数据<small>含收藏、观看历史</small></span>
          <span className="settings-row__chev" aria-hidden>›</span>
        </button>
        <button type="button" className="settings-row" onClick={() => fileRef.current?.click()}>
          <span className="settings-row__label">导入设置与数据<small>从备份文件恢复</small></span>
          <span className="settings-row__chev" aria-hidden>›</span>
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
      </section>

      {/* 恢复默认配置 */}
      <section className="settings-personal-section">
        <div className="settings-card__header">
          <h3 className="settings-card__title">恢复默认配置</h3>
          <Button variant="ghost" size="sm" className="settings-action-btn settings-action-btn--inline settings-action-btn--danger" onClick={() => setConfirm('all')}>
            <AlertTriangle size={16} /> 一键全部恢复默认
          </Button>
        </div>
        <p className="settings-card__desc">将设置页内容全部恢复默认，并可清空收藏、历史记录等操作。</p>
        <button type="button" className="settings-row" onClick={() => setConfirm('reset')}>
          <span className="settings-row__label">恢复设置默认<small>仅重置设置项</small></span>
          <span className="settings-row__chev" aria-hidden>›</span>
        </button>
        <button type="button" className="settings-row" onClick={() => setConfirm('collections')}>
          <span className="settings-row__label">清空我的收藏<small>共 {collectionsCount} 条 · 不可恢复</small></span>
          <span className="settings-row__chev" aria-hidden>›</span>
        </button>
        <button type="button" className="settings-row" onClick={() => setConfirm('history')}>
          <span className="settings-row__label">清空观看历史<small>共 {historyCount} 条 · 不可恢复</small></span>
          <span className="settings-row__chev" aria-hidden>›</span>
        </button>
      </section>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirmTitle}
        description={confirmDesc}
        confirmText="确认"
        variant="danger"
        onConfirm={doConfirm}
      />
    </>
  );
}
