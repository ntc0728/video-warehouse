package com.videowarehouse.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
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
    }
}
