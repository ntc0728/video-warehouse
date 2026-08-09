import { useRef, useState, type ChangeEvent } from 'react';
import { Upload, AlertTriangle } from 'lucide-react';
import { Button, ConfirmDialog, toast } from '@/components/ui';
import { useSettingsStore } from '@/stores';
import { useUserStore } from '@/stores';
import ProfileHeader from '../ProfileHeader';
import { exportBackup, parseBackup, applyBackup } from '../settingsBackup';
import { clearAllCaches } from '@/lib/clearCaches';
import { Icon } from "@/components/ui/Icon";

type ConfirmKind = null | 'reset' | 'collections' | 'history' | 'all' | 'cache';

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
      toast.success('已导出设置与数据');
    } catch {
      toast.error('导出失败，请重试');
    }
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      applyBackup(parseBackup(text));
      toast.success('已导入并恢复数据');
    } catch (err) {
      toast.error((err as Error).message || '导入失败');
    }
  };

  const doConfirm = () => {
    switch (confirm) {
      case 'reset':
        resetToDefaults();
        toast.success('设置已恢复默认');
        break;
      case 'collections':
        clearCollections();
        toast.success('收藏已清空');
        break;
      case 'history':
        clearHistory();
        toast.success('观看历史已清空');
        break;
      case 'all':
        resetToDefaults();
        clearCollections();
        clearHistory();
        toast.success('已恢复默认并清空收藏、历史');
        break;
      case 'cache':
        void clearAllCaches().then(() => {
          toast.success('已清除全部缓存');
        }).catch(() => {
          toast.error('清除缓存失败，请重试');
        });
        break;
    }
    setConfirm(null);
  };

  const confirmTitle =
    confirm === 'all' ? '恢复默认并清空数据'
      : confirm === 'cache' ? '清除全部缓存'
        : confirm === 'reset' ? '恢复设置默认'
          : confirm === 'collections' ? '清空我的收藏'
            : '清空观看历史';

  const confirmDesc =
    confirm === 'all' ? '将设置页内容全部恢复默认，并清空收藏与观看历史，此操作不可恢复。'
      : confirm === 'cache' ? '将清除频道列表、节目单、首页与类目数据、源检测结果等缓存，清除后将在下次访问时自动重新加载。不影响设置、收藏、历史等个人数据。'
        : confirm === 'reset' ? '仅重置设置项，收藏与观看历史不受影响。'
          : confirm === 'collections' ? `将清空全部 ${collectionsCount} 条收藏，此操作不可恢复。`
            : `将清空全部 ${historyCount} 条观看历史，此操作不可恢复。`;

  return (
    <>
      {/* 个人资料：桌面端 / 移动端统一为 banner 风格 */}
      <ProfileHeader />

      {/* 配置管理 */}
      <section className="settings-personal-section">
        <h3 className="settings-card__title">配置管理</h3>
        <div className="settings-card__body">
          <div className="settings-card__header">
            <Button variant="ghost" size="sm" className="settings-action-btn settings-action-btn--inline" onClick={() => fileRef.current?.click()}>
              <Icon icon={Upload} size="sm" /> 一键导入恢复数据
            </Button>
          </div>
          <p className="settings-card__desc">导入 / 导出「设置页内容」以及「我的收藏、观看历史记录」，支持一键导入恢复数据。</p>
          <button type="button" className="settings-row" onClick={handleExport}>
            <span className="settings-row__label"><span className="settings-row__title">导出设置与数据</span><small>含收藏、观看历史</small></span>
            <span className="settings-row__chev" aria-hidden>›</span>
          </button>
          <button type="button" className="settings-row" onClick={() => fileRef.current?.click()}>
            <span className="settings-row__label"><span className="settings-row__title">导入设置与数据</span><small>从备份文件恢复</small></span>
            <span className="settings-row__chev" aria-hidden>›</span>
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
      </section>

      {/* 恢复默认配置 */}
      <section className="settings-personal-section">
        <h3 className="settings-card__title">恢复默认配置</h3>
        <div className="settings-card__body">
          <div className="settings-card__header">
            <Button variant="ghost" size="sm" className="settings-action-btn settings-action-btn--inline settings-action-btn--danger" onClick={() => setConfirm('all')}>
              <Icon icon={AlertTriangle} size="sm" /> 一键全部恢复默认
            </Button>
          </div>
          <p className="settings-card__desc">将设置页内容全部恢复默认，并可清空收藏、历史记录等操作。</p>
          <button type="button" className="settings-row" onClick={() => setConfirm('reset')}>
            <span className="settings-row__label"><span className="settings-row__title">恢复设置默认</span><small>仅重置设置项</small></span>
            <span className="settings-row__chev" aria-hidden>›</span>
          </button>
          <button type="button" className="settings-row" onClick={() => setConfirm('collections')}>
            <span className="settings-row__label"><span className="settings-row__title">清空我的收藏</span><small>共 {collectionsCount} 条 · 不可恢复</small></span>
            <span className="settings-row__chev" aria-hidden>›</span>
          </button>
          <button type="button" className="settings-row" onClick={() => setConfirm('history')}>
            <span className="settings-row__label"><span className="settings-row__title">清空观看历史</span><small>共 {historyCount} 条 · 不可恢复</small></span>
            <span className="settings-row__chev" aria-hidden>›</span>
          </button>
          <button type="button" className="settings-row" onClick={() => setConfirm('cache')}>
            <span className="settings-row__label"><span className="settings-row__title">清除全部缓存</span><small>频道、节目单、首页数据等 · 下次访问自动重载</small></span>
            <span className="settings-row__chev" aria-hidden>›</span>
          </button>
        </div>
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
