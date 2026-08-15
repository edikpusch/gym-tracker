"use client";

import { getAppPreferences } from "@/lib/appPreferences";

/**
 * Pausensignale, die auch im Hintergrund kommen.
 *
 * Der entscheidende Punkt: Die Töne werden NICHT per setTimeout ausgelöst.
 * Browser drosseln Timer in unsichtbaren Tabs auf etwa einen Aufruf pro Minute —
 * ein 15-Sekunden-Vorwarnton käme damit irgendwann, nur nicht rechtzeitig.
 *
 * Stattdessen werden beide Töne beim Start der Pause im Voraus auf der Uhr des
 * AudioContext geplant (`context.currentTime + offset`). Diese Uhr läuft im
 * Audio-Thread und ist von der Drosselung des JavaScript-Threads unabhängig.
 *
 * Damit der Context im Hintergrund nicht suspendiert wird, läuft zusätzlich eine
 * stille Endlosschleife als Anker. Auf Android hält das die Audio-Sitzung offen.
 * Auf iOS suspendiert WebKit den Context beim Verlassen der App trotzdem — dort
 * bleibt nur der native Weg über Capacitor-Benachrichtigungen (siehe
 * lib/restNotifications.ts). Das ist eine Plattformgrenze, kein Fehler hier.
 */

type WebAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

let context: AudioContext | null = null;
let masterGain: GainNode | null = null;
let keepAlive: AudioBufferSourceNode | null = null;
let scheduled: AudioScheduledSourceNode[] = [];

function getContext() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    context = new Ctor();
    masterGain = context.createGain();
    masterGain.gain.value = getAppPreferences().signalVolume;
    masterGain.connect(context.destination);
  }
  return context;
}

/** Hält die Audio-Sitzung offen, damit geplante Töne im Hintergrund noch feuern. */
function startKeepAlive(ctx: AudioContext) {
  if (keepAlive) return;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.round(ctx.sampleRate * 0.5)), ctx.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  // Bewusst nicht über masterGain: der Anker muss auch bei Lautstärke 0 laufen.
  const silent = ctx.createGain();
  silent.gain.value = 0.0001;
  source.connect(silent).connect(ctx.destination);
  source.start();
  keepAlive = source;
}

/**
 * Muss aus einer echten Nutzergeste heraus laufen (Tippen auf „Satz starten"),
 * sonst verweigern Browser das Abspielen. Danach bleibt der Context nutzbar.
 */
export async function unlockRestAudio() {
  const ctx = getContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  if (ctx.state === "running") {
    startKeepAlive(ctx);
    return true;
  }
  return false;
}

export function setSignalVolume(volume: number) {
  const clamped = Math.min(1, Math.max(0, volume));
  if (masterGain && context) {
    masterGain.gain.setTargetAtTime(clamped, context.currentTime, 0.01);
  }
}

/** Ein kurzer Ton zum gegebenen Zeitpunkt auf der Audio-Uhr. */
function tone(ctx: AudioContext, at: number, frequency: number, durationSeconds: number, peak: number) {
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(peak, at + 0.015);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + durationSeconds);
  oscillator.connect(envelope).connect(masterGain ?? ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + durationSeconds + 0.02);
  scheduled.push(oscillator);
  oscillator.onended = () => {
    scheduled = scheduled.filter((node) => node !== oscillator);
  };
  return oscillator;
}

/** Zwei gleiche Töne — „gleich geht es weiter". */
function scheduleWarning(ctx: AudioContext, at: number) {
  tone(ctx, at, 740, 0.16, 0.16);
  tone(ctx, at + 0.22, 880, 0.16, 0.16);
}

/** Drei aufsteigende Töne — deutlich anders als die Vorwarnung. */
function scheduleEnd(ctx: AudioContext, at: number) {
  tone(ctx, at, 660, 0.14, 0.18);
  tone(ctx, at + 0.16, 880, 0.14, 0.18);
  tone(ctx, at + 0.32, 1175, 0.3, 0.22);
}

export const REST_WARNING_LEAD_SECONDS = 15;

/**
 * Plant Vorwarnung und Endton für eine Pause. Beim Verkürzen, Verlängern oder
 * Überspringen erneut aufrufen — vorherige Planungen werden verworfen.
 */
export function scheduleRestTones(remainingMs: number) {
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return false;

  cancelRestTones();

  const preferences = getAppPreferences();
  setSignalVolume(preferences.signalVolume);
  if (preferences.signalVolume <= 0) return false;

  const now = ctx.currentTime;
  const endsAt = now + remainingMs / 1000;
  const warnAt = endsAt - REST_WARNING_LEAD_SECONDS;

  // Nur planen, wenn der Zeitpunkt noch in der Zukunft liegt. Sonst würde eine
  // kurze Pause die Vorwarnung sofort auslösen (der alte Fehler M5 im Audit).
  if (preferences.getReadyTone && warnAt > now + 0.25) scheduleWarning(ctx, warnAt);
  if (preferences.restEndTone && endsAt > now + 0.05) scheduleEnd(ctx, endsAt);
  return true;
}

export function cancelRestTones() {
  scheduled.forEach((node) => {
    try {
      node.stop();
    } catch {
      /* Bereits beendete Knoten werfen — unerheblich. */
    }
  });
  scheduled = [];
}

/** Für die Hörprobe in den Einstellungen. */
export async function previewSignal(kind: "warning" | "end") {
  const unlocked = await unlockRestAudio();
  const ctx = getContext();
  if (!unlocked || !ctx) return false;
  setSignalVolume(getAppPreferences().signalVolume);
  const at = ctx.currentTime + 0.05;
  if (kind === "warning") scheduleWarning(ctx, at);
  else scheduleEnd(ctx, at);
  return true;
}
