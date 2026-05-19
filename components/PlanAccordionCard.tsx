"use client";

import type { TrainingPlan } from "@/lib/trainingPlans";

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
    <div
      style={{
        ...card,
        borderColor: expanded ? theme.primary : "#e5ebf4",
        boxShadow: expanded
          ? `0 22px 42px ${theme.shadow}`
          : "0 14px 28px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        style={{
          ...cardToggle,
          background: expanded
            ? `linear-gradient(180deg, ${theme.soft} 0%, rgba(255,255,255,0.96) 100%)`
            : "#ffffff",
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
              }}
            />
            <div style={cardHeaderText}>
              <div style={cardName}>{plan.name}</div>
              <div style={cardSubtitle}>{subtitle}</div>
            </div>
          </div>
          <div style={cardHeaderRight}>
            {isActive ? <span style={activeBadge}>Aktiv</span> : null}
            <span style={isCustom ? customBadge : templateBadge}>
              {isCustom ? "Eigener Plan" : "Vorlage"}
            </span>
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
              aria-label={`Plan ${plan.name} loeschen`}
              title={canDelete ? "Loeschen" : "Vorlage kann nicht geloescht werden"}
              disabled={!canDelete}
            >
              X
            </button>
            <span style={{ ...chevron, color: theme.primary }}>{expanded ? "^" : "v"}</span>
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
                <div style={dayPreview}>{day.preview || "Noch keine Uebungen"}</div>
              </div>
            ))}
          </div>

          <div style={actionRow}>
            {!isActive ? (
              <button
                type="button"
                style={primaryAction}
                onClick={(event) => {
                  event.stopPropagation();
                  onUse();
                }}
              >
                Verwenden
              </button>
            ) : null}

            {isCustom ? (
              <button
                type="button"
                style={secondaryAction}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
              >
                Bearbeiten
              </button>
            ) : null}

            <button
              type="button"
              style={secondaryAction}
              onClick={(event) => {
                event.stopPropagation();
                onDuplicate();
              }}
            >
              Kopie
            </button>

            {isActive && startHref ? (
              <a
                href={startHref}
                style={startAction}
                onClick={(event) => event.stopPropagation()}
              >
                Starten
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getPlanCardTheme(plan: TrainingPlan, isCustom: boolean) {
  const name = plan.name.toLowerCase();
  const firstDayColor = plan.days[0]?.color ?? plan.accent;

  if (isCustom) {
    return {
      primary: "#111827",
      soft: "rgba(239, 68, 68, 0.08)",
      shadow: "rgba(17, 24, 39, 0.12)",
    };
  }

  if (name.includes("2er")) {
    return {
      primary: "#7c3aed",
      soft: "rgba(124, 58, 237, 0.08)",
      shadow: "rgba(124, 58, 237, 0.14)",
    };
  }

  if (name.includes("3er")) {
    return {
      primary: "#ea580c",
      soft: "rgba(234, 88, 12, 0.08)",
      shadow: "rgba(234, 88, 12, 0.14)",
    };
  }

  if (name.includes("push pull legs")) {
    return {
      primary: "#dc2626",
      soft: "rgba(220, 38, 38, 0.08)",
      shadow: "rgba(220, 38, 38, 0.14)",
    };
  }

  return {
    primary: firstDayColor || "#2563eb",
    soft: hexToRgba(firstDayColor || "#2563eb", 0.08),
    shadow: hexToRgba(firstDayColor || "#2563eb", 0.14),
  };
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  if (value.length !== 6) {
    return `rgba(37, 99, 235, ${alpha})`;
  }

  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const card = {
  borderRadius: 24,
  border: "1.5px solid #e5ebf4",
  background: "#ffffff",
  overflow: "hidden" as const,
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.06)",
};

const cardToggle = {
  width: "100%",
  border: "none",
  display: "grid",
  gap: 16,
  textAlign: "left" as const,
  padding: "20px 20px 16px",
  cursor: "pointer",
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
  color: "#111827",
  lineHeight: 1.02,
};

const cardSubtitle = {
  fontSize: 14,
  fontWeight: 700,
  color: "#64748b",
  lineHeight: 1.4,
};

const cardHeaderRight = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap" as const,
  justifyContent: "flex-end",
};

const activeBadge = {
  minHeight: 34,
  padding: "0 14px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 800,
  background: "#111827",
  color: "#ffffff",
};

const customBadge = {
  minHeight: 34,
  padding: "0 14px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 800,
  background: "rgba(239, 68, 68, 0.1)",
  color: "#b91c1c",
};

const templateBadge = {
  minHeight: 34,
  padding: "0 14px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 800,
  background: "rgba(59, 130, 246, 0.1)",
  color: "#2563eb",
};

const deleteButton = {
  width: 34,
  minWidth: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid rgba(248, 113, 113, 0.34)",
  background: "#fff7f7",
  color: "#dc2626",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const deleteButtonDisabled = {
  opacity: 0.4,
  cursor: "not-allowed",
};

const chevron = {
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1,
};


const expandedContent = {
  display: "grid",
  gap: 16,
  padding: "0 20px 20px",
};

const dayList = {
  display: "grid",
  gap: 12,
};

const dayRow = {
  borderRadius: 20,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
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
  boxShadow: "0 4px 10px rgba(15, 23, 42, 0.12)",
};

const dayName = {
  fontSize: 15,
  fontWeight: 800,
  color: "#1e293b",
};

const dayPreview = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "#64748b",
};

const actionRow = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 10,
};

const primaryAction = {
  minHeight: 50,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryAction = {
  minHeight: 50,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid #d7e1ef",
  background: "#ffffff",
  color: "#111827",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
};

const startAction = {
  minHeight: 50,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid rgba(22, 163, 74, 0.2)",
  background: "rgba(22, 163, 74, 0.08)",
  color: "#15803d",
  fontSize: 15,
  fontWeight: 800,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
