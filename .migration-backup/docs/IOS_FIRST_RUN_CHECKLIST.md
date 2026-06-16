# iOS First-Run Checklist

Diese Checkliste ist fuer den ersten echten iPhone-/Xcode-Durchlauf gedacht.

## Vor dem Mac-Start

1. Sicherstellen, dass das Repo aktuell ist.
2. Falls Android-Daten uebernommen werden sollen: In der Android-App unter Einstellungen ein Backup exportieren.
3. Apple-ID und nach Moeglichkeit ein Apple-Developer-Konto bereithalten.
4. Xcode auf dem Mac installieren oder aktualisieren.

## Projekt auf dem Mac vorbereiten

1. Projekt auf den Mac holen.
2. Im Projektordner `npm install` ausfuehren.
3. `npm run build:capacitor` ausfuehren.
4. `npm run cap:add:ios` einmalig ausfuehren.
5. `npm run cap:sync` ausfuehren.
6. `npm run cap:open:ios` ausfuehren.

## Xcode-Grundsetup

1. In Xcode das erzeugte `ios`-Projekt oeffnen.
2. Im Target `App` unter `Signing & Capabilities` ein Team auswaehlen.
3. Die `Bundle Identifier` pruefen.
   Erwartet ist aktuell `com.edikp.gymtracker`.
4. Den Deployment-Target-Wert pruefen und mit dem vorhandenen iPhone abstimmen.
5. Falls Xcode automatische Signing-Korrekturen anbietet, diese uebernehmen.

## Erste Tests auf dem iPhone

1. App auf einem echten iPhone installieren.
2. Startseite, Planseite und Workout-Start testen.
3. Einen kompletten Workout-Durchlauf testen:
   - Satz speichern
   - Pause starten
   - Workout beenden
   - Summary oeffnen
4. App komplett schliessen und erneut starten.
5. Pruefen, ob Trainingsdaten, Plaene und Einstellungen erhalten bleiben.
6. Backup-Import testen, wenn Android-Daten uebernommen werden sollen.

## iOS-spezifische Checks

1. Safe Areas oben und unten pruefen:
   - Notch / Dynamic Island
   - Home Indicator
2. Drawer, Bottom Sheets und Dialoge auf kleinen iPhones pruefen.
3. Rest-Timer-Benachrichtigungen pruefen.
4. Theme-Wechsel pruefen.
5. Backup-Export pruefen:
   Erwartet ist das native iOS-Share-Sheet mit einer geteilten JSON-Backup-Datei.
6. Fuer den kompletten Android-/iPhone-Abgleich die Testmatrix in `docs/CROSS_PLATFORM_DEVICE_QA.md` nutzen.

## Vor TestFlight

1. App-Name, App-Icon und Splash/Launch-Darstellung pruefen.
2. Berechtigungen und Texte fuer Notifications pruefen.
3. Release-Build in Xcode erstellen.
4. Upload in TestFlight vorbereiten.
5. Fuer den kompletten Release-/Upload-Ablauf die Phase-7-Checkliste in `docs/IOS_RELEASE_AND_TESTFLIGHT.md` nutzen.

## Wenn etwas auffaellt

1. Problem mit genauer Stelle notieren.
2. Wenn moeglich Screenshot oder Video aufnehmen.
3. Danach das Repo hier auf Windows weiter anpassen und spaeter erneut `cap:sync` auf dem Mac ausfuehren.
