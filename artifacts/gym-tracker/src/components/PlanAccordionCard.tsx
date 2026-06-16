

import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import type { TrainingPlan } from "@/lib/trainingPlans";
import { appPalette, getSplitTheme, splitThemes, uiTheme, withAlpha } from "@/lib/theme";

type PlanAccordionCardProps = {
  plan: TrainingPlan;
  subtitle: string;
  isActive: boolean;
  isCustom: boolean;
  expanded: boolean;
  canDelete: boolean;
  startHref?: string;
  dayPreviews: Array<{
    id: string;
    name: string;
    color: string;
    preview: string;
  }>;
  onToggle: () => void;
  onUse: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function PlanAccordionCard({
  plan,
  subtitle,
  isActive,
  isCustom,
  expanded,
  canDelete,
  startHref,
  dayPreviews,
  onToggle,
  onUse,
  onEdit,
  onDuplicate,
  onDelete,
}: PlanAccordionCardProps) {
  const theme = getPlanCardTheme(plan, isCustom);

  return (
    <AppCard
      variant={expanded ? "theme" : "default"}
      accentColor={theme.primary}
      interactive
      style={{
        ...card,
        borderColor: expanded
          ? withAlpha(theme.primary, 0.24)
          : isActive
          ? withAlpha(theme.primary, 0.18)
          : appPalette.borderSoft,
        background: expanded
          ? `linear-gradient(180deg, ${theme.soft} 0%, ${withAlpha(appPalette.surface, 0.98)} 100%)`
          : isActive
          ? `linear-gradient(180deg, ${withAlpha(theme.primary, 0.04)} 0%, ${withAlpha(appPalette.surface, 0.98)} 100%)`
          : appPalette.surface,
        boxShadow: expanded
          ? `0 22px 42px ${theme.shadow}`
          : isActive
          ? `0 18px 34px ${withAlpha(theme.primary, 0.12)}`
          : `0 14px 28px ${withAlpha(appPalette.surfaceDark, 0.06)}`,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        style={{
          ...cardToggle,
          background: expanded
            ? `linear-gradient(180deg, ${theme.soft} 0%, ${withAlpha(appPalette.surface, 0.96)} 100%)`
            : isActive
            ? `linear-gradient(180deg, ${withAlpha(theme.primary, 0.035)} 0%, ${appPalette.surface} 100%)`
            : appPalette.surface,
        }}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        <div style={cardHeader}>
          <div style={cardHeaderLeft}>
            <div
              style={{
                ...accentRail,
                background: theme.primary,
                boxShadow: `0 8px 18px ${withAlpha(theme.primary, 0.24)}`,
              }}
            />
            <div style={cardHeaderText}>
              <div style={cardName}>{plan.name}</div>
              <div style={cardSubtitle}>{subtitle}</div>
            </div>
          </div>
          <div style={cardHeaderRight}>
            {isActive ? <AppBadge variant="active">Aktiv</AppBadge> : null}
            <AppBadge variant={isCustom ? "custom" : "template"}>
              {isCustom ? "Eigener Plan" : "Vorlage"}
            </AppBadge>
            <button
              type="button"
              style={{
                ...deleteButton,
                ...(canDelete ? null : deleteButtonDisabled),
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (!canDelete) {
                  return;
                }
                onDelete();
              }}
              aria-label={`Plan ${plan.name} löschen`}
              title={canDelete ? "Löschen" : "Vorlage kann nicht gelöscht werden"}
              disabled={!canDelete}
            >
              X
            </button>
            <span
              style={{
                ...chevron,
                color: theme.primary,
                background: withAlpha(theme.primary, 0.08),
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ›
            </span>
          </div>
        </div>
      </div>

      {expanded ? (
        <div style={expandedContent}>
          <div style={dayList}>
            {dayPreviews.map((day) => (
              <div key={day.id} style={dayRow}>
                <div style={dayRowTop}>
                  <div style={dayRowLeft}>
                    <span
                      style={{
                        ...dayDot,
                        background: day.color,
                      }}
                    />
                    <span style={dayName}>{day.name}</span>
                  </div>
                </div>
                <div style={dayPreview}>{day.preview || "Noch keine Übungen"}</div>
              </div>
            ))}
          </div>

          <div style={actionRow}>
            {!isActive ? (
              <AppButton
                variant="primary"
                onClick={(event) => {
                  event.stopPropagation();
                  onUse();
                }}
              >
                Verwenden
              </AppButton>
            ) : null}

            {isCustom ? (
              <AppButton
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
              >
                Bearbeiten
              </AppButton>
            ) : null}

            <AppButton
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation();
                onDuplicate();
              }}
            >
              Kopie
            </AppButton>

            {isActive && startHref ? (
              <AppButton
                href={startHref}
                variant="secondary"
                style={startAction}
                onClick={(event) => event.stopPropagation()}
              >
                Starten
              </AppButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </AppCard>
  );
}

function getPlanCardTheme(plan: TrainingPlan, isCustom: boolean) {
  const name = plan.name.toLowerCase();
  const firstDayColor = plan.days[0]?.color ?? plan.accent;

  if (isCustom) {
    return {
      primary: appPalette.surfaceDark,
      soft: withAlpha(appPalette.danger, 0.08),
      shadow: withAlpha(appPalette.surfaceDark, 0.12),
    };
  }

  if (name.includes("2er")) {
    return {
      primary: splitThemes.pull.primary,
      soft: withAlpha(splitThemes.pull.primary, 0.08),
      shadow: withAlpha(splitThemes.pull.primary, 0.14),
    };
  }

  if (name.includes("3er")) {
    return {
      primary: splitThemes.warmup.primary,
      soft: withAlpha(splitThemes.warmup.primary, 0.08),
      shadow: withAlpha(splitThemes.warmup.primary, 0.14),
    };
  }

  if (name.includes("push pull legs")) {
    const pushTheme = getSplitTheme("push");
    return {
      primary: pushTheme.primary,
      soft: withAlpha(pushTheme.primary, 0.08),
      shadow: withAlpha(pushTheme.primary, 0.14),
    };
  }

  return {
    primary: firstDayColor || splitThemes.pull.primary,
    soft: withAlpha(firstDayColor || splitThemes.pull.primary, 0.08),
    shadow: withAlpha(firstDayColor || splitThemes.pull.primary, 0.14),
  };
}

const card = {
  borderRadius: uiTheme.radius.large - 4,
  border: `1.5px solid ${appPalette.borderSoft}`,
  background: appPalette.surface,
  overflow: "hidden" as const,
  boxShadow: `0 14px 28px ${withAlpha(appPalette.surfaceDark, 0.06)}`,
};

const cardToggle = {
  width: "100%",
  border: "none",
  display: "grid",
  gap: 16,
  textAlign: "left" as const,
  padding: "20px 20px 16px",
  cursor: "pointer",
  transition: `background ${uiTheme.motion.quick}`,
};

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
};

const cardHeaderLeft = {
  display: "flex",
  gap: 12,
  minWidth: 0,
  flex: 1,
};

const accentRail = {
  width: 6,
  minWidth: 6,
  borderRadius: 999,
};

const cardHeaderText = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const cardName = {
  fontSize: 28,
  fontWeight: 850,
  color: appPalette.textStrong,
  lineHeight: 1.02,
};

const cardSubtitle = {
  fontSize: 14,
  fontWeight: 700,
  color: appPalette.textMuted,
  lineHeight: 1.4,
};

const cardHeaderRight = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap" as const,
  justifyContent: "flex-end",
};

const deleteButton = {
  width: 34,
  minWidth: 34,
  height: 34,
  borderRadius: 999,
  border: `1px solid ${withAlpha(appPalette.danger, 0.34)}`,
  background: withAlpha(appPalette.danger, 0.08),
  color: appPalette.danger,
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const deleteButtonDisabled = {
  opacity: 0.4,
  cursor: "not-allowed",
};

const chevron = {
  width: 34,
  minWidth: 34,
  height: 34,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
  transition: `transform ${uiTheme.motion.quick}, background ${uiTheme.motion.quick}`,
};

const expandedContent = {
  display: "grid",
  gap: 16,
  padding: "0 20px 20px",
  animation: "codex-fade-in 180ms ease",
};

const dayList = {
  display: "grid",
  gap: 12,
};

const dayRow = {
  borderRadius: 20,
  background: appPalette.surfaceMuted,
  border: `1px solid ${appPalette.borderDefault}`,
  padding: "14px 15px",
  display: "grid",
  gap: 6,
};

const dayRowTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const dayRowLeft = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const dayDot = {
  width: 11,
  height: 11,
  borderRadius: 999,
  boxShadow: `0 4px 10px ${withAlpha(appPalette.surfaceDark, 0.12)}`,
};

const dayName = {
  fontSize: 15,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const dayPreview = {
  fontSize: 14,
  lineHeight: 1.5,
  color: appPalette.textMuted,
};

const actionRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 10,
};

const startAction = {
  border: `1px solid ${withAlpha(appPalette.success, 0.2)}`,
  background: withAlpha(appPalette.success, 0.08),
  color: appPalette.success,
};
