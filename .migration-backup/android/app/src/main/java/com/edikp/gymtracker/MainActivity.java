package com.edikp.gymtracker;

import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "GymTrackerOverlay";
    private boolean restOverlayEnabled = false;
    private long restEndsAt = 0L;
    private String restExercise = "Pause";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(RestPictureInPicturePlugin.class);
    }

    public void setRestOverlayState(boolean enabled, long endsAt, String exercise) {
        restOverlayEnabled = enabled;
        restEndsAt = endsAt;
        restExercise = (exercise == null || exercise.isEmpty()) ? "Pause" : exercise;
        Log.d(TAG, "setRestOverlayState enabled=" + enabled + " endsAt=" + endsAt + " exercise=" + restExercise);
    }

    @Override
    public void onStop() {
        super.onStop();
        Log.d(TAG, "MainActivity onStop");
        maybeShowRestOverlay();
    }

    @Override
    public void onResume() {
        super.onResume();
        Log.d(TAG, "MainActivity onResume");
        stopRestOverlay();
    }

    private void maybeShowRestOverlay() {
        Log.d(
            TAG,
            "maybeShowRestOverlay enabled=" + restOverlayEnabled
                + " endsAt=" + restEndsAt
                + " now=" + System.currentTimeMillis()
                + " canDraw=" + Settings.canDrawOverlays(this)
        );

        if (!restOverlayEnabled || restEndsAt <= System.currentTimeMillis()) {
            Log.d(TAG, "Overlay not started: no active rest state");
            return;
        }

        if (!Settings.canDrawOverlays(this)) {
            Log.w(TAG, "Overlay not started: draw-overlays permission missing");
            return;
        }

        Intent serviceIntent = new Intent(this, RestOverlayService.class);
        serviceIntent.putExtra(RestOverlayService.EXTRA_EXERCISE, restExercise);
        serviceIntent.putExtra(RestOverlayService.EXTRA_ENDS_AT, restEndsAt);
        Log.d(TAG, "Starting RestOverlayService");
        ContextCompat.startForegroundService(this, serviceIntent);
    }

    public void stopRestOverlay() {
        Intent serviceIntent = new Intent(this, RestOverlayService.class);
        Log.d(TAG, "Stopping RestOverlayService");
        stopService(serviceIntent);
    }
}
