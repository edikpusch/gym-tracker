"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { getAllTrainingPlans, getActivePlanId, setActivePlanId, type TrainingPlan } from "@/lib/trainingPlans";
import { getDb } from "@/lib/db";

export default function SettingsPage() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [activePlanId, setActivePlanIdState] = useState<string>("");
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    const all = getAllTrainingPlans();
    setPlans(all);
    setActivePlanIdState(getActivePlanId());
  }, []);

  function handleSelectPlan(id: string) {
    setActivePlanId(id);
    setActivePlanIdState(id);
  }

  async function handleClearData() {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }
    const db = getDb();
    await Promise.all([
      db.sets.clear(),
      db.sessions.clear(),
      db.weights.clear(),
      db.activeWorkout.clear(),
    ]);
    setClearConfirm(false);
    alert("Alle Trainingsdaten wurden gelöscht.");
  }

  const appVersion = "1.0.0";

  return (
    <div style={{ minHeight: "var(--app-viewport-height)", background: "var(--c-bg)", paddingBottom: "calc(var(--c-tab-height) + var(--safe-area-bottom) + 16px)" }}>

      <div style={{ paddingTop: "calc(20px + var(--safe-area-top))", paddingLeft: 20, paddingRight: 20, paddingBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--c-text)" }}>Einstellungen</h1>
      </div>

      <div style={{ paddingLeft: 16, paddingRight: 16, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Plan selector */}
        <section>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-3)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>
            Aktiver Trainingsplan
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {plans.map((plan) => {
              const isActive = plan.id === activePlanId;
              return (
                <button
                  key={plan.id}
                  onClick={() => handleSelectPlan(plan.id)}
                  style={{
                    width: "100%",
                    background: isActive ? "var(--c-accent-dim)" : "var(--c-surface)",
                    border: `1px solid ${isActive ? "var(--c-accent-border)" : "var(--c-border)"}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: isActive ? "var(--c-accent)" : "var(--c-text)", marginBottom: 2 }}>
                      {plan.name}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                      {plan.description} · {plan.days.length} Tage
                    </p>
                  </div>
                  {isActive && (
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--c-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Plan days preview */}
        {plans.find((p) => p.id === activePlanId) && (() => {
          const plan = plans.find((p) => p.id === activePlanId)!;
          return (
            <section>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-3)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>
                Trainingstage
              </p>
              <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, overflow: "hidden" }}>
                {plan.days.map((day, i) => (
                  <div
                    key={day.id}
                    style={{
                      padding: "13px 16px",
                      borderBottom: i < plan.days.length - 1 ? "1px solid var(--c-border)" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", marginBottom: 1 }}>{day.name}</p>
                      <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                        {day.exercises.map((e) => e.name).join(" · ")}
                      </p>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--c-text-3)", flexShrink: 0, marginLeft: 8 }}>
                      {day.exercises.length} Übg.
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {/* Data management */}
        <section>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-3)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>
            Daten
          </p>
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, overflow: "hidden" }}>
            <button
              onClick={() => void handleClearData()}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: clearConfirm ? "var(--c-danger)" : "var(--c-text)", marginBottom: 1 }}>
                  {clearConfirm ? "Wirklich löschen?" : "Trainingsdaten löschen"}
                </p>
                <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                  {clearConfirm ? "Nochmal tippen um zu bestätigen" : "Alle Sätze, Sessions und Gewichte"}
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={clearConfirm ? "var(--c-danger)" : "var(--c-text-3)"} strokeWidth={2} strokeLinecap="round">
                <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
              </svg>
            </button>
          </div>
        </section>

        {/* App info */}
        <div style={{ textAlign: "center", paddingTop: 8 }}>
          <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Gym Tracker v{appVersion}</p>
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
