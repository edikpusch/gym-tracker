import assert from "node:assert/strict";
import test from "node:test";
import { getExerciseGuidanceCatalog, getPublishedExerciseGuidance } from "@/lib/exercise-guidance/catalog";

test("unpublished guidance does not alter the workout UI", () => {
  assert.deepEqual(getExerciseGuidanceCatalog(), []);
  assert.equal(getPublishedExerciseGuidance("benchpress"), null);
  assert.equal(getPublishedExerciseGuidance(), null);
});
