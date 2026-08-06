import assert from "node:assert/strict";
import test from "node:test";
import { reorderDayExerciseBlocks, syncDayBlocks, type TrainingPlanBlock } from "@/lib/trainingModel";

const exerciseA = { id: "a", name: "benchpress", sets: 3, minReps: 8, maxReps: 10, restSeconds: 90 };
const exerciseB = { id: "b", name: "cable_row", sets: 3, minReps: 10, maxReps: 12, restSeconds: 90 };

test("reordering exercises changes workout order while preserving optional block position", () => {
  const base = syncDayBlocks([exerciseA, exerciseB]);
  const blocks: TrainingPlanBlock[] = [
    base[0],
    { id: "note", type: "note", label: "Hinweis", notes: "Atmen" },
    base[1],
  ];
  const reordered = reorderDayExerciseBlocks([exerciseB, exerciseA], blocks);

  assert.deepEqual(reordered.map((block) => block.type === "exercise" ? block.exerciseId : block.id), ["b", "note", "a"]);
});
