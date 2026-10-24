package com.anitier.phone;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import java.io.OutputStream;
import android.util.Base64;

public class MainActivity extends Activity {
    private static final int REQUEST_FILE_CHOOSER = 1001;
    private static final int REQUEST_SAVE_BACKUP = 1002;
    private static final int REQUEST_SAVE_MEDIA = 1003;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingBackupJson;
    private OutputStream pendingMediaOutput;
    private String pendingTikTokShare;
    private boolean pageReady;

    @SuppressWarnings("deprecation")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        pendingTikTokShare = extractTikTokLink(getIntent());

        getWindow().setStatusBarColor(Color.parseColor("#07080e"));
        getWindow().setNavigationBarColor(Color.parseColor("#07080e"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#07080e"));
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setDefaultTextEncodingName("utf-8");
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        WebView.setWebContentsDebuggingEnabled(false);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQUEST_FILE_CHOOSER);
                    return true;
                } catch (Exception error) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "Не удалось открыть выбор файла", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });
        webView.addJavascriptInterface(new BackupBridge(), "AniTierAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                dispatchPendingTikTokShare();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.isForMainFrame()) {
                    return openExternal(request.getUrl());
                }
                return false;
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openExternal(Uri.parse(url));
            }
        });

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        pendingTikTokShare = extractTikTokLink(intent);
        dispatchPendingTikTokShare();
    }

    private String extractTikTokLink(Intent intent) {
        if (intent == null) return null;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null) text = intent.getDataString();
        if (text == null) return null;
        Matcher matcher = Pattern.compile("https?://[^\\s<>\\\"']+", Pattern.CASE_INSENSITIVE).matcher(text);
        while (matcher.find()) {
            String value = matcher.group().replaceAll("[),.;!?\\]}]+$", "");
            Uri uri = Uri.parse(value);
            String host = uri.getHost();
            if ("https".equalsIgnoreCase(uri.getScheme()) && host != null
                    && (host.equalsIgnoreCase("tiktok.com") || host.toLowerCase().endsWith(".tiktok.com"))) {
                return value;
            }
        }
        return null;
    }

    private void dispatchPendingTikTokShare() {
        if (!pageReady || webView == null || pendingTikTokShare == null) return;
        final String url = pendingTikTokShare;
        pendingTikTokShare = null;
        webView.evaluateJavascript("window.AniTier && window.AniTier.receiveSharedTikTok && window.AniTier.receiveSharedTikTok("
                + JSONObject.quote(url) + ")", null);
    }

    private boolean openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if ("file".equals(scheme) || "about".equals(scheme) || "data".equals(scheme)) {
            return false;
        }

        if ("http".equals(scheme) || "https".equals(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception error) {
                Toast.makeText(MainActivity.this, "Не удалось открыть ссылку", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        return true;
    }

    private boolean openTikTok(String value) {
        Uri uri = Uri.parse(value == null ? "" : value);
        String host = uri.getHost();
        if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null
                || !(host.equalsIgnoreCase("tiktok.com") || host.toLowerCase().endsWith(".tiktok.com"))) {
            return false;
        }
        runOnUiThread(() -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception error) {
                Toast.makeText(MainActivity.this, "Не удалось открыть TikTok", Toast.LENGTH_SHORT).show();
            }
        });
        return true;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_FILE_CHOOSER) {
            if (filePathCallback == null) {
                super.onActivityResult(requestCode, resultCode, data);
                return;
            }
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null && clip.getItemCount() > 0) {
                    results = new Uri[clip.getItemCount()];
                    for (int i = 0; i < clip.getItemCount(); i++) {
                        results[i] = clip.getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }

        if (requestCode == REQUEST_SAVE_BACKUP) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingBackupJson != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out != null) {
                        out.write(pendingBackupJson.getBytes("UTF-8"));
                        out.flush();
                        Toast.makeText(this, "Резервная копия сохранена", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception error) {
                    Toast.makeText(this, "Не удалось сохранить копию", Toast.LENGTH_SHORT).show();
                }
            }
            pendingBackupJson = null;
            return;
        }

        if (requestCode == REQUEST_SAVE_MEDIA) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                try {
                    pendingMediaOutput = getContentResolver().openOutputStream(data.getData());
                } catch (Exception error) {
                    pendingMediaOutput = null;
                }
                notifyMediaSaveReady(pendingMediaOutput != null);
            } else {
                notifyMediaSaveReady(false);
            }
            return;
        }

        super.onActivityResult(requestCode, resultCode, data);
    }

    private class BackupBridge {
        @JavascriptInterface
        public boolean openTikTok(String url) {
            return MainActivity.this.openTikTok(url);
        }

        @JavascriptInterface
        public void saveBackup(final String json, final String fileName) {
            if (json == null || json.isEmpty()) return;
            pendingBackupJson = json;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/json");
                    intent.putExtra(Intent.EXTRA_TITLE, fileName == null || fileName.isEmpty()
                            ? "anitier-backup.json" : fileName);
                    try {
                        startActivityForResult(intent, REQUEST_SAVE_BACKUP);
                    } catch (Exception error) {
                        pendingBackupJson = null;
                        Toast.makeText(MainActivity.this, "Не удалось открыть сохранение файла", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void beginMediaSave(final String fileName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/octet-stream");
                    intent.putExtra(Intent.EXTRA_TITLE, fileName == null || fileName.isEmpty()
                            ? "anitier-media.bin" : fileName);
                    try {
                        startActivityForResult(intent, REQUEST_SAVE_MEDIA);
                    } catch (Exception error) {
                        notifyMediaSaveReady(false);
                    }
                }
            });
        }

        @JavascriptInterface
        public boolean writeMediaChunk(String base64) {
            if (pendingMediaOutput == null || base64 == null) return false;
            try {
                pendingMediaOutput.write(Base64.decode(base64, Base64.DEFAULT));
                return true;
            } catch (Exception error) {
                return false;
            }
        }

        @JavascriptInterface
        public void finishMediaSave(boolean success) {
            boolean saved = success;
            try {
                if (pendingMediaOutput != null) {
                    if (success) pendingMediaOutput.flush();
                    pendingMediaOutput.close();
                } else {
                    saved = false;
                }
            } catch (Exception error) {
                saved = false;
            } finally {
                pendingMediaOutput = null;
            }
            final boolean result = saved;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(MainActivity.this, result ? "Медиаархив сохранён" : "Не удалось сохранить медиаархив", Toast.LENGTH_SHORT).show();
                    if (webView != null) webView.evaluateJavascript("window.__anitierMediaSaveFinished(" + result + ")", null);
                }
            });
        }
    }

    private void notifyMediaSaveReady(final boolean ready) {
        if (webView != null) webView.evaluateJavascript("window.__anitierMediaSaveReady(" + ready + ")", null);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
