# GymTracker — Vollständige Überarbeitung

Du baust eine bestehende Next.js + Capacitor App weiter. Das Repo ist bereits importiert.
Arbeite Datei für Datei. Fange mit den Bugs an, dann die neuen Features.

---

## TECH STACK (nicht ändern)
- Next.js 16, App Router, TypeScript
- Capacitor 8 (Android APK)
- Styling: Inline-Styles (`style={{...}}`), KEIN Tailwind in workout-screen.tsx
- Storage: localStorage + Capacitor Preferences (dual, bereits implementiert)
- Sprache der UI: Deutsch

---

## SCHRITT 1 — KRITISCHE BUGS BEHEBEN

### Bug 1: Trainingsdaten werden bei Plan-Update gelöscht (KRITISCH)
**Datei:** `lib/workoutEngine.ts`
**Funktion:** `ensureCurrentPlanStorage()`

Aktuelle fehlerhafte Version:
```typescript
export function ensureCurrentPlanStorage() {
  if (!hasAppStorage()) return;
  try {
    const currentVersion = getStorageItem(PLAN_VERSION_KEY);
    if (currentVersion === PLAN_VERSION) return;
    removeStorageItem(WORKOUT_LOG_KEY);  // ← DIESER BUG LÖSCHT ALLE DATEN
    setStorageItem(PLAN_VERSION_KEY, PLAN_VERSION);
  } catch (error) {
    console.error("Local plan storage could not be updated:", error);
  }
}
```

Fix — `removeStorageItem(WORKOUT_LOG_KEY)` entfernen:
```typescript
export function ensureCurrentPlanStorage() {
  if (!hasAppStorage()) return;
  try {
    const currentVersion = getStorageItem(PLAN_VERSION_KEY);
    if (currentVersion === PLAN_VERSION) return;
    setStorageItem(PLAN_VERSION_KEY, PLAN_VERSION);
  } catch (error) {
    console.error("Local plan storage could not be updated:", error);
  }
}
```

---

### Bug 2: detectWorkoutType() versagt bei eigenen Übungen
**Datei:** `lib/workoutEngine.ts`
**Problem:** Hardcodierte Übungsnamen-Liste. Eigene Übungen → immer `"workout"` → History-Matching schlägt fehl.

In `saveSet()` diese Zeile:
```typescript
type: type ?? detectWorkoutType(exercise),
```
ändern zu:
```typescript
type: type ?? "workout",
```

Danach die gesamte `detectWorkoutType()`-Funktion am Ende der Datei löschen.

---

### Bug 3: Grammatikfehler "1 Sätze gespeichert"
**Datei:** `components/workout-screen.tsx`
**Suche:** den String `"Sätze gespeichert"` in der `renderRestHistoryCard`-Funktion

Fix — korrekte Singular/Plural-Logik:
```typescript
// Vorher (falsch):
`${currentExerciseHistory.length} Sätze gespeichert`

// Nachher (richtig):
`${currentExerciseHistory.length} ${currentExerciseHistory.length === 1 ? "Satz" : "Sätze"} gespeichert`
```

---

## SCHRITT 2 — NEUES FEATURE: Letzten Satz im Pausenscreen editieren

**Datei:** `components/workout-screen.tsx`
**Priorität:** HÖCHSTE

**Problem:** Nach "Satz speichern" wechselt die App in den Pausenscreen. Den gerade gespeicherten Satz zu korrigieren braucht 2 Taps (aufklappen → ✏️ tippen). Im Gym zu langsam.

**Was bereits existiert (nutze diese):**
- `lastSavedSet` — Variable mit dem letzten gespeicherten Satz (ca. Zeile 1540)
- `updateStoredSet(timestamp, { weight, reps })` — bereits importiert aus workoutEngine
- `editableSet` / `setEditableSet` — State für den Set-Editor existiert bereits
- `openSetEditor(set)` — Funktion existiert bereits

**Lösung:** Im Pausenscreen direkt nach dem Timer-Ring, VOR dem "GLEICH GEHT'S WEITER"-Panel, eine neue Komponente einfügen:

```typescript
// Neuer State (oben mit den anderen States einfügen):
const [showLastSetEditor, setShowLastSetEditor] = useState(false);
const [lastSetEditWeight, setLastSetEditWeight] = useState("");
const [lastSetEditReps, setLastSetEditReps] = useState("");

// Neue Funktion:
function openLastSetQuickEdit() {
  if (!lastSavedSet) return;
  setLastSetEditWeight(String(lastSavedSet.weight));
  setLastSetEditReps(String(lastSavedSet.reps));
  setShowLastSetEditor(true);
}

async function saveLastSetQuickEdit() {
  if (!lastSavedSet) return;
  const nextWeight = parseFloat(lastSetEditWeight.replace(",", "."));
  const nextReps = parseFloat(lastSetEditReps.replace(",", "."));
  if (isNaN(nextWeight) || isNaN(nextReps) || nextReps < 1) return;
  
  const updated = await updateStoredSet(lastSavedSet.timestamp, {
    weight: nextWeight,
    reps: Math.round(nextReps),
  });
  
  if (updated) {
    setLoggedSets(prev => prev.map(s => s.timestamp === updated.timestamp ? updated : s));
    setSessionSets(prev => prev.map(s => s && s.timestamp === updated.timestamp ? updated : s));
  }
  setShowLastSetEditor(false);
}
```

**UI — Im Pausenscreen einfügen** (direkt nach dem `restTimerWrap`-div, vor `restWeightSection`):

```tsx
{/* Letzter Satz — schnell editieren */}
{lastSavedSet && isResting && (
  <div style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px",
    margin: "8px 0",
    background: appPalette.surface,
    borderRadius: 14,
    border: `1px solid ${theme.border}`,
  }}>
    <span style={{ fontSize: 13, color: appPalette.textMuted, fontWeight: 500 }}>
      ✓ Gespeichert
    </span>
    <span style={{ fontSize: 15, fontWeight: 700, color: appPalette.textStrong }}>
      {lastSavedSet.weight} kg × {lastSavedSet.reps}
    </span>
    <button
      style={{
        fontSize: 18,
        background: "none",
        border: "none",
        padding: "4px 8px",
        color: theme.accent,
        cursor: "pointer",
      }}
      onClick={openLastSetQuickEdit}
    >
      ✏️
    </button>
  </div>
)}

{/* Bottom Sheet für Satz-Edit */}
{showLastSetEditor && lastSavedSet && (
  <div style={{
    position: "fixed", inset: 0, zIndex: 999,
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "flex-end",
  }}
    onClick={() => setShowLastSetEditor(false)}
  >
    <div
      style={{
        width: "100%", background: appPalette.surface,
        borderRadius: "24px 24px 0 0", padding: "24px 20px 40px",
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: appPalette.textStrong }}>
        Satz korrigieren
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: appPalette.textMuted, marginBottom: 6 }}>
            GEWICHT (KG)
          </div>
          <input
            type="number"
            inputMode="decimal"
            value={lastSetEditWeight}
            onChange={e => setLastSetEditWeight(e.target.value)}
            style={{
              width: "100%", padding: "14px 16px",
              fontSize: 22, fontWeight: 700, textAlign: "center",
              border: `2px solid ${theme.accent}`, borderRadius: 14,
              background: appPalette.surfaceSoft, color: appPalette.textStrong,
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: appPalette.textMuted, marginBottom: 6 }}>
            WIEDERHOLUNGEN
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={lastSetEditReps}
            onChange={e => setLastSetEditReps(e.target.value)}
            style={{
              width: "100%", padding: "14px 16px",
              fontSize: 22, fontWeight: 700, textAlign: "center",
              border: `2px solid ${theme.accent}`, borderRadius: 14,
              background: appPalette.surfaceSoft, color: appPalette.textStrong,
            }}
          />
        </div>
      </div>
      <button
        onClick={saveLastSetQuickEdit}
        style={{
          width: "100%", padding: "16px",
          background: theme.accent, color: "#fff",
          fontSize: 17, fontWeight: 700, borderRadius: 16,
          border: "none", marginBottom: 10,
        }}
      >
        Speichern
      </button>
      <button
        onClick={() => setShowLastSetEditor(false)}
        style={{
          width: "100%", padding: "14px",
          background: "none", color: appPalette.textMuted,
          fontSize: 16, borderRadius: 16, border: "none",
        }}
      >
        Abbrechen
      </button>
    </div>
  </div>
)}
```

---

## SCHRITT 3 — NEUES FEATURE: Wiederholungen im Pausenscreen anpassen

**Datei:** `components/workout-screen.tsx`

**Problem:** Im Pausenscreen kann man das Gewicht für den nächsten Satz anpassen (−5/−1/+1/+5 Buttons), aber Wiederholungen nicht.

**Wo einfügen:** Im Pausenscreen, direkt nach dem Block `restWeightSection` (der Block mit den Gewicht-Buttons).

```tsx
{/* Wiederholungen für nächsten Satz */}
<div style={{ marginTop: 12, textAlign: "center" }}>
  <div style={{
    fontSize: 11, fontWeight: 700, letterSpacing: 1,
    color: appPalette.textMuted, marginBottom: 8,
  }}>
    WIEDERHOLUNGEN
  </div>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
    <button
      style={{
        width: 52, height: 52, borderRadius: 14,
        fontSize: 22, fontWeight: 700,
        color: theme.accent,
        border: `1px solid ${theme.border}`,
        background: appPalette.surface,
      }}
      onClick={() => setReps(r => Math.max(1, r - 1))}
    >
      −
    </button>
    <div style={{
      minWidth: 64, textAlign: "center",
      fontSize: 26, fontWeight: 800, color: appPalette.textStrong,
    }}>
      {reps}
    </div>
    <button
      style={{
        width: 52, height: 52, borderRadius: 14,
        fontSize: 22, fontWeight: 700,
        color: theme.accent,
        border: `1px solid ${theme.border}`,
        background: appPalette.surface,
      }}
      onClick={() => setReps(r => r + 1)}
    >
      +
    </button>
  </div>
</div>
```

---

## SCHRITT 4 — NEUES FEATURE: "Schnell anpassen" vereinfachen

**Datei:** `components/workout-screen.tsx`
**Funktion:** Der Block der das `showAdjustSheet`-Sheet rendert

**Problem:** 7 Optionen auf einmal sind zu viel für eine Hand im Gym.

**Neuen State einfügen:**
```typescript
const [adjustSheetExpanded, setAdjustSheetExpanded] = useState(false);
```

**Beim Schließen des Sheets zurücksetzen:**
```typescript
// Wo showAdjustSheet auf false gesetzt wird, auch:
setAdjustSheetExpanded(false);
```

**Im Sheet:** Erste 3 Optionen immer sichtbar, Rest nur wenn `adjustSheetExpanded`:

Reihenfolge der immer sichtbaren Top-3:
1. ⏱ **Pause hinzufügen** — Sofort zusätzliche Pause starten
2. **+ Satz hinzufügen** — Einen weiteren Arbeitssatz anhängen
3. **⏭ Aktuelle Übung überspringen** — Nur diese Session weiterziehen

Danach ein "··· Mehr anzeigen"-Button. Bei Klick: alle 7 Optionen sichtbar.

---

## SCHRITT 5 — UX-VERBESSERUNG: Heutiger Plan — Dots durch Zahlen ersetzen

**Datei:** `components/workout-screen.tsx`
**Wo:** Im `showPlanModal`-Overlay, die Übungsliste

**Problem:** Dots (●○○○○○) sind auf kleinem Screen schwer lesbar.

**Fix:** Statt Dots eine klare Zahl anzeigen:
```tsx
// Vorher: ●○○○○○ 
// Nachher:
<span style={{ fontSize: 13, fontWeight: 700, color: theme.accent }}>
  {completedSets}/{totalSets}
</span>
```

---

## SCHRITT 6 — NEUE SEITE: Körpergewicht-Verlauf mit einfachem Chart

**Datei:** `app/weight/page.tsx`

Die Seite existiert bereits. Ergänze oben eine einfache visuelle Kurve der letzten 10 Einträge:

```tsx
// Einfacher SVG-Linienchart ohne externe Libraries
// X-Achse: Datum, Y-Achse: Gewicht
// Verwende die bestehenden `entries`-Daten
// Zeige nur wenn entries.length >= 2
```

Implementierung als reines SVG, keine externen Chart-Libraries:
- Breite: 100% des Containers
- Höhe: 120px
- Linie in `theme.accent`-Farbe (verwende splitThemes.mixed.primary = "#16A34A")
- Punkte als kleine Kreise
- Letzter Punkt hervorgehoben

---

## SCHRITT 7 — VERBESSERUNG: Startseite — Training läuft Banner verbessern

**Datei:** `app/page.tsx`

Das bestehende "TRAINING LÄUFT"-Banner (schwarzer Bereich oben) soll zusätzlich den Pausen-Timer anzeigen wenn eine Pause läuft. Das geht aktuell nicht, da der Timer-State im workout-screen ist.

**Einfachere Alternative:** Das Banner soll prominenter sein — größere Schrift, grüner Akzent beim "Fortsetzen"-Button:

Finde den Banner-Block der `activeWorkout` anzeigt und ändere den "Fortsetzen"-Button-Style:
```typescript
// Vorher: schwarzer Button
// Nachher: grüner Button mit Puls-Animation
background: "#16A34A",
animation: "pulse 2s infinite",
```

CSS in globals.css einfügen:
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.82; }
}
```

---

## WICHTIGE REGELN

1. **workout-screen.tsx hat 6571 Zeilen** — NUR gezielte Änderungen. NIE die ganze Datei neu schreiben.
2. **Nicht anfassen:** `lib/appStorage.ts`, `lib/appBackup.ts`, `lib/platform.ts`
3. **Alle UI-Texte Deutsch**
4. **Inline-Styles** im workout-screen (kein Tailwind dort)
5. **Nach jedem Schritt:** `npm run dev` und testen
6. **Importiert bereits:** `updateStoredSet`, `deleteStoredSet`, `appPalette`, `withAlpha` — nicht neu importieren

---

## REIHENFOLGE DER UMSETZUNG

1. Bug 1 (kritisch — Datenverlust)
2. Bug 2 (detectWorkoutType)
3. Bug 3 (Grammatik)
4. Feature: Letzten Satz editieren im Pausenscreen
5. Feature: Wiederholungen im Pausenscreen
6. Feature: Schnell anpassen vereinfachen
7. UX: Dots durch Zahlen
8. Neues: Gewichts-Chart
9. UX: Banner-Verbesserung
