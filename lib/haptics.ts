"use client";

import { getAppPreferences } from "@/lib/appPreferences";

/**
 * Haptische Rückmeldung für Aktionen, die eine Konsequenz haben.
 *
 * Beim Training schaut man nicht auf den Bildschirm — die Vibration bestätigt,
 * dass der Satz wirklich gespeichert wurde. Bewusst NICHT bei jedem Tippen:
 * Dauervibration nutzt sich ab und kostet Akku.
 *
 * Die Muster sind so gewählt, dass sie sich blind unterscheiden lassen:
 * kurz = erledigt, doppelt = Achtung, aufsteigend = fertig.
 */

export type HapticPattern =
  | "tap"        // leichte Bestätigung: Gewicht/Wiederholungen geändert
  | "success"    // Satz gespeichert
  | "warning"    // Pause endet gleich, Übung übersprungen
  | "complete"   // Workout abgeschlossen
  | "record"     // neue Bestleistung
  | "error";     // Eingabe abgelehnt

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: 25,
  warning: [180, 90, 180],
  complete: [40, 60, 40, 60, 120],
  record: [30, 50, 30, 50, 30, 50, 90],
  error: [60, 50, 60],
};

function canVibrate() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Löst ein Vibrationsmuster aus, sofern der Nutzer Haptik aktiviert hat.
 * Gibt zurück, ob tatsächlich vibriert wurde — nützlich für Tests.
 */
export function haptic(pattern: HapticPattern) {
  if (!canVibrate()) return false;
  if (!getAppPreferences().restVibration) return false;
  try {
    return navigator.vibrate(PATTERNS[pattern]);
  } catch {
    return false;
  }
}

/** Bricht eine laufende Vibration ab, z. B. wenn die Pause übersprungen wird. */
export function stopHaptics() {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(0);
  } catch {
    /* egal */
  }
}

export function hapticsSupported() {
  return canVibrate();
}
