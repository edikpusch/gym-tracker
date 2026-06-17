# WICHTIG: Bestehenden Code verbessern — NICHT neu bauen!

Das Repo `edikpusch/gym-tracker` ist bereits importiert und läuft.
Du darfst KEINE neue App erstellen. Arbeite NUR mit den bestehenden Dateien.

## Kontext
Die App ist eine professionelle Next.js + Capacitor Fitness-App mit:
- 6571 Zeilen in `components/workout-screen.tsx`
- Vollständigem Coach-System, Plan-Editor, 80+ Übungen
- Pause-Timer mit Ring-Animation, Warm-up Logik, History-Vergleich

---

## REGEL #1: Niemals neu bauen
Wenn du versucht bist eine neue Datei zu erstellen die bereits existiert → STOP.
Stattdessen: die bestehende Datei öffnen und nur die betroffene Stelle ändern.

Bestehende Hauptdateien die du NICHT ersetzen darfst:
- `components/workout-screen.tsx` (6571 Zeilen — nur gezielte Änderungen)
- `app/page.tsx` (3627 Zeilen — nur gezielte Änderungen)
- `lib/workoutEngine.ts`
- `lib/trainingPlans.ts`
- `lib/appStorage.ts`
- `lib/trainingCatalog.ts` (80+ Übungen)

---

## AUFGABE 1 — Bug: Datenverlust bei Plan-Update (KRITISCH)

**Datei:** `lib/workoutEngine.ts`
**Suche die Funktion:** `ensureCurrentPlanStorage`

Finde diese Zeile und lösche sie:
```typescript
removeStorageItem(WORKOUT_LOG_KEY);
```

Diese eine Zeile löscht alle Trainingsdaten bei einem Plan-Update. Nur diese Zeile entfernen, nichts sonst.

---

## AUFGABE 2 — Bug: Grammatik "1 Sätze"

**Datei:** `components/workout-screen.tsx`
**Suche:** den Text `Sätze gespeichert` in der Nähe einer Zahl

Ersetze die Stelle so dass gilt:
- Bei count === 1 → "1 Satz gespeichert"
- Bei count > 1 → "X Sätze gespeichert"

---

## AUFGABE 3 — Feature: Letzten Satz im Pausenscreen editieren

**Datei:** `components/workout-screen.tsx`

**Was bereits existiert (nicht neu erstellen):**
- `lastSavedSet` Variable (Zeile ~1540)
- `updateStoredSet` Funktion (bereits importiert)
- `isResting` Boolean
- `appPalette`, `theme` Objekte für Styling

**Was hinzufügen:**

Schritt A — Neuen State hinzufügen (bei den anderen useState-Zeilen, ca. Zeile 217-260):
```typescript
const [showLastSetEditor, setShowLastSetEditor] = useState(false);
const [lastSetEditWeight, setLastSetEditWeight] = useState("");
const [lastSetEditReps, setLastSetEditReps] = useState("");
```

Schritt B — Neue Funktion hinzufügen (bei den anderen Handler-Funktionen):
```typescript
function openLastSetQuickEdit() {
  if (!lastSavedSet) return;
  setLastSetEditWeight(String(lastSavedSet.weight));
  setLastSetEditReps(String(lastSavedSet.reps));
  setShowLastSetEditor(true);
}

async function saveLastSetQuickEdit() {
  if (!lastSavedSet) return;
  const nextWeight = parseFloat(lastSetEditWeight.replace(",", "."));
  const nextReps = parseInt(lastSetEditReps, 10);
  if (isNaN(nextWeight) || isNaN(nextReps) || nextReps < 1) return;
  const updated = await updateStoredSet(lastSavedSet.timestamp, {
    weight: nextWeight,
    reps: nextReps,
  });
  if (updated) {
    setLoggedSets(prev => prev.map(s => s.timestamp === updated.timestamp ? updated : s));
    setSessionSets(prev => prev.map(s => s && s.timestamp === updated.timestamp ? updated : s));
  }
  setShowLastSetEditor(false);
}
```

Schritt C — Im Pausenscreen JSX einfügen.

Suche im JSX den Block der den Pausenscreen rendert (enthält `isResting` und den Timer-Ring). Direkt nach dem Timer-Ring-Block, VOR dem Gewicht-Buttons-Block, diesen JSX einfügen:

```tsx
{lastSavedSet && (
  <div style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px",
    margin: "0 0 8px 0",
    background: appPalette.surface,
    borderRadius: 14,
    border: `1px solid ${theme.border}`,
  }}>
    <span style={{ fontSize: 13, color: appPalette.textMuted, fontWeight: 600 }}>
      ✓ Gespeichert
    </span>
    <span style={{ fontSize: 15, fontWeight: 700, color: appPalette.textStrong }}>
      {lastSavedSet.weight} kg × {lastSavedSet.reps}
    </span>
    <button
      style={{ fontSize: 18, background: "none", border: "none", padding: "4px 8px", color: theme.accent }}
      onClick={openLastSetQuickEdit}
    >
      ✏️
    </button>
  </div>
)}

{showLastSetEditor && lastSavedSet && (
  <div
    style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end" }}
    onClick={() => setShowLastSetEditor(false)}
  >
    <div
      style={{ width: "100%", background: appPalette.surface, borderRadius: "24px 24px 0 0", padding: "24px 20px 40px" }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: appPalette.textStrong }}>
        Satz korrigieren
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: appPalette.textMuted, marginBottom: 6 }}>GEWICHT (KG)</div>
          <input
            type="number"
            inputMode="decimal"
            value={lastSetEditWeight}
            onChange={e => setLastSetEditWeight(e.target.value)}
            style={{ width: "100%", padding: "14px 16px", fontSize: 22, fontWeight: 700, textAlign: "center", border: `2px solid ${theme.accent}`, borderRadius: 14, background: appPalette.surfaceSoft, color: appPalette.textStrong }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: appPalette.textMuted, marginBottom: 6 }}>WIEDERHOLUNGEN</div>
          <input
            type="number"
            inputMode="numeric"
            value={lastSetEditReps}
            onChange={e => setLastSetEditReps(e.target.value)}
            style={{ width: "100%", padding: "14px 16px", fontSize: 22, fontWeight: 700, textAlign: "center", border: `2px solid ${theme.accent}`, borderRadius: 14, background: appPalette.surfaceSoft, color: appPalette.textStrong }}
          />
        </div>
      </div>
      <button
        onClick={saveLastSetQuickEdit}
        style={{ width: "100%", padding: "16px", background: theme.accent, color: "#fff", fontSize: 17, fontWeight: 700, borderRadius: 16, border: "none", marginBottom: 10 }}
      >
        Speichern
      </button>
      <button
        onClick={() => setShowLastSetEditor(false)}
        style={{ width: "100%", padding: "14px", background: "none", color: appPalette.textMuted, fontSize: 16, borderRadius: 16, border: "none" }}
      >
        Abbrechen
      </button>
    </div>
  </div>
)}
```

---

## AUFGABE 4 — Feature: Wiederholungen im Pausenscreen

**Datei:** `components/workout-screen.tsx`

Im Pausenscreen JSX, direkt NACH dem Block mit den Gewicht-Buttons (−5/−1/+1/+5), diesen Block einfügen:

```tsx
<div style={{ marginTop: 12, textAlign: "center" }}>
  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: appPalette.textMuted, marginBottom: 8 }}>
    WIEDERHOLUNGEN
  </div>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
    <button
      style={{ width: 52, height: 52, borderRadius: 14, fontSize: 22, fontWeight: 700, color: theme.accent, border: `1px solid ${theme.border}`, background: appPalette.surface }}
      onClick={() => setReps(r => Math.max(1, r - 1))}
    >−</button>
    <div style={{ minWidth: 64, textAlign: "center", fontSize: 26, fontWeight: 800, color: appPalette.textStrong }}>
      {reps}
    </div>
    <button
      style={{ width: 52, height: 52, borderRadius: 14, fontSize: 22, fontWeight: 700, color: theme.accent, border: `1px solid ${theme.border}`, background: appPalette.surface }}
      onClick={() => setReps(r => r + 1)}
    >+</button>
  </div>
</div>
```

---

## AUFGABE 5 — Feature: "Schnell anpassen" vereinfachen

**Datei:** `components/workout-screen.tsx`

Neuen State hinzufügen:
```typescript
const [adjustSheetExpanded, setAdjustSheetExpanded] = useState(false);
```

Im Sheet-JSX (`showAdjustSheet === true`): Die ersten 3 Optionen immer zeigen:
1. Pause hinzufügen
2. Satz hinzufügen
3. Aktuelle Übung überspringen

Dann ein Button:
```tsx
<button
  onClick={() => setAdjustSheetExpanded(e => !e)}
  style={{ width: "100%", padding: "14px", textAlign: "center", color: appPalette.textMuted, background: "none", border: "none", fontSize: 15 }}
>
  {adjustSheetExpanded ? "▲ Weniger anzeigen" : "··· Mehr anzeigen"}
</button>
```

Die restlichen 4 Optionen nur wenn `adjustSheetExpanded === true` zeigen.

Beim Schließen des Sheets (`showAdjustSheet` auf false) auch `setAdjustSheetExpanded(false)` aufrufen.

---

## NACH JEDER AUFGABE

1. `npm run dev` starten
2. Im Preview testen ob die Änderung funktioniert
3. Erst dann zur nächsten Aufgabe

## ABSOLUTE REGELN

- Keine neue App erstellen
- Keine bestehenden Dateien komplett ersetzen
- Nur die beschriebenen Stellen ändern
- Alle Texte auf Deutsch
- Inline-Styles verwenden (kein Tailwind in workout-screen.tsx)
