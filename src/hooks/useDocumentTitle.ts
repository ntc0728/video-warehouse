/**
 * useDocumentTitle — 动态设置浏览器页签标题
 *
 * 用法：
 *   useDocumentTitle()           — 仅路由标题
 *   useDocumentTitle('海王')      — 路由 + 内容标题
 *   useDocumentTitle(null, true)  — 沉浸模式，只显示内容标题
 */
import { useEffect, useContext, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ActiveRouteContext, SelfRouteContext } from './routeTitleContext';

export const APP_NAME = 'kinoTV';

const routeTitles: Record<string, string> = {
  '/': '首页',
  '/browse': '搜索',
  '/iptv': 'IPTV',
  '/collections': '收藏',
  '/history': '历史记录',
  '/settings': '设置',
  '/source-checker': '源检测',
  '/detail': '详情',
  '/play': '播放',
  '/player': '播放',
  '/person': '人物',
};

/**
 * 路由级标题：导航发生瞬间（无需等待页面 chunk / 数据加载）立即更新页签名称，
 * 避免「已进入新页面、浏览器页签仍显示上一页标题」的体感延迟。
 *
 * 与 useDocumentTitle 的分工：
 * - 本 hook 只负责「路由名」兜底（如「搜索 - kinoTV」），在 AppLayout / 顶层路由
 *   挂载阶段即用 layout effect 写入，页面 chunk 还在 Suspense 时也生效。
 * - useDocumentTitle 在数据就绪后再把内容标题（如「海王 · 详情」）叠加到路由名之上。
 * 二者写入顺序：子组件 effect（内容标题）在父级 layout effect（路由名）之后运行，
 * 故内容标题最终生效；路由名仅在页面尚未挂载（Suspense）或内容未就绪时可见。
 */
export function useRouteTitleImmediate(): void {
  const location = useLocation();
  useLayoutEffect(() => {
    const routeTitle = getRouteTitle(location.pathname);
    document.title = routeTitle ? `${routeTitle} - ${APP_NAME}` : APP_NAME;
  }, [location.pathname]);
}

export function useDocumentTitle(contentTitle?: string | null, immersive = false) {
  const location = useLocation();
  // Keep-Alive：仅当本页是激活页时才写标题，避免已切走页面覆盖
  const activeRouteKey = useContext(ActiveRouteContext);
  const selfRouteKey = useContext(SelfRouteContext);

  useEffect(() => {
    // 未被 SelfRouteContext 包裹（独立顶层路由，如 /iptv/play）→ 退化为旧行为直接写
    // 被包裹但非激活页 → 跳过，交给激活页写
    if (selfRouteKey != null && selfRouteKey !== activeRouteKey) return;

    let title: string;

    if (immersive && contentTitle) {
      title = `${contentTitle} - ${APP_NAME}`;
    } else if (contentTitle) {
      const routeTitle = getRouteTitle(location.pathname);
      title = routeTitle
        ? `${contentTitle} · ${routeTitle} - ${APP_NAME}`
        : `${contentTitle} - ${APP_NAME}`;
    } else {
      const routeTitle = getRouteTitle(location.pathname);
      title = routeTitle ? `${routeTitle} - ${APP_NAME}` : APP_NAME;
    }

    document.title = title;
  }, [location.pathname, contentTitle, immersive, activeRouteKey, selfRouteKey]);
}

export function getRouteTitle(pathname: string): string | null {
  if (pathname === '/') return routeTitles['/'];
  const match = Object.entries(routeTitles).find(
    ([path]) => path !== '/' && pathname.startsWith(path),
  );
  return match ? match[1] : null;
}
