/**
 * 强制 loading 状态的最短持续时间 hook
 *
 * 用途：避免快速 API 响应（< 100ms，本地缓存/弱网重试成功/服务端 SSE 复用）下
 *       骨架占位闪 1 帧就被替换为真实数据，造成视觉抖动。
 *
 * 用法：
 *   const effectiveLoading = useMinLoadingTime(isLoading, 300);
 *   {effectiveLoading && <Skeleton />}
 *
 * 行为：
 *   - isLoading 上升沿：立即返回 true
 *   - isLoading 下降沿：等 minMs 后才返回 false
 *   - 计时期间 isLoading 再次上升：取消计时（保持 true）
 *   - 组件 unmount：清理 setTimeout
 *
 * @param isLoading 真实加载状态（来自 store / fetch）
 * @param minMs 最短持续时间（默认 300ms）
 * @returns 经过最短持续时间控制后的"有效" loading 状态
 */
import { useEffect, useRef, useState } from 'react';

export function useMinLoadingTime(isLoading: boolean, minMs = 300): boolean {
  const [effective, setEffective] = useState(isLoading);
  const downSinceRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 上升沿：立即 true，并取消下降沿计时
    if (isLoading) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      downSinceRef.current = null;
      setEffective(true);
      return;
    }

    // 下降沿：记录下降时间，启动延迟翻转
    if (downSinceRef.current === null) {
      downSinceRef.current = Date.now();
    }
    const elapsed = Date.now() - downSinceRef.current;
    const remain = Math.max(0, minMs - elapsed);

    timerRef.current = setTimeout(() => {
      downSinceRef.current = null;
      timerRef.current = null;
      setEffective(false);
    }, remain);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isLoading, minMs]);

  return effective;
}
