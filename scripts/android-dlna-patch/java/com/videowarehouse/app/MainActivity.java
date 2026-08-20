package com.videowarehouse.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import com.videowarehouse.app.cast.CastBridgePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 原生投屏桥：必须在 super.onCreate() 之前注册，确保 WebView 端
        // Capacitor.Plugins.CastBridge 代理可用（注入见下方 onPageLoaded shim）
        registerPlugin(CastBridgePlugin.class);

        super.onCreate(savedInstanceState);

        // 固定 WebView 文本缩放 100%：Android WebView 默认 textZoom 跟随系统
        // fontScale（系统「字体大小」调大 → 项目文本整体放大，布局 px 不变，
        // 导致不同设备观感差异）。固定后系统字体设置不再影响本项目。
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            // setTextZoom(int) 在 compileSdk 34 的 android.jar 中为隐藏 API
            //（javap 公共签名不可见），但系统 WebView 运行时必然存在 → 反射调用
            try {
                webView.getClass().getMethod("setTextZoom", int.class).invoke(webView, 100);
            } catch (Exception ignored) {
                // 反射失败则保持系统默认（不影响功能，仅观感差异）
            }
        }

        // 页面加载完成后注入 window.CastBridge shim（代理到原生 CastBridge 插件）。
        // shim 方法签名与前端 src/services/castService.ts 的 CastBridge 契约一一对应。
        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    injectCastBridgeShim(webView);
                }
            });
        }
    }

    private static void injectCastBridgeShim(WebView webView) {
        String shim = "(function () {"
                + "  if (window.CastBridge) { return; }"
                + "  function plugin() {"
                + "    return window.Capacitor && window.Capacitor.Plugins"
                + "      && window.Capacitor.Plugins.CastBridge;"
                + "  }"
                + "  window.CastBridge = {"
                + "    discover: function () {"
                + "      var p = plugin();"
                + "      if (!p || !p.discover) { return Promise.resolve([]); }"
                + "      return p.discover().then(function (r) {"
                + "        return (r && r.devices) || [];"
                + "      });"
                + "    },"
                + "    connect: function (deviceId) {"
                + "      var p = plugin();"
                + "      if (!p || !p.connect) { return Promise.resolve(); }"
                + "      return p.connect({ deviceId: deviceId });"
                + "    },"
                + "    disconnect: function () {"
                + "      var p = plugin();"
                + "      if (!p || !p.disconnect) { return Promise.resolve(); }"
                + "      return p.disconnect();"
                + "    },"
                + "    setSource: function (url, title) {"
                + "      var p = plugin();"
                + "      if (!p || !p.setSource) { return Promise.resolve(); }"
                + "      return p.setSource({ url: url, title: title || '' });"
                + "    },"
                + "    play: function () {"
                + "      var p = plugin();"
                + "      if (!p || !p.play) { return Promise.resolve(); }"
                + "      return p.play();"
                + "    },"
                + "    pause: function () {"
                + "      var p = plugin();"
                + "      if (!p || !p.pause) { return Promise.resolve(); }"
                + "      return p.pause();"
                + "    },"
                + "    seek: function (time) {"
                + "      var p = plugin();"
                + "      if (!p || !p.seek) { return Promise.resolve(); }"
                + "      return p.seek({ time: time });"
                + "    },"
                + "    setVolume: function (volume) {"
                + "      var p = plugin();"
                + "      if (!p || !p.setVolume) { return Promise.resolve(); }"
                + "      return p.setVolume({ volume: volume });"
                + "    },"
                + "    ensurePermission: function () {"
                + "      var p = plugin();"
                + "      if (!p || !p.ensurePermission) { return Promise.resolve('granted'); }"
                + "      return p.ensurePermission().then(function (r) {"
                + "        return (r && r.status) || 'granted';"
                + "      });"
                + "    },"
                + "    openAppSettings: function () {"
                + "      var p = plugin();"
                + "      if (!p || !p.openAppSettings) { return Promise.resolve(); }"
                + "      return p.openAppSettings();"
                + "    }"
                + "  };"
                + "})();";
        try {
            webView.evaluateJavascript(shim, null);
        } catch (Exception ignored) {
            // 注入失败则前端 getCastBridge() 返回 null → 投屏弹窗空态，功能不受影响
        }
    }
}
