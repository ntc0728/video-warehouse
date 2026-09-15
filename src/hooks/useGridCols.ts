/**
 * 读取网格列数 CSS token 的实际值（整数），供骨架按「列数 × 行数」生成占位卡。
 *
 * 为什么不在 JS 里另刻一套断点表（useMediaQuery 逐档判断）：
 * 那会让列数出现第二个真源，与 variables.css / index.css 必然漂移
 * （本项目已多次发生「骨架列数与真实网格差一档」）。这里只做「读」——
 * 列数真源仍是 CSS token，断点调整只改 CSS 一处，骨架自动跟随。
 *
 * 约定：
 *  - token 必须登记在 html（:root）或其媒体查询覆盖上，本 hook 读 documentElement 计算值；
 *  - 视口跨越断点由 ResizeObserver 捕获；设备档切换（html[data-device]）由 MutationObserver 捕获；
 *  - 读取用 useLayoutEffect（paint 前完成修正），避免首帧按 fallback 张数闪一下。
 */
import { useLayoutEffect, useState } from 'react';

export function useGridCols(token: string, fallback = 1): number {
  const [cols, setCols] = useState(fallback);

  useLayoutEffect(() => {
    const read = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
      const n = Number.parseInt(raw, 10);
      // token 未定义 / 非数字 / ≤0 时退回 fallback，绝不让张数变成 NaN 或 0
      setCols(Number.isFinite(n) && n > 0 ? n : fallback);
    };
    read();

    const ro = new ResizeObserver(read);
    ro.observe(document.documentElement);

    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-device'] });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [token, fallback]);

  return cols;
}
