import assert from "node:assert/strict";
import { test } from "node:test";
import {
  nextChapter,
  dayComplete,
  eveningTarget,
  type JourneyState,
} from "../src/story/journey.ts";

const start = (): JourneyState => ({
  day: 1,
  kite: "sad",
  sushi: false,
  order: false,
  project: "",
  chime: false,
  festivalArt: false,
  gathering: false,
});
test("five days form one causal chain and no night animal gates the first evening", () => {
  const q = start();
  assert.equal(nextChapter(q), "kite");
  q.kite = "done";
  assert.equal(nextChapter(q), "supper");
  assert.equal(dayComplete(q), false);
  q.sushi = true;
  assert.equal(dayComplete(q), true);
  assert.equal(nextChapter(q), "rest");
  q.day = 2;
  q.sushi = false;
  assert.equal(nextChapter(q), "sign");
  q.order = true;
  assert.equal(dayComplete(q), true);
  q.day = 3;
  assert.equal(nextChapter(q), "shelter");
  q.project = "paws";
  assert.equal(dayComplete(q), true);
  q.day = 4;
  assert.equal(nextChapter(q), "chime");
  q.chime = true;
  assert.equal(dayComplete(q), true);
  q.day = 5;
  assert.equal(nextChapter(q), "invitation");
  q.festivalArt = true;
  assert.equal(nextChapter(q), "gather");
  assert.equal(dayComplete(q), false);
  q.gathering = true;
  assert.equal(nextChapter(q), "rest");
  assert.equal(dayComplete(q), true);
});
test("sleeping past an unfinished day preserves its prerequisite rather than skipping the chapter", () => {
  const q = { ...start(), kite: "done", day: 5 };
  assert.equal(nextChapter(q), "sign");
  q.order = true;
  assert.equal(nextChapter(q), "shelter");
  q.project = "tea";
  assert.equal(nextChapter(q), "chime");
  q.day = 8;
  assert.equal(nextChapter(q), "chime");
});
test("preparations lead naturally to sunset without a compulsory detour or a skip-time button", () => {
  const q = { ...start(), kite: "done" };
  assert.equal(eveningTarget(q, false, true), 0);
  assert.equal(eveningTarget(q, true, true), 0.705);
  assert.equal(eveningTarget(q, true, false), 0.705);
  q.sushi = true;
  assert.equal(eveningTarget(q, false, false), 0.795);
  q.day = 2;
  q.sushi = false;
  assert.equal(eveningTarget(q, false, false), 0);
  q.order = true;
  assert.equal(eveningTarget(q, false, false), 0.795);
});
