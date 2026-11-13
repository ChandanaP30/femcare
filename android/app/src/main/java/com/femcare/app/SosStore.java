package com.femcare.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Small private store for the native SOS features. Phone numbers stay in app-private storage. */
final class SosStore {
    static final int MAX_CONTACTS = 5;
    private static final long PENDING_MAX_AGE_MS = 30000L;
    private static final Object LOCK = new Object();
    private final SharedPreferences sp;

    static final class Contact {
        final String name;
        final String phone;

        Contact(String name, String phone) {
            this.name = name;
            this.phone = phone;
        }
    }

    static final class Fix {
        final double lat;
        final double lon;
        final float acc;
        final long time;

        Fix(double lat, double lon, float acc, long time) {
            this.lat = lat;
            this.lon = lon;
            this.acc = acc;
            this.time = time;
        }
    }

    SosStore(Context ctx) {
        sp = ctx.getApplicationContext().getSharedPreferences("femcare_sos", Context.MODE_PRIVATE);
    }

    boolean isEnabled() { return sp.getBoolean("enabled", false); }
    void setEnabled(boolean v) { sp.edit().putBoolean("enabled", v).apply(); }
    boolean isLockButton() { return sp.getBoolean("lockButton", false); }
    void setLockButton(boolean v) { sp.edit().putBoolean("lockButton", v).apply(); }
    String lang() { return sp.getString("lang", "en"); }
    void setLang(String l) { sp.edit().putString("lang", l).apply(); }

    void setContacts(List<Contact> list) {
        JSONArray a = new JSONArray();
        try {
            for (int i = 0; i < list.size() && i < MAX_CONTACTS; i++) {
                JSONObject o = new JSONObject();
                o.put("name", list.get(i).name);
                o.put("phone", list.get(i).phone);
                a.put(o);
            }
        } catch (org.json.JSONException ignored) {
            // keep what was built so far
        }
        sp.edit().putString("contacts", a.toString()).apply();
    }

    List<Contact> contacts() {
        List<Contact> out = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(sp.getString("contacts", "[]"));
            for (int i = 0; i < a.length() && out.size() < MAX_CONTACTS; i++) {
                JSONObject o = a.getJSONObject(i);
                String phone = o.optString("phone", "");
                if (!phone.isEmpty()) out.add(new Contact(o.optString("name", ""), phone));
            }
        } catch (Exception ignored) {
            // corrupt data: return what we have
        }
        return out;
    }

    void saveFix(double lat, double lon, float acc, long time) {
        sp.edit().putString("fix", lat + "," + lon + "," + acc + "," + time).apply();
    }

    Fix lastFix() {
        String s = sp.getString("fix", null);
        if (s == null) return null;
        try {
            String[] p = s.split(",");
            return new Fix(Double.parseDouble(p[0]), Double.parseDouble(p[1]), Float.parseFloat(p[2]), Long.parseLong(p[3]));
        } catch (Exception e) {
            return null;
        }
    }

    /** The running countdown id, or 0 when none (a stale countdown counts as none). */
    long pendingId() {
        long id = sp.getLong("pending_id", 0L);
        long at = sp.getLong("pending_at", 0L);
        return (id != 0L && System.currentTimeMillis() - at <= PENDING_MAX_AGE_MS) ? id : 0L;
    }

    void setPending(long id) {
        sp.edit().putLong("pending_id", id).putLong("pending_at", id == 0L ? 0L : System.currentTimeMillis()).apply();
    }

    void startResults(long id, int total) {
        synchronized (LOCK) {
            sp.edit().putLong("res_id", id).putInt("res_total", total).putInt("res_ok", 0).putInt("res_fail", 0).apply();
        }
    }

    /** Returns {ok, fail, total}, or null when this send is no longer the current one. */
    int[] addResult(long id, boolean ok) {
        synchronized (LOCK) {
            if (sp.getLong("res_id", 0L) != id) return null;
            int o = sp.getInt("res_ok", 0);
            int f = sp.getInt("res_fail", 0);
            if (ok) o++; else f++;
            sp.edit().putInt("res_ok", o).putInt("res_fail", f).apply();
            return new int[] {o, f, sp.getInt("res_total", 0)};
        }
    }

    int[] results(long id) {
        synchronized (LOCK) {
            if (sp.getLong("res_id", 0L) != id) return null;
            return new int[] {sp.getInt("res_ok", 0), sp.getInt("res_fail", 0), sp.getInt("res_total", 0)};
        }
    }

    void clearAll() { sp.edit().clear().apply(); }
}
