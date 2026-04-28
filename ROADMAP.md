# Gym Tracker Roadmap

## Produktziel

Die App soll im echten Studio schnell, klar und handlich nutzbar sein.

Wichtige Grundsätze:

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

## Neues Real-World-Feedback aus dem Studio

Diese Punkte sind jetzt wichtig:

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
- Bildschirm muss gesperrt im Hochformat bleiben
- vorherige Übung und vorheriger Satz sollen im Pausenfenster sichtbar sein
- personalisierte Pläne müssen frei anordenbar und bearbeitbar sein
- zusätzliche Gewichtsänderungen mit 1 kg und 0,5 kg
- Gewicht muss auch ins Minus gehen können
- ausgewählter Plan in der Plan-Auswahl immer ganz oben
- klarer Satz an Hauptaktionen:
  - Home
  - Pause
  - Play
  - Zurück

## Grundentscheidung für die nächste Ausbaustufe

Wir bauen die App ab jetzt nicht nur schöner, sondern strukturell gym-tauglich.

Das bedeutet:

- ein Training besteht künftig nicht nur aus Übungen
- ein Plan besteht aus frei anordenbaren Blöcken
- diese Blöcke können sein:
  - Übung
  - Aufwärmsatz
  - Dehnen
  - Pause
- aktives Training und pausiertes Training werden als echter Zustand behandelt
- alle Vergleiche bleiben objektiv, die App entscheidet aber weiterhin nichts für den Nutzer

## Neue Arbeitsreihenfolge

### Phase 6: Trainingslogik und Datenmodell

Ziel:

- die App so umbauen, dass sie die echten Studio-Abläufe tragen kann

#### 6.1 Plan-Blöcke definieren

Status: in Arbeit

- neuer Blocktyp `Übung`
- neuer Blocktyp `Aufwärmsatz`
- neuer Blocktyp `Dehnen`
- neuer Blocktyp `Pause`
- Reihenfolge frei speicherbar

#### 6.2 Übungsarten definieren

Status: in Arbeit

- `Grundübung`
- `Isolationsübung`
- `Dehnen`

Regeln:

- Grundübung standardmäßig 3 Aufwärmsätze
- Isolationsübung standardmäßig 1 Aufwärmsatz
- alles trotzdem manuell änderbar

#### 6.3 Gewichtsmodell erweitern

Status: in Arbeit

- negative Gewichte erlauben
- zusätzliche Schritte 1 kg und 0,5 kg
- Reihenfolge der Buttons:
  - 5
  - 2,5
  - 1
  - 0,5

### Phase 7: Aktives Training neu aufbauen

Ziel:

- während des Trainings mehr Kontext zeigen, ohne unübersichtlich zu werden

#### 7.1 Aktiver Satz

Status: offen

- letztes Training anzeigen
- letzter Satz anzeigen
- bester Satz bisher anzeigen
- Überblick über Trainingsplan und bereits erledigte Sätze

#### 7.2 Pause

Status: offen

- allgemeine Workout-Pause
- Satzpause
- letzte Übung anzeigen
- vorherigen Satz anzeigen
- erledigte Sätze sichtbar markieren
- nächstes Gewicht weiter anpassbar
- 10-Sekunden-Hinweis
- 3, 2, 1 auf dem Display

#### 7.3 Minimiertes Training

Status: offen

- aktives Training minimieren
- jederzeit zurück ins laufende Training
- klare Anzeige, dass noch ein Training aktiv ist

### Phase 8: Plan-Editor neu strukturieren

Ziel:

- persönliche Pläne wirklich frei bearbeitbar machen

#### 8.1 Freie Anordnung

Status: offen

- Blöcke frei verschieben
- Blöcke einfügen
- Blöcke löschen
- Blöcke duplizieren

#### 8.2 Plan-Inhalte

Status: offen

- Übungen aus Bibliothek wählen
- Dehnen aus Bibliothek wählen
- Pausen einfügen
- Aufwärmsätze anpassen

#### 8.3 Plan-Auswahl

Status: offen

- aktiver Plan immer oben
- aktiver Plan klar hervorgehoben

### Phase 9: Übungs- und Dehnbibliothek

Ziel:

- saubere Grundlage für Editor und Trainingsaufbau

#### 9.1 Trainingsübungen

Status: offen

- Übungen in Kategorien gliedern
- Beispielkategorien:
  - Brust
  - Rücken
  - Schultern
  - Beine
  - Arme
  - Core

#### 9.2 Dehnen und Mobilität

Status: offen

- Dehnen in Kategorien gliedern
- Beispielkategorien:
  - Oberkörper
  - Unterkörper
  - Hüfte
  - Rücken
  - Schultern

### Phase 10: Geräte- und Systemverhalten

Ziel:

- die App im Training stabiler und praktischer machen

#### 10.1 Hochformat sperren

Status: offen

- Bildschirm darf sich nicht drehen

#### 10.2 Trainingszustand erhalten

Status: offen

- Training bleibt beim Verlassen erhalten
- Rückkehr ins Training muss sofort möglich sein

## Was wir zuerst umsetzen sollten

Die sinnvollste Reihenfolge ist:

1. neues Datenmodell für Plan-Blöcke
2. Übungsarten und Standardregeln für Aufwärmsätze
3. Gewichtsmodell mit Minus, 1 kg und 0,5 kg
4. aktiven Workout-Screen um Trainingsüberblick und Vergleichsdaten erweitern
5. Pause-Screen um vorherige Übung, Satzstatus und Workout-Pause erweitern
6. danach freier Editor
7. danach Bibliothek
8. zuletzt Systemthemen wie Minimieren und Hochformat-Sperre

## Nächster konkreter Schritt

Als Nächstes sollten wir nicht direkt an der Oberfläche anfangen, sondern zuerst das Datenmodell festziehen:

1. Blocktypen definieren
2. Übungsarten definieren
3. Standardregeln für Aufwärmsätze festlegen
4. Gewichtsmodell erweitern

Stand:

- Grundstruktur im Code angelegt
- Übungskatalog mit Kategorien angelegt
- Aufwärmsatz-Regeln und Gewichtsregeln als Basis angelegt

Darauf baut fast alles Weitere auf.
