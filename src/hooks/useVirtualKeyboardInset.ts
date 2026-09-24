import { useEffect } from 'react';

/**
 * 虚拟键盘 inset：把「键盘遮挡高度」写入 :root 的 --kb-inset。
 *
 * 配套 index.html viewport 的 interactive-widget=resizes-content：
 * · 支持该关键字的浏览器：布局视口随键盘缩小，--kb-inset ≈ 0，fixed bottom 已在键盘上方；
 * · 不支持的浏览器：innerHeight 不变、visualViewport.height 缩小，差值即遮挡高度，
 *   index.css 中 bottom:0 的底部浮层（modal/bottomsheet 等）改读 var(--kb-inset) 抬升。
 *
 * 只监听 visualViewport（resize/scroll），卸载时清掉变量，避免残留到其他页。。
 */
export function useVirtualKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;

    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty('--kb-inset', `${inset}px`);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--kb-inset');
    };
  }, []);
}
