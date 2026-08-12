/**
 * orientation 屏幕方向控制单测（9.1）
 *
 * 覆盖：
 * - web 端（无 Capacitor）：lock/unlock 为 no-op，不调用插件
 * - app 端（有 Capacitor）：lockLandscape → ScreenOrientation.lock({landscape})
 * - app 端：unlockOrientation → ScreenOrientation.unlock()
 *
 * 注意：isNativePlatform 有模块级缓存（_isNative），
 * 用 vi.resetModules() + 动态 import 保证每个用例拿到全新模块状态。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 拦截插件（动态 import 同样命中 vi.mock）
vi.mock('@capacitor/screen-orientation', () => ({
  ScreenOrientation: {
    lock: vi.fn().mockResolvedValue(undefined),
    unlock: vi.fn().mockResolvedValue(undefined),
  },
}));

async function freshOrientation() {
  vi.resetModules();
  return await import('./orientation');
}

async function pluginMocks() {
  const mod = (await vi.importActual('@capacitor/screen-orientation')) as Record<string, unknown>;
  return mod;
}

describe('orientation (9.1)', () => {
  const originalCapacitor = (globalThis as Record<string, unknown>).window
    ? (window as unknown as Record<string, unknown>).Capacitor
    : undefined;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).Capacitor = originalCapacitor;
    }
  });

  it('web 端（无 Capacitor）：lockLandscape no-op，不调用插件', async () => {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).Capacitor = undefined;
    }
    const { lockLandscape } = await freshOrientation();
    await lockLandscape();
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    expect(ScreenOrientation.lock).not.toHaveBeenCalled();
  });

  it('web 端（无 Capacitor）：unlockOrientation no-op', async () => {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).Capacitor = undefined;
    }
    const { unlockOrientation } = await freshOrientation();
    await unlockOrientation();
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    expect(ScreenOrientation.unlock).not.toHaveBeenCalled();
  });

  it('app 端：lockLandscape 调用 ScreenOrientation.lock({orientation:"landscape"})', async () => {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).Capacitor = { getPlatform: () => 'android' };
    }
    const { lockLandscape } = await freshOrientation();
    await lockLandscape();
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    expect(ScreenOrientation.lock).toHaveBeenCalledWith({ orientation: 'landscape' });
  });

  it('app 端：unlockOrientation 调用 ScreenOrientation.unlock()', async () => {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).Capacitor = { getPlatform: () => 'android' };
    }
    const { unlockOrientation } = await freshOrientation();
    await unlockOrientation();
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    expect(ScreenOrientation.unlock).toHaveBeenCalled();
  });

  it('app 端：插件异常被静默吞掉，不抛错', async () => {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).Capacitor = { getPlatform: () => 'android' };
    }
    const { lockLandscape } = await freshOrientation();
    const mod = (await import('@capacitor/screen-orientation')) as unknown as {
      ScreenOrientation: { lock: ReturnType<typeof vi.fn> };
    };
    mod.ScreenOrientation.lock.mockRejectedValueOnce(new Error('ROM 不支持'));
    await expect(lockLandscape()).resolves.toBeUndefined();
  });

  // 占位避免未使用告警
  void pluginMocks;
});
