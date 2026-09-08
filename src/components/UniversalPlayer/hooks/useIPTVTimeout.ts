/**
 * IPTV 加载超时检测 Hook
 *
 * [批次4设计决策] 使用回调函数 onTimeout 而非直接操作 hasError 状态
 * 原因：hasError 是主组件的本地状态，不在 Zustand store 中
 * 设计：通过 onTimeout 回调通知主组件处理超时逻辑
 * 好处：保持 hook 的纯粹性，避免副作用耦合
 */
import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores';
import { isIOS } from '../lib/utils';

interface UseIPTVTimeoutOptions {
  /** 是否启用超时看门狗（由能力矩阵 `hasTimeoutWatchdog` 驱动；直播类模式为 true，点播为 false） */
  enabled: boolean;
  currentUrl: string;
  onTimeout?: () => void;
}

export function useIPTVTimeout({ enabled, currentUrl, onTimeout }: UseIPTVTimeoutOptions) {
  const iptvTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // P4：mode 判断迁到能力矩阵，由调用方传入 `enabled`（= hasTimeoutWatchdog）。
    // 等价性：原 `mode !== 'iptv'` 对 video 早退、对 iptv 生效；
    // 现 `!enabled` 对 video（hasTimeoutWatchdog=false）早退、对 iptv/live（true）生效。逐字等价。
    if (!enabled || !currentUrl) return;

    clearTimeout(iptvTimeoutRef.current);
    iptvTimeoutRef.current = setTimeout(() => {
      const state = usePlayerStore.getState();
      if (!state.isPlaying) {
        onTimeout?.();
      }
    }, isIOS() ? 20000 : 15000);

    return () => clearTimeout(iptvTimeoutRef.current);
  }, [enabled, currentUrl, onTimeout]);
}
