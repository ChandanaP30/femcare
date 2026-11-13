package com.femcare.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.Locale;

/**
 * Opened by the home-screen widget. Counts down 5 seconds (Cancel stops it), gets a fresh location
 * in the meantime, then sends one SMS per saved contact. Falls back to the emergency panel when
 * auto-send is off, a permission is missing or there are no contacts.
 */
public class SosTriggerActivity extends Activity {
    private static final int COUNTDOWN_S = 5;
    private static final long LOCATION_BUDGET_MS = 6000L;
    private static final int MAX_POLLS = 24;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private SosStore store;
    private Context t;
    private TextView title;
    private TextView status;
    private Button button;
    private int remaining = COUNTDOWN_S;
    private int polls;
    private boolean cancelled;
    private boolean sent;
    private boolean failed;
    private boolean countdownDone;
    private boolean locationDone;
    private Location fix;
    private long sendId;

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (cancelled) return;
            remaining--;
            if (remaining <= 0) {
                countdownDone = true;
                title.setText(t.getString(R.string.sos_sending));
                trySend();
            } else {
                updateTitle();
                handler.postDelayed(this, 1000L);
            }
        }
    };

    private final Runnable pollTask = new Runnable() {
        @Override public void run() {
            poll();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        store = new SosStore(this);
        t = SosText.localized(this, store.lang());
        if (!store.isEnabled() || !SosSender.hasSmsPermission(this) || store.contacts().isEmpty()) {
            openPanel();
            return;
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        buildUi();
        updateTitle();
        status.setText(t.getString(R.string.sos_getting_location));
        handler.postDelayed(tick, 1000L);
        SosLocation.fresh(this, LOCATION_BUDGET_MS, new SosLocation.Callback() {
            @Override public void onResult(Location best) {
                if (cancelled || isFinishing()) return;
                fix = best;
                locationDone = true;
                if (best != null) {
                    store.saveFix(best.getLatitude(), best.getLongitude(), best.hasAccuracy() ? best.getAccuracy() : 0f, System.currentTimeMillis());
                    status.setText(t.getString(R.string.sos_location_found));
                } else {
                    status.setText(t.getString(R.string.sos_location_none));
                }
                trySend();
            }
        });
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(24), dp(24), dp(24), dp(24));
        root.setBackgroundColor(0xFFF3EDFA);

        title = new TextView(this);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30f);
        title.setTextColor(0xFF49384F);
        title.setGravity(Gravity.CENTER);

        status = new TextView(this);
        status.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f);
        status.setTextColor(0xFF7D6E82);
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, dp(16), 0, dp(32));

        button = new Button(this);
        button.setText(t.getString(R.string.sos_action_cancel));
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f);
        button.setTextColor(0xFFFFFFFF);
        button.setBackgroundColor(0xFFC98A8F);
        button.setAllCaps(false);
        button.setMinimumHeight(dp(72));
        button.setOnClickListener(new android.view.View.OnClickListener() {
            @Override public void onClick(android.view.View v) {
                onButton();
            }
        });

        int match = ViewGroup.LayoutParams.MATCH_PARENT;
        int wrap = ViewGroup.LayoutParams.WRAP_CONTENT;
        root.addView(title, new LinearLayout.LayoutParams(match, wrap));
        root.addView(status, new LinearLayout.LayoutParams(match, wrap));
        root.addView(button, new LinearLayout.LayoutParams(match, wrap));
        setContentView(root);
    }

    private void updateTitle() {
        title.setText(String.format(Locale.US, t.getString(R.string.sos_countdown_n), remaining));
    }

    private void trySend() {
        if (cancelled || sent || !countdownDone || !locationDone) return;
        sent = true;
        String body = SosSender.messageFor(this, store, fix);
        sendId = SosSender.send(this, store, store.contacts(), body, false);
        if (sendId == 0L) {
            failed = true;
            title.setText(t.getString(R.string.sos_result_fail));
            status.setText("");
            button.setText(t.getString(R.string.sos_open_panel));
            return;
        }
        button.setText(t.getString(R.string.sos_close));
        poll();
    }

    private void poll() {
        if (isFinishing()) return;
        int[] r = store.results(sendId);
        if (r != null) {
            status.setText(String.format(Locale.US, t.getString(R.string.sos_sent_n), r[0], r[2]));
            if (r[0] + r[1] >= r[2]) {
                handler.postDelayed(new Runnable() {
                    @Override public void run() {
                        finish();
                    }
                }, 6000L);
                return;
            }
        }
        if (++polls < MAX_POLLS) handler.postDelayed(pollTask, 500L);
    }

    private void onButton() {
        if (failed) {
            openPanel();
        } else if (sent) {
            finish();
        } else {
            cancelled = true;
            handler.removeCallbacksAndMessages(null);
            finish();
        }
    }

    @Override
    public void onBackPressed() {
        if (!sent && !failed) {
            cancelled = true;
            handler.removeCallbacksAndMessages(null);
        }
        super.onBackPressed();
    }

    private void openPanel() {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("com.femcare.app://sos"), this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(i);
        finish();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
