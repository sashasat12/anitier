package com.anitier.phone;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.DownloadManager;
import android.app.PendingIntent;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.Environment;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.provider.Settings;
import android.widget.Toast;
import org.json.JSONObject;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import java.io.InputStream;
import java.io.OutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import android.util.Base64;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final int REQUEST_FILE_CHOOSER = 1001;
    private static final int REQUEST_SAVE_BACKUP = 1002;
    private static final int REQUEST_SAVE_MEDIA = 1003;
    private static final int REQUEST_RELEASE_NOTIFICATIONS = 1004;
    private static final String RELEASE_PREFS = "anitier-release-notifications";
    private static final String RELEASE_ENABLED = "enabled";
    private static final String RELEASE_ITEMS = "items";
    private static final String APP_ASSET_ORIGIN = "https://appassets.androidplatform.net";
    private static final String APP_ASSET_BASE = APP_ASSET_ORIGIN + "/assets/";
    private static final String APP_START_URL = APP_ASSET_BASE + "index.html";
    /* Страховочная копия в приватной памяти приложения: переживает смену
       адреса страницы, обновление и очистку данных WebView. */
    private static final String SNAPSHOT_FILE = "anitier-snapshot.json";
    private static final long SNAPSHOT_MAX_BYTES = 32L * 1024 * 1024;
    /* Старые сборки открывали file:///android_asset/index.html; их данные
       лежат в localStorage другого адреса и переносятся один раз. */
    private static final String LEGACY_PREFS = "anitier-legacy-storage";
    private static final String LEGACY_DONE = "migrated";
    private static final String LEGACY_URL = "file:///android_asset/legacy.html";
    /* Найденные данные прошлой сборки: предлагаются вручную, если в текущем
       хранилище уже что-то есть. */
    private static final String LEGACY_FILE = "anitier-legacy.json";

    /* Пакеты TikTok: обычный, для Европы/Азии и китайская версия Douyin. */
    private static final String[] TIKTOK_PACKAGES = {
            "com.zhiliaoapp.musically",
            "com.ss.android.ugc.trill",
            "com.ss.android.ugc.aweme",
            "com.zhiliaoapp.musically.go",
    };

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingBackupJson;
    private OutputStream pendingMediaOutput;
    private String pendingTikTokShare;
    private boolean pageReady;
    private boolean enablingReleaseNotifications;
    private String pendingLegacyJson;
    private WebView legacyView;
    private long updateDownloadId = -1;
    private BroadcastReceiver updateDownloadReceiver;

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
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
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
                dispatchLegacyData();
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = interceptAppAsset(request.getUrl());
                return response != null ? response : super.shouldInterceptRequest(view, request);
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
        migrateLegacyStorage();
        webView.loadUrl(APP_START_URL);
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

    private boolean isAppAsset(Uri uri) {
        return uri != null
                && "https".equalsIgnoreCase(uri.getScheme())
                && "appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())
                && uri.getPath() != null
                && uri.getPath().startsWith("/assets/");
    }

    private WebResourceResponse interceptAppAsset(Uri uri) {
        if (!isAppAsset(uri)) return null;
        String path = uri.getPath().substring("/assets/".length());
        if (path.isEmpty() || path.contains("..")) return notFoundResponse();
        try {
            InputStream input = getAssets().open(path);
            String mime = "text/html";
            String lower = path.toLowerCase();
            if (lower.endsWith(".js")) mime = "application/javascript";
            else if (lower.endsWith(".css")) mime = "text/css";
            else if (lower.endsWith(".json")) mime = "application/json";
            else if (lower.endsWith(".png")) mime = "image/png";
            else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = "image/jpeg";
            else if (lower.endsWith(".svg")) mime = "image/svg+xml";
            else if (lower.endsWith(".webmanifest")) mime = "application/manifest+json";
            else if (lower.endsWith(".woff2")) mime = "font/woff2";
            else if (lower.endsWith(".woff")) mime = "font/woff";
            Map<String, String> headers = new HashMap<String, String>();
            headers.put("Access-Control-Allow-Origin", APP_ASSET_ORIGIN);
            if (Build.VERSION.SDK_INT >= 21) {
                return new WebResourceResponse(mime, "utf-8", 200, "OK", headers, input);
            }
            return new WebResourceResponse(mime, "utf-8", input);
        } catch (Exception error) {
            return notFoundResponse();
        }
    }

    private WebResourceResponse notFoundResponse() {
        if (Build.VERSION.SDK_INT >= 21) {
            Map<String, String> headers = new HashMap<String, String>();
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, null);
        }
        return null;
    }

    private boolean openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (isAppAsset(uri)) {
            return false;
        }
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
        runOnUiThread(() -> startExternal(uri));
        return true;
    }

    /**
     * Поиск в TikTok: сначала пробуем приложение TikTok, если его нет — браузер.
     */
    private boolean searchInTikTok(String query) {
        String text = query == null ? "" : query.trim();
        if (text.isEmpty()) return false;
        Uri web = Uri.parse("https://www.tiktok.com/search?q=" + Uri.encode(text));
        String encoded = Uri.encode(text);
        Uri[] deepLinks = new Uri[]{
                Uri.parse("tiktok://search?keyword=" + encoded),
                Uri.parse("snssdk1233://search?keyword=" + encoded),
                Uri.parse("musically://search?keyword=" + encoded),
                Uri.parse("snssdk1180://search?keyword=" + encoded),
        };
        runOnUiThread(() -> {
            if (!openInTikTokApp(deepLinks, web)) startExternal(web);
        });
        return true;
    }

    /** Открывает поиск внутри приложения TikTok, не показывая выбор браузера. */
    private boolean openInTikTokApp(Uri[] deepLinks, Uri web) {
        for (String pkg : TIKTOK_PACKAGES) {
            if (!isPackageInstalled(pkg)) continue;
            for (Uri uri : deepLinks) {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                intent.setPackage(pkg);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    startActivity(intent);
                    return true;
                } catch (Exception ignored) {
                    // схема не поддерживается — пробуем следующую
                }
            }
            Intent webIntent = new Intent(Intent.ACTION_VIEW, web);
            webIntent.setPackage(pkg);
            webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                startActivity(webIntent);
                return true;
            } catch (Exception ignored) {
                // приложение не ловит веб-ссылку — идём в браузер
            }
        }
        return false;
    }

    private boolean isPackageInstalled(String pkg) {
        try {
            getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (Exception error) {
            return false;
        }
    }

    private void startExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception error) {
            Toast.makeText(MainActivity.this, "Не удалось открыть TikTok", Toast.LENGTH_SHORT).show();
        }
    }

    private boolean hasNotificationPermission() {
        return Build.VERSION.SDK_INT < 33 || checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void updateReleaseNotifications(boolean enabled) {
        SharedPreferences prefs = getSharedPreferences(RELEASE_PREFS, MODE_PRIVATE);
        prefs.edit().putBoolean(RELEASE_ENABLED, enabled).apply();
        if (!enabled) {
            ReleaseNotificationScheduler.cancelAll(this, prefs.getString(RELEASE_ITEMS, "[]"));
            prefs.edit().putString(RELEASE_ITEMS, "[]").apply();
        } else {
            ReleaseNotificationScheduler.schedule(this, prefs.getString(RELEASE_ITEMS, "[]"));
        }
        notifyReleaseNotificationState(enabled);
    }

    private void notifyReleaseNotificationState(boolean enabled) {
        if (webView != null) webView.evaluateJavascript(
                "window.AniTier && window.AniTier.onReleaseNotificationPermissionResult(" + enabled + ")", null);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_RELEASE_NOTIFICATIONS) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        updateReleaseNotifications(granted && enablingReleaseNotifications);
        enablingReleaseNotifications = false;
        if (!granted) Toast.makeText(this, "Разрешите уведомления AniTier в настройках телефона", Toast.LENGTH_LONG).show();
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

    /* Один раз читает localStorage старого адреса file:// и отдаёт данные приложению. */
    private void migrateLegacyStorage() {
        SharedPreferences prefs = getSharedPreferences(LEGACY_PREFS, MODE_PRIVATE);
        if (prefs.getBoolean(LEGACY_DONE, false)) return;
        try {
            WebView reader = new WebView(this);
            WebSettings settings = reader.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            reader.addJavascriptInterface(new LegacyBridge(), "AniTierAndroidLegacy");
            reader.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    /* Если страница не отчиталась, не держим WebView в памяти. */
                    new Handler(Looper.getMainLooper()).postDelayed(() -> destroyLegacyView(view), 2000);
                }
            });
            legacyView = reader;
            reader.loadUrl(LEGACY_URL);
        } catch (Exception error) {
            /* Ничего не помечаем: попробуем ещё раз при следующем запуске. */
        }
    }

    private class LegacyBridge {
        @JavascriptInterface
        public void report(final String json) {
            SharedPreferences prefs = getSharedPreferences(LEGACY_PREFS, MODE_PRIVATE);
            prefs.edit().putBoolean(LEGACY_DONE, true).apply();
            if (json == null || json.isEmpty() || "{}".equals(json)) return;
            if (!writePrivateFile(LEGACY_FILE, json)) return;
            runOnUiThread(() -> {
                pendingLegacyJson = json;
                dispatchLegacyData();
                destroyLegacyView(legacyView);
            });
        }
    }

    /* Данные прошлой сборки, сохранённые для ручного восстановления. */
    private String readPrivateFile(String name) {
        File file = new File(getFilesDir(), name);
        if (!file.exists() || file.length() == 0 || file.length() > SNAPSHOT_MAX_BYTES) return "";
        try {
            byte[] data = new byte[(int) file.length()];
            int offset = 0;
            try (FileInputStream in = new FileInputStream(file)) {
                while (offset < data.length) {
                    int read = in.read(data, offset, data.length - offset);
                    if (read < 0) break;
                    offset += read;
                }
            }
            return new String(data, 0, offset, StandardCharsets.UTF_8);
        } catch (Exception error) {
            return "";
        }
    }

    private boolean writePrivateFile(String name, String text) {
        File dir = getFilesDir();
        File target = new File(dir, name);
        File tmp = new File(dir, name + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(text.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        } catch (Exception error) {
            return false;
        }
        if (tmp.renameTo(target)) return true;
        /* Некоторые файловые системы не переименовывают поверх файла. */
        return target.delete() && tmp.renameTo(target);
    }

    private void dispatchLegacyData() {
        if (pendingLegacyJson == null || webView == null || !pageReady) return;
        String payload = pendingLegacyJson;
        pendingLegacyJson = null;
        String script = "window.AniTier && window.AniTier.receiveLegacyData && window.AniTier.receiveLegacyData("
                + JSONObject.quote(payload) + ")";
        webView.evaluateJavascript(script, null);
    }

    private void destroyLegacyView(WebView view) {
        if (view == null) return;
        if (view == legacyView) legacyView = null;
        try {
            view.loadUrl("about:blank");
            view.destroy();
        } catch (Exception ignored) {
        }
    }

    /* Обновление качается внутри приложения: DownloadManager и установщик. */
    private boolean startUpdateDownload(String url, String version) {
        if (url == null || !url.startsWith("https://")) return false;
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            runOnUiThread(() -> {
                Toast.makeText(this, "Разрешите установку приложений из AniTier и нажмите «Скачать обновление» ещё раз", Toast.LENGTH_LONG).show();
                try {
                    startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + getPackageName())));
                } catch (Exception ignored) {
                }
            });
            return false;
        }
        try {
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) return false;
            String safeVersion = version == null ? "" : version.replaceAll("[^0-9A-Za-z._-]", "");
            if (safeVersion.length() > 20) safeVersion = safeVersion.substring(0, 20);
            String fileName = "AniTier" + (safeVersion.isEmpty() ? "" : "-" + safeVersion) + ".apk";
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("AniTier " + safeVersion);
            request.setDescription("Обновление AniTier");
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, fileName);
            updateDownloadId = manager.enqueue(request);
            registerUpdateReceiver();
            runOnUiThread(() -> Toast.makeText(this, "Скачиваем обновление…", Toast.LENGTH_SHORT).show());
            return true;
        } catch (Exception error) {
            runOnUiThread(() -> Toast.makeText(this, "Не удалось начать загрузку", Toast.LENGTH_SHORT).show());
            return false;
        }
    }

    private void registerUpdateReceiver() {
        if (updateDownloadReceiver != null) return;
        updateDownloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != updateDownloadId) return;
                installDownloadedUpdate(id);
            }
        };
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(updateDownloadReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(updateDownloadReceiver, filter);
        }
    }

    private void installDownloadedUpdate(long id) {
        DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) return;
        Uri uri = manager.getUriForDownloadedFile(id);
        if (uri == null) {
            Toast.makeText(this, "Не удалось скачать обновление", Toast.LENGTH_LONG).show();
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
        } catch (Exception error) {
            Toast.makeText(this, "Не удалось открыть установщик", Toast.LENGTH_LONG).show();
        }
    }

    private class BackupBridge {
        @JavascriptInterface
        public void openUrl(String url) {
            Uri uri = Uri.parse(url == null ? "" : url);
            String scheme = uri.getScheme();
            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) return;
            runOnUiThread(() -> openExternal(uri));
        }

        @JavascriptInterface
        public boolean openTikTokSearch(String query) {
            return searchInTikTok(query);
        }

        @JavascriptInterface
        public boolean areReleaseNotificationsEnabled() {
            return getSharedPreferences(RELEASE_PREFS, MODE_PRIVATE).getBoolean(RELEASE_ENABLED, false)
                    && hasNotificationPermission();
        }

        @JavascriptInterface
        public void setReleaseNotificationsEnabled(boolean enabled) {
            runOnUiThread(() -> {
                if (!enabled) {
                    updateReleaseNotifications(false);
                } else if (Build.VERSION.SDK_INT >= 33 && !hasNotificationPermission()) {
                    enablingReleaseNotifications = true;
                    requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, REQUEST_RELEASE_NOTIFICATIONS);
                } else {
                    updateReleaseNotifications(true);
                }
            });
        }

        @JavascriptInterface
public void scheduleReleaseNotifications(String json) {
    if (json == null) return;

    runOnUiThread(() -> {
        SharedPreferences prefs = getSharedPreferences(
                RELEASE_PREFS, MODE_PRIVATE);

        String oldJson = prefs.getString(RELEASE_ITEMS, "[]");

        // Отменяем старое расписание до сохранения нового.
        ReleaseNotificationScheduler.cancelAll(
                MainActivity.this, oldJson);

        prefs.edit().putString(RELEASE_ITEMS, json).apply();
        NextEpisodeWidgetProvider.updateAll(MainActivity.this);

        if (prefs.getBoolean(RELEASE_ENABLED, false)
                && hasNotificationPermission()) {
            ReleaseNotificationScheduler.schedule(
                    MainActivity.this, json);
        }
    });
}

        @JavascriptInterface
        public boolean openTikTok(String url) {
            return MainActivity.this.openTikTok(url);
        }

        @JavascriptInterface
        public boolean downloadUpdate(String url, String version) {
            return startUpdateDownload(url, version);
        }

        @JavascriptInterface
        public boolean saveSnapshot(String json) {
            if (json == null || json.isEmpty() || json.length() > SNAPSHOT_MAX_BYTES) return false;
            return writePrivateFile(SNAPSHOT_FILE, json);
        }

        @JavascriptInterface
        public String loadSnapshot() {
            return readPrivateFile(SNAPSHOT_FILE);
        }

        @JavascriptInterface
        public long snapshotSavedAt() {
            File file = new File(getFilesDir(), SNAPSHOT_FILE);
            return file.exists() ? file.lastModified() : 0;
        }

        @JavascriptInterface
        public String loadLegacyData() {
            return readPrivateFile(LEGACY_FILE);
        }

        @JavascriptInterface
        public boolean clearLegacyData() {
            File file = new File(getFilesDir(), LEGACY_FILE);
            return !file.exists() || file.delete();
        }

        @JavascriptInterface
        public void saveBackup(final String json, final String fileName) {
            if (json == null || json.isEmpty()) return;
            pendingBackupJson = json;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    String name = fileName == null || fileName.isEmpty() ? "anitier-backup.json" : fileName;
                    String type = name.toLowerCase().endsWith(".ics") ? "text/calendar" : "application/json";
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(type);
                    intent.putExtra(Intent.EXTRA_TITLE, name);
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
                    String safeName = fileName == null || fileName.isEmpty()
                            ? "anitier-media.bin" : fileName;
                    intent.setType(safeName.toLowerCase().endsWith(".png")
                            ? "image/png" : "application/octet-stream");
                    intent.putExtra(Intent.EXTRA_TITLE, safeName);
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
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
                "window.AniTier && window.AniTier.handleAndroidBack ? window.AniTier.handleAndroidBack() : false",
                value -> {
                    if (!"true".equals(value)) MainActivity.super.onBackPressed();
                }
        );
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
        if (updateDownloadReceiver != null) {
            try { unregisterReceiver(updateDownloadReceiver); } catch (Exception ignored) { }
            updateDownloadReceiver = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
