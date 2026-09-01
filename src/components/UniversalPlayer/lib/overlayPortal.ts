/**
 * 播放器浮层（toast / 菜单 / 弹窗）的 portal 目标决策。
 *
 * 为什么不能一律 portal 到 document.body：
 * - fullscreen-api 档（Android Chrome / 桌面 Chrome 等）：container 进入浏览器
 *   top layer，body 下的任何元素都会被其覆盖（z-index 无效）；
 * - css-pseudo 伪全屏（App 端 WebView / iPhone）：container z-index 9998，
 *   body 下 z-index 较低的浮层同样被盖。
 *
 * 因此：container 处于全屏态（fullscreenElement / webkitFullscreenElement）时，
 * 浮层必须 portal 进 container 本身；非全屏维持 body
 * （逃出 .app-shell__scroll 的 contain:layout 劫持 fixed 包含块）。
 *
 * 坐标无需换算：全屏时 container rect = (0,0,vw,vh)，视口坐标 == 容器坐标。
 */
export function getOverlayPortalTarget(
  container: HTMLElement | null | undefined,
): HTMLElement {
  if (!container) return document.body;
  const fsElement =
    document.fullscreenElement ??
    (document as Document & { webkitFullscreenElement?: Element | null })
      .webkitFullscreenElement ??
    null;
  if (fsElement != null && fsElement === container) return container;
  return document.body;
}
