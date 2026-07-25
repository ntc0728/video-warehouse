/**
 * 设置与用户数据备份
 * 支持导出（设置 + 收藏 + 观看历史）为 JSON 文件，以及从 JSON 文件导入恢复。
 */
import { useSettingsStore, DEFAULT_SETTINGS } from '@/stores/useSettingsStore';
import { useUserStore } from '@/stores/useUserStore';
import type { CollectionRecord, HistoryRecord } from '@/types/store';
import type { VideoType } from '@/types/video';

export interface SettingsBackup {
  version: 1;
  exportedAt: string;
  settings: Record<string, unknown>;
  collections: CollectionRecord[];
  history: HistoryRecord[];
}

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

/** 收集当前设置与用户数据 */
export function collectBackup(): SettingsBackup {
  const s = useSettingsStore.getState();
  const { collections, history } = useUserStore.getState();
  const settings: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    settings[key] = (s as unknown as Record<string, unknown>)[key];
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    collections,
    history,
  };
}

/** 导出备份为 JSON 文件并触发下载 */
export function exportBackup(): void {
  const data = collectBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.download = `kinotv-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 解析备份文件文本，校验基本结构 */
export function parseBackup(text: string): SettingsBackup {
  const obj = JSON.parse(text) as Partial<SettingsBackup>;
  if (!obj || typeof obj !== 'object' || !obj.settings || typeof obj.settings !== 'object') {
    throw new Error('文件格式不正确：缺少设置数据');
  }
  return {
    version: 1,
    exportedAt: obj.exportedAt ?? new Date().toISOString(),
    settings: obj.settings,
    collections: Array.isArray(obj.collections) ? obj.collections : [],
    history: Array.isArray(obj.history) ? obj.history : [],
  };
}

/** 将备份数据应用到当前存储（设置 + 收藏 + 历史） */
export function applyBackup(data: SettingsBackup): void {
  // 仅写入 DEFAULT_SETTINGS 中存在的字段，避免污染 store
  const patch: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    if (key in data.settings) {
      patch[key] = data.settings[key];
    }
  }
  useSettingsStore.setState(patch);

  // 敏感字段需经加密 setter 持久化（setState 不触发加密）
  const settings = data.settings as Record<string, unknown>;
  if (settings.tmdbAccessToken) {
    useSettingsStore.getState().setTMDBToken(String(settings.tmdbAccessToken));
  }
  if (settings.translationApiKey) {
    useSettingsStore.getState().setTranslationApiKey(String(settings.translationApiKey));
  }

  // 恢复收藏与历史（先清空再写入）
  const user = useUserStore.getState();
  user.clearCollections();
  user.clearHistory();
  data.collections.forEach((c) => useUserStore.getState().addCollection(c.videoId, {
    title: c.title,
    cover: c.cover,
    type: c.type as VideoType,
    year: c.year,
    rating: c.rating,
    sourceIndex: c.sourceIndex,
  }));
  data.history.forEach((h) => useUserStore.getState().addHistory(h));
}
