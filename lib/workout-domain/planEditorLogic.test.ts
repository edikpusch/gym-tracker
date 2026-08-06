import assert from "node:assert/strict";
import test from "node:test";
import { groupExercisesContiguously, validatePlanDraft } from "@/lib/planEditorLogic";
import { placeOptionalBlockAtExerciseBoundary, syncDayBlocks, type TrainingPlanBlock } from "@/lib/trainingModel";

const exercises = ["a", "b", "c"].map((id) => ({ id, name: id, sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 }));

test("new group members become contiguous at the first selected position", () => {
  const group = { id: "group", type: "superset" as const, label: "Supersatz", rounds: 4, transitionSeconds: 15, roundRestSeconds: 90 };
  const grouped = groupExercisesContiguously(exercises, new Set(["a", "c"]), group);
  assert.deepEqual(grouped.map((exercise) => exercise.id), ["a", "c", "b"]);
  assert.deepEqual(grouped.slice(0, 2).map((exercise) => [exercise.group?.id, exercise.sets]), [["group", 4], ["group", 4]]);
});

test("optional blocks can be positioned directly between exercises", () => {
  const note: TrainingPlanBlock = { id: "note", type: "note", label: "Hinweis", notes: "Atmen" };
  const blocks = [...syncDayBlocks(exercises), note];
  const placed = placeOptionalBlockAtExerciseBoundary(exercises, blocks, "note", 1);
  assert.deepEqual(placed.map((block) => block.type === "exercise" ? block.exerciseId : block.id), ["a", "note", "b", "c"]);
});

test("draft validation blocks structural errors but keeps optional content optional", () => {
  const issues = validatePlanDraft({ id: "plan", name: "Plan", description: "", accent: "#fff", origin: "custom", days: [{ id: "day", name: "Leer", slot: "mixed", color: "#fff", exercises: [] }] });
  assert.deepEqual(issues.map((issue) => [issue.code, issue.tone]), [["empty-day:day", "warning"]]);

  const invalid = validatePlanDraft({ id: "plan", name: "", description: "", accent: "#fff", origin: "custom", days: [{ id: "day", name: "Tag", slot: "mixed", color: "#fff", exercises: [{ ...exercises[0], minReps: 12, maxReps: 8 }] }] });
  assert.equal(invalid.filter((issue) => issue.tone === "error").length, 2);
  assert.ok(invalid.some((issue) => issue.code === "plan-name"));
  assert.ok(invalid.some((issue) => issue.code === "invalid-exercise:a"));

  const dense = validatePlanDraft({ id: "plan", name: "Plan", description: "", accent: "#fff", origin: "custom", days: [{ id: "day", name: "Lang", slot: "mixed", color: "#fff", exercises: [{ ...exercises[0], sets: 20, restSeconds: 900 }], blocks: syncDayBlocks(exercises) }] });
  assert.ok(dense.some((issue) => issue.code === "long-day:day" && issue.tone === "warning"));
  assert.ok(dense.some((issue) => issue.code === "long-rest:a" && issue.tone === "info"));
});
