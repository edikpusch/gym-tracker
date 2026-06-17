package com.edikp.gymtracker;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RestPictureInPicture")
public class RestPictureInPicturePlugin extends Plugin {
    private static final String TAG = "GymTrackerOverlay";

    @PluginMethod
    public void setEnabled(PluginCall call) {
        MainActivity activity = (MainActivity) getActivity();
        boolean enabled = call.getBoolean("enabled", false);
        long endsAt = call.getLong("endsAt", 0L);
        String exercise = call.getString("exercise", "Pause");

        Log.d(
            TAG,
            "Plugin setEnabled enabled=" + enabled
                + " endsAt=" + endsAt
                + " exercise=" + exercise
                + " canDraw=" + Settings.canDrawOverlays(getContext())
        );

        if (enabled && !Settings.canDrawOverlays(getContext())) {
            Log.w(TAG, "Requesting overlay permission screen");
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }

        activity.setRestOverlayState(enabled, endsAt, exercise);
        call.resolve();
    }

    @PluginMethod
    public void enterNow(PluginCall call) {
        String exercise = call.getString("exercise", "Pause");
        long endsAt = call.getLong("endsAt", 0L);

        Log.d(
            TAG,
            "Plugin enterNow exercise=" + exercise
                + " endsAt=" + endsAt
                + " canDraw=" + Settings.canDrawOverlays(getContext())
        );

        if (!Settings.canDrawOverlays(getContext())) {
            Log.w(TAG, "enterNow blocked: overlay permission missing");
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
            return;
        }

        Intent serviceIntent = new Intent(getContext(), RestOverlayService.class);
        serviceIntent.putExtra(RestOverlayService.EXTRA_EXERCISE, exercise);
        serviceIntent.putExtra(RestOverlayService.EXTRA_ENDS_AT, endsAt);

        Log.d(TAG, "Plugin startService RestOverlayService");
        getContext().startService(serviceIntent);

        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        MainActivity activity = (MainActivity) getActivity();
        activity.setRestOverlayState(false, 0L, "Pause");
        activity.stopRestOverlay();
        Log.d(TAG, "Plugin stop overlay");

        Intent serviceIntent = new Intent(getContext(), RestOverlayService.class);
        getContext().stopService(serviceIntent);
        call.resolve();
    }
}
