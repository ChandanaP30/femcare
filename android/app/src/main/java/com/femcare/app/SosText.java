package com.femcare.app;

import android.content.Context;
import android.content.res.Configuration;
import java.util.Locale;

/** Strings in the language chosen inside FemCare+ (not only the phone language). */
final class SosText {
    private SosText() { }

    static Context localized(Context base, String lang) {
        try {
            Configuration c = new Configuration(base.getResources().getConfiguration());
            c.setLocale(new Locale(lang == null || lang.isEmpty() ? "en" : lang));
            return base.createConfigurationContext(c);
        } catch (Exception e) {
            return base;
        }
    }
}
