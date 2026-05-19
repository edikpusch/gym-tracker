import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const REST_NOTIFICATION_ID = 42001;
const REST_CHANNEL_ID = "rest-timer";

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
    id: REST_CHANNEL_ID,
    name: "Pausen-Timer",
    description: "Benachrichtigungen für das Ende deiner Satzpause.",
    sound: "rest_chime.wav",
    importance: 5,
    visibility: 1,
    vibration: true,
  });

  channelReady = true;
}

export async function scheduleRestNotification(
  exerciseLabel: string,
  seconds: number
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

  const notification = {
    id: REST_NOTIFICATION_ID,
    title: "Pause beendet",
    body: `${exerciseLabel} ist wieder dran.`,
    schedule: {
      at: new Date(Date.now() + seconds * 1000),
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
            channelId: REST_CHANNEL_ID,
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
