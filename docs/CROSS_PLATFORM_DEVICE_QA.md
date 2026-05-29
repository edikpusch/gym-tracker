# Cross-Platform Device QA

Diese Checkliste ist fuer die echte Geraete-QA von `Gym Tracker` auf `Android` und `iPhone` gedacht.

Ziel:

- dieselbe Codebasis auf beiden Plattformen pruefen
- iOS-Fixes nicht auf Kosten von Android einbauen
- vor TestFlight oder groesseren APK-/IPA-Tests einen reproduzierbaren Abnahmeweg haben

## Testaufbau

Vor jedem QA-Durchlauf:

1. Auf Windows den aktuellen Stand bauen:
   - `npm run lint`
   - `npm run build`
   - fuer native Builds zusaetzlich `npm run build:capacitor`
2. Android-Projekt nach Web-Aenderungen synchronisieren:
   - `npm run cap:sync`
3. iOS-Projekt auf dem Mac nach Web-Aenderungen synchronisieren:
   - `npm install`
   - `npm run build:capacitor`
   - `npm run cap:sync`
4. Sicherstellen, dass auf beiden Geraeten dieselbe App-Version getestet wird.
5. Wenn moeglich mit einem frischen Backup arbeiten, damit Android- und iPhone-Daten vergleichbar sind.

## Testgeraete

Mindestens diese Kombinationen abdecken:

1. Android:
   - ein normales Android-Geraet mit aktueller APK
2. iPhone:
   - ein echtes iPhone mit Xcode-Deploy
3. Optional:
   - kleines iPhone-Display
   - groesseres iPhone-Display
   - Android-Geraet mit eher kleiner Hoehe

## Abnahme-Regeln

Ein Testfall gilt nur dann als bestanden, wenn:

1. der erwartete UI-Zustand sichtbar ist
2. keine Fehlermeldung oder kaputte Navigation auftritt
3. Daten nach App-Wechsel oder Neustart erhalten bleiben
4. das Verhalten auf Android und iPhone funktional gleichwertig ist

Bei Plattformunterschieden ist das okay, wenn sie bewusst sind.
Beispiel:

- Android darf Rest-Overlay/PiP haben
- iPhone darf stattdessen Benachrichtigungen plus Rueckkehr in die App nutzen

## Testfall-Matrix

### 1. App-Start und Persistenz

1. App frisch starten.
   Erwartet:
   - Startansicht rendert sauber
   - kein kaputter leerer Zustand
   - keine falsch zurueckgesetzten Plaene/Einstellungen
2. App komplett schliessen und neu starten.
   Erwartet:
   - Daten bleiben erhalten
   - letzte Einstellungen bleiben erhalten
3. Geraet sperren, entsperren und App erneut in den Vordergrund holen.
   Erwartet:
   - keine defekte Rueckkehr
   - keine Navigation springt unerwartet

### 2. Navigation und Safe Areas

1. Startseite komplett durchscrollen.
2. Menue / Drawer / Navigation pruefen.
3. Seitenwechsel pruefen:
   - Training
   - Uebungen
   - Verlauf
   - Statistik
   - Fortschritt
   - Gewicht
   - Einstellungen
   - Support
4. Auf iPhone oben und unten pruefen:
   - Notch / Dynamic Island
   - Home Indicator
5. Auf Android unten pruefen:
   - Navigation Bar / Gestenbereich

Erwartet:

- nichts wird abgeschnitten
- Buttons liegen nicht im Home-Indicator-Bereich
- Scrollflaechen enden sauber

### 3. Workout-Komplettdurchlauf

1. Workout starten.
2. Gewichte und Wiederholungen eingeben.
3. Satz speichern.
4. Mehrere Saetze durchspielen.
5. Pause starten.
6. Workout beenden.
7. Summary-Seite pruefen.
8. In Verlauf wechseln und Session pruefen.

Erwartet:

- keine verlorenen Saetze
- Rest-Timer startet sauber
- Summary ist vollstaendig
- Verlauf zeigt die Session direkt korrekt an

### 4. Rest-Timer und Hintergrundverhalten

1. Nach einem Satz eine Pause starten.
2. App in den Hintergrund schicken.
3. Auf Ablauf oder aktive Pause warten.

Android erwartet:

- Rest-Benachrichtigung kommt
- falls Rest-Overlay/PiP aktiviert ist, Verhalten pruefen

iPhone erwartet:

- Rest-Benachrichtigung kommt
- kein Versuch, ein Android-Overlay nachzubilden
- Rueckkehr in die App zeigt sauberen Rest-Stand

Zusaetzlich pruefen:

1. Pause abbrechen
2. Pause verlaengern / verkuerzen
3. naechsten Satz nach Pause speichern

### 5. Bottom Sheets, Dialoge und Tastatur

Diese Phase ist nach den Viewport-/Keyboard-Fixes besonders wichtig.

Zu pruefen:

1. Workout-Bottom-Sheets oeffnen
2. Plan-/Uebungsdialoge oeffnen
3. Eingabefelder fokussieren
4. iPhone-Tastatur oeffnen
5. Android-Tastatur oeffnen
6. im Sheet nach unten scrollen
7. Felder am unteren Rand bearbeiten

Erwartet:

- Eingabefelder bleiben sichtbar
- Sheet wird nicht vom Keyboard verdeckt
- Safe-Area unten bleibt korrekt
- keine springenden Hoehen oder abgeschnittenen Buttons

### 6. Planverwaltung

1. Plan umbenennen
2. Trainingstag bearbeiten
3. Uebung hinzufuegen
4. Uebung entfernen
5. Reihenfolge aendern
6. Trainingsblock hinzufuegen
7. App schliessen und neu oeffnen

Erwartet:

- alle Plan-Aenderungen bleiben erhalten
- keine doppelten oder verschwundenen Bloecke
- Android und iPhone zeigen denselben Stand

### 7. Uebungsbibliothek und Favoriten

1. Eigene Uebung anlegen
2. Uebung umbenennen
3. Uebung archivieren
4. Favorit setzen/entfernen
5. Uebung in Plaenen und Workout verwenden

Erwartet:

- neue Uebung ist direkt verfuegbar
- Favoritenzustand bleibt erhalten
- keine Plattform verliert eigene Uebungen

### 8. Gewicht, Fortschritt und Statistik

1. Gewichtseintrag anlegen
2. Gewichtseintrag loeschen
3. Fortschrittsseite pruefen
4. Statistikseite pruefen
5. Verlaufseintraege oeffnen

Erwartet:

- Charts/Listen rendern sauber
- keine leeren oder inkonsistenten Daten
- Scrollen bleibt auf kleinen Geraeten benutzbar

### 9. Backup-Export und Import

Android:

1. In Einstellungen Backup exportieren
2. Datei pruefen
3. auf anderes Geraet uebertragen

iPhone:

1. In Einstellungen Backup exportieren
2. nativen Share-Sheet-Weg pruefen
3. Datei wieder importieren

Erwartet:

- Export funktioniert ohne Browser-Download-Haenger
- Import zeigt Zusammenfassung und Warnung
- nach Import und Reload sind Daten korrekt vorhanden:
  - Plaene
  - Verlauf
  - Gewicht
  - Favoriten
  - eigene Uebungen
  - Resume-Stand

### 10. Theme und Darstellung

1. Theme wechseln
2. App neu starten
3. Theme erneut pruefen
4. Kontrast bei Dialogen, Sheets und Workout pruefen

Erwartet:

- Theme bleibt gespeichert
- keine Texte verschwinden
- Android und iPhone bleiben lesbar

## Fehlerprotokoll

Jeden Fehler immer mit diesen Punkten notieren:

1. Plattform:
   - Android oder iPhone
2. Geraet:
   - z. B. Pixel / iPhone-Modell
3. Build:
   - APK-Stand oder Xcode-Stand
4. Seite/Flow:
   - z. B. Workout, Settings, Backup
5. Reproduktionsschritte
6. Erwartetes Verhalten
7. Tatsaechliches Verhalten
8. Screenshot oder Video, wenn moeglich
9. Prioritaet:
   - `P1` blockiert Nutzung
   - `P2` wichtige Funktion defekt
   - `P3` UX-/Darstellungsfehler

## Freigabe fuer iPhone-Weitergang

Bevor es an TestFlight oder breitere iPhone-Tests geht, sollten mindestens diese Punkte gruen sein:

1. App startet auf iPhone stabil
2. Workout-Komplettdurchlauf funktioniert
3. Rest-Timer funktioniert im Vordergrund und Hintergrund
4. Backup-Export via Share-Sheet funktioniert
5. Backup-Import funktioniert
6. Settings, Gewicht, Verlauf und Uebungen bleiben nach Neustart erhalten
7. Bottom Sheets und Tastatur verdecken keine kritischen Aktionen
8. Android zeigt nach denselben Aenderungen keine Regression

## Empfohlene Testreihenfolge

1. Android Smoke-Test
2. iPhone Smoke-Test
3. kompletter Workout-Test auf Android
4. kompletter Workout-Test auf iPhone
5. Backup Android -> iPhone
6. Restart-/Persistenztests
7. Theme-/Layout-/Keyboard-Finalrunde

## Ergebnis-Dokumentation

Am Ende jedes QA-Durchlaufs kurz festhalten:

1. Datum
2. getestete Plattformen
3. getestete Build-Staende
4. bestandene Testbereiche
5. offene Fehler
6. naechste Fix-Runde
