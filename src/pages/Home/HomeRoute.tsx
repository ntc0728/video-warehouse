/**
 * HomeRoute — 路由层包装
 *
 * 不再使用 key={homeResetKey} 强制 unmount/remount HomePage。
 * 旧实现会让每次点"首页"按钮都重跑 fetchAllHomeData + 20 张图预加载,
 * 是"切回首页仍卡顿"的根因。HomePage 没有需要被 reset 的本地 state,
 * store 数据已缓存,scrollToTop 由 useScrollRestore 负责。
 *
 * 跨页面导航（/browse → /、/settings → / 等）由 React Router 切到不同
 * 的 ReactElement,自然重建 HomePage 实例,无需 key 介入。
 */
import HomePage from './index';

export default function HomeRoute() {
  return <HomePage />;
}
