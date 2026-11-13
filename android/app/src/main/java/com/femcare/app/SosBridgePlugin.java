package com.femcare.app;

import android.Manifest;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/** Link between the FemCare+ web app and the native SOS features. */
@CapacitorPlugin(
    name = "SosBridge",
    permissions = {
        @Permission(strings = {Manifest.permission.SEND_SMS}, alias = "sms"),
        @Permission(strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, alias = "location")
    }
)
public class SosBridgePlugin extends Plugin {
    private SosStore store() {
        return new SosStore(getContext());
    }

    @PluginMethod
    public void sync(PluginCall call) {
        try {
            JSArray arr = call.getArray("contacts");
            List<SosStore.Contact> list = new ArrayList<>();
            if (arr != null) {
                for (int i = 0; i < arr.length() && list.size() < SosStore.MAX_CONTACTS; i++) {
                    JSONObject o = arr.getJSONObject(i);
                    String phone = o.optString("phone", "").trim();
                    if (!phone.isEmpty()) list.add(new SosStore.Contact(o.optString("name", ""), phone));
                }
            }
            SosStore s = store();
            s.setContacts(list);
            String lang = call.getString("lang");
            if (lang != null && !lang.isEmpty()) s.setLang(lang);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not save contacts");
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context c = getContext();
        SosStore s = store();
        JSObject ret = new JSObject();
        ret.put("sms", SosSender.hasSmsPermission(c));
        ret.put("location", SosLocation.hasPermission(c));
        ret.put("enabled", s.isEnabled());
        ret.put("lockButton", s.isLockButton());
        ret.put("contacts", s.contacts().size());
        int widgets = 0;
        try {
            widgets = AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, SosWidgetProvider.class)).length;
        } catch (Exception ignored) {
            // widget info unavailable
        }
        ret.put("widgets", widgets);
        call.resolve(ret);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        SosStore s = store();
        s.setEnabled(on);
        if (!on) {
            s.setLockButton(false);
            SosNotifications.cancel(getContext(), SosNotifications.ID_SHORTCUT);
            SosNotifications.cancel(getContext(), SosNotifications.ID_STATUS);
        }
        call.resolve();
    }

    @PluginMethod
    public void setLockButton(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        SosStore s = store();
        if (on && !s.isEnabled()) {
            call.reject("Auto-send is off");
            return;
        }
        s.setLockButton(on);
        if (on) {
            SosNotifications.showShortcut(getContext());
        } else {
            SosNotifications.cancel(getContext(), SosNotifications.ID_SHORTCUT);
        }
        call.resolve();
    }

    @PluginMethod
    public void saveFix(PluginCall call) {
        Double lat = call.getDouble("lat");
        Double lon = call.getDouble("lon");
        Double acc = call.getDouble("accuracy", 0.0);
        if (lat == null || lon == null) {
            call.reject("Missing position");
            return;
        }
        store().saveFix(lat, lon, acc == null ? 0f : acc.floatValue(), System.currentTimeMillis());
        call.resolve();
    }

    @PluginMethod
    public void clearAll(PluginCall call) {
        store().clearAll();
        SosNotifications.cancel(getContext(), SosNotifications.ID_SHORTCUT);
        SosNotifications.cancel(getContext(), SosNotifications.ID_STATUS);
        call.resolve();
    }

    private void resolveGranted(PluginCall call, boolean granted) {
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestSms(PluginCall call) {
        if (SosSender.hasSmsPermission(getContext())) {
            resolveGranted(call, true);
            return;
        }
        requestPermissionForAlias("sms", call, "smsCallback");
    }

    @PermissionCallback
    private void smsCallback(PluginCall call) {
        resolveGranted(call, SosSender.hasSmsPermission(getContext()));
    }

    @PluginMethod
    public void requestLocation(PluginCall call) {
        if (SosLocation.hasPermission(getContext())) {
            resolveGranted(call, true);
            return;
        }
        requestPermissionForAlias("location", call, "locationCallback");
    }

    @PermissionCallback
    private void locationCallback(PluginCall call) {
        resolveGranted(call, SosLocation.hasPermission(getContext()));
    }
}
