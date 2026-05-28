"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import { getAppPreferences } from "@/lib/appPreferences";

const REST_NOTIFICATION_ID = 42001;
const REST_CHANNEL_ID_SOUND = "rest-timer-sound-v2";
const REST_CHANNEL_ID_SILENT = "rest-timer-silent-v2";
const REST_WARNING_LEAD_MS = 10_000;

let channelReady = false;

function isNativeApp() {
  return Capacitor.isNativePlatform();
}

function isAndroid() {
  return Capacitor.getPlatform() === "android";
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
    id: REST_CHANNEL_ID_SOUND,
    name: "Pausen-Timer Signal",
    description: "Kräftiges Signal 10 Sekunden vor dem Ende deiner Satzpause.",
    importance: 5,
    visibility: 1,
    vibration: true,
  });

  await LocalNotifications.createChannel({
    id: REST_CHANNEL_ID_SILENT,
    name: "Pausen-Timer leise",
    description: "Stille Benachrichtigungen 10 Sekunden vor dem Ende deiner Satzpause.",
    importance: 4,
    visibility: 1,
    vibration: true,
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

  const withTone = getAppPreferences().getReadyTone;

  const notification = {
    id: REST_NOTIFICATION_ID,
    title: "Pause endet in 10 Sek.",
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
            channelId: withTone ? REST_CHANNEL_ID_SOUND : REST_CHANNEL_ID_SILENT,
          }
        : notification,
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
