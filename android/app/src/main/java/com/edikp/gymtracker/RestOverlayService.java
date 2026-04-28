package com.edikp.gymtracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;

public class RestOverlayService extends Service {
    private static final String TAG = "GymTrackerOverlay";
    public static final String EXTRA_ENDS_AT = "endsAt";
    public static final String EXTRA_EXERCISE = "exercise";
    private static final String CHANNEL_ID = "rest_overlay_service";
    private static final int NOTIFICATION_ID = 42002;

    private WindowManager windowManager;
    private View overlayView;
    private TextView timerView;
    private TextView titleView;
    private Handler handler;
    private Runnable tickRunnable;
    private long endsAt = 0L;
    private boolean chimePlayed = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "RestOverlayService onCreate");
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        handler = new Handler(Looper.getMainLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "RestOverlayService onStartCommand intent=" + (intent != null));
        if (!Settings.canDrawOverlays(this) || intent == null) {
            Log.w(TAG, "RestOverlayService stopping: permission missing or null intent");
            stopSelf();
            return START_NOT_STICKY;
        }

        endsAt = intent.getLongExtra(EXTRA_ENDS_AT, 0L);
        String exercise = intent.getStringExtra(EXTRA_EXERCISE);
        Log.d(TAG, "RestOverlayService start endsAt=" + endsAt + " exercise=" + exercise);
        startAsForeground(exercise);

        if (overlayView == null) {
            showOverlay();
        }

        if (titleView != null) {
            titleView.setText(exercise == null || exercise.isEmpty() ? "Pause" : exercise);
        }

        chimePlayed = false;
        startTicker();

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "RestOverlayService onDestroy");
        stopTicker();
        removeOverlay();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void startAsForeground(String exercise) {
        createNotificationChannel();

        Notification notification =
            new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Pausen-Timer aktiv")
                .setContentText(
                    exercise == null || exercise.isEmpty()
                        ? "Das Timer-Fenster bleibt sichtbar."
                        : exercise + " läuft weiter."
                )
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        startForeground(NOTIFICATION_ID, notification);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }

        NotificationChannel channel =
            new NotificationChannel(
                CHANNEL_ID,
                "Pausen-Timer",
                NotificationManager.IMPORTANCE_LOW
            );
        channel.setDescription("Hält den schwebenden Pausen-Timer aktiv.");
        manager.createNotificationChannel(channel);
    }

    private void showOverlay() {
        Log.d(TAG, "showOverlay");
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setPadding(28, 22, 28, 22);
        container.setBackgroundResource(android.R.drawable.dialog_holo_light_frame);

        titleView = new TextView(this);
        titleView.setText("Pause");
        titleView.setTextSize(13f);
        titleView.setAlpha(0.8f);

        timerView = new TextView(this);
        timerView.setText("00:00");
        timerView.setTextSize(28f);
        timerView.setPadding(0, 6, 0, 0);

        container.addView(titleView);
        container.addView(timerView);

        int overlayType =
            android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );

        params.gravity = Gravity.TOP | Gravity.END;
        params.x = 32;
        params.y = 180;

        container.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (overlayView == null) {
                    return false;
                }

                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x;
                        initialY = params.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        params.x = initialX - (int) (event.getRawX() - initialTouchX);
                        params.y = initialY + (int) (event.getRawY() - initialTouchY);
                        windowManager.updateViewLayout(overlayView, params);
                        return true;
                    default:
                        return false;
                }
            }
        });

        overlayView = container;
        try {
            windowManager.addView(overlayView, params);
            Log.d(TAG, "Overlay view added successfully");
        } catch (Exception error) {
            Log.e(TAG, "Failed to add overlay view", error);
            overlayView = null;
        }
    }

    private void removeOverlay() {
        if (overlayView != null && windowManager != null) {
            Log.d(TAG, "Removing overlay view");
            windowManager.removeView(overlayView);
            overlayView = null;
            timerView = null;
            titleView = null;
        }
    }

    private void startTicker() {
        stopTicker();

        tickRunnable = new Runnable() {
            @Override
            public void run() {
                long remainingMs = Math.max(0L, endsAt - System.currentTimeMillis());
                long remainingSeconds = (long) Math.ceil(remainingMs / 1000.0);

                if (timerView != null) {
                    timerView.setText(formatRestTimer(remainingSeconds));
                }

                if (remainingSeconds <= 0L && !chimePlayed) {
                    chimePlayed = true;
                    ToneGenerator toneGenerator =
                        new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 75);
                    toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP2, 400);
                }

                handler.postDelayed(this, 250L);
            }
        };

        handler.post(tickRunnable);
    }

    private void stopTicker() {
        if (handler != null && tickRunnable != null) {
            handler.removeCallbacks(tickRunnable);
            tickRunnable = null;
        }
    }

    private String formatRestTimer(long totalSeconds) {
        long safeSeconds = Math.max(0L, totalSeconds);
        long minutes = safeSeconds / 60L;
        long seconds = safeSeconds % 60L;
        return String.format("%02d:%02d", minutes, seconds);
    }
}
