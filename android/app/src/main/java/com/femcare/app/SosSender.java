package com.femcare.app;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Build;
import android.telephony.SmsManager;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** Builds the SOS text and sends it with the phone's SMS service. Always called after an explicit user tap. */
final class SosSender {
    static final String ACTION_SMS_RESULT = "com.femcare.app.SOS_SMS_RESULT";
    static final long MAX_FIX_AGE_MS = 30L * 60L * 1000L;

    private SosSender() { }

    static boolean hasSmsPermission(Context c) {
        return c.checkSelfPermission(Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    static String noLocationMessage() {
        return "SOS! I need help but I could not get my location. Please call me now.";
    }

    static String buildMessage(double lat, double lon, float acc, long fixTime, long now) {
        String hhmm = new SimpleDateFormat("HH:mm", Locale.US).format(new Date(now));
        long ageMin = Math.max(0L, (now - fixTime) / 60000L);
        StringBuilder sb = new StringBuilder("SOS! I need help. My location: ");
        sb.append(String.format(Locale.US, "https://maps.google.com/?q=%.6f,%.6f", lat, lon));
        sb.append(" (");
        if (acc > 0f) sb.append("accuracy about ").append(Math.round(acc)).append(" m, ");
        if (ageMin >= 2L) sb.append("saved ").append(ageMin).append(" min ago, ");
        sb.append(hhmm).append("). Please call me or send help.");
        return sb.toString();
    }

    /** Fresh fix if given, otherwise the newest saved or system fix that is under 30 minutes old. */
    static String messageFor(Context ctx, SosStore store, Location fresh) {
        long now = System.currentTimeMillis();
        if (fresh != null) {
            float acc = fresh.hasAccuracy() ? fresh.getAccuracy() : 0f;
            return buildMessage(fresh.getLatitude(), fresh.getLongitude(), acc, now, now);
        }
        Location sys = SosLocation.systemLastKnown(ctx);
        SosStore.Fix saved = store.lastFix();
        long sysT = sys != null ? sys.getTime() : 0L;
        long savedT = saved != null ? saved.time : 0L;
        if (sys != null && sysT >= savedT && now - sysT <= MAX_FIX_AGE_MS) {
            float acc = sys.hasAccuracy() ? sys.getAccuracy() : 0f;
            return buildMessage(sys.getLatitude(), sys.getLongitude(), acc, sysT, now);
        }
        if (saved != null && now - savedT <= MAX_FIX_AGE_MS) {
            return buildMessage(saved.lat, saved.lon, saved.acc, savedT, now);
        }
        return noLocationMessage();
    }

    /** Sends one SMS per contact. Returns an id used to read results, or 0 when nothing could be started. */
    static long send(Context ctx, SosStore store, List<SosStore.Contact> contacts, String body, boolean notify) {
        if (!hasSmsPermission(ctx) || contacts.isEmpty()) return 0L;
        SmsManager sm = Build.VERSION.SDK_INT >= 31 ? ctx.getSystemService(SmsManager.class) : SmsManager.getDefault();
        if (sm == null) return 0L;
        final long id = System.currentTimeMillis();
        store.startResults(id, contacts.size());
        int idx = 0;
        for (SosStore.Contact c : contacts) {
            try {
                Intent i = new Intent(ctx, SosReceiver.class).setAction(ACTION_SMS_RESULT);
                i.putExtra("id", id);
                i.putExtra("notify", notify);
                int code = (int) ((id % 100000L) * 10L + idx);
                PendingIntent pi = PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                ArrayList<String> parts = sm.divideMessage(body);
                if (parts.size() > 1) {
                    ArrayList<PendingIntent> sent = new ArrayList<>();
                    for (int p = 0; p < parts.size(); p++) sent.add(p == 0 ? pi : null);
                    sm.sendMultipartTextMessage(c.phone, null, parts, sent, null);
                } else {
                    sm.sendTextMessage(c.phone, null, body, pi, null);
                }
            } catch (Exception e) {
                store.addResult(id, false);
            }
            idx++;
        }
        return id;
    }
}
