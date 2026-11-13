package com.femcare.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;

/** Handles the lock-screen "Send" button: 5-second countdown, then one SMS per contact unless cancelled. */
public class SosReceiver extends BroadcastReceiver {
    static final String ACTION_START = "com.femcare.app.SOS_START";
    static final String ACTION_CANCEL = "com.femcare.app.SOS_CANCEL";
    static final String ACTION_FIRE = "com.femcare.app.SOS_FIRE";
    static final long COUNTDOWN_MS = 5000L;
    private static final int PI_FLAGS = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (action == null) return;
        SosStore store = new SosStore(ctx);
        if (ACTION_START.equals(action)) {
            onStart(ctx, store);
        } else if (ACTION_CANCEL.equals(action)) {
            onCancel(ctx, store);
        } else if (ACTION_FIRE.equals(action)) {
            onFire(ctx, store, intent.getLongExtra("id", 0L));
        } else if (SosSender.ACTION_SMS_RESULT.equals(action)) {
            onResult(ctx, store, intent.getLongExtra("id", 0L), getResultCode() == Activity.RESULT_OK, intent.getBooleanExtra("notify", true));
        }
    }

    private PendingIntent firePending(Context ctx, long id) {
        Intent i = new Intent(ctx, SosReceiver.class).setAction(ACTION_FIRE);
        i.putExtra("id", id);
        return PendingIntent.getBroadcast(ctx, 2, i, PI_FLAGS);
    }

    private void onStart(Context ctx, SosStore store) {
        if (!store.isEnabled() || !store.isLockButton() || !SosSender.hasSmsPermission(ctx) || store.contacts().isEmpty()) {
            SosNotifications.showNeedsSetup(ctx);
            return;
        }
        if (store.pendingId() != 0L) return; // a countdown is already running
        long id = System.currentTimeMillis();
        store.setPending(id);
        SosNotifications.showCountdown(ctx, (int) (COUNTDOWN_MS / 1000L));
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + COUNTDOWN_MS, firePending(ctx, id));
        }
    }

    private void onCancel(Context ctx, SosStore store) {
        store.setPending(0L);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(firePending(ctx, 0L));
        SosNotifications.cancel(ctx, SosNotifications.ID_STATUS);
    }

    private void onFire(Context ctx, SosStore store, long id) {
        if (id == 0L || id != store.pendingId()) return; // cancelled or stale
        store.setPending(0L);
        String body = SosSender.messageFor(ctx, store, null);
        long sendId = SosSender.send(ctx, store, store.contacts(), body, true);
        if (sendId == 0L) {
            SosNotifications.showFailure(ctx);
        } else {
            SosNotifications.showSending(ctx);
        }
    }

    private void onResult(Context ctx, SosStore store, long id, boolean ok, boolean notify) {
        int[] r = store.addResult(id, ok);
        if (r == null || !notify) return;
        if (r[0] + r[1] >= r[2]) {
            if (r[0] == 0) {
                SosNotifications.showFailure(ctx);
            } else {
                SosNotifications.showResult(ctx, r[0], r[2]);
            }
        }
    }
}
