"use client";

import { useOverlay } from "@/lib/useOverlay";

import type { ExerciseGuidance } from "@/lib/exercise-guidance/types";

export function ExerciseGuidanceSheet({ guide, onClose }: { guide: ExerciseGuidance; onClose: () => void }) {
  const sections = [
    { title: "Vorbereitung", items: guide.setup },
    { title: "Ausführung", items: guide.execution },
    { title: "Cues", items: guide.cues },
    { title: "Achtung", items: guide.warnings },
  ].filter((section) => section.items?.length);
  const dialogRef = useOverlay(true, onClose);

  return <div role="presentation" style={{ position: "fixed", top: 0, left: 0, right: 0, height: "var(--app-viewport-height)", zIndex: 130, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Ausführung ${guide.title}`} style={{ width: "100%", maxHeight: "calc(var(--app-viewport-height) * 0.92)", overflowY: "auto", overscrollBehavior: "contain", padding: "20px 18px calc(22px + var(--safe-area-bottom))", borderRadius: "24px 24px 0 0", background: "var(--c-surface)", borderTop: "1px solid var(--c-border-strong)" }} onClick={(event) => event.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ flex: 1 }}><p style={{ color: "var(--c-accent)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .9 }}>Ausführung</p><h2 style={{ fontSize: 24, marginTop: 4 }}>{guide.title}</h2></div><button aria-label="Ausführung schließen" onClick={onClose} style={{ width: 44, height: 44, borderRadius: 13, background: "var(--c-surface-2)", color: "var(--c-text)", fontSize: 21 }}><span aria-hidden="true">×</span></button></div>
      {guide.media && <div role="img" data-guidance-renderer={guide.media.renderer} data-guidance-source={guide.media.sourceId} aria-label={guide.media.alt} style={{ aspectRatio: guide.media.aspectRatio ?? "4/3", marginTop: 18, borderRadius: 18, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "grid", placeItems: "center", color: "var(--c-text-3)", fontSize: 12 }}>Medien-Renderer wird später angebunden</div>}
      {sections.map((section) => <section key={section.title} style={{ marginTop: 20 }}><h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: .7, color: section.title === "Achtung" ? "var(--c-warning)" : "var(--c-text-2)" }}>{section.title}</h3><ol style={{ margin: "10px 0 0 20px", color: "var(--c-text-2)", lineHeight: 1.55 }}>{section.items?.map((item) => <li key={item} style={{ marginTop: 6 }}>{item}</li>)}</ol></section>)}
    </div>
  </div>;
}
