/**
 * 屏幕方向控制（9.1：app 端 IPTV 播放页进入自动横屏）
 *
 * 基于 @capacitor/screen-orientation 插件：
 * - lockLandscape()：锁定横屏（进入 IPTV 播放页时调用）
 * - unlockOrientation()：解锁恢复系统默认方向（离开播放页时调用）
 *
 * 安全设计：
 * - isNativePlatform() 守卫：web 端直接 no-op，零影响
 * - 动态 import：web 端不加载插件代码，不污染 entry
 * - try/catch 静默：个别厂商 ROM 锁横屏可能无效，失败不阻塞播放
 */
import { isNativePlatform } from './platform';

export async function lockLandscape(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    await ScreenOrientation.lock({ orientation: 'landscape' });
  } catch {
    /* 平台不支持 / 系统权限限制 / ROM 差异：静默失败，不阻塞播放 */
  }
}

export async function unlockOrientation(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    await ScreenOrientation.unlock();
  } catch {
    /* ignore */
  }
}
