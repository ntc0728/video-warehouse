package com.videowarehouse.app.cast;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/**
 * CastBridge 原生插件：向 WebView 暴露 DLNA 投屏能力。
 * 由 MainActivity 在 {@code registerPlugin(CastBridgePlugin.class)} 注册，WebView 端
 * 通过注入的 window.CastBridge shim（转发到 Capacitor.Plugins.CastBridge）调用。
 *
 * 方法与前端 src/services/castService.ts 的 CastBridge 契约一一对应。
 */
@CapacitorPlugin(
        name = "CastBridge",
        permissions = {
                @Permission(strings = {Manifest.permission.NEARBY_WIFI_DEVICES}, alias = "nearbyWifi")
        })
public class CastBridgePlugin extends Plugin {

    private static final String TAG = "CastBridgePlugin";
    private static final long DISCOVER_TIMEOUT_MS = 3000;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicReference<List<CastDeviceInfo>> discovered = new AtomicReference<>(new ArrayList<>());
    private final AtomicReference<CastDeviceInfo> connectedDevice = new AtomicReference<>(null);

    @PluginMethod
    public void discover(PluginCall call) {
        final ContextRef ctx = new ContextRef(getContext());
        executor.execute(() -> {
            try {
                List<CastDeviceInfo> devices = SSDPDiscovery.discover(ctx.get(), DISCOVER_TIMEOUT_MS);
                discovered.set(devices);
                JSArray arr = new JSArray();
                for (CastDeviceInfo d : devices) {
                    JSObject o = new JSObject();
                    o.put("id", d.id);
                    o.put("name", d.name);
                    o.put("address", d.address);
                    arr.put(o);
                }
                JSObject ret = new JSObject();
                ret.put("devices", arr);
                call.resolve(ret);
            } catch (Exception e) {
                Log.w(TAG, "discover failed: " + e.getMessage());
                call.reject("discover failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String deviceId = call.getString("deviceId");
        if (deviceId == null || deviceId.isEmpty()) {
            call.reject("deviceId required");
            return;
        }
        CastDeviceInfo dev = findById(deviceId);
        if (dev == null) {
            call.reject("device not found: " + deviceId);
            return;
        }
        connectedDevice.set(dev);
        Log.d(TAG, "connected: " + dev.name);
        call.resolve();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        final CastDeviceInfo dev = connectedDevice.getAndSet(null);
        if (dev != null) {
            executor.execute(() -> {
                try {
                    UPnPAVTransport.stop(dev);
                } catch (Exception e) {
                    Log.w(TAG, "stop on disconnect failed: " + e.getMessage());
                }
            });
        }
        call.resolve();
    }

    @PluginMethod
    public void setSource(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title");
        if (url == null || url.isEmpty()) {
            call.reject("url required");
            return;
        }
        final CastDeviceInfo dev = connectedDevice.get();
        if (dev == null) {
            call.reject("not connected");
            return;
        }
        final String safeTitle = title == null ? "" : title;
        executor.execute(() -> {
            try {
                UPnPAVTransport.setAVTransportURI(dev, url, safeTitle);
                call.resolve();
            } catch (Exception e) {
                Log.w(TAG, "setSource failed: " + e.getMessage());
                call.reject("setSource failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        runAction(call, device -> {
            UPnPAVTransport.play(device);
            return null;
        }, "play");
    }

    @PluginMethod
    public void pause(PluginCall call) {
        runAction(call, device -> {
            UPnPAVTransport.pause(device);
            return null;
        }, "pause");
    }

    @PluginMethod
    public void seek(PluginCall call) {
        Double time = call.getDouble("time");
        final double seconds = time == null ? 0.0 : time;
        runAction(call, device -> {
            UPnPAVTransport.seek(device, seconds);
            return null;
        }, "seek");
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double volume = call.getDouble("volume");
        final double vol = volume == null ? 0.5 : volume;
        runAction(call, device -> {
            UPnPAVTransport.setVolume(device, vol);
            return null;
        }, "setVolume");
    }

    /**
     * 检查/请求投屏所需权限。
     * DLNA SSDP 组播在 Android 12L+/13+ 受「附近的设备」(NEARBY_WIFI_DEVICES) 运行时权限约束；
     * 未授权时触发系统授权弹窗，用户拒绝后前端展示「去设置授权」并调 openAppSettings。
     * 老系统（无该运行时权限）视为已授予。
     */
    @PluginMethod
    public void ensurePermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("nearbyWifi") != PermissionState.GRANTED) {
                requestPermissionForAlias("nearbyWifi", call, "permissionResult");
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("status", "granted");
        call.resolve(ret);
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        boolean granted = getPermissionState("nearbyWifi") == PermissionState.GRANTED;
        JSObject ret = new JSObject();
        ret.put("status", granted ? "granted" : "denied");
        call.resolve(ret);
    }

    /** 打开系统应用详情页（设置）供用户手动授权被拒的权限 */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            Log.w(TAG, "openAppSettings failed: " + e.getMessage());
            call.reject("openAppSettings failed: " + e.getMessage());
        }
    }

    private interface DeviceAction {
        Object run(CastDeviceInfo device) throws Exception;
    }

    private void runAction(PluginCall call, DeviceAction action, String name) {
        final CastDeviceInfo dev = connectedDevice.get();
        if (dev == null) {
            call.reject("not connected");
            return;
        }
        executor.execute(() -> {
            try {
                action.run(dev);
                call.resolve();
            } catch (Exception e) {
                Log.w(TAG, name + " failed: " + e.getMessage());
                call.reject(name + " failed: " + e.getMessage());
            }
        });
    }

    private CastDeviceInfo findById(String deviceId) {
        for (CastDeviceInfo d : discovered.get()) {
            if (deviceId.equals(d.id)) {
                return d;
            }
        }
        return null;
    }

    /** 简单的 Context 强引用持有（仅插件生命周期内短期使用），避免匿名内部类捕获跨线程问题。 */
    private static final class ContextRef {
        private final android.content.Context value;

        ContextRef(android.content.Context value) {
            this.value = value;
        }

        android.content.Context get() {
            return value;
        }
    }
}
