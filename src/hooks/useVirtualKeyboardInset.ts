import { useEffect } from 'react';

/** 键盘遮挡高度低于此值视为浏览器工具栏伸缩，不抬升浮层（键盘通常 ≥160px） */
const KB_INSET_MIN = 80;

/**
 * 虚拟键盘视口变量：把「键盘遮挡高度 / 可见视口高度 / 可见视口顶部偏移」写入 :root。
 *
 * 配套 index.html viewport 的 interactive-widget=resizes-content：
 * · 支持该关键字的浏览器（Android Chrome/WebView 108+）：布局视口随键盘缩小，
 *   --kb-inset ≈ 0，fixed bottom 已在键盘上方；
 * · 不支持的浏览器（iOS Safari / WKWebView / 旧 WebView）：innerHeight 不变、
 *   visualViewport 缩小/平移，差值即遮挡高度 → 浮层读 --kb-inset 抬升；
 *   --kb-vvh / --kb-vvtop 供底部弹层限高、居中弹窗在可见区重新居中。
 *
 * 只监听 visualViewport（resize/scroll），卸载时清掉变量，避免残留到其他页。
 */
export function useVirtualKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;

    const update = () => {
      const visibleHeight = Math.max(0, Math.round(vv.height));
      const viewportTop = Math.max(0, Math.round(vv.offsetTop));
      const rawInset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      // 过滤浏览器地址栏/工具栏伸缩造成的几十像素假差；可见高度/顶部始终写入。
      const inset = rawInset >= KB_INSET_MIN ? rawInset : 0;
      root.style.setProperty('--kb-inset', `${inset}px`);
      root.style.setProperty('--kb-vvh', `${visibleHeight}px`);
      root.style.setProperty('--kb-vvtop', `${viewportTop}px`);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--kb-inset');
      root.style.removeProperty('--kb-vvh');
      root.style.removeProperty('--kb-vvtop');
    };
  }, []);
}
