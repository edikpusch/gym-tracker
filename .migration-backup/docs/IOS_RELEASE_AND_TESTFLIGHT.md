# iOS Release And TestFlight

Diese Checkliste ist fuer den letzten nativen iOS-Abschnitt gedacht:

- Signing finalisieren
- App auf ein echtes iPhone deployen
- letzte iOS-native Fehler beheben
- optional einen TestFlight-Build vorbereiten

Sie baut auf:

- `docs/IOS_FIRST_RUN_CHECKLIST.md`
- `docs/CROSS_PLATFORM_DEVICE_QA.md`

auf.

## Voraussetzungen

Vor Phase 7 sollten diese Punkte bereits erledigt sein:

1. Das iOS-Projekt wurde auf dem Mac bereits erzeugt.
2. `npm install`, `npm run build:capacitor` und `npm run cap:sync` liefen auf dem Mac erfolgreich.
3. Die App wurde mindestens einmal in Xcode geoeffnet.
4. Die Cross-Platform-QA aus `docs/CROSS_PLATFORM_DEVICE_QA.md` wurde mindestens als Smoke-Test durchgefuehrt.
5. Das echte iPhone ist verfuegbar.

## Projektbasis pruefen

Aktuell relevante Projektwerte:

1. App-ID in [capacitor.config.ts](/C:/Users/edikp/gym-tracker/capacitor.config.ts): `com.edikp.gymtracker`
2. App-Name in [capacitor.config.ts](/C:/Users/edikp/gym-tracker/capacitor.config.ts): `Gym Tracker`
3. iOS-Kommandos in [package.json](/C:/Users/edikp/gym-tracker/package.json):
   - `npm run cap:add:ios`
   - `npm run cap:sync`
   - `npm run cap:open:ios`

Wenn der Bundle Identifier spaeter geaendert werden muss, dann:

1. in Xcode anpassen
2. danach den neuen Identifier dokumentieren
3. darauf achten, dass Android davon unberuehrt bleibt

## 1. Xcode-Signing finalisieren

In Xcode:

1. Projekt `App` oeffnen
2. Target `App` waehlen
3. `Signing & Capabilities` oeffnen
4. `Automatically manage signing` aktiviert lassen
5. `Team` auf dein Apple-Team setzen

Erwartung:

- `Signing Certificate`: `Apple Development`
- `Provisioning Profile`: `Xcode Managed Profile`

Wenn Fehler kommen:

1. Apple-ID in `Xcode > Settings > Accounts` pruefen
2. Internetverbindung pruefen
3. echtes iPhone anschliessen
4. in Xcode `Try Again` klicken

## 2. Echtes iPhone vorbereiten

Auf dem iPhone:

1. Geraet entsperren
2. per Kabel mit dem Mac verbinden
3. `Diesem Computer vertrauen` bestaetigen
4. falls noetig Code eingeben

In Xcode:

1. oben in der Zielauswahl das echte iPhone auswaehlen
2. wenn noetig kurz warten, bis Xcode das Geraet fertig registriert hat

Wenn das iPhone nicht sauber deployt:

1. Kabel neu verbinden
2. iPhone entsperrt lassen
3. Xcode neu auf das Geraet warten lassen

## 3. Developer Mode und lokale Installation

Falls iOS fuer lokale Entwickler-Builds danach fragt:

1. auf dem iPhone den `Developer Mode` aktivieren
2. iPhone neu starten
3. den Developer Mode bestaetigen

Danach:

1. in Xcode erneut `Run` ausfuehren
2. pruefen, ob `Gym Tracker` installiert und gestartet wird

## 4. Erster nativer Deploy-Test

In Xcode:

1. echtes iPhone als Ziel auswaehlen
2. `Run` klicken

Erwartet:

1. Build laeuft ohne Signing-Fehler
2. App wird auf dem iPhone installiert
3. App startet auf dem Geraet

Wenn der Build fehlschlaegt, Fehler notieren:

1. Signing
2. Provisioning
3. Bundle Identifier
4. Capability-/Permission-Fehler
5. Runtime-Fehler in der WebView

## 5. Native iPhone-Smoke-Test

Sobald die App installiert ist:

1. App starten
2. Training / Startseite pruefen
3. Workout starten
4. Satz speichern
5. Rest-Timer pruefen
6. Workout beenden
7. Summary pruefen
8. Einstellungen pruefen
9. Backup-Export pruefen
10. App schliessen und neu starten

Dafuer die Matrix aus `docs/CROSS_PLATFORM_DEVICE_QA.md` verwenden.

## 6. Letzte iOS-native Fehler systematisch behandeln

Wenn auf dem iPhone Probleme auftauchen:

1. Fehler mit Screenshot/Videobeweis notieren
2. reproduzierbare Schritte aufschreiben
3. Prioritaet vergeben:
   - `P1` blockiert iPhone-Nutzung
   - `P2` wichtige Funktion kaputt
   - `P3` UX-/Layout-Fehler
4. auf Windows fixen
5. auf dem Mac erneut:
   - `npm run build:capacitor`
   - `npm run cap:sync`
   - Xcode erneut testen

## 7. Release-Check vor TestFlight

Vor dem ersten TestFlight-Build diese Punkte pruefen:

1. App startet auf iPhone ohne lokale Sonderworkarounds
2. Backup-Export per Share-Sheet funktioniert
3. Backup-Import funktioniert
4. Rest-Timer funktioniert im Vordergrund und Hintergrund
5. Safe Areas und Bottom Sheets sind auf dem iPhone sauber
6. Android zeigt keine Regression nach den iOS-Aenderungen
7. App-Name stimmt
8. App-Icon und Launch-Darstellung sind akzeptabel

## 8. Release-Build in Xcode erzeugen

In Xcode:

1. `Product > Archive`
2. warten bis der Archive-Build fertig ist
3. im Organizer den Build pruefen

Erwartet:

- kein Signing-/Provisioning-Fehler
- kein offensichtlicher Packaging-Fehler

## 9. Upload zu TestFlight

Wenn ein Apple Developer Program aktiv ist:

1. im Organizer `Distribute App`
2. `App Store Connect`
3. Upload bestaetigen
4. Verarbeitung in App Store Connect abwarten

Danach:

1. Build in TestFlight pruefen
2. interne Tester hinzufuegen
3. Release Notes dokumentieren

## 10. Ergebnisdokumentation

Nach Phase 7 kurz notieren:

1. getestetes iPhone-Modell
2. macOS-/Xcode-Version
3. ob lokaler Deploy geklappt hat
4. ob Archive-Build geklappt hat
5. ob TestFlight-Upload geklappt hat
6. offene Restfehler

## Minimalziel fuer Phase 7

Phase 7 ist erfolgreich, wenn mindestens diese Punkte gruen sind:

1. Signing funktioniert in Xcode
2. `Gym Tracker` laeuft auf einem echten iPhone
3. die iPhone-Smoke-Tests bestehen
4. Android bleibt parallel funktionsfaehig

## Vollziel fuer Phase 7

Phase 7 ist voll abgeschlossen, wenn zusaetzlich:

1. ein Release-Archiv erfolgreich gebaut wurde
2. ein TestFlight-Build hochgeladen wurde
3. keine offenen `P1`-Probleme fuer iPhone mehr uebrig sind
