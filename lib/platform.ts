"use client";

import { Capacitor } from "@capacitor/core";

export type NativePlatform = "android" | "ios" | "web";

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

export function isNativeRuntime(): boolean {
  // Return false during SSR: the Capacitor bridge is never available server-side,
  // so we treat SSR the same as a plain web browser. This keeps the server-rendered
  // HTML consistent with the web-client's initial render and avoids a hydration mismatch.
  // On iOS/Android Capacitor builds this runs only in the WKWebView / WebView where
  // window is always defined and isNativePlatform() returns true.
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

export function getNativePlatform(): NativePlatform {
  return Capacitor.getPlatform() as NativePlatform;
}

export function isAndroidPlatform() {
  return getNativePlatform() === "android";
}

export function isIosPlatform() {
  return getNativePlatform() === "ios";
}

export function supportsRestOverlay() {
  return isAndroidPlatform();
}

export function getRestBackgroundBehaviorLabel() {
  if (isAndroidPlatform()) {
    return "Im Hintergrund erinnert dich die App per Benachrichtigung und kann zusaetzlich das schwebende Pausenfenster nutzen.";
  }

  if (isIosPlatform()) {
    return "Im Hintergrund erinnert dich die App auf dem iPhone per Benachrichtigung statt ueber ein schwebendes Pausenfenster.";
  }

  return "Im Hintergrund arbeitet der Pausenhinweis ueber Benachrichtigungen, wenn dein Geraet sie unterstuetzt.";
}
