"use client";

import { useMemo } from "react";

import { appPalette, uiTheme, withAlpha } from "@/lib/theme";

export type ProgressRingProps = {
  totalSeconds: number;
  remainingSeconds: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  subLabel?: string;
  valueText?: string;
  pulse?: boolean;
};

export function ProgressRing({
  totalSeconds,
  remainingSeconds,
  color,
  size = 232,
  strokeWidth = 12,
  label,
  subLabel,
  valueText,
  pulse = false,
}: ProgressRingProps) {
  const radius = useMemo(() => (size - strokeWidth) / 2, [size, strokeWidth]);
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);
  const progress = totalSeconds <= 0 ? 0 : Math.max(0, Math.min(1, remainingSeconds / totalSeconds));
  const dashOffset = circumference * (1 - progress);
  const center = size / 2;
  const normalizedProgress = Math.max(0, Math.min(1, progress));
  const progressAngle = -90 + normalizedProgress * 360;
  const angleRad = (progressAngle * Math.PI) / 180;
  const dotX = center + radius * Math.cos(angleRad);
  const dotY = center + radius * Math.sin(angleRad);
  const glow = withAlpha(color, 0.18);
  const softGlow = withAlpha(color, 0.08);
  const track = withAlpha(color, 0.11);
  const ringShadow = withAlpha(color, 0.12);
  const gradientId = `ring-gradient-${color.replace(/[^a-z0-9]/gi, "")}-${size}-${strokeWidth}`;
  const shadowId = `ring-shadow-${color.replace(/[^a-z0-9]/gi, "")}-${size}-${strokeWidth}`;
  const haloId = `ring-halo-${color.replace(/[^a-z0-9]/gi, "")}-${size}-${strokeWidth}`;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={withAlpha(color, 0.52)} />
            <stop offset="32%" stopColor={withAlpha(color, 0.88)} />
            <stop offset="72%" stopColor={color} />
            <stop offset="100%" stopColor={withAlpha(color, 0.72)} />
          </linearGradient>
          <radialGradient id={haloId} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor={withAlpha(color, 0.1)} />
            <stop offset="72%" stopColor={withAlpha(color, 0.04)} />
            <stop offset="100%" stopColor={withAlpha(color, 0)} />
          </radialGradient>
          <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor={softGlow} />
          </filter>
        </defs>

        <circle cx={center} cy={center} r={radius + strokeWidth * 0.8} fill={`url(#${haloId})`} />

        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={track}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            filter: `drop-shadow(0 0 10px ${glow})`,
            transition: "stroke-dashoffset 120ms linear, filter 180ms ease",
          }}
        />

        <circle
          cx={center}
          cy={center}
          r={radius - strokeWidth * 0.32}
          fill="none"
          stroke={withAlpha(appPalette.surface, 0.72)}
          strokeWidth={Math.max(1.5, strokeWidth * 0.14)}
          strokeLinecap="round"
          opacity={0.9}
        />

        {normalizedProgress > 0 ? (
          <g style={{ filter: `drop-shadow(0 0 10px ${ringShadow})` }}>
            <circle cx={dotX} cy={dotY} r={strokeWidth * 0.74} fill={appPalette.surface} opacity={0.98} />
            <circle cx={dotX} cy={dotY} r={strokeWidth * 0.44} fill={color} />
          </g>
        ) : null}
      </svg>

      <div
        style={{
          position: "absolute",
          inset: strokeWidth + 12,
          borderRadius: "50%",
          background: `linear-gradient(180deg, ${appPalette.surface} 0%, ${appPalette.surfaceSoft} 100%)`,
          boxShadow: `inset 0 0 0 1px ${withAlpha(color, 0.12)}, 0 14px 28px ${softGlow}`,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: size >= 220 ? 18 : 14,
        }}
      >
        <div style={{ display: "grid", gap: size >= 220 ? 9 : 7 }}>
          {label ? (
            <div
              style={{
                fontSize: size >= 220 ? 14 : 12,
                letterSpacing: 1.1,
                textTransform: "uppercase",
                fontWeight: 800,
                color,
                opacity: 0.95,
              }}
            >
              {label}
            </div>
          ) : null}
          <div
            style={{
              fontSize: size >= 220 ? 60 : 46,
              lineHeight: 0.93,
              fontWeight: 850,
              color: appPalette.textStrong,
              transform: pulse ? "scale(1.015)" : "scale(1)",
              transition: "transform 140ms ease-out",
              textShadow: `0 10px 18px ${withAlpha(appPalette.surfaceDark, 0.06)}`,
            }}
          >
            {valueText ?? formatClock(remainingSeconds)}
          </div>
          {subLabel ? (
            <div
              style={{
                justifySelf: "center",
                minHeight: size >= 220 ? 38 : 34,
                padding: size >= 220 ? "0 16px" : "0 14px",
                borderRadius: uiTheme.radius.pill,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: withAlpha(color, 0.12),
                color,
                fontSize: size >= 220 ? 15 : 14,
                fontWeight: 800,
                boxShadow: `inset 0 0 0 1px ${withAlpha(color, 0.08)}`,
              }}
            >
              {subLabel}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
