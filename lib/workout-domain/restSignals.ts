"use client";

import { getAppPreferences } from "@/lib/appPreferences";

export const REST_WARNING_LEAD_MS = 15_000;

export type RestVisualStage =
  | { type: "normal" }
  | { type: "warning" }
  | { type: "countdown"; value: 3 | 2 | 1 }
  | { type: "ready" };

export function getRestVisualStage(remainingMs: number): RestVisualStage {
  if (remainingMs <= 0) return { type: "ready" };
  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds <= 3) return { type: "countdown", value: seconds as 3 | 2 | 1 };
  if (remainingMs <= REST_WARNING_LEAD_MS) return { type: "warning" };
  return { type: "normal" };
}

export function crossedRestWarning(previousRemainingMs: number | null, remainingMs: number) {
  if (remainingMs <= 0 || remainingMs > REST_WARNING_LEAD_MS) return false;
  return previousRemainingMs == null || previousRemainingMs > REST_WARNING_LEAD_MS;
}

type WebAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

let audioContext: AudioContext | null = null;
const warnedRestKeys = new Set<number>();

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  return audioContext;
}

export async function prepareRestSignals() {
  const context = getAudioContext();
  if (context?.state === "suspended") {
    try { await context.resume(); } catch { /* A later user gesture can retry. */ }
  }
}

function playWarningTone() {
  const context = getAudioContext();
  if (!context || context.state !== "running") return;
  const start = context.currentTime;
  [0, 0.22].forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = index === 0 ? 740 : 880;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.16, start + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.18);
  });
}

export async function emitRestWarning() {
  await prepareRestSignals();
  const preferences = getAppPreferences();
  if (preferences.getReadyTone) playWarningTone();
  if (preferences.restVibration && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate([180, 90, 180]);
  }
}

export async function emitRestWarningOnce(restKey: number | null) {
  if (restKey == null || warnedRestKeys.has(restKey)) return false;
  warnedRestKeys.add(restKey);
  await emitRestWarning();
  return true;
}
