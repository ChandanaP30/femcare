package com.femcare.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.os.Build;

/** The quiet "Safety shortcut" notification and its status messages. Lock-screen text stays neutral. */
final class SosNotifications {
    static final String CH_SHORTCUT = "safety_shortcut";
    static final String CH_STATUS = "safety_status";
    static final int ID_SHORTCUT = 7001;
    static final int ID_STATUS = 7002;
    private static final int PI_FLAGS = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;

    private SosNotifications() { }

    private static void ensureChannels(Context c, Context t) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel a = new NotificationChannel(CH_SHORTCUT, t.getString(R.string.sos_channel_shortcut), NotificationManager.IMPORTANCE_LOW);
        a.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        a.setShowBadge(false);
        nm.createNotificationChannel(a);
        NotificationChannel b = new NotificationChannel(CH_STATUS, t.getString(R.string.sos_channel_status), NotificationManager.IMPORTANCE_DEFAULT);
        b.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        b.setSound(null, null);
        b.setShowBadge(false);
        nm.createNotificationChannel(b);
    }

    private static Notification.Builder builder(Context c, String channel) {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, channel) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat_safety);
        b.setVisibility(Notification.VISIBILITY_PUBLIC);
        return b;
    }

    private static Notification.Action action(Context c, CharSequence title, PendingIntent pi) {
        Notification.Action.Builder b = new Notification.Action.Builder(Icon.createWithResource(c, R.drawable.ic_stat_safety), title, pi);
        if (Build.VERSION.SDK_INT >= 31) b.setAuthenticationRequired(false);
        return b.build();
    }

    private static PendingIntent broadcast(Context c, int code, String action) {
        return PendingIntent.getBroadcast(c, code, new Intent(c, SosReceiver.class).setAction(action), PI_FLAGS);
    }

    private static void post(Context c, int id, Notification n) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        try {
            nm.notify(id, n);
        } catch (SecurityException ignored) {
            // notifications not allowed
        }
    }

    static void cancel(Context c, int id) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(id);
    }

    static void showShortcut(Context c) {
        Context t = SosText.localized(c, new SosStore(c).lang());
        ensureChannels(c, t);
        Notification.Builder b = builder(c, CH_SHORTCUT)
            .setContentTitle(t.getString(R.string.sos_shortcut_title))
            .setContentText(t.getString(R.string.sos_shortcut_text))
            .setOngoing(true)
            .setShowWhen(false)
            .addAction(action(c, t.getString(R.string.sos_action_send), broadcast(c, 1, SosReceiver.ACTION_START)));
        post(c, ID_SHORTCUT, b.build());
    }

    static void showCountdown(Context c, int seconds) {
        Context t = SosText.localized(c, new SosStore(c).lang());
        ensureChannels(c, t);
        Notification.Builder b = builder(c, CH_STATUS)
            .setContentTitle(t.getString(R.string.sos_countdown_notif))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setWhen(System.currentTimeMillis() + seconds * 1000L)
            .addAction(action(c, t.getString(R.string.sos_action_cancel), broadcast(c, 2, SosReceiver.ACTION_CANCEL)));
        post(c, ID_STATUS, b.build());
    }

    static void showSending(Context c) {
        Context t = SosText.localized(c, new SosStore(c).lang());
        ensureChannels(c, t);
        Notification.Builder b = builder(c, CH_STATUS)
            .setContentTitle(t.getString(R.string.sos_sending))
            .setOngoing(true)
            .setOnlyAlertOnce(true);
        post(c, ID_STATUS, b.build());
    }

    static void showResult(Context c, int ok, int total) {
        Context t = SosText.localized(c, new SosStore(c).lang());
        ensureChannels(c, t);
        Notification.Builder b = builder(c, CH_STATUS)
            .setContentTitle(String.format(java.util.Locale.US, t.getString(R.string.sos_result), ok, total))
            .setAutoCancel(true)
            .setOnlyAlertOnce(true);
        if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(120000L);
        post(c, ID_STATUS, b.build());
    }

    static void showFailure(Context c) {
        showText(c, R.string.sos_result_fail);
    }

    static void showNeedsSetup(Context c) {
        showText(c, R.string.sos_needs_setup);
    }

    private static void showText(Context c, int stringId) {
        Context t = SosText.localized(c, new SosStore(c).lang());
        ensureChannels(c, t);
        PendingIntent open = PendingIntent.getActivity(c, 3, new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PI_FLAGS);
        Notification.Builder b = builder(c, CH_STATUS)
            .setContentTitle(t.getString(stringId))
            .setContentIntent(open)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true);
        if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(120000L);
        post(c, ID_STATUS, b.build());
    }
}
