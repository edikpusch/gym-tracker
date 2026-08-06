import type { TrainingExercise, TrainingPlan } from "@/lib/trainingPlans";
import { syncDayBlocks } from "@/lib/trainingModel";

export type PlanEditorIssue = {
  code: string;
  tone: "error" | "warning" | "info";
  title: string;
  detail: string;
  dayId?: string;
  targetId?: string;
};

export function validatePlanDraft(plan: TrainingPlan): PlanEditorIssue[] {
  const issues: PlanEditorIssue[] = [];
  if (!plan.name.trim()) issues.push({ code: "plan-name", tone: "error", title: "Planname fehlt", detail: "Gib dem Trainingsplan vor dem Speichern einen Namen." });
  if (!plan.days.length) issues.push({ code: "no-days", tone: "error", title: "Kein Trainingstag", detail: "Ein Trainingsplan benötigt mindestens einen Tag." });

  plan.days.forEach((day) => {
    if (!day.name.trim()) issues.push({ code: `day-name:${day.id}`, tone: "error", title: "Trainingstag ohne Namen", detail: "Benenne den Tag, damit er später eindeutig gestartet werden kann.", dayId: day.id });
    if (!day.exercises.length) issues.push({ code: `empty-day:${day.id}`, tone: "warning", title: `${day.name || "Trainingstag"} ist leer`, detail: "Der Tag kann gespeichert werden, startet aber aktuell ohne Übung.", dayId: day.id });

    const workSets = day.exercises.reduce((total, exercise) => total + Math.max(0, exercise.sets), 0);
    const blocks = syncDayBlocks(day.exercises, day.blocks);
    const estimatedSeconds = blocks.reduce((total, block) => {
      if (block.type === "exercise") return total + block.sets * (block.restSeconds + 45);
      if (block.type === "warmup") return total + block.rounds * (block.restSeconds + 30);
      if (block.type === "stretch") return total + block.holdSeconds * block.rounds;
      if (block.type === "pause") return total + block.seconds;
      return total + 20;
    }, 0);
    if (workSets > 30) issues.push({ code: `high-volume:${day.id}`, tone: "warning", title: "Sehr hohes Satzvolumen", detail: `${day.name} enthält ${workSets} Arbeitssätze. Prüfe, ob das für eine Einheit beabsichtigt ist.`, dayId: day.id });
    if (estimatedSeconds >= 7_200) issues.push({ code: `long-day:${day.id}`, tone: "warning", title: "Sehr langer Trainingsentwurf", detail: `${day.name} liegt grob bei ${Math.round(estimatedSeconds / 60)} Minuten. Die Schätzung enthält Satz- und Pausenzeiten.`, dayId: day.id });

    day.exercises.forEach((exercise) => {
      if (exercise.sets < 1 || exercise.minReps < 1 || exercise.maxReps < exercise.minReps || exercise.restSeconds < 0) issues.push({ code: `invalid-exercise:${exercise.id}`, tone: "error", title: "Ungültige Übungswerte", detail: "Sätze, Wiederholungsbereich oder Pause müssen korrigiert werden.", dayId: day.id, targetId: exercise.id });
      if (exercise.restSeconds > 300) issues.push({ code: `long-rest:${exercise.id}`, tone: "info", title: "Lange Satzpause", detail: `${exercise.restSeconds} Sekunden Pause bei dieser Übung sind ungewöhnlich lang, aber erlaubt.`, dayId: day.id, targetId: exercise.id });
    });

    const groupCounts = new Map<string, { count: number; label: string }>();
    day.exercises.forEach((exercise) => {
      if (!exercise.group) return;
      const current = groupCounts.get(exercise.group.id);
      groupCounts.set(exercise.group.id, { count: (current?.count ?? 0) + 1, label: exercise.group.label });
    });
    groupCounts.forEach((group, groupId) => {
      if (group.count < 2) issues.push({ code: `small-group:${groupId}`, tone: "error", title: "Unvollständige Gruppe", detail: `${group.label || "Die Gruppe"} benötigt mindestens zwei Übungen.`, dayId: day.id });
    });

    blocks.forEach((block) => {
      if ((block.type === "pause" || block.type === "note" || block.type === "stretch") && !block.label.trim()) issues.push({ code: `block-label:${block.id}`, tone: "warning", title: "Baustein ohne Titel", detail: "Der Baustein funktioniert, ist im Workout aber schwer zu erkennen.", dayId: day.id, targetId: block.id });
      if (block.type === "note" && !block.notes.trim()) issues.push({ code: `empty-note:${block.id}`, tone: "info", title: "Leerer Hinweis", detail: "Ergänze einen Hinweistext oder entferne den Baustein.", dayId: day.id, targetId: block.id });
    });
  });

  const rank = { error: 0, warning: 1, info: 2 } as const;
  return issues.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

export function groupExercisesContiguously(
  exercises: TrainingExercise[],
  selectedIds: ReadonlySet<string>,
  group: NonNullable<TrainingExercise["group"]>
) {
  const members = exercises.filter((exercise) => selectedIds.has(exercise.id));
  if (members.length < 2) return exercises;
  const firstSelectedIndex = exercises.findIndex((exercise) => selectedIds.has(exercise.id));
  const affectedGroupIds = new Set(members.flatMap((exercise) => exercise.group ? [exercise.group.id] : []));
  let remaining = exercises.filter((exercise) => !selectedIds.has(exercise.id));
  affectedGroupIds.forEach((groupId) => {
    if (remaining.filter((exercise) => exercise.group?.id === groupId).length < 2) {
      remaining = remaining.map((exercise) => exercise.group?.id === groupId ? { ...exercise, group: undefined } : exercise);
    }
  });
  const insertionIndex = exercises.slice(0, firstSelectedIndex).filter((exercise) => !selectedIds.has(exercise.id)).length;
  const groupedMembers = members.map((exercise) => ({ ...exercise, sets: group.rounds, group }));
  return [...remaining.slice(0, insertionIndex), ...groupedMembers, ...remaining.slice(insertionIndex)];
}
