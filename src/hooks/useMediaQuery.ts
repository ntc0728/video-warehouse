import { useState, useEffect } from 'react';
import { isNativePlatform } from '@/lib/platform';
import { useSettingsStore } from '@/stores';

/**
 * 监听 CSS 媒体查询的 Hook
 * @param query CSS 媒体查询表达式，如 '(max-width: 1023px)'
 * @returns 当前是否匹配该媒体查询
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** 检测是否为移动端（视口宽度 < 1024px） */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}

/**
 * 通过 User-Agent 检测是否为「真实手机」（排除平板 / 桌面）。
 *
 * 用于移动端布局：仅真实手机 web + App(Capacitor) 渲染手机 UI，
 * 桌面浏览器把窗口调窄、平板（iPad / Android 平板）不触发。
 *
 * 判定规则：
 *  - 平板：显式 tablet 关键字，或 Android 设备但不带 Mobile（Android 平板特征）；
 *  - 手机：iPhone / iPod / Android+Mobile / 其它移动 UA。
 */
export function getIsRealPhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isTablet =
    /ipad|tablet|kindle|playbook|silk|nexus (?:7|9|10)|galaxy tab|sm-t|gt-[p5]|sch-i|mi pad|redmi pad/i.test(
      ua,
    ) || (/android/i.test(ua) && !/mobile/i.test(ua));
  const isPhoneUA =
    /iphone|ipod|android.*mobile|mobile|blackberry|bb10|opera mini|webos|windows phone|iemobile/i.test(
      ua,
    );
  return isPhoneUA && !isTablet;
}

/** 真实手机检测 Hook（基于 getIsRealPhone 的状态化封装） */
export function useIsRealPhone(): boolean {
  const [isRealPhone] = useState(getIsRealPhone);
  return isRealPhone;
}

/**
 * 是否应展示「移动端 UI 布局」。
 *
 * 命中任一即展示移动端布局：
 *  - App 端（Capacitor 原生）；
 *  - 真实手机 web 端（UA 命中手机，排除平板 / 桌面）；
 *  - 视口宽度 < 768px（窄窗 / 平板竖屏 / 桌面窄窗统一走移动端布局）。
 *
 * 注意：isNativePlatform 是普通函数（读缓存），useIsRealPhone / useMediaQuery 是 Hook，
 * 三者都无条件调用以保证 Hook 顺序稳定。
 */
export function useIsMobileLayout(): boolean {
  const isNative = isNativePlatform();
  const isRealPhone = useIsRealPhone();
  const isNarrow = useMediaQuery('(max-width: 767px)');
  return isNative || isRealPhone || isNarrow;
}

/** 检测是否为桌面端（视口宽度 >= 1024px） */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/**
 * 通过 User-Agent 检测是否为电视设备
 * 支持 WebOS、Tizen、Roku、Apple TV、PlayStation、Xbox、Google TV 等
 * @returns 是否为电视设备
 */
export function getIsTV(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes('tv') ||
    ua.includes('smart-tv') ||
    ua.includes('hbbtv') ||
    ua.includes('roku') ||
    ua.includes('viera') ||
    ua.includes('webos') ||
    ua.includes('tizen') ||
    ua.includes('googletv') ||
    ua.includes('appletv') ||
    ua.includes('crkey') ||
    ua.includes('playstation') ||
    ua.includes('xbox')
  );
}

/**
 * 电视设备检测 Hook
 * 优先读取用户在设置页的「TV 模式」强制开关；关闭时回退到 User-Agent 自动检测。
 * 订阅 store，开关切换后即时响应（无需重新挂载组件）。
 */
export function useIsTV(): boolean {
  const forceTV = useSettingsStore((s) => s.tvMode);
  return forceTV || getIsTV();
}

/**
 * 投影仪设备检测 Hook。
 * ⚠️ 投影仪 UA 无可靠特征（市面投影仪多伪装成普通浏览器 / Android TV UA，
 * 且部分投影仪直接跑标准 Chromium），自动检测不可行 —— 仅提供设置/存储层
 * 手动指定入口（useSettingsStore.projectorMode，对齐 tvMode 同款机制）。
 */
export function useIsProjector(): boolean {
  return useSettingsStore((s) => s.projectorMode);
}

/**
 * 「TV 类」设备语义封装（tv || projector）—— 焦点交互语义的唯一判定入口。
 *
 * 投影仪与 TV 共享同一套焦点交互（遥控器/方向键空间导航、卡片 tabIndex、
 * 焦点滚动、TV 焦点方框），但布局几何走桌面档（≥1920，data-device="projector"
 * 命中各 html:not([data-device="tv"]) 桌面分档、不命中 [data-device="tv"]
 * 2× 几何覆盖块）。需要「焦点交互」语义时用本 Hook，禁止在调用方散布
 * `useIsTV() || useIsProjector()` 组合判断。
 *
 * 注意：布局几何/宽度档语义（useHeroSideCols / useIsWideDesktop / isWideDetail /
 * 播放器 platform 等）应继续使用 useIsTV（真 TV 判定），投影仪按桌面几何走。
 */
export function useIsTVLike(): boolean {
  const isTV = useIsTV();
  const isProjector = useIsProjector();
  return isTV || isProjector;
}

/**
 * 通过 User-Agent 检测是否为真正的移动设备（手机/平板）
 * 不依赖视口宽度，避免桌面浏览器窗口调小时误判
 */
export function getIsRealMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod|mobile|webos|blackberry|opera mini|iemobile/i.test(ua);
}

/** 真实移动设备检测 Hook */
export function useIsRealMobile(): boolean {
  const [isRealMobile] = useState(getIsRealMobile);
  return isRealMobile;
}
