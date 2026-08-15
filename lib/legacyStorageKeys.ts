/**
 * Schlüssel und Version der alten localStorage-Ablage (Version 1 der App).
 *
 * Die zugehörige Engine (lib/workoutEngine.ts, 1067 Zeilen) wurde entfernt: Sie
 * war ein zweiter, konkurrierender Persistenzpfad neben lib/workout-domain und
 * wurde von keiner gerouteten Seite mehr benutzt. Sie enthielt unter anderem ein
 * ensureCurrentPlanStorage(), das den kompletten Trainingslog gelöscht hätte —
 * nirgends aufgerufen, aber eine Landmine.
 *
 * Die Konstanten bleiben, weil Backup und Aufräumlogik die alten Einträge
 * weiterhin lesen und sichern können müssen.
 */
export const WORKOUT_LOG_KEY = "gym-tracker-sets";
export const PLAN_VERSION_KEY = "gym-tracker-plan-version";
export const PLAN_VERSION = "2026-04-23-plan-v2";
