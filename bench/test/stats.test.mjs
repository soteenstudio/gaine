import test from "node:test";
import assert from "node:assert/strict";
import { mannWhitneyP, median } from "../lib/stats.mjs";
import { compareMetric, METRICS } from "../lib/metrics.mjs";

test("median", () => assert.equal(median([3, 1, 2]), 2));
test("MWU separates clearly different samples", () => {
  assert.ok(mannWhitneyP([1, 2, 3, 4, 5, 6], [10, 11, 12, 13, 14, 15]) < 0.01);
  assert.ok(mannWhitneyP([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]) > 0.9);
});
test("lab metric inside noise is a tie, real gain is a win", () => {
  const lcp = METRICS.find((m) => m.id === "lcp");
  assert.equal(compareMetric(lcp, [1000, 1010, 990, 1005, 995, 1000], [1002, 998, 1004, 996, 1001, 999]).winner, "tie");
  assert.equal(compareMetric(lcp, [1000, 1010, 990, 1005, 995, 1000], [800, 810, 790, 805, 795, 800]).winner, "gaine");
});
test("exact metric: higher bytes loses", () => {
  const js = METRICS.find((m) => m.id === "jsBytes");
  assert.equal(compareMetric(js, [100000], [150000]).winner, "baseline");
});
