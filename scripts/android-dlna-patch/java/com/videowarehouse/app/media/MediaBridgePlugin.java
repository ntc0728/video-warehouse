package com.videowarehouse.app.media;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * MediaBridge 原生插件：向 WebView 暴露「后台音频前台服务」能力（P3）。
 * 由 MainActivity 在 super.onCreate() 之前 registerPlugin 注册，WebView 端
 * 通过注入的 window.MediaBridge shim（转发到 Capacitor.Plugins.MediaBridge）调用。
 *
 * 方法与前端 src/services/backgroundAudioService.ts 的 MediaBridge 契约一一对应。
 * startForegroundService 启动 MediaService（API 26+ 限制后台启动 Service），由 Service
 * 自行管理 MediaPlayer + MediaSession + 前台通知。
 */
@CapacitorPlugin(name = "MediaBridge")
public class MediaBridgePlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        // API 26+ 必须用 startForegroundService 启动 Service（否则 IllegalStateException）
        Intent intent = MediaService.buildStartIntent(getContext(), url, title, artist);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void play(PluginCall call) {
        Intent intent = MediaService.buildPlayIntent(getContext());
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        Intent intent = MediaService.buildPauseIntent(getContext());
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = MediaService.buildStopIntent(getContext());
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void seek(PluginCall call) {
        Long timeMs = call.getLong("timeMs");
        if (timeMs == null) {
            call.reject("timeMs is required");
            return;
        }
        Intent intent = MediaService.buildSeekIntent(getContext(), timeMs);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        // 简化：不做跨进程状态查询；前端可据 play/pause 回调自行维护
        JSObject ret = new JSObject();
        ret.put("state", "stopped");
        call.resolve(ret);
    }
}
