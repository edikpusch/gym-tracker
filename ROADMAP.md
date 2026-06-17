# Gym Tracker Roadmap

## Produktziel

Die App soll im echten Studio schnell, klar und handlich nutzbar sein.

Grundsätze:

- möglichst wenig Tippen im Gym
- möglichst wenig Scrollen
- klare Fakten statt Coaching
- Training jederzeit schnell fortsetzen können
- alle wichtigen Infos auf einen Blick verstehen
- Pläne frei anpassbar, aber trotzdem leicht bedienbar

## Aktueller Stand

Bereits vorhanden:

- mehrere Trainingspläne als Vorlagen
- eigener Plan als bearbeitbare Kopie
- aktiver Plan auf der Startseite
- planbasierte Workout-Screens
- planbezogener Verlauf
- planbezogene Übersicht nach dem Training
- Löschfunktion für Pläne und Workouts
- klare Zurück-Buttons und vereinheitlichte Navigation
- parallele APK-Varianten:
  - Live
  - Preview
  - Sandbox

Neu dazugekommen:

- freier Plan-Editor mit Blöcken:
  - Übung
  - Aufwärmen
  - Dehnen
  - Pause
  - Workout-Pause
- Block-Reihenfolge frei verschiebbar
- Blöcke einfügen, duplizieren, löschen, bearbeiten
- Übungs- und Dehnbibliothek mit Kategorien
- Standardwerte je Übung aus der Bibliothek
- Gewichtslogik mit:
  - 5 kg
  - 2,5 kg
  - 1 kg
  - 0,5 kg
  - negativem Gewicht für Unterstützungsübungen
- aktives Training mit:
  - Vergleich
  - Planübersicht
  - Satzfortschritt
  - Workout-Pause
  - Dehnen und freie Pausen als echte Flow-Schritte
- 10-Sekunden-Hinweis und 3, 2, 1 im Vordergrund
- sichtbare Rückkehr ins laufende Training über die Startseite

## Studio-Feedback als Leitlinie

Diese Punkte bleiben maßgeblich:

- allgemeine Pause für das gesamte Workout
- Grundübungen mit 3 Aufwärmsätzen
- Isolationsübungen mit 1 Aufwärmsatz
- Editor für Übungen, Aufwärmsätze, Dehnen und Pausen
- freie Reihenfolge und leichtes Verschieben im Editor
- Übungsbibliothek mit Kategorien für Training und Dehnen
- aktives Training muss minimierbar sein
- Rückkehr ins laufende Training jederzeit möglich
- Ton 10 Sekunden vor Pausenende
- großes 3, 2, 1 kurz vor dem nächsten Satz
- während des aktiven Satzes Vergleich mit letztem Training, letztem Satz und bestem Satz
- Überblick über Trainingsplan und bereits geleistete Sätze im aktiven Training
- während der Pause Überblick über letzte Übung und erledigte Sätze
- Bildschirm muss im Hochformat bleiben
- personalisierte Pläne müssen frei anordenbar und bearbeitbar sein
- ausgewählter Plan in der Plan-Auswahl immer ganz oben

## Phasenstatus

### Phase 6: Trainingslogik und Datenmodell

Status: weitgehend erledigt

Erledigt:

- Blockmodell für:
  - Übung
  - Aufwärmen
  - Dehnen
  - Pause
- Übungsarten:
  - Grundübung
  - Isolationsübung
  - Dehnen
- Standardregeln für Aufwärmsätze
- Gewichtsmodell mit 5 / 2,5 / 1 / 0,5
- negatives Gewicht für Unterstützungsübungen

Offen:

- Datenmodell später noch erweitern, falls echte Minimierung oder Hintergrundzustände tiefer gespeichert werden sollen

### Phase 7: Aktives Training

Status: in Arbeit

Erledigt:

- Vergleich im aktiven Satz:
  - letzter Satz
  - letztes Training
  - Bestwert
- Heutiger Plan mit Satzfortschritt
- Ablauf mit echten Blocktypen
- Aufwärmen als echter Schritt
- Dehnen als echter Schritt
- freie Pause als echter Schritt
- Workout-Pause als eigener Zustand
- Pause mit letzter Übung und erledigten Sätzen
- 10-Sekunden-Hinweis
- 3, 2, 1 im Vordergrund
- sichtbare Rückkehr ins laufende Training über Startseite

Offen:

- minimiertes Training außerhalb der App wirklich robust lösen
- Flow zwischen mehreren Zusatzblöcken weiter glätten
- Übergänge im Workout weiter auf Praxis-Flow trimmen

### Phase 8: Plan-Editor

Status: weitgehend erledigt

Erledigt:

- Blöcke frei verschieben
- Blöcke einfügen
- Blöcke löschen
- Blöcke duplizieren
- Übungen aus Bibliothek wählen
- Dehnen aus Bibliothek wählen
- Pausen einfügen
- Aufwärmsätze anpassen
- Schnellbausteine:
  - Grundübung
  - Isolation
  - Dehnen
  - Pause
  - Workout-Pause
- aktiver Plan im Picker oben und hervorgehoben

Offen:

- optional später echtes Drag-and-drop
- noch flüssigere Block-Bearbeitung mit weniger Einzel-Buttons

### Phase 9: Übungs- und Dehnbibliothek

Status: in Arbeit

Erledigt:

- Kategorien für Trainingsübungen
- Kategorien für Dehnen und Mobilität
- mehrere zusätzliche Übungen
- mehrere zusätzliche Dehnungen
- sinnvolle Standardwerte pro Übung

Offen:

- Bibliothek weiter ausbauen
- Auswahl noch schneller machen
- Standards pro Übung weiter schärfen

### Phase 10: Geräte- und Systemverhalten

Status: teilweise erledigt

Erledigt:

- Hochformat im Android-Setup berücksichtigt
- Training bleibt in der App sichtbar fortsetzbar

Offen:

- echtes Minimieren des aktiven Trainings außerhalb der App
- belastbare Rückkehr in laufende Pausen auch bei Systemwechsel
- Systemverhalten im echten Studio weiter härten

## Aktuelle Prioritäten

### 1. Aktiven Trainings-Flow finalisieren

Noch offen:

- Flow zwischen Satz, Satzpause, Dehnen und freien Pausen weiter glätten
- Zusatzblöcke hintereinander noch natürlicher führen
- Training außerhalb der App robuster fortsetzen

### 2. Bibliothek weiter ausbauen

Noch offen:

- mehr Übungen
- mehr Dehnungen
- bessere Standards pro Übung

### 3. Letzter UI-Feinschliff

Noch offen:

- letzte Restabstände auf kleinen Displays
- restliche sichtbare Text-/Encoding-Prüfung im ganzen Projekt
- gleiche Dichte auf allen Hauptscreens halten

## Nächste sinnvolle Einzelschritte

1. aktiven Trainings-Flow weiter glätten
2. Bibliothek erweitern und Standards schärfen
3. minimiertes Training bzw. System-Rückkehr später als eigener Block

## Nächster konkreter Schritt

Als Nächstes sinnvoll:

1. Zusatzblöcke im aktiven Training noch flüssiger machen
2. danach die Bibliothek weiter ausbauen
3. erst danach wieder größere Systemthemen angehen
