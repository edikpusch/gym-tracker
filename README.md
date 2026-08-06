# Gym Tracker

Gym Tracker ist eine lokal-first Progressive Web App für störungsarmes Krafttraining. Pläne, laufende Workouts und der Trainingsverlauf bleiben auf dem Gerät; für Sicherungen steht ein vollständiger JSON-Export mit Wiederherstellung bereit.

## Aktueller Funktionsumfang

- schneller Einstieg über empfohlenes Workout oder freie Workout-Auswahl
- vollständige Workout-Vorschau vor dem Start und jederzeit während des Trainings
- expliziter Satzstart mit Satzzeit sowie unauffälliger gesamter Workout-Zeit
- Arbeitssätze und Aufwärmsätze mit getrennten Statistiken
- automatische Pausen, anpassbare Pausendauer, 15-Sekunden-Signal, Vibration und 3–2–1-Countdown
- Gewichts- und Wiederholungsvorschläge aus dem letzten passenden Training
- freie Übungsauswahl, Überspringen, Zurückstellen und vorzeitiges Beenden
- Supersätze, Zirkel und optionale Mobilitäts-, Pausen- und Hinweisblöcke
- Planeditor mit Validierung, Sortierung und explizitem Speichern
- Verlaufskorrekturen, Volumen-, Bestleistungs- und Fortschrittsauswertung
- lokale Backups sowie Wiederaufnahme nach App-Wechsel oder Neustart
- installierbare und offline nutzbare PWA für Android und iPhone

Übungshinweise sind technisch vorbereitet. Die endgültigen Ausführungsanimationen und Medien werden später separat festgelegt.

## Daten und Datenschutz

Die Web-App benötigt kein Benutzerkonto und überträgt keine Trainingsdaten an einen Cloud-Dienst. Trainingsdaten werden lokal in IndexedDB gespeichert. Einstellungen liegen ebenfalls lokal auf dem Gerät.

Vor einem Browserwechsel, Zurücksetzen des Geräts oder Löschen der Website-Daten sollte unter **Einstellungen → Lokale Daten** ein Backup exportiert werden.

## Lokale Entwicklung

Voraussetzung ist eine aktuelle Node.js-LTS-Version.

```bash
npm install
npm run dev
```

Die App ist anschließend unter [http://localhost:3000](http://localhost:3000) erreichbar.

## Qualitätsprüfungen

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Der Produktionsbuild erzeugt zusätzlich eine versionsgebundene Service-Worker-Datei und ein Manifest der offline verfügbaren Assets.

## PWA testen

```bash
npm run build
npm run start
```

Danach die App einmal vollständig online öffnen. Auf Android kann sie über Chrome installiert werden. Auf iPhone und iPad erfolgt die Installation in Safari über **Teilen → Zum Home-Bildschirm**.

Updates werden nicht ungefragt während eines Trainings aktiviert. Wenn eine neue Version bereitsteht, erscheint die Aktualisierung kontrolliert in den Einstellungen.

## Native Wrapper

Die PWA ist zusätzlich für einen späteren Capacitor-Wrapper vorbereitet:

```bash
npm run cap:prepare
npm run cap:open:android
```

Für iOS werden macOS und Xcode benötigt. Weiterführende Checklisten befinden sich in `docs/IOS_FIRST_RUN_CHECKLIST.md`, `docs/CROSS_PLATFORM_DEVICE_QA.md` und `docs/IOS_RELEASE_AND_TESTFLIGHT.md`.

## Deployment

Das Projekt ist für Next.js auf Vercel konfiguriert. Es benötigt aktuell keine Umgebungsvariablen oder externen Datendienste.
