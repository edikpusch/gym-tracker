"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { AppPageFrame } from "@/components/AppPageFrame";
import { TextPromptDialog } from "@/components/ui/TextPromptDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NoticeDialog } from "@/components/ui/NoticeDialog";
import {
  exportGymTrackerBackup,
  inspectGymTrackerBackup,
  importGymTrackerBackup,
} from "@/lib/appBackup";
import {
  DEFAULT_APP_PREFERENCES,
  getAppPreferences,
  saveAppPreferences,
  type AppPreferences,
} from "@/lib/appPreferences";
import { clearBodyWeightEntries } from "@/lib/bodyWeight";
import {
  CUSTOM_EXERCISE_CATEGORIES,
  getCustomExerciseLibraryEntries,
  renameCustomExerciseEntry,
  setCustomExerciseArchived,
  updateCustomExerciseEntry,
  type CustomExerciseLibraryEntry,
} from "@/lib/exerciseLibrary";
import {
  removeFavoriteExerciseId,
  setExerciseFavorite,
} from "@/lib/exerciseFavorites";
import { appPalette, uiTheme, withAlpha } from "@/lib/theme";

type PendingImportState = {
  fileName: string;
  rawText: string;
  preview: ReturnType<typeof inspectGymTrackerBackup>;
};

type NoticeState = {
  title: string;
  body: string;
  reloadAfterClose?: boolean;
};

type RenameExerciseState = {
  id: string;
  value: string;
};

type EditExerciseState = {
  id: string;
  category: CustomExerciseLibraryEntry["category"];
  kind: CustomExerciseLibraryEntry["kind"];
  favorite: boolean;
  sets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
};

export default function SettingsPage() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [settings, setSettings] = useState<AppPreferences>(getAppPreferences());
  const [showClearWeightConfirm, setShowClearWeightConfirm] = useState(false);
  const [showWeightClearedNotice, setShowWeightClearedNotice] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImportState | null>(null);
  const [noticeState, setNoticeState] = useState<NoticeState | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExerciseLibraryEntry[]>(
    () => getCustomExerciseLibraryEntries({ includeArchived: true })
  );
  const [showArchivedExercises, setShowArchivedExercises] = useState(false);
  const [renameExerciseState, setRenameExerciseState] = useState<RenameExerciseState | null>(null);
  const [archiveExerciseId, setArchiveExerciseId] = useState<string | null>(null);
  const [editExerciseState, setEditExerciseState] = useState<EditExerciseState | null>(null);
  const [pendingExerciseQuery, setPendingExerciseQuery] = useState<string | null>(null);

  function refreshCustomExercises() {
    setCustomExercises(getCustomExerciseLibraryEntries({ includeArchived: true }));
  }

  function updateSettings(patch: Partial<AppPreferences>) {
    const next = {
      ...settings,
      ...patch,
    };
    setSettings(next);
    saveAppPreferences(next);
  }

  async function exportData() {
    try {
      const result = await exportGymTrackerBackup();
      if (result.method === "cancelled" || result.method === "share") {
        return;
      }

      setNoticeState({
        title: "Backup erstellt",
        body: "Dein Backup wurde als Datei exportiert und enthaelt Trainingsverlauf, Plaene, eigene Uebungen, Favoriten sowie den aktuellen Fortsetzen-Stand.",
      });
    } catch (error) {
      console.error("Backup export failed:", error);
      setNoticeState({
        title: "Export fehlgeschlagen",
        body: "Das Backup konnte nicht erstellt werden. Bitte versuche es erneut.",
      });
    }
  }

  function openImportPicker() {
    importInputRef.current?.click();
  }

  async function handleImportFileSelected(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      const preview = inspectGymTrackerBackup(rawText);
      setPendingImport({
        fileName: file.name,
        rawText,
        preview,
      });
    } catch (error) {
      console.error("Backup file could not be read:", error);
      setNoticeState({
        title: "Datei konnte nicht gelesen werden",
        body: "Die ausgewaehlte Backup-Datei konnte nicht geoeffnet werden.",
      });
    }
  }

  function handleImportConfirm() {
    if (!pendingImport) {
      return;
    }

    try {
      const result = importGymTrackerBackup(pendingImport.rawText);
      const nextSettings = getAppPreferences();
      setSettings(nextSettings);
      setPendingImport(null);
      setNoticeState({
        title: "Backup importiert",
        body: `Deine Daten wurden wiederhergestellt: ${result.summary.workoutSessionCount} Sessions, ${result.summary.customPlanCount} eigene Plaene, ${result.summary.customExerciseCount} eigene Uebungen${result.summary.hasResumeState ? " und ein Fortsetzen-Stand" : ""}. Nach dem Schliessen wird die App neu geladen.`,
        reloadAfterClose: true,
      });
    } catch (error) {
      console.error("Backup import failed:", error);
      setPendingImport(null);
      setNoticeState({
        title: "Import fehlgeschlagen",
        body:
          error instanceof Error
            ? error.message
            : "Das Backup konnte nicht importiert werden.",
      });
    }
  }

  function clearWeightHistory() {
    clearBodyWeightEntries();
    setShowClearWeightConfirm(false);
    setShowWeightClearedNotice(true);
  }

  function resetPreferences() {
    saveAppPreferences(DEFAULT_APP_PREFERENCES);
    setSettings(DEFAULT_APP_PREFERENCES);
  }

  function handleRenameExerciseConfirm() {
    if (!renameExerciseState) {
      return;
    }

    const result = renameCustomExerciseEntry(
      renameExerciseState.id,
      renameExerciseState.value
    );

    if (result.status === "duplicate") {
      setNoticeState({
        title: "Name bereits vorhanden",
        body: `Es gibt bereits eine aktive eigene Übung mit dem Namen "${result.entry?.label ?? renameExerciseState.value}".`,
      });
      return;
    }

    if (result.status !== "updated") {
      setNoticeState({
        title: "Umbenennen fehlgeschlagen",
        body: "Die eigene Übung konnte nicht umbenannt werden.",
      });
      return;
    }

    setRenameExerciseState(null);
    refreshCustomExercises();
  }

  function handleArchiveExercise(archived: boolean) {
    if (!archiveExerciseId) {
      return;
    }

    const updated = setCustomExerciseArchived(archiveExerciseId, archived);
    setArchiveExerciseId(null);

    if (!updated) {
      setNoticeState({
        title: archived ? "Archivieren fehlgeschlagen" : "Wiederherstellen fehlgeschlagen",
        body: "Die eigene Übung konnte nicht aktualisiert werden.",
      });
      return;
    }

    if (archived) {
      removeFavoriteExerciseId(updated.id);
    }

    refreshCustomExercises();
  }

  function openExerciseEditor(entry: CustomExerciseLibraryEntry) {
    const defaults = entry.defaults ?? {
      sets: 3,
      minReps: 8,
      maxReps: 12,
      restSeconds: 90,
    };
    setEditExerciseState({
      id: entry.id,
      category: entry.category,
      kind: entry.kind,
      favorite: Boolean(entry.favorite),
      sets: defaults.sets,
      minReps: defaults.minReps,
      maxReps: defaults.maxReps,
      restSeconds: defaults.restSeconds,
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const requestedExerciseId = new URLSearchParams(window.location.search).get(
      "exercise"
    );
    if (requestedExerciseId) {
      setPendingExerciseQuery(requestedExerciseId);
    }
  }, []);

  useEffect(() => {
    if (!pendingExerciseQuery) {
      return;
    }

    const requestedEntry = customExercises.find(
      (entry) => entry.id === pendingExerciseQuery
    );
    if (!requestedEntry) {
      setPendingExerciseQuery(null);
      return;
    }

    if (requestedEntry.archived) {
      setShowArchivedExercises(true);
    }

    openExerciseEditor(requestedEntry);
    setPendingExerciseQuery(null);
  }, [customExercises, pendingExerciseQuery]);

  function handleSaveExerciseDetails() {
    if (!editExerciseState) {
      return;
    }

    const minReps = Math.max(1, Math.round(editExerciseState.minReps));
    const maxReps = Math.max(minReps, Math.round(editExerciseState.maxReps));
    const sets = Math.max(1, Math.round(editExerciseState.sets));
    const restSeconds = Math.max(15, Math.round(editExerciseState.restSeconds));

    const updated = updateCustomExerciseEntry(editExerciseState.id, {
      category: editExerciseState.category,
      kind: editExerciseState.kind,
      favorite: editExerciseState.favorite,
      defaults: {
        sets,
        minReps,
        maxReps,
        restSeconds,
      },
    });

    if (!updated) {
      setNoticeState({
        title: "Speichern fehlgeschlagen",
        body: "Die Übungsdetails konnten nicht gespeichert werden.",
      });
      return;
    }

    setExerciseFavorite(updated.id, editExerciseState.favorite, updated.defaults);
    refreshCustomExercises();
    setEditExerciseState(null);
  }

  function handleNoticeClose() {
    const shouldReload = noticeState?.reloadAfterClose;
    setNoticeState(null);

    if (shouldReload && typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return (
    <AppPageFrame
      activeKey="settings"
      eyebrow="Einstellungen"
      title="App anpassen"
      subtitle="Steuere Menuseite, Trainingshinweise, Theme und deine Daten an einem Ort."
    >
      <section style={sectionCard}>
        <div style={sectionTitle}>Navigation</div>
        <div style={settingRow}>
          <div>
            <div style={settingLabel}>Menuseite</div>
            <div style={settingHint}>
              Lege fest, ob der Drawer links oder rechts oeffnet.
            </div>
          </div>
          <div style={segmentedControl}>
            <button
              style={settings.menuSide === "left" ? segmentActive : segmentButton}
              onClick={() => updateSettings({ menuSide: "left" })}
            >
              Links
            </button>
            <button
              style={settings.menuSide === "right" ? segmentActive : segmentButton}
              onClick={() => updateSettings({ menuSide: "right" })}
            >
              Rechts
            </button>
          </div>
        </div>
      </section>

      <section style={sectionCard}>
        <div style={sectionTitle}>Darstellung</div>
        <ToggleRow
          title="Dark Mode"
          hint="Schaltet die App zwischen heller und dunkler Oberflaeche um."
          checked={settings.themeMode === "dark"}
          onChange={(checked) =>
            updateSettings({ themeMode: checked ? "dark" : "light" })
          }
        />
      </section>

      <section style={sectionCard}>
        <div style={sectionTitle}>Training</div>
        <ToggleRow
          title="10-Sekunden-Ton"
          hint="Spielt kurz vor dem Pausenende einen Hinweis ab."
          checked={settings.getReadyTone}
          onChange={(checked) => updateSettings({ getReadyTone: checked })}
        />
        <ToggleRow
          title="3-2-1 Countdown"
          hint="Zeigt die letzten drei Sekunden gross im Timer an."
          checked={settings.countdownOverlay}
          onChange={(checked) => updateSettings({ countdownOverlay: checked })}
        />
        <ToggleRow
          title="Fortschrittsanimationen"
          hint="Aktiviert den animierten Ring und die sanfte Timer-Bewegung."
          checked={settings.progressAnimations}
          onChange={(checked) => updateSettings({ progressAnimations: checked })}
        />
      </section>

      <section style={sectionCard}>
        <div style={sectionTitle}>Daten</div>
        <div style={settingHint}>
          Sichere deine Daten als Backup-Datei und spiele sie spaeter auf Android oder iPhone wieder ein.
        </div>
        <button style={actionButton} onClick={exportData}>
          Daten exportieren
        </button>
        <button style={ghostButton} onClick={openImportPicker}>
          Daten importieren
        </button>
        <button style={ghostButton} onClick={() => setShowClearWeightConfirm(true)}>
          Gewichtsverlauf loeschen
        </button>
        <button style={ghostButton} onClick={resetPreferences}>
          Einstellungen zuruecksetzen
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFileSelected}
          style={hiddenInput}
        />
      </section>

      <section style={sectionCard}>
        <div style={sectionTitle}>Eigene Übungen</div>
        <div style={settingHint}>
          Verwalte selbst erstellte Übungen zentral. Du kannst sie umbenennen, archivieren und bei Bedarf wieder aktivieren.
        </div>
        {customExercises.filter((entry) => !entry.archived).length === 0 ? (
          <div style={emptyLibraryState}>Noch keine eigenen Übungen gespeichert.</div>
        ) : (
          <div style={exerciseLibraryList}>
            {customExercises
              .filter((entry) => !entry.archived)
              .map((entry) => (
                <div key={entry.id} style={exerciseLibraryRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={exerciseLibraryLabel}>{entry.label}</div>
                    <div style={exerciseLibraryMeta}>
                      {entry.category} · {entry.kind === "compound" ? "Grundübung" : "Isolation"}
                    </div>
                  </div>
                  <div style={exerciseLibraryActions}>
                    <button
                      style={miniGhostButton}
                      onClick={() => openExerciseEditor(entry)}
                    >
                      Bearbeiten
                    </button>
                    <button
                      style={miniGhostButton}
                      onClick={() =>
                        setRenameExerciseState({ id: entry.id, value: entry.label })
                      }
                    >
                      Umbenennen
                    </button>
                    <button
                      style={miniGhostButton}
                      onClick={() => setArchiveExerciseId(entry.id)}
                    >
                      Archivieren
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {editExerciseState ? (
          <div style={exerciseEditorCard}>
            <div style={exerciseEditorTitle}>Eigene Übung bearbeiten</div>
            <div style={exerciseEditorGrid}>
              <label style={fieldLabel}>
                Kategorie
                <select
                  value={editExerciseState.category}
                  onChange={(event) =>
                    setEditExerciseState((current) =>
                      current
                        ? {
                            ...current,
                            category: event.currentTarget
                              .value as CustomExerciseLibraryEntry["category"],
                          }
                        : current
                    )
                  }
                  style={selectStyle}
                >
                  {CUSTOM_EXERCISE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label style={fieldLabel}>
                Art
                <div style={segmentedControl}>
                  <button
                    style={
                      editExerciseState.kind === "compound"
                        ? segmentActive
                        : segmentButton
                    }
                    onClick={() =>
                      setEditExerciseState((current) =>
                        current ? { ...current, kind: "compound" } : current
                      )
                    }
                  >
                    Grundübung
                  </button>
                  <button
                    style={
                      editExerciseState.kind === "isolation"
                        ? segmentActive
                        : segmentButton
                    }
                    onClick={() =>
                      setEditExerciseState((current) =>
                        current ? { ...current, kind: "isolation" } : current
                      )
                    }
                  >
                    Isolation
                  </button>
                </div>
              </label>
            </div>

            <ToggleRow
              title="Favorit"
              hint="Zeigt die Übung direkt in der Schnellwahl beim Hinzufügen."
              checked={editExerciseState.favorite}
              onChange={(checked) =>
                setEditExerciseState((current) =>
                  current ? { ...current, favorite: checked } : current
                )
              }
            />

            <div style={exerciseEditorTitleSmall}>Standardwerte</div>
            <div style={numberGrid}>
              <NumberField
                label="Sätze"
                value={editExerciseState.sets}
                onChange={(value) =>
                  setEditExerciseState((current) =>
                    current ? { ...current, sets: value } : current
                  )
                }
              />
              <NumberField
                label="Min. Wdh."
                value={editExerciseState.minReps}
                onChange={(value) =>
                  setEditExerciseState((current) =>
                    current ? { ...current, minReps: value } : current
                  )
                }
              />
              <NumberField
                label="Max. Wdh."
                value={editExerciseState.maxReps}
                onChange={(value) =>
                  setEditExerciseState((current) =>
                    current ? { ...current, maxReps: value } : current
                  )
                }
              />
              <NumberField
                label="Pause (Sek.)"
                value={editExerciseState.restSeconds}
                onChange={(value) =>
                  setEditExerciseState((current) =>
                    current ? { ...current, restSeconds: value } : current
                  )
                }
              />
            </div>

            <div style={editorActionRow}>
              <button style={ghostButton} onClick={() => setEditExerciseState(null)}>
                Abbrechen
              </button>
              <button style={actionButton} onClick={handleSaveExerciseDetails}>
                Details speichern
              </button>
            </div>
          </div>
        ) : null}

        {customExercises.some((entry) => entry.archived) ? (
          <>
            <button
              style={ghostButton}
              onClick={() => setShowArchivedExercises((current) => !current)}
            >
              {showArchivedExercises ? "Archiv ausblenden" : "Archiv anzeigen"}
            </button>
            {showArchivedExercises ? (
              <div style={exerciseLibraryList}>
                {customExercises
                  .filter((entry) => entry.archived)
                  .map((entry) => (
                    <div key={entry.id} style={exerciseLibraryRowMuted}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={exerciseLibraryLabel}>{entry.label}</div>
                        <div style={exerciseLibraryMeta}>
                          {entry.category} · archiviert
                        </div>
                      </div>
                      <div style={exerciseLibraryActions}>
                        <button
                          style={miniGhostButton}
                          onClick={() => setArchiveExerciseId(entry.id)}
                        >
                          Wiederherstellen
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <ConfirmDialog
        open={showClearWeightConfirm}
        title="Gewichtsverlauf loeschen?"
        body="Der komplette Gewichtsverlauf wird auf diesem Geraet entfernt. Diese Aktion kann nicht rueckgaengig gemacht werden."
        confirmLabel="Loeschen"
        cancelLabel="Abbrechen"
        confirmVariant="danger"
        onCancel={() => setShowClearWeightConfirm(false)}
        onConfirm={clearWeightHistory}
      />

      <NoticeDialog
        open={showWeightClearedNotice}
        title="Verlauf geloescht"
        body="Der Gewichtsverlauf wurde erfolgreich entfernt."
        onClose={() => setShowWeightClearedNotice(false)}
      />

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="Backup importieren?"
        body={
          pendingImport
            ? `Die Datei "${pendingImport.fileName}" ueberschreibt die aktuellen App-Daten auf diesem Geraet. Enthalten: ${pendingImport.preview.summary.workoutSessionCount} Sessions, ${pendingImport.preview.summary.customPlanCount} eigene Plaene, ${pendingImport.preview.summary.customExerciseCount} eigene Uebungen${pendingImport.preview.summary.archivedExerciseCount > 0 ? `, ${pendingImport.preview.summary.archivedExerciseCount} archiviert` : ""}${pendingImport.preview.summary.hasResumeState ? " und ein gespeicherter Fortsetzen-Stand" : ""}.`
            : ""
        }
        confirmLabel="Importieren"
        cancelLabel="Abbrechen"
        onCancel={() => setPendingImport(null)}
        onConfirm={handleImportConfirm}
      />

      <NoticeDialog
        open={Boolean(noticeState)}
        title={noticeState?.title ?? ""}
        body={noticeState?.body ?? ""}
        onClose={handleNoticeClose}
      />

      <TextPromptDialog
        open={Boolean(renameExerciseState)}
        title="Eigene Übung umbenennen"
        body="Die Übungs-ID bleibt erhalten. Verlauf, Vergleiche und Favoriten bleiben deshalb verbunden."
        label="Name"
        value={renameExerciseState?.value ?? ""}
        placeholder="Neuer Übungsname"
        onChange={(value) =>
          setRenameExerciseState((current) =>
            current ? { ...current, value } : current
          )
        }
        onCancel={() => setRenameExerciseState(null)}
        onConfirm={handleRenameExerciseConfirm}
        confirmLabel="Speichern"
        cancelLabel="Abbrechen"
        confirmDisabled={!renameExerciseState?.value.trim()}
      />

      <ConfirmDialog
        open={Boolean(archiveExerciseId)}
        title={
          customExercises.find((entry) => entry.id === archiveExerciseId)?.archived
            ? "Eigene Übung wiederherstellen?"
            : "Eigene Übung archivieren?"
        }
        body={
          customExercises.find((entry) => entry.id === archiveExerciseId)?.archived
            ? "Die Übung wird wieder in Bibliothek und Schnellwahl angezeigt."
            : "Die Übung bleibt für Verlauf und bestehende Pläne erhalten, erscheint aber nicht mehr in der aktiven Bibliothek."
        }
        confirmLabel={
          customExercises.find((entry) => entry.id === archiveExerciseId)?.archived
            ? "Wiederherstellen"
            : "Archivieren"
        }
        cancelLabel="Abbrechen"
        onCancel={() => setArchiveExerciseId(null)}
        onConfirm={() =>
          handleArchiveExercise(
            !(customExercises.find((entry) => entry.id === archiveExerciseId)?.archived ?? false)
          )
        }
      />
    </AppPageFrame>
  );
}

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div style={settingRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={settingLabel}>{title}</div>
        <div style={settingHint}>{hint}</div>
      </div>
      <button
        type="button"
        aria-pressed={checked}
        style={checked ? toggleActive : toggleButton}
        onClick={() => onChange(!checked)}
      >
        <span style={checked ? toggleKnobActive : toggleKnob} />
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={fieldLabel}>
      {label}
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value) || 0)}
        style={numberInput}
      />
    </label>
  );
}

const sectionCard = {
  padding: "16px 14px",
  borderRadius: 26,
  background: appPalette.surface,
  border: `1px solid ${appPalette.borderSoft}`,
  boxShadow: uiTheme.shadow.soft,
  display: "grid",
  gap: 12,
  scrollMarginBottom: "calc(96px + env(safe-area-inset-bottom))",
};

const sectionTitle = {
  fontSize: 20,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const settingRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
};

const settingLabel = {
  fontSize: 16,
  fontWeight: 700,
  color: appPalette.textStrong,
};

const settingHint = {
  marginTop: 4,
  fontSize: 12,
  lineHeight: 1.4,
  color: appPalette.textMuted,
};

const segmentedControl = {
  display: "inline-flex",
  padding: 4,
  borderRadius: 999,
  background: appPalette.surfaceMuted,
  border: `1px solid ${appPalette.borderDefault}`,
  gap: 4,
  flexShrink: 0,
};

const segmentButton = {
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 999,
  background: "transparent",
  color: appPalette.textDefault,
  fontSize: 13,
  fontWeight: 800,
};

const segmentActive = {
  ...segmentButton,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
};

const toggleButton = {
  width: 56,
  height: 34,
  borderRadius: 999,
  background: appPalette.borderDefault,
  padding: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  transition: "all 180ms ease",
  flexShrink: 0,
};

const toggleActive = {
  ...toggleButton,
  background: appPalette.danger,
  justifyContent: "flex-end",
};

const toggleKnob = {
  width: 26,
  height: 26,
  borderRadius: 999,
  background: appPalette.surface,
  boxShadow: `0 6px 12px ${withAlpha(appPalette.surfaceDark, 0.14)}`,
};

const toggleKnobActive = {
  ...toggleKnob,
};

const actionButton = {
  width: "100%",
  minHeight: 54,
  borderRadius: 999,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  fontSize: 16,
  fontWeight: 800,
  boxShadow: `0 16px 28px ${withAlpha(appPalette.surfaceDark, 0.16)}`,
};

const ghostButton = {
  width: "100%",
  minHeight: 50,
  borderRadius: 999,
  background: appPalette.surface,
  color: appPalette.textDefault,
  fontSize: 15,
  fontWeight: 700,
  border: `1px solid ${appPalette.borderDefault}`,
};

const hiddenInput = {
  display: "none",
};

const emptyLibraryState = {
  padding: "14px 12px",
  borderRadius: 18,
  background: appPalette.surfaceMuted,
  color: appPalette.textMuted,
  fontSize: 14,
  fontWeight: 600,
};

const exerciseLibraryList = {
  display: "grid",
  gap: 10,
};

const exerciseLibraryRow = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 12px",
  borderRadius: 18,
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surfaceMuted,
};

const exerciseLibraryRowMuted = {
  ...exerciseLibraryRow,
  background: withAlpha(appPalette.textMuted, 0.08),
};

const exerciseLibraryLabel = {
  fontSize: 15,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const exerciseLibraryMeta = {
  marginTop: 3,
  fontSize: 12,
  fontWeight: 700,
  color: appPalette.textMuted,
};

const exerciseLibraryActions = {
  display: "grid",
  gap: 8,
  justifyItems: "end" as const,
};

const miniGhostButton = {
  minHeight: 36,
  padding: "8px 12px",
  borderRadius: 14,
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 13,
  fontWeight: 800,
};

const exerciseEditorCard = {
  display: "grid",
  gap: 12,
  padding: "14px 12px",
  borderRadius: 20,
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surfaceMuted,
};

const exerciseEditorTitle = {
  fontSize: 16,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const exerciseEditorTitleSmall = {
  fontSize: 13,
  fontWeight: 800,
  color: appPalette.textMuted,
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
};

const exerciseEditorGrid = {
  display: "grid",
  gap: 10,
};

const fieldLabel = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: appPalette.textMuted,
};

const selectStyle = {
  width: "100%",
  minHeight: 48,
  borderRadius: 16,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  padding: "10px 14px",
  fontSize: 15,
  fontWeight: 700,
};

const numberGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const numberInput = {
  width: "100%",
  minHeight: 48,
  borderRadius: 16,
  border: `1px solid ${appPalette.borderDefault}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  padding: "10px 14px",
  fontSize: 15,
  fontWeight: 700,
};

const editorActionRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};
