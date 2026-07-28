/**
 * useDocumentTitle — 动态设置浏览器页签标题
 *
 * 用法：
 *   useDocumentTitle()           — 仅路由标题
 *   useDocumentTitle('海王')      — 路由 + 内容标题
 *   useDocumentTitle(null, true)  — 沉浸模式，只显示内容标题
 */
import { useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { ActiveRouteContext, SelfRouteContext } from './routeTitleContext';

const APP_NAME = 'kinoTV';

const routeTitles: Record<string, string> = {
  '/': '首页',
  '/browse': '搜索',
  '/iptv': 'IPTV',
  '/collections': '收藏',
  '/history': '历史记录',
  '/settings': '设置',
};

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

function getRouteTitle(pathname: string): string | null {
  if (pathname === '/') return routeTitles['/'];
  const match = Object.entries(routeTitles).find(
    ([path]) => path !== '/' && pathname.startsWith(path),
  );
  return match ? match[1] : null;
}
