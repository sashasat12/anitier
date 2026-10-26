package com.anitier.phone;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Виджет «Следующая серия»: берёт ближайшую серию из расписания,
 * которое приложение уже сохраняет для напоминаний.
 */
public class NextEpisodeWidgetProvider extends AppWidgetProvider {
    private static final String PREFS = "anitier-release-notifications";
    private static final String ITEMS = "items";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, manager, id);
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName name = new ComponentName(context, NextEpisodeWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(name);
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_next_episode);

        String title = "AniTier";
        String episode = "Нет ближайших серий";
        String when = "Откройте приложение";

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray items = new JSONArray(prefs.getString(ITEMS, "[]"));
            JSONObject best = null;
            long bestAt = Long.MAX_VALUE;
            long now = System.currentTimeMillis();

            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                long at = parseDate(item.optString("date", ""));
                if (at <= 0 || at < now - 60 * 60 * 1000L) continue;
                if (at < bestAt) {
                    bestAt = at;
                    best = item;
                }
            }

            if (best != null) {
                title = best.optString("title", title);
                int number = best.optInt("n", 0);
                episode = number > 0 ? "Серия " + number : "Новая серия";
                SimpleDateFormat format = new SimpleDateFormat("d MMM, HH:mm", new Locale("ru", "RU"));
                when = format.format(new Date(bestAt));
            }
        } catch (Exception ignored) {
            /* виджет остаётся с подсказкой */
        }

        views.setTextViewText(R.id.widget_title, title);
        views.setTextViewText(R.id.widget_episode, episode);
        views.setTextViewText(R.id.widget_date, when);

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pending = PendingIntent.getActivity(context, 0, intent, flags);
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        manager.updateAppWidget(widgetId, views);
    }

    private static long parseDate(String value) {
        if (value == null || value.isEmpty()) return 0;
        String[] patterns = {
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat format = new SimpleDateFormat(pattern, Locale.US);
                format.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date date = format.parse(value);
                if (date != null) return date.getTime();
            } catch (Exception ignored) {
                /* пробуем следующий формат */
            }
        }
        return 0;
    }
}
