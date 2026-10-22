package com.shaunmcintyre.sol.lightkeeper;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String UPDATE_ROOT = "https://shaunmcintyre813.github.io/sol-lightkeeper/";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private UpdateStore store;
    private UpdateStore.Launch launch;
    private boolean ready;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(14, 25, 38));
        getWindow().setNavigationBarColor(Color.rgb(14, 25, 38));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        View waiting = new View(this);
        waiting.setBackgroundColor(Color.rgb(14, 25, 38));
        setContentView(waiting);
        new Thread(() -> {
            try {
                store = new UpdateStore(new File(getFilesDir(), "content"), new URL(UPDATE_ROOT), null,
                    getAssets().open("www/update.manifest"));
                UpdateStore.Launch selected = store.prepare(isOnline());
                runOnUiThread(() -> show(selected));
            } catch (Exception error) {
                runOnUiThread(() -> show(new UpdateStore.Launch(null, "bundle", false)));
            }
        }, "sol-update-check").start();
    }

    private boolean isOnline() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo info = manager == null ? null : manager.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    private void show(UpdateStore.Launch selected) {
        launch = selected;
        ready = false;
        if (webView != null) { webView.destroy(); webView = null; }
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.setBackgroundColor(Color.rgb(14, 25, 38));
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface public void ready() {
                handler.post(() -> {
                    if (launch != selected || ready) return;
                    ready = true;
                    if (store != null && selected.pending) {
                        try { store.ready(selected.id); } catch (IOException ignored) { }
                    }
                });
            }
        }, "SolAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return asset(request.getUrl(), selected);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return !"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost());
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) handler.post(() -> fail(selected));
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                handler.post(() -> fail(selected));
                return true;
            }
        });
        setContentView(webView);
        webView.loadUrl("https://" + HOST + "/index.html");
        handler.postDelayed(() -> { if (launch == selected && !ready) fail(selected); }, 12000);
    }

    private void fail(UpdateStore.Launch selected) {
        if (launch != selected || ready) return;
        ready = true;
        if (store == null || selected.directory == null) return;
        try { show(store.failed(selected.id)); }
        catch (IOException ignored) { show(new UpdateStore.Launch(null, "bundle", false)); }
    }

    private WebResourceResponse asset(Uri uri, UpdateStore.Launch selected) {
        if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost())) return missing();
        String path = uri.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
        if (!path.matches("/[A-Za-z0-9._/-]+") || path.contains("..") || path.contains("//")) return missing();
        try {
            InputStream input = selected.directory == null
                ? getAssets().open("www" + path)
                : new FileInputStream(new File(selected.directory, path.substring(1)));
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            return new WebResourceResponse(mime(path), "UTF-8", 200, "OK", headers, input);
        } catch (IOException error) { return missing(); }
    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
            Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".mjs") || path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".webmanifest")) return "application/manifest+json";
        if (path.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    @Override protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
