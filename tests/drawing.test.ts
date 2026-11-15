import assert from "node:assert/strict";
import { test } from "node:test";
import { fitDrawing } from "../src/story/paper.ts";

test("fitting a multi-stroke drawing preserves the position of its smaller details", () => {
  const drawing: [number, number][][] = [
    [
      [0, 0],
      [100, 100],
    ],
    [
      [20, 30],
      [30, 30],
    ],
  ];
  const fitted = fitDrawing(drawing, 30, 30, 60);
  assert.deepEqual(fitted, [
    [
      [0, 0],
      [60, 60],
    ],
    [
      [12, 18],
      [18, 18],
    ],
  ]);
  assert.deepEqual(
    drawing[1],
    [
      [20, 30],
      [30, 30],
    ],
    "placing the drawing cannot rewrite the saved original",
  );
  assert.deepEqual(fitDrawing([], 30, 30, 60), []);
});
