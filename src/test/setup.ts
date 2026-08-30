import '@testing-library/jest-dom'

// jsdom 不实现 window.matchMedia，而 useMediaQuery / useIsDesktop 等 hook 直接读取它。
// 提供最小 stub，避免渲染这些 hook 的组件单测在初始化阶段崩溃。
// 默认 matches=false（测试环境视为「非桌面」），保证 PullToRefreshOverlay 等组件
// 在单测中照常渲染并接管手势；真实浏览器仍按视口正确判定桌面/移动。
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList);
}
