package com.femcare.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Puts the lock-screen button back after a reboot or an app update, if the user turned it on. */
public class SosBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(a) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) return;
        SosStore s = new SosStore(ctx);
        if (s.isEnabled() && s.isLockButton()) SosNotifications.showShortcut(ctx);
    }
}
