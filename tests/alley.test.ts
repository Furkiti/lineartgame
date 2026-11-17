import test from 'node:test';
import assert from 'node:assert/strict';
import { grade, normalizeStones, STONES, GRADE } from '../src/story/alley.ts';

test('a touch on the beat presses a straight stone with moss; off the beat a crooked one — never a miss', () => {
  assert.deepEqual(grade(0.05, 1), { q: 1, tilt: 0, gap: 0 });
  assert.equal(grade(-(GRADE.great + GRADE.good) / 2, -1).tilt < 0, true, 'early leans one way');
  assert.equal(grade(0.2, 1).tilt > 0, true, 'late leans the other');
  const far = grade(0.5, 1);
  assert.equal(far.q > 0, true, 'even far off the beat the stone is pressed');
});

test('saved stones are cleaned up, and there are five of them', () => {
  assert.equal(STONES.length, 5);
  assert.deepEqual(normalizeStones([{ q: 9, tilt: 99 }, 'x']).map(s => [s.q, s.tilt]), [[1, 20], [0.42, 0]]);
  assert.deepEqual(normalizeStones(null), []);
});
