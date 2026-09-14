/**
 * 延迟标志：`active` 置 true 后等待 `delayMs` 毫秒才返回 true；`active` 置 false 立即返回 false。
 *
 * 用途（2026-09-14 Browse「慢取页反馈」A′ 方案）：
 * 取页耗时 T 的取值域极宽 —— 内存页缓存 / 浏览器 HTTP 缓存命中时只有几十毫秒，
 * 真网络往返则 0.3~2s，跨页边界还要 ×2。若一置 loading 就挂反馈：
 *   - T 小时反馈只存在 1~2 帧 → 视觉抽搐（flash of loading state）；
 *   - T 大时反馈又是必需的（否则界面静止、用户以为卡死）。
 * 用延迟阈值把「瞬时完成」的那批过滤掉，只给真正拖慢的等待挂反馈，两个档位各取最优。
 *
 * 注意：这是「延迟显示」而非「防抖」—— 不合并任何调用、不推迟任何请求，
 * 只控制反馈何时出现在屏幕上。防抖解决请求次数，本 hook 解决反馈时机。
 */
import { useEffect, useState } from 'react';

export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) {
      setElapsed(false);
      return;
    }
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  // 与 active 取与：active 转 false 当帧即失效，不必等 effect 复位（少一帧残留）
  return active && elapsed;
}
