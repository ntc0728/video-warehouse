import { useCallback, useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

export interface CmsSourceGuard {
  /** 给定 cmsSourceId 判断该源是否已在设置中启用（未传 id 视为放行，如 TMDB 详情类记录） */
  isSourceEnabled: (cmsSourceId?: string) => boolean;
  /**
   * 跳转前调用：源未启用返回 false 并弹出居中提示弹窗；
   * 源已启用（或未携带源标识）返回 true，调用方继续导航。
   */
  requestNavigate: (cmsSourceId?: string, cmsSourceName?: string) => boolean;
  /** 当前被拦截的源名称（用于弹窗文案）；null 表示无弹窗 */
  blockedSourceName: string | null;
  modalVisible: boolean;
  closeModal: () => void;
}

/**
 * CMS 源启用守卫：历史/收藏页点击「直链收藏」类记录跳转前，
 * 校验记录所选 CMS 源是否在设置中启用；未启用则拦截导航并弹出居中弹窗。
 *
 * 启用状态取自持久化 settings.videoSourceIds（启用源 ID 列表），
 * 无需等待 sourceManager bootstrap，单独进入历史/收藏页也不会误拦。
 */
export function useCmsSourceGuard(): CmsSourceGuard {
  const [blockedSourceName, setBlockedSourceName] = useState<string | null>(null);

  const isSourceEnabled = useCallback((cmsSourceId?: string): boolean => {
    if (!cmsSourceId) return true;
    const enabledIds = useSettingsStore.getState().videoSourceIds;
    return enabledIds.includes(cmsSourceId);
  }, []);

  const requestNavigate = useCallback(
    (cmsSourceId?: string, cmsSourceName?: string): boolean => {
      if (isSourceEnabled(cmsSourceId)) return true;
      setBlockedSourceName(cmsSourceName || cmsSourceId || '该视频源');
      return false;
    },
    [isSourceEnabled],
  );

  const closeModal = useCallback(() => setBlockedSourceName(null), []);

  return {
    isSourceEnabled,
    requestNavigate,
    blockedSourceName,
    modalVisible: blockedSourceName !== null,
    closeModal,
  };
}
