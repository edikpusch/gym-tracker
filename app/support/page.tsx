"use client";

import { useState } from "react";

import { AppPageFrame } from "@/components/AppPageFrame";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { NoticeDialog } from "@/components/ui/NoticeDialog";
import { TextPromptDialog } from "@/components/ui/TextPromptDialog";
import { appPalette } from "@/lib/theme";

export default function SupportPage() {
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [copySuccessMessage, setCopySuccessMessage] = useState<string | null>(null);
  const [manualCopyText, setManualCopyText] = useState<string | null>(null);

  async function copyFeedbackTemplate() {
    const text = [
      "Gym Tracker Feedback",
      "",
      "Was ist passiert?",
      "- ",
      "",
      "Was haette passieren sollen?",
      "- ",
      "",
      `Zeit: ${new Date().toLocaleString("de-DE")}`,
      "Version: 0.1.0",
    ].join("\n");

    await copyTextWithFallback(
      text,
      "Feedback-Vorlage kopiert.",
      setCopySuccessMessage,
      setManualCopyText
    );
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

    await copyTextWithFallback(
      text,
      "Bug-Vorlage kopiert.",
      setCopySuccessMessage,
      setManualCopyText
    );
  }

  return (
    <AppPageFrame
      activeKey="support"
      eyebrow="Hilfe & Support"
      title="Schnell Hilfe finden"
      subtitle="Kurze Antworten fuer haeufige Fragen plus fertige Vorlagen fuer Feedback und Bugs."
    >
      <AppCard style={sectionCard}>
        <div style={sectionHead}>
          <div style={sectionTitle}>Haeufige Fragen</div>
          <AppBadge variant="template">
            {showAllFaqs ? FAQS.length : Math.min(2, FAQS.length)}
          </AppBadge>
        </div>
        {(showAllFaqs ? FAQS : FAQS.slice(0, 2)).map((faq) => (
          <FaqCard key={faq.question} question={faq.question} answer={faq.answer} />
        ))}
        {FAQS.length > 2 ? (
          <AppButton
            block
            variant="secondary"
            style={moreButton}
            onClick={() => setShowAllFaqs((current) => !current)}
          >
            {showAllFaqs ? "Weniger Fragen anzeigen" : "Weitere Fragen anzeigen"}
          </AppButton>
        ) : null}
      </AppCard>

      <AppCard style={sectionCard}>
        <div style={sectionHead}>
          <div style={sectionTitle}>Feedback & Bugs</div>
          <AppBadge variant="active">Support</AppBadge>
        </div>
        <AppButton
          block
          variant="primary"
          style={primaryButton}
          onClick={() => void copyFeedbackTemplate()}
        >
          Feedback-Vorlage kopieren
        </AppButton>
        <AppButton
          block
          variant="secondary"
          style={ghostButton}
          onClick={() => void copyBugTemplate()}
        >
          Bug-Vorlage kopieren
        </AppButton>
      </AppCard>

      <AppCard style={sectionCard}>
        <div style={sectionHead}>
          <div style={sectionTitle}>App-Info</div>
          <AppBadge variant="custom">0.1.0</AppBadge>
        </div>
        <div style={infoRow}>
          <span style={infoLabel}>Version</span>
          <span style={infoValue}>0.1.0</span>
        </div>
        <div style={infoRow}>
          <span style={infoLabel}>Build</span>
          <span style={infoValue}>2026-05-28</span>
        </div>
      </AppCard>

      <NoticeDialog
        open={Boolean(copySuccessMessage)}
        title="Kopiert"
        body={copySuccessMessage ?? ""}
        onClose={() => setCopySuccessMessage(null)}
      />

      <TextPromptDialog
        open={Boolean(manualCopyText)}
        title="Text manuell kopieren"
        body="Das automatische Kopieren war auf diesem Geraet nicht moeglich. Du kannst den Text hier direkt markieren und kopieren."
        label="Vorlage"
        value={manualCopyText ?? ""}
        readOnly
        multiline
        confirmLabel="Fertig"
        cancelLabel="Schliessen"
        onChange={() => {}}
        onCancel={() => setManualCopyText(null)}
        onConfirm={() => setManualCopyText(null)}
      />
    </AppPageFrame>
  );
}

async function copyTextWithFallback(
  text: string,
  successMessage: string,
  onSuccess: (message: string | null) => void,
  onManualCopy: (text: string | null) => void
) {
  try {
    await navigator.clipboard.writeText(text);
    onSuccess(successMessage);
  } catch (error) {
    console.error("Clipboard copy failed:", error);
    onManualCopy(text);
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
    <AppCard variant="soft" style={faqCard}>
      <div style={faqQuestion}>{question}</div>
      <div style={faqAnswer}>{answer}</div>
    </AppCard>
  );
}

const FAQS = [
  {
    question: "Wie starte ich ein Training?",
    answer:
      "Oeffne Training, tippe auf eine Trainingskarte und starte deinen aktuellen Plan direkt ueber den Tap-Bereich oder den Start-Button.",
  },
  {
    question: "Wie bearbeite ich einen Plan?",
    answer:
      "Oeffne Plaene, waehle deinen aktiven Plan oder eine Kopie und bearbeite danach Tage, Uebungen, Warm-up, Dehnen und Pausen direkt im Editor.",
  },
  {
    question: "Wie funktionieren Dehnen und Pausen?",
    answer:
      "Dehn- und Pausebloecke sind echte Bestandteile des Workouts. Sie erscheinen im Ablauf, in der Pause und spaeter auch im Verlauf.",
  },
];

const sectionCard = {
  padding: "16px 14px",
  display: "grid",
  gap: 10,
};

const sectionHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const sectionTitle = {
  fontSize: 20,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const faqCard = {
  padding: "12px 12px 14px",
  display: "grid",
  gap: 6,
};

const faqQuestion = {
  fontSize: 16,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const faqAnswer = {
  fontSize: 14,
  lineHeight: 1.45,
  color: appPalette.textDefault,
};

const primaryButton = {
  width: "100%",
};

const ghostButton = {
  width: "100%",
};

const infoRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "9px 0",
  borderTop: `1px solid ${appPalette.borderSoft}`,
};

const infoLabel = {
  fontSize: 14,
  fontWeight: 700,
  color: appPalette.textMuted,
};

const infoValue = {
  fontSize: 15,
  fontWeight: 800,
  color: appPalette.textStrong,
};

const moreButton = {
  width: "100%",
};
