"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppPageFrame } from "@/components/AppPageFrame";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import {
  getFavoriteExerciseIds,
  setExerciseFavorite,
} from "@/lib/exerciseFavorites";
import {
  getCustomExerciseLibraryEntries,
  setCustomExerciseArchived,
  type CustomExerciseLibraryEntry,
} from "@/lib/exerciseLibrary";
import { appPalette, withAlpha } from "@/lib/theme";
import { getSuggestedExerciseSetup } from "@/lib/trainingCatalog";
import { getExercisePlanUsage, type ExercisePlanUsage } from "@/lib/trainingPlans";
import {
  getBestSetInsightForExercise,
  getCoachDecisionForRange,
  getRecentSessionsForExercise,
  getExerciseTrendInsight,
  type BestSetInsight,
  type SetType,
} from "@/lib/workoutEngine";
import {
  getExerciseLibraryGroupsWithOptions,
  getExerciseMeta,
} from "@/lib/workoutUi";

type ScopeFilter = "all" | "favorites" | "custom" | "system" | "archived";

type LibraryItem = {
  value: string;
  label: string;
  category: string;
};

export default function ExerciseLibraryPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    getFavoriteExerciseIds()
  );
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedRecentSessions, setSelectedRecentSessions] = useState<SetType[][]>([]);
  const [selectedBestInsight, setSelectedBestInsight] = useState<BestSetInsight>({
    set: null,
    label: null,
    detail: null,
    sampleCount: 0,
  });
  const [selectedPlanUsage, setSelectedPlanUsage] = useState<ExercisePlanUsage[]>([]);
  const [customEntries, setCustomEntries] = useState<CustomExerciseLibraryEntry[]>(
    () => getCustomExerciseLibraryEntries({ includeArchived: true })
  );
  const archivedCount = customEntries.filter((entry) => entry.archived).length;
  const activeCustomCount = customEntries.filter((entry) => !entry.archived).length;

  function refreshCustomEntries() {
    setCustomEntries(getCustomExerciseLibraryEntries({ includeArchived: true }));
  }

  const groups = useMemo(() => {
    const search = query.trim().toLowerCase();
    return getExerciseLibraryGroupsWithOptions({
      includeArchived: scope === "archived",
    })
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const isCustom = item.value.startsWith("custom:");
          const customEntry = isCustom
            ? customEntries.find((entry) => entry.id === item.value) ?? null
            : null;
          const isArchived = Boolean(customEntry?.archived);
          if (scope === "favorites" && !favoriteIds.includes(item.value)) {
            return false;
          }
          if (scope === "custom" && !isCustom) {
            return false;
          }
          if (scope === "system" && isCustom) {
            return false;
          }
          if (scope === "archived" && !isArchived) {
            return false;
          }
          if (scope !== "archived" && isArchived) {
            return false;
          }
          if (!search) {
            return true;
          }

          const meta = getExerciseMeta(item.value);
          return (
            item.label.toLowerCase().includes(search) ||
            group.category.toLowerCase().includes(search) ||
            meta?.id?.toLowerCase().includes(search)
          );
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [customEntries, favoriteIds, query, scope]);

  const visibleGroups = showAllGroups ? groups : groups.slice(0, 6);
  const totalVisibleExercises = groups.reduce(
    (sum, group) => sum + group.items.length,
    0
  );

  const selectedExercise = useMemo<LibraryItem | null>(() => {
    if (!selectedExerciseId) {
      return null;
    }

    return (
      groups
        .flatMap((group) =>
          group.items.map((item) => ({
            ...item,
            category: group.category,
          }))
        )
        .find((item) => item.value === selectedExerciseId) ??
      null
    );
  }, [groups, selectedExerciseId]);

  useEffect(() => {
    if (selectedExerciseId && selectedExercise) {
      return;
    }

    const fallback = groups[0]?.items[0]?.value ?? null;
    setSelectedExerciseId(fallback);
  }, [groups, selectedExercise, selectedExerciseId]);

  useEffect(() => {
    async function loadExerciseDetails() {
      if (!selectedExercise) {
        setSelectedRecentSessions([]);
        setSelectedBestInsight({
          set: null,
          label: null,
          detail: null,
          sampleCount: 0,
        });
        setSelectedPlanUsage([]);
        return;
      }

      const [recentSessions, bestInsight] = await Promise.all([
        getRecentSessionsForExercise(
          selectedExercise.label,
          0,
          undefined,
          selectedExercise.value,
          "workset",
          3
        ),
        getBestSetInsightForExercise(
          selectedExercise.label,
          undefined,
          selectedExercise.value
        ),
      ]);

      setSelectedRecentSessions(recentSessions);
      setSelectedBestInsight(bestInsight);
      setSelectedPlanUsage(getExercisePlanUsage(selectedExercise.value));
    }

    void loadExerciseDetails();
  }, [selectedExercise]);

  function toggleFavorite(item: Pick<LibraryItem, "value" | "label">) {
    const nextFavorite = !favoriteIds.includes(item.value);
    const defaults = getSuggestedExerciseSetup(item.value);
    const reference = setExerciseFavorite(item.value, nextFavorite, defaults);
    if (!reference) {
      return;
    }

    setFavoriteIds((current) =>
      nextFavorite
        ? Array.from(new Set([...current, reference]))
        : current.filter((value) => value !== reference)
    );
  }

  function toggleArchive(item: Pick<LibraryItem, "value">, archived: boolean) {
    const updated = setCustomExerciseArchived(item.value, archived);
    if (!updated) {
      return;
    }

    if (archived) {
      setExerciseFavorite(item.value, false);
      setFavoriteIds((current) => current.filter((value) => value !== item.value));
    }

    refreshCustomEntries();
  }

  return (
    <AppPageFrame
      activeKey="exercises"
      eyebrow="Bibliothek"
      title="Deine Übungen"
      subtitle="Alle System- und eigenen Übungen an einem Ort. Suche, filtere und springe direkt in die Verwaltung."
      actions={
        <Link href="/settings/index.html" style={manageLink}>
          Verwalten
        </Link>
      }
    >
      <div style={heroStats}>
        <MetricCard label="Aktiv" value={totalVisibleExercises} />
        <MetricCard label="Favoriten" value={favoriteIds.length} />
        <MetricCard label="Eigene" value={activeCustomCount} />
        <MetricCard label="Archiv" value={archivedCount} />
      </div>

      {selectedExercise ? (
        <ExerciseDetailCard
          exercise={selectedExercise}
          favorite={favoriteIds.includes(selectedExercise.value)}
          bestInsight={selectedBestInsight}
          recentSessions={selectedRecentSessions}
          planUsage={selectedPlanUsage}
          customEntry={
            selectedExercise.value.startsWith("custom:")
              ? customEntries.find((entry) => entry.id === selectedExercise.value) ?? null
              : null
          }
          onToggleFavorite={() => toggleFavorite(selectedExercise)}
          onToggleArchive={(archived) => toggleArchive(selectedExercise, archived)}
        />
      ) : null}

      <AppCard style={controlCard}>
        <input
          type="search"
          value={query}
          placeholder="Übung oder Kategorie suchen"
          onChange={(event) => setQuery(event.currentTarget.value)}
          style={searchInput}
        />

        <div style={filterRow}>
          {[
            { key: "all", label: "Alle" },
            { key: "favorites", label: "Favoriten" },
            { key: "custom", label: "Eigene" },
            { key: "system", label: "System" },
            { key: "archived", label: "Archiv" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              style={scope === item.key ? filterButtonActive : filterButton}
              onClick={() => setScope(item.key as ScopeFilter)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {archivedCount > 0 ? (
          <div style={archivedHint}>
            {archivedCount} archivierte eigene Übungen kannst du in den Einstellungen wiederherstellen.
          </div>
        ) : null}
      </AppCard>

      {visibleGroups.length === 0 ? (
        <AppCard style={emptyCard}>
          Zu deiner Suche oder dem aktuellen Filter wurden keine Übungen gefunden.
        </AppCard>
      ) : null}

      {visibleGroups.map((group) => (
        <AppCard key={group.category} style={groupCard}>
          <div style={groupHeader}>
            <div style={groupTitle}>{group.category}</div>
            <AppBadge variant="template">{group.items.length}</AppBadge>
          </div>

          <div style={exerciseList}>
            {group.items.map((item) => {
              const meta = getExerciseMeta(item.value);
              const setup = getSuggestedExerciseSetup(item.value);
              const isFavorite = favoriteIds.includes(item.value);
              const isCustom = item.value.startsWith("custom:");
              const customEntry = isCustom
                ? customEntries.find((entry) => entry.id === item.value) ?? null
                : null;
              const isArchived = Boolean(customEntry?.archived);

              return (
                <button
                  key={item.value}
                  type="button"
                  style={
                    selectedExerciseId === item.value ? exerciseRowActive : exerciseRow
                  }
                  onClick={() => setSelectedExerciseId(item.value)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={exerciseLabelRow}>
                      <span style={exerciseLabel}>{item.label}</span>
                      <div style={exerciseBadgeRow}>
                        {isFavorite ? <AppBadge variant="better">Favorit</AppBadge> : null}
                        {isCustom ? <AppBadge variant="exercise">Eigen</AppBadge> : null}
                        {isArchived ? <AppBadge variant="worse">Archiviert</AppBadge> : null}
                        {meta?.kind === "compound" ? (
                          <AppBadge variant="template">Grundübung</AppBadge>
                        ) : meta?.kind === "isolation" ? (
                          <AppBadge variant="stretch">Isolation</AppBadge>
                        ) : null}
                      </div>
                    </div>
                    <div style={exerciseMeta}>
                      {setup.sets} Sätze · {setup.minReps}-{setup.maxReps} Wdh. ·{" "}
                      {setup.restSeconds} Sek. Pause
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      ...rowFavoriteButton,
                      ...(isArchived ? disabledRowFavoriteButton : null),
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFavorite(item);
                    }}
                    disabled={isArchived}
                  >
                    {isFavorite ? "★" : "☆"}
                  </button>
                </button>
              );
            })}
          </div>
        </AppCard>
      ))}

      {groups.length > 6 ? (
        <AppButton
          block
          variant="secondary"
          style={moreButton}
          onClick={() => setShowAllGroups((current) => !current)}
        >
          {showAllGroups ? "Weniger Kategorien anzeigen" : "Weitere Kategorien anzeigen"}
        </AppButton>
      ) : null}
    </AppPageFrame>
  );
}

function ExerciseDetailCard({
  exercise,
  favorite,
  bestInsight,
  recentSessions,
  planUsage,
  customEntry,
  onToggleFavorite,
  onToggleArchive,
}: {
  exercise: LibraryItem;
  favorite: boolean;
  bestInsight: BestSetInsight;
  recentSessions: SetType[][];
  planUsage: ExercisePlanUsage[];
  customEntry: CustomExerciseLibraryEntry | null;
  onToggleFavorite: () => void;
  onToggleArchive: (archived: boolean) => void;
}) {
  const meta = getExerciseMeta(exercise.value);
  const setup = getSuggestedExerciseSetup(exercise.value);
  const recentWorkSets = recentSessions.flat();
  const coach = getCoachDecisionForRange(
    recentWorkSets,
    setup.minReps,
    setup.maxReps
  );
  const trendInsight = getExerciseTrendInsight(recentSessions);

  return (
    <AppCard style={detailCard}>
      <div style={detailHeader}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={detailTitle}>{exercise.label}</div>
          <div style={detailMetaRow}>
            <AppBadge variant={exercise.value.startsWith("custom:") ? "exercise" : "template"}>
              {exercise.value.startsWith("custom:") ? "Eigen" : "System"}
            </AppBadge>
            <AppBadge variant={meta?.kind === "compound" ? "template" : "stretch"}>
              {meta?.kind === "compound" ? "Grundübung" : "Isolation"}
            </AppBadge>
            <AppBadge variant="template">{meta?.category ?? exercise.category}</AppBadge>
          </div>
        </div>
        <button
          type="button"
          style={{
            ...favoritePillButton,
            ...(customEntry?.archived ? disabledFavoritePillButton : null),
          }}
          onClick={onToggleFavorite}
          disabled={Boolean(customEntry?.archived)}
        >
          {favorite ? "★ Favorit" : "☆ Favorit"}
        </button>
      </div>

      <div style={detailMetricGrid}>
        <MetricCard label="Standard" value={`${setup.sets} Sätze`} />
        <MetricCard label="Range" value={`${setup.minReps}-${setup.maxReps}`} />
        <MetricCard label="Pause" value={`${setup.restSeconds}s`} />
      </div>

      {exercise.value.startsWith("custom:") ? (
        <div style={detailActionRow}>
          <Link
            href={`/settings/index.html?exercise=${encodeURIComponent(exercise.value)}`}
            style={detailActionLink}
          >
            Eigene Uebung bearbeiten
          </Link>
        </div>
      ) : null}

      {exercise.value.startsWith("custom:") ? (
        <div style={detailActionRow}>
          <button
            type="button"
            style={detailSecondaryAction}
            onClick={() => onToggleArchive(!(customEntry?.archived ?? false))}
          >
            {customEntry?.archived ? "Wieder aktivieren" : "Archivieren"}
          </button>
        </div>
      ) : null}

      {customEntry?.archived ? (
        <div style={archivedStateBanner}>
          Diese eigene Übung ist archiviert. Sie bleibt in Verlauf und bestehenden Plänen erhalten,
          erscheint aber nicht mehr in der aktiven Bibliothek oder Schnellwahl.
        </div>
      ) : null}

      <div style={detailSection}>
        <div style={detailSectionTitle}>In Plänen verwendet</div>
        {planUsage.length === 0 ? (
          <div style={detailCopy}>
            Diese Übung ist aktuell noch in keinem Trainingstag eingeplant.
          </div>
        ) : (
          <div style={usageList}>
            {planUsage.map((usage) => (
              <Link
                key={`${usage.planId}:${usage.dayId}`}
                href={`/index.html?sheet=exercises&plan=${encodeURIComponent(
                  usage.planId
                )}&day=${encodeURIComponent(usage.dayId)}`}
                style={usageCardLink}
              >
                <div style={usageTitleRow}>
                  <span style={usagePlanName}>{usage.planName}</span>
                  <AppBadge variant="template">{usage.dayName}</AppBadge>
                </div>
                <div style={usageMeta}>
                  {usage.blockCount > 1
                    ? `${usage.blockCount}x in diesem Tag`
                    : "1x in diesem Tag"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={detailSection}>
        <div style={detailSectionTitle}>Coach</div>
        <div style={detailCoachLine}>
          {coach.label} · {coach.detail}
        </div>
        {trendInsight.recentTopSets.length > 0 ? (
          <div style={trendChipRow}>
            {trendInsight.recentTopSets.map((set, index) => (
              <span key={`${exercise.value}-trend-${set.timestamp}-${index}`} style={trendChip}>
                {index === 0 ? "Aktuell " : `${index + 1}. `}
                {set.weight} kg × {set.reps}
              </span>
            ))}
          </div>
        ) : null}
        <div style={detailCopy}>
          {trendInsight.label} · {trendInsight.detail}
        </div>
      </div>

      <div style={detailSection}>
        <div style={detailSectionTitle}>Bestleistung</div>
        {bestInsight.set ? (
          <>
            <div style={detailHighlight}>
              {bestInsight.set.weight} kg × {bestInsight.set.reps}
            </div>
            <div style={detailCopy}>
              {bestInsight.label} · {bestInsight.detail}
            </div>
          </>
        ) : (
          <div style={detailCopy}>Noch keine Arbeitssätze gespeichert.</div>
        )}
      </div>

      <div style={detailSection}>
        <div style={detailSectionTitle}>Letzte Einheiten</div>
        {recentSessions.length === 0 ? (
          <div style={detailCopy}>
            Zu dieser Übung gibt es noch keine gespeicherte Historie.
          </div>
        ) : (
          <div style={sessionList}>
            {recentSessions.map((session, index) => (
              <div key={`${exercise.value}-${index}`} style={sessionCard}>
                <div style={sessionTitle}>
                  {index === 0 ? "Letzte Einheit" : `${index + 1}. letzte Einheit`}
                </div>
                <div style={sessionDate}>
                  {new Date(session[0]?.timestamp ?? 0).toLocaleDateString("de-DE")}
                </div>
                <div style={sessionRows}>
                  {session.map((set) => (
                    <div key={`${exercise.value}-${set.timestamp}-${set.set}`} style={sessionRow}>
                      <span style={sessionRowLabel}>Satz {set.set}</span>
                      <span style={sessionRowValue}>
                        {set.weight} kg × {set.reps}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppCard>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <AppCard style={metricCard}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
    </AppCard>
  );
}

function getTopSessionSet(session: SetType[]) {
  if (session.length === 0) {
    return null;
  }

  return session.reduce((best, current) => {
    if (current.weight > best.weight) {
      return current;
    }

    if (current.weight === best.weight && current.reps > best.reps) {
      return current;
    }

    return best;
  }, session[0]);
}

function formatExerciseTrend(current: SetType | null, previous: SetType | null) {
  if (!current && !previous) {
    return "Noch keine Trenddaten vorhanden.";
  }

  if (current && !previous) {
    return "Erste gespeicherte Einheit für diese Übung.";
  }

  if (!current || !previous) {
    return "Trend wird aufgebaut.";
  }

  const weightDelta = current.weight - previous.weight;
  const repsDelta = current.reps - previous.reps;

  if (weightDelta === 0 && repsDelta === 0) {
    return "Top-Set gleich zur vorherigen Einheit.";
  }

  const parts: string[] = [];
  if (weightDelta !== 0) {
    parts.push(`${weightDelta > 0 ? "+" : ""}${weightDelta} kg`);
  }
  if (repsDelta !== 0) {
    parts.push(`${repsDelta > 0 ? "+" : ""}${repsDelta} Wdh.`);
  }

  return `${parts.join(" · ")} zum letzten Top-Set.`;
}

const manageLink = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 36,
  padding: "0 14px",
  borderRadius: 999,
  background: appPalette.surface,
  border: `1px solid ${appPalette.borderSoft}`,
  color: appPalette.textStrong,
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
};

const heroStats = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
};

const metricCard = {
  padding: "12px 12px",
  display: "grid",
  gap: 4,
};

const metricLabel = {
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: appPalette.textMuted,
};

const metricValue = {
  fontSize: 24,
  lineHeight: 1,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const detailCard = {
  padding: "16px 14px",
  display: "grid",
  gap: 14,
};

const detailActionRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 10,
};

const detailActionLink = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  padding: "0 14px",
  borderRadius: 14,
  background: withAlpha(appPalette.success, 0.12),
  border: `1px solid ${withAlpha(appPalette.success, 0.22)}`,
  color: appPalette.success,
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
};

const detailSecondaryAction = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  padding: "0 14px",
  borderRadius: 14,
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 13,
  fontWeight: 800,
};

const archivedStateBanner = {
  padding: "12px 14px",
  borderRadius: 16,
  background: withAlpha(appPalette.warning, 0.1),
  border: `1px solid ${withAlpha(appPalette.warning, 0.26)}`,
  color: appPalette.warning,
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 700,
};

const detailHeader = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
};

const detailTitle = {
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const detailMetaRow = {
  marginTop: 10,
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
};

const favoritePillButton = {
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 999,
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surfaceMuted,
  color: appPalette.textStrong,
  fontSize: 13,
  fontWeight: 800,
  flexShrink: 0,
};

const disabledFavoritePillButton = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const detailMetricGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const detailSection = {
  display: "grid",
  gap: 8,
};

const usageList = {
  display: "grid",
  gap: 8,
};

const usageCard = {
  display: "grid",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 14,
  background: appPalette.surface,
  border: `1px solid ${appPalette.borderSoft}`,
};

const usageCardLink = {
  ...usageCard,
  textDecoration: "none",
};

const usageTitleRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap" as const,
};

const usagePlanName = {
  fontSize: 14,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const usageMeta = {
  fontSize: 12,
  color: appPalette.textMuted,
};

const detailSectionTitle = {
  fontSize: 13,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  fontWeight: 800,
  color: appPalette.textMuted,
};

const detailHighlight = {
  fontSize: 28,
  lineHeight: 1,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const detailCopy = {
  fontSize: 14,
  lineHeight: 1.45,
  color: appPalette.textDefault,
  fontWeight: 700,
};

const detailCoachLine = {
  fontSize: 15,
  lineHeight: 1.45,
  color: appPalette.textStrong,
  fontWeight: 800,
};

const trendChipRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const trendChip = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "4px 10px",
  borderRadius: 999,
  background: appPalette.surfaceMuted,
  border: `1px solid ${appPalette.borderSoft}`,
  color: appPalette.textDefault,
  fontSize: 12,
  fontWeight: 700,
};

const sessionList = {
  display: "grid",
  gap: 10,
};

const sessionCard = {
  padding: "12px 12px",
  borderRadius: 18,
  background: appPalette.surfaceMuted,
  border: `1px solid ${appPalette.borderSoft}`,
  display: "grid",
  gap: 8,
};

const sessionTitle = {
  fontSize: 15,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const sessionDate = {
  fontSize: 12,
  fontWeight: 700,
  color: appPalette.textMuted,
};

const sessionRows = {
  display: "grid",
  gap: 6,
};

const sessionRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 13,
};

const sessionRowLabel = {
  color: appPalette.textMuted,
  fontWeight: 700,
};

const sessionRowValue = {
  color: appPalette.textStrong,
  fontWeight: 800,
};

const controlCard = {
  padding: "14px 14px",
  display: "grid",
  gap: 12,
};

const searchInput = {
  width: "100%",
  minHeight: 52,
  borderRadius: 18,
  border: `1px solid ${appPalette.borderDefault}`,
  padding: "0 16px",
  fontSize: 16,
  fontWeight: 700,
  color: appPalette.textStrong,
  background: appPalette.surface,
};

const filterRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const filterButton = {
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 999,
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surface,
  color: appPalette.textDefault,
  fontSize: 13,
  fontWeight: 800,
};

const filterButtonActive = {
  ...filterButton,
  background: appPalette.surfaceDark,
  color: appPalette.surface,
  borderColor: withAlpha(appPalette.surfaceDark, 0.3),
};

const archivedHint = {
  fontSize: 13,
  lineHeight: 1.45,
  color: appPalette.textMuted,
  fontWeight: 700,
};

const emptyCard = {
  padding: "18px 16px",
  color: appPalette.textMuted,
  fontSize: 15,
};

const groupCard = {
  padding: "14px 14px",
  display: "grid",
  gap: 12,
};

const groupHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const groupTitle = {
  fontSize: 18,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const exerciseList = {
  display: "grid",
  gap: 10,
};

const exerciseRow = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "12px 12px",
  borderRadius: 18,
  background: appPalette.surfaceMuted,
  border: `1px solid ${appPalette.borderSoft}`,
  width: "100%",
  textAlign: "left" as const,
};

const exerciseRowActive = {
  ...exerciseRow,
  border: `1px solid ${withAlpha(appPalette.surfaceDark, 0.22)}`,
  boxShadow: `0 14px 24px ${withAlpha(appPalette.surfaceDark, 0.08)}`,
};

const exerciseLabelRow = {
  display: "grid",
  gap: 6,
};

const exerciseLabel = {
  fontSize: 16,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const exerciseBadgeRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
};

const exerciseMeta = {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.45,
  color: appPalette.textMuted,
  fontWeight: 700,
};

const rowFavoriteButton = {
  width: 38,
  height: 38,
  borderRadius: 999,
  border: `1px solid ${appPalette.borderSoft}`,
  background: appPalette.surface,
  color: appPalette.textStrong,
  fontSize: 18,
  fontWeight: 800,
  flexShrink: 0,
};

const disabledRowFavoriteButton = {
  opacity: 0.45,
  cursor: "not-allowed",
};

const moreButton = {
  width: "100%",
  minHeight: 50,
};
