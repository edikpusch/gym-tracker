"use client";

import { useState } from "react";

import { AppPageFrame } from "@/components/AppPageFrame";

export default function SupportPage() {
  const [showAllFaqs, setShowAllFaqs] = useState(false);

  async function copyFeedbackTemplate() {
    const text = [
      "Gym Tracker Feedback",
      "",
      "Was ist passiert?",
      "- ",
      "",
      "Was hätte passieren sollen?",
      "- ",
      "",
      `Zeit: ${new Date().toLocaleString("de-DE")}`,
      "Version: 0.1.0",
    ].join("\n");

    await copyTextWithFallback(text, "Feedback-Vorlage kopiert.");
  }

  async function copyBugTemplate() {
    const text = [
      "Gym Tracker Bug Report",
      "",
      "Bereich:",
      "- ",
      "",
      "Schritte zum Reproduzieren:",
      "1. ",
      "2. ",
      "3. ",
      "",
      "Erwartetes Verhalten:",
      "- ",
      "",
      "Aktuelles Verhalten:",
      "- ",
      "",
      `Zeit: ${new Date().toLocaleString("de-DE")}`,
      "Version: 0.1.0",
    ].join("\n");

    await copyTextWithFallback(text, "Bug-Vorlage kopiert.");
  }

  return (
    <AppPageFrame
      activeKey="support"
      eyebrow="Hilfe & Support"
      title="Schnell Hilfe finden"
      subtitle="Kurze Antworten für die häufigsten Fragen plus fertige Vorlagen für Feedback und Bugs."
    >
      <section style={sectionCard}>
        <div style={sectionTitle}>Häufige Fragen</div>
        {(showAllFaqs ? FAQS : FAQS.slice(0, 2)).map((faq) => (
          <FaqCard key={faq.question} question={faq.question} answer={faq.answer} />
        ))}
        {FAQS.length > 2 ? (
          <button
            style={moreButton}
            onClick={() => setShowAllFaqs((current) => !current)}
          >
            {showAllFaqs ? "Weniger Fragen anzeigen" : "Weitere Fragen anzeigen"}
          </button>
        ) : null}
      </section>

      <section style={sectionCard}>
        <div style={sectionTitle}>Feedback & Bugs</div>
        <button style={primaryButton} onClick={() => void copyFeedbackTemplate()}>
          Feedback-Vorlage kopieren
        </button>
        <button style={ghostButton} onClick={() => void copyBugTemplate()}>
          Bug-Vorlage kopieren
        </button>
      </section>

      <section style={sectionCard}>
        <div style={sectionTitle}>App-Info</div>
        <div style={infoRow}>
          <span style={infoLabel}>Version</span>
          <span style={infoValue}>0.1.0</span>
        </div>
        <div style={infoRow}>
          <span style={infoLabel}>Build</span>
          <span style={infoValue}>2026-05-10</span>
        </div>
      </section>
    </AppPageFrame>
  );
}

async function copyTextWithFallback(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    window.alert(successMessage);
  } catch (error) {
    console.error("Clipboard copy failed:", error);
    window.prompt("Text kopieren:", text);
  }
}

function FaqCard({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <div style={faqCard}>
      <div style={faqQuestion}>{question}</div>
      <div style={faqAnswer}>{answer}</div>
    </div>
  );
}

const FAQS = [
  {
    question: "Wie starte ich ein Training?",
    answer:
      "Öffne Training, tippe auf eine Trainingskarte und starte deinen aktuellen Plan direkt über den Tap-Bereich oder den Start-Button.",
  },
  {
    question: "Wie bearbeite ich einen Plan?",
    answer:
      "Öffne Pläne, wähle deinen aktiven Plan oder eine Kopie und bearbeite danach Tage, Übungen, Warm-up, Dehnen und Pausen direkt im Editor.",
  },
  {
    question: "Wie funktionieren Dehnen und Pausen?",
    answer:
      "Dehn- und Pauseblöcke sind echte Bestandteile des Workouts. Sie erscheinen im Ablauf, in der Pause und später auch im Verlauf.",
  },
];

const sectionCard = {
  padding: "18px 16px",
  borderRadius: 26,
  background: "#ffffff",
  border: "1px solid #e8eef6",
  boxShadow: "0 22px 36px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 12,
};

const sectionTitle = {
  fontSize: 20,
  fontWeight: 800,
  color: "#0f172a",
};

const faqCard = {
  padding: "14px 14px 16px",
  borderRadius: 20,
  background: "#f8fafc",
  border: "1px solid #e9eef6",
  display: "grid",
  gap: 8,
};

const faqQuestion = {
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
};

const faqAnswer = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
};

const primaryButton = {
  width: "100%",
  minHeight: 56,
  borderRadius: 999,
  background: "#111827",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 800,
  boxShadow: "0 16px 28px rgba(15, 23, 42, 0.16)",
};

const ghostButton = {
  width: "100%",
  minHeight: 52,
  borderRadius: 999,
  background: "#ffffff",
  color: "#334155",
  fontSize: 15,
  fontWeight: 700,
  border: "1px solid #e2e8f0",
};

const infoRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderTop: "1px solid #eef2f7",
};

const infoLabel = {
  fontSize: 14,
  fontWeight: 700,
  color: "#64748b",
};

const infoValue = {
  fontSize: 15,
  fontWeight: 800,
  color: "#0f172a",
};

const moreButton = {
  width: "100%",
  minHeight: 50,
  borderRadius: 999,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 800,
  border: "1px solid #dce5f0",
};
