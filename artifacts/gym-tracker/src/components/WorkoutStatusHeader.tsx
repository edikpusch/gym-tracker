

import { appPalette, uiTheme, withAlpha } from "@/lib/theme";

type WorkoutStatusHeaderProps = {
  theme: {
    primary: string;
    soft: string;
    dark?: string;
  };
  onHome: () => void;
  onPause: () => void;
  onStop?: () => void;
  elapsedLabel: string;
  exerciseIndex: number;
  exerciseTotal: number;
  progressPercent: number;
  exerciseName?: string;
  nextLabel?: string;
  pauseLabel?: string;
  compact?: boolean;
};

export function WorkoutStatusHeader({
  theme,
  onHome,
  onPause,
  onStop,
  elapsedLabel,
  exerciseIndex,
  exerciseTotal,
  progressPercent,
  exerciseName,
  nextLabel,
  pauseLabel = "Pause",
  compact = false,
}: WorkoutStatusHeaderProps) {
  const primary = theme.primary;
  const soft = theme.soft;
  const progressWidth = `${Math.max(0, Math.min(100, progressPercent))}%`;

  return (
    <div style={{ display: "grid", gap: compact ? 8 : 10 }}>
      <div style={headerRow}>
        <button
          type="button"
          onClick={onHome}
          style={{
            ...headerButton,
            ...(compact ? compactHeaderButton : null),
            color: primary,
            background: soft,
            border: `1px solid ${withAlpha(primary, 0.16)}`,
          }}
        >
          ← Home
        </button>

        <div style={{ ...timerPill, ...(compact ? compactTimerPill : null) }}>{elapsedLabel}</div>

        <div style={headerActionGroup}>
          <button
            type="button"
            onClick={onPause}
            style={{
              ...pauseButton,
              ...(compact ? compactPauseButton : null),
              color: primary,
              background: soft,
              border: `1px solid ${withAlpha(primary, 0.16)}`,
            }}
          >
            {pauseLabel}
          </button>
          {onStop ? (
            <button
              type="button"
              onClick={onStop}
              style={{
                ...stopButton,
                ...(compact ? compactStopButton : null),
                color: primary,
                border: `1px solid ${withAlpha(primary, 0.14)}`,
              }}
              aria-label="Training stoppen"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: compact ? 4 : 5 }}>
        <div style={{ ...progressMetaRow, fontSize: compact ? 10 : 11 }}>
          <span style={progressSideLabel}>
            ÜBUNG {exerciseIndex} / {exerciseTotal}
          </span>
          {exerciseName ? <span style={progressName}>{exerciseName}</span> : <span />}
          <span style={progressSideLabel}>{progressPercent}%</span>
        </div>
        <div style={progressTrack}>
          <div
            style={{
              ...progressFill,
              width: progressWidth,
              background: `linear-gradient(90deg, ${withAlpha(primary, 0.75)} 0%, ${primary} 100%)`,
            }}
          />
        </div>
      </div>

      {nextLabel ? (
        <div style={{ ...nextLine, ...(compact ? compactNextLine : null) }}>
          <span style={nextPrefix}>Danach:</span> {nextLabel}
        </div>
      ) : null}
    </div>
  );
}

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const headerActionGroup: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
};

const headerButton: React.CSSProperties = {
  minHeight: 40,
  minWidth: 120,
  padding: "7px 14px",
  borderRadius: uiTheme.radius.pill,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
  appearance: "none",
  cursor: "pointer",
  boxShadow: `0 6px 14px ${withAlpha(appPalette.surfaceDark, 0.05)}`,
  flexShrink: 0,
};

const pauseButton: React.CSSProperties = {
  ...headerButton,
  minWidth: 92,
  padding: "7px 12px",
};

const compactHeaderButton: React.CSSProperties = {
  minHeight: 36,
  minWidth: 104,
  padding: "6px 11px",
  fontSize: 12,
};

const compactPauseButton: React.CSSProperties = {
  minHeight: 36,
  minWidth: 82,
  padding: "6px 10px",
  fontSize: 12,
};

const stopButton: React.CSSProperties = {
  minHeight: 38,
  minWidth: 38,
  padding: 0,
  borderRadius: uiTheme.radius.pill,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  background: appPalette.surface,
  fontSize: 16,
  fontWeight: 800,
  appearance: "none",
  cursor: "pointer",
  boxShadow: `0 6px 14px ${withAlpha(appPalette.surfaceDark, 0.04)}`,
  flexShrink: 0,
};

const compactStopButton: React.CSSProperties = {
  minHeight: 34,
  minWidth: 34,
  fontSize: 14,
};

const timerPill: React.CSSProperties = {
  minHeight: 38,
  minWidth: 76,
  padding: "6px 14px",
  borderRadius: uiTheme.radius.pill,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: appPalette.surface,
  border: `1px solid ${appPalette.borderSoft}`,
  color: appPalette.textStrong,
  fontSize: 13,
  fontWeight: 800,
  boxShadow: `0 6px 14px ${withAlpha(appPalette.surfaceDark, 0.04)}`,
  flexShrink: 0,
};

const compactTimerPill: React.CSSProperties = {
  minHeight: 34,
  minWidth: 68,
  padding: "5px 11px",
  fontSize: 12,
};

const progressMetaRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 8,
  color: appPalette.textSoft,
  fontWeight: 800,
  letterSpacing: 0.45,
};

const progressSideLabel: React.CSSProperties = {
  whiteSpace: "nowrap",
  opacity: 0.9,
};

const progressName: React.CSSProperties = {
  textAlign: "center",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: appPalette.textMuted,
  fontWeight: 700,
};

const progressTrack: React.CSSProperties = {
  width: "100%",
  height: 5,
  borderRadius: uiTheme.radius.pill,
  background: withAlpha(appPalette.danger, 0.16),
  overflow: "hidden",
};

const progressFill: React.CSSProperties = {
  height: "100%",
  borderRadius: uiTheme.radius.pill,
};

const nextLine: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: appPalette.textMuted,
  lineHeight: 1.4,
  paddingLeft: 2,
  paddingTop: 1,
};

const compactNextLine: React.CSSProperties = {
  fontSize: 11,
};

const nextPrefix: React.CSSProperties = {
  color: appPalette.textSoft,
  fontWeight: 800,
};
