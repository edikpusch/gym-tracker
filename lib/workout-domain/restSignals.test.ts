import assert from "node:assert/strict";
import test from "node:test";
import { crossedRestWarning, getRestVisualStage } from "@/lib/workout-domain/restSignals";

test("rest visuals change from warning into a 3-2-1 countdown and ready", () => {
  assert.deepEqual(getRestVisualStage(20_000), { type: "normal" });
  assert.deepEqual(getRestVisualStage(15_000), { type: "warning" });
  assert.deepEqual(getRestVisualStage(3_000), { type: "countdown", value: 3 });
  assert.deepEqual(getRestVisualStage(1), { type: "countdown", value: 1 });
  assert.deepEqual(getRestVisualStage(0), { type: "ready" });
});

test("the 15 second warning only fires when crossing its threshold", () => {
  assert.equal(crossedRestWarning(15_200, 14_900), true);
  assert.equal(crossedRestWarning(14_900, 14_500), false);
  assert.equal(crossedRestWarning(null, 12_000), true);
  assert.equal(crossedRestWarning(500, 0), false);
});
