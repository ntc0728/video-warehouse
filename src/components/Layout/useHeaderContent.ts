/**
 * useHeaderContent — 兼容层 Hook
 *
 * 合并 HeaderActionsContext + HeaderStateContext 两个 Context 的值,
 * 既保持旧 API 签名(单一 Hook 调用),又能让 Provider 拆分优化生效。
 *
 * 单独拆分以满足 react-refresh/only-export-components 约束。
 */
import { useContext, useEffect, useMemo } from 'react';
import { HeaderActionsContext, HeaderStateContext } from './HeaderContext';
import type { HeaderConfig, HeaderActionsValue, HeaderStateValue } from './types';

export function useHeaderContent(config?: HeaderConfig): HeaderActionsValue & HeaderStateValue {
  const actions = useContext(HeaderActionsContext);
  const state = useContext(HeaderStateContext);
  useEffect(() => {
    if (!config) return;
    const cleanup = actions.setHeaderConfig(config);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.content, config?.showFilter, config?.onFilterClick, config?.immersive]);
  return useMemo(() => ({ ...actions, ...state }), [actions, state]);
}
