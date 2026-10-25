package com.anitier.phone;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

public class ReleaseNotificationBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(
                "anitier-release-notifications",
                Context.MODE_PRIVATE
        );

        if (!prefs.getBoolean("enabled", false)) return;

        if (Build.VERSION.SDK_INT >= 33
                && context.checkSelfPermission(
                        android.Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        String items = prefs.getString("items", "[]");
        ReleaseNotificationScheduler.schedule(context, items);
    }
}