import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_APP_PREFERENCES,
  type AppPreferences,
} from "@/lib/appPreferences";

/**
 * Die Ton-Engine selbst braucht einen echten AudioContext und lässt sich hier
 * nicht ausführen. Getestet wird deshalb die Entscheidungslogik, die bestimmt
 * WANN geplant wird — genau dort saß der Fehler, dass kurze Pausen die
 * Vorwarnung sofort ausgelöst haben.
 */

const LEAD_SECONDS = 15;

/** Spiegelt die Bedingungen aus lib/restAudio.ts scheduleRestTones(). */
function plannedTones(remainingMs: number, preferences: AppPreferences) {
  const endsAt = remainingMs / 1000;
  const warnAt = endsAt - LEAD_SECONDS;
  const tones: string[] = [];
  if (preferences.signalVolume <= 0) return tones;
  if (preferences.getReadyTone && warnAt > 0.25) tones.push("warning");
  if (preferences.restEndTone && endsAt > 0.05) tones.push("end");
  return tones;
}

test("eine normale Pause bekommt Vorwarnung und Endton", () => {
  assert.deepEqual(plannedTones(90_000, DEFAULT_APP_PREFERENCES), ["warning", "end"]);
});

test("eine Pause von 15 Sekunden bekommt keine Vorwarnung, nur den Endton", () => {
  // Der alte Fehler: Bei Supersätzen (Standard 15s Übergang) feuerte der Warnton
  // im Moment des Pausenstarts statt 15 Sekunden vor dem Ende.
  assert.deepEqual(plannedTones(15_000, DEFAULT_APP_PREFERENCES), ["end"]);
});

test("eine sehr kurze Pause bekommt gar keine Vorwarnung", () => {
  assert.deepEqual(plannedTones(5_000, DEFAULT_APP_PREFERENCES), ["end"]);
});

test("Lautstärke 0 schaltet beide Töne ab", () => {
  assert.deepEqual(plannedTones(90_000, { ...DEFAULT_APP_PREFERENCES, signalVolume: 0 }), []);
});

test("einzeln abschaltbar", () => {
  assert.deepEqual(plannedTones(90_000, { ...DEFAULT_APP_PREFERENCES, getReadyTone: false }), ["end"]);
  assert.deepEqual(plannedTones(90_000, { ...DEFAULT_APP_PREFERENCES, restEndTone: false }), ["warning"]);
});

test("Standardeinstellungen enthalten Lautstärke und Endton", () => {
  assert.equal(DEFAULT_APP_PREFERENCES.signalVolume, 0.7);
  assert.equal(DEFAULT_APP_PREFERENCES.restEndTone, true);
});
