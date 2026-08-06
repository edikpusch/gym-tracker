"use client";

import { LocalNotifications } from "@capacitor/local-notifications";

import { getAppPreferences } from "@/lib/appPreferences";
import { isAndroidPlatform, isNativePlatform } from "@/lib/platform";

const REST_NOTIFICATION_ID = 42001;
const REST_CHANNEL_ID_SIGNAL = "rest-timer-signal-v3";
const REST_CHANNEL_ID_SOUND = "rest-timer-sound-v3";
const REST_CHANNEL_ID_VIBRATION = "rest-timer-vibration-v3";
const REST_CHANNEL_ID_SILENT = "rest-timer-silent-v3";
const REST_WARNING_LEAD_MS = 15_000;

let channelReady = false;

function isNativeApp() {
  return isNativePlatform();
}

function isAndroid() {
  return isAndroidPlatform();
}

async function ensurePermission() {
  if (!isNativeApp()) {
    return false;
  }

  const status = await LocalNotifications.checkPermissions();
  if (status.display === "granted") {
    return true;
  }

  const requested = await LocalNotifications.requestPermissions();
  return requested.display === "granted";
}

async function ensureChannel() {
  if (!isAndroid() || channelReady) {
    return;
  }

  await LocalNotifications.createChannel({
    id: REST_CHANNEL_ID_SIGNAL,
    name: "Pausen-Timer Ton und Vibration",
    description: "Kräftiges Signal 15 Sekunden vor dem Ende deiner Satzpause.",
    importance: 5,
    visibility: 1,
    vibration: true,
    sound: "default",
  });

  await LocalNotifications.createChannel({
    id: REST_CHANNEL_ID_SOUND,
    name: "Pausen-Timer nur Ton",
    description: "Warnton ohne Vibration.",
    importance: 5,
    visibility: 1,
    vibration: false,
    sound: "default",
  });

  await LocalNotifications.createChannel({
    id: REST_CHANNEL_ID_VIBRATION,
    name: "Pausen-Timer nur Vibration",
    description: "Vibration ohne Warnton.",
    importance: 4,
    visibility: 1,
    vibration: true,
  });

  await LocalNotifications.createChannel({
    id: REST_CHANNEL_ID_SILENT,
    name: "Pausen-Timer leise",
    description: "Stille Pausenbenachrichtigungen.",
    importance: 3,
    visibility: 1,
    vibration: false,
  });

  channelReady = true;
}

export async function scheduleRestNotification(
  exerciseLabel: string,
  restEndsAtMs: number
) {
  if (!isNativeApp()) {
    return;
  }

  const granted = await ensurePermission();
  if (!granted) {
    return;
  }

  await ensureChannel();
  await clearRestNotification();

  const triggerAtMs = restEndsAtMs - REST_WARNING_LEAD_MS;

  if (triggerAtMs <= Date.now()) {
    return;
  }

  const preferences = getAppPreferences();
  const withTone = preferences.getReadyTone;
  const withVibration = preferences.restVibration;

  const notification = {
    id: REST_NOTIFICATION_ID,
    title: "Pause endet in 15 Sek.",
    body: `${exerciseLabel} ist gleich wieder dran.`,
    schedule: {
      at: new Date(triggerAtMs),
      allowWhileIdle: true,
    },
    ongoing: false,
    autoCancel: true,
  };

  await LocalNotifications.schedule({
    notifications: [
      isAndroid()
        ? {
            ...notification,
            channelId: withTone && withVibration ? REST_CHANNEL_ID_SIGNAL : withTone ? REST_CHANNEL_ID_SOUND : withVibration ? REST_CHANNEL_ID_VIBRATION : REST_CHANNEL_ID_SILENT,
          }
        : { ...notification, sound: withTone ? "default" : undefined },
    ],
  });
}

export async function clearRestNotification() {
  if (!isNativeApp()) {
    return;
  }

  await LocalNotifications.cancel({
    notifications: [{ id: REST_NOTIFICATION_ID }],
  });

  await LocalNotifications.removeAllDeliveredNotifications();
}
