/**
 * 路由标题上下文 — 供 useDocumentTitle 判断「本页是否为激活页」
 *
 * 背景：本项目是 Keep-Alive，所有已访问页面同时挂载。若每个页面各自根据全局
 * location.pathname 写 document.title，则每次路由变化所有已挂载页面（含已切走的页）
 * 的 effect 都会重跑并覆盖标题，最后跑的胜出而非激活页 —— 返回后标题停在旧页。
 *
 * 解决：AppLayout 通过 ActiveRouteContext 下发当前激活路由 key，并通过 SelfRouteContext
 * 给每个页面标记自身路由 key；useDocumentTitle 仅在二者相等（即本页激活）时才写标题。
 * 未被包裹的独立顶层路由（如 /iptv/play）selfRouteKey 为 null，退化为旧的直接写入行为。
 */
import { createContext } from 'react';

/** 当前激活的路由 key（由 AppLayout 提供） */
export const ActiveRouteContext = createContext<string | null>(null);

/** 当前页面自身的路由 key（由 AppLayout 按路由包裹提供） */
export const SelfRouteContext = createContext<string | null>(null);
