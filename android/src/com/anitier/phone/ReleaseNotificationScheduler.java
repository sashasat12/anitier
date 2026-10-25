package com.anitier.phone;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public final class ReleaseNotificationScheduler {
    private static final String ACTION =
            "com.anitier.phone.RELEASE_NOTIFICATION";

    private ReleaseNotificationScheduler() {}

    public static void schedule(Context context, String json) {
        cancelAll(context, json);

        try {
            JSONArray items = new JSONArray(json);
            AlarmManager alarms =
                    (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            if (alarms == null) return;

            long now = System.currentTimeMillis();

            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;

                String title = item.optString("title", "Аниме");
                String date = item.optString("date", "");
                int episode = item.optInt("n", 0);

                long triggerAt = parseDate(date);
                if (triggerAt <= now) continue;

                String key = item.optString("id", title)
                        + "_" + episode + "_" + triggerAt;

                int requestCode = key.hashCode();

                Intent intent = new Intent(context,
                        ReleaseNotificationReceiver.class);
                intent.setAction(ACTION + "." + key);
                intent.putExtra("title", title);
                intent.putExtra("episode", episode);
                intent.putExtra("notificationId", requestCode);

                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                        context,
                        requestCode,
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT
                                | PendingIntent.FLAG_IMMUTABLE
                );

                alarms.setAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerAt,
                        pendingIntent
                );
            }
        } catch (Exception e) {
            android.util.Log.e("AniTier", "Не удалось запланировать уведомления", e);
        }
    }

    public static void cancelAll(Context context, String json) {
        if (json == null || json.trim().isEmpty()) return;

        try {
            JSONArray items = new JSONArray(json);
            AlarmManager alarms =
                    (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            if (alarms == null) return;

            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;

                String title = item.optString("title", "Аниме");
                String date = item.optString("date", "");
                int episode = item.optInt("n", 0);
                long triggerAt = parseDate(date);

                if (triggerAt <= 0) continue;

                String key = item.optString("id", title)
                        + "_" + episode + "_" + triggerAt;

                int requestCode = key.hashCode();

                Intent intent = new Intent(context,
                        ReleaseNotificationReceiver.class);
                intent.setAction(ACTION + "." + key);

                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                        context,
                        requestCode,
                        intent,
                        PendingIntent.FLAG_NO_CREATE
                                | PendingIntent.FLAG_IMMUTABLE
                );

                if (pendingIntent != null) {
                    alarms.cancel(pendingIntent);
                    pendingIntent.cancel();
                }
            }
        } catch (Exception e) {
            android.util.Log.e("AniTier", "Не удалось отменить уведомления", e);
        }
    }

    private static long parseDate(String value) {
        if (value == null || value.trim().isEmpty()) return 0;

        try {
            long numeric = Long.parseLong(value);
            // Поддержка Unix timestamp в секундах и миллисекундах.
            return numeric < 100000000000L ? numeric * 1000L : numeric;
        } catch (NumberFormatException ignored) {
            // Дата может быть ISO 8601.
        }

        String[] patterns = {
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ss'Z'"
        };

        for (String pattern : patterns) {
            try {
                SimpleDateFormat format =
                        new SimpleDateFormat(pattern, Locale.US);
                format.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date parsed = format.parse(value);
                if (parsed != null) return parsed.getTime();
            } catch (Exception ignored) {
            }
        }

        return 0;
    }
}