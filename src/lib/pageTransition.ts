/**
 * 页面过渡动画的统一决策中心 + 黑场转场幕布（curtain）
 *
 * 设计背景（2026-08-30）：
 * 1. 页面进入动画原先分散挂在各页面自己的根元素上（page-transition-enter /
 *    --stagger），导致分支漏挂（Person 主分支、Player 七个分支、Detail 的
 *    loading / notFound 分支）。现由 AppLayout 的 .page-transition 容器统一接管，
 *    本模块只负责「按路由决定用哪个变体」，页面代码零感知。
 *
 * 2. /iptv/play 是顶层独立路由（不走 AppLayout），整个页面就是播放器。
 *    播放器自身不得参与任何进场动画（避免首帧重采样、控制条抖动），
 *    改为「来源页离场 → 黑场幕布 → 播放页挂载 → 幕布淡出」的黑场转场，
 *    视觉上连续、播放器零动画。
 *
 * 3. 幕布必须挂在 document.body 上：进入 /iptv/play 时 AppLayout 会被卸载，
 *    任何挂在 React 树内的元素都会随之消失，无法跨越这次导航。
 */

/** 页面过渡变体 */
export type PageVariant =
  /** 常规页：内容层柔和淡入（不整页 opacity 0→1，避免全屏亮度跃变闪眼） */
  | 'soft'
  /** 视频播放页：播放器区域豁免动画，仅周边内容柔和淡入 */
  | 'player'
  /** 零动画：IPTV 播放页，由黑场幕布承担转场 */
  | 'none'
  /**
   * 首页：容器层刻意不出任何规则，交给首页自己的专属过渡
   * （Hero 不参与、内容淡入、骨架屏延迟淡入）。
   * 首页这套是专门调过的 —— 一旦被容器规则接管，HeroBanner 会被卷进
   * opacity 动画而出现合成层闪烁。保留自治。
   */
  | 'home';

/**
 * 时长常量。改动必须同步 animations.css 里的 --dur-pt-* 变量，
 * 否则 AppLayout 的离场等待与 CSS 动画会对不上（表现为黑场提前/延后）。
 */
export const PT_DUR = {
  /** 内容层进场 */
  enter: 240,
  /** 来源页离场（进入黑场路由时） */
  leave: 200,
  /** 幕布淡入（遮住来源页） */
  curtainIn: 200,
  /** 幕布淡出（露出新页） */
  curtainOut: 200,
  /** 兜底：幕布最长驻留时间，防止新页未调用 dropCurtain 导致永久黑屏 */
  curtainMaxHold: 3000,
} as const;

/** 需要黑场转场的目标路由（进入这些路由时，来源页播放离场动画） */
const CURTAIN_ROUTES: readonly string[] = ['/iptv/play'];

/** 视频播放页路由（播放器区域豁免进场动画） */
const PLAYER_ROUTES: readonly string[] = ['/play', '/player'];

/** 系统「减少动态效果」偏好：开启时一切转场从简（幕布仍可用，但瞬时） */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 目标路径是否为黑场转场路由（用 pathname 判断，兼容带 query 的 /iptv/play?url=…） */
export function isCurtainPath(pathname: string): boolean {
  return CURTAIN_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/**
 * 按路由 key（routeConfig 的路径模式，如 '/play'、'/detail'）决定变体。
 * 未匹配到路由时返回 soft（兜底走常规柔和淡入）。
 */
export function getPageVariant(routeKey: string | null | undefined): PageVariant {
  if (!routeKey) return 'soft';
  if (routeKey === '/') return 'home';
  if (PLAYER_ROUTES.includes(routeKey)) return 'player';
  if (routeKey === '/iptv/play') return 'none';
  return 'soft';
}

/**
 * 是否需要为「从 from 到 to」这次导航播放来源页离场动画。
 * 只在 PUSH/REPLACE 生效；POP（浏览器后退）由 react-router 自行放行，不做拦截。
 */
export function needsLeaveAnimation(fromPath: string, toPath: string): boolean {
  if (!isCurtainPath(toPath)) return false;
  // 已经在目标页内（换台时的 replace）不需要再来一次转场
  return fromPath !== toPath && !isCurtainPath(fromPath);
}

/* ─────────────────────────────────────────────────────────────
   黑场幕布：命令式 DOM，跨 React 树存活
   ───────────────────────────────────────────────────────────── */

const CURTAIN_ID = 'pt-curtain';
let holdTimer: number | null = null;

function ensureCurtain(): HTMLDivElement {
  let el = document.getElementById(CURTAIN_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = CURTAIN_ID;
    el.className = 'pt-curtain';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  return el;
}

function clearHoldTimer() {
  if (holdTimer !== null) {
    window.clearTimeout(holdTimer);
    holdTimer = null;
  }
}

/**
 * 幕布淡入（遮住当前页）。返回实际耗时（ms），调用方据此等待后再导航。
 * 幂等：连续调用只刷新兜底定时器。
 */
export function raiseCurtain(): number {
  if (typeof document === 'undefined') return 0;
  const el = ensureCurtain();
  const duration = prefersReducedMotion() ? 0 : PT_DUR.curtainIn;

  el.style.transitionDuration = `${duration}ms`;
  // 先确保处于可见层（移除 display:none），下一帧再改 opacity 才会触发 transition
  el.classList.add('pt-curtain--active');
  void el.offsetWidth;
  el.style.opacity = '1';

  // 兜底：新页若未调用 dropCurtain（异常/unmount），强制放幕，绝不永久黑屏
  clearHoldTimer();
  holdTimer = window.setTimeout(() => dropCurtain(), PT_DUR.curtainMaxHold);

  return duration;
}

/**
 * 幕布淡出（露出新页）。新页挂载后调用；未升起过时调用无害。
 */
export function dropCurtain(): void {
  if (typeof document === 'undefined') return;
  clearHoldTimer();
  const el = document.getElementById(CURTAIN_ID) as HTMLDivElement | null;
  if (!el || el.style.opacity !== '1') return;

  const duration = prefersReducedMotion() ? 0 : PT_DUR.curtainOut;
  el.style.transitionDuration = `${duration}ms`;
  el.style.opacity = '0';
  window.setTimeout(() => el.classList.remove('pt-curtain--active'), duration);
}
