package com.femcare.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import java.util.ArrayList;
import java.util.List;

/** Location without Google Play services: system providers only. */
final class SosLocation {
    interface Callback {
        void onResult(Location best);
    }

    private SosLocation() { }

    static boolean hasPermission(Context c) {
        return c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    /** Newest position the system already has, or null. May be null in the background on newer Android. */
    static Location systemLastKnown(Context c) {
        if (!hasPermission(c)) return null;
        LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return null;
        Location best = null;
        String[] providers = {LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER};
        for (String p : providers) {
            try {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            } catch (SecurityException | IllegalArgumentException ignored) {
                // provider not available
            }
        }
        return best;
    }

    /** One fresh fix within timeoutMs. Calls back on the main thread, with null if none arrived. */
    static void fresh(final Context c, final long timeoutMs, final Callback cb) {
        final Handler h = new Handler(Looper.getMainLooper());
        final LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null || !hasPermission(c)) {
            h.post(new Runnable() {
                @Override public void run() { cb.onResult(null); }
            });
            return;
        }
        final Location[] best = new Location[1];
        final boolean[] done = new boolean[1];
        final List<LocationListener> listeners = new ArrayList<>();

        final Runnable finish = new Runnable() {
            @Override public void run() {
                if (done[0]) return;
                done[0] = true;
                for (LocationListener l : listeners) {
                    try {
                        lm.removeUpdates(l);
                    } catch (SecurityException ignored) {
                        // permission revoked meanwhile
                    }
                }
                cb.onResult(best[0]);
            }
        };

        class Listener implements LocationListener {
            @Override public void onLocationChanged(Location l) {
                if (done[0]) return;
                if (best[0] == null || l.getAccuracy() < best[0].getAccuracy()) best[0] = l;
                if (l.hasAccuracy() && l.getAccuracy() <= 100f) finish.run();
            }
            @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
            @Override public void onProviderEnabled(String provider) { }
            @Override public void onProviderDisabled(String provider) { }
        }

        boolean any = false;
        String[] providers = {LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER};
        for (String p : providers) {
            try {
                if (lm.isProviderEnabled(p)) {
                    Listener l = new Listener();
                    listeners.add(l);
                    lm.requestLocationUpdates(p, 0L, 0f, l, Looper.getMainLooper());
                    any = true;
                }
            } catch (SecurityException | IllegalArgumentException ignored) {
                // provider unavailable
            }
        }
        if (!any) {
            h.post(finish);
            return;
        }
        h.postDelayed(finish, timeoutMs);
    }
}
