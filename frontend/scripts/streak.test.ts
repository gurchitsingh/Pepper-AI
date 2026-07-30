import assert from "node:assert";
import { computeStreak } from "../src/pages/streak.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = (offsetDays: number) => new Date(now - offsetDays * DAY).toISOString();

assert.equal(computeStreak([]), 0, "no items -> 0");

assert.equal(computeStreak([{ created_at: iso(0) }]), 1, "one save today -> 1");

assert.equal(
  computeStreak([{ created_at: iso(0) }, { created_at: iso(1) }, { created_at: iso(2) }]),
  3,
  "three consecutive days -> 3",
);

assert.equal(
  computeStreak([{ created_at: iso(1) }]),
  1,
  "save yesterday, none yet today -> streak still 1 (day not over)",
);

assert.equal(
  computeStreak([{ created_at: iso(2) }]),
  0,
  "save two days ago, missed yesterday -> streak reset to 0",
);

assert.equal(
  computeStreak([{ created_at: iso(0) }, { created_at: iso(0) }, { created_at: iso(1) }]),
  2,
  "multiple saves same day count once",
);

assert.equal(
  computeStreak([{ created_at: iso(0) }, { created_at: iso(1) }, { created_at: iso(3) }]),
  2,
  "gap breaks the streak count at the gap",
);

console.log("streak.test.ts: all assertions passed");
