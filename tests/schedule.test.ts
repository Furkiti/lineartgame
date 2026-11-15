import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextVisit, timeRate } from '../src/story/schedule.ts';

test('a dinner invitation waits at the door, accepts a late arrival, and expires without blocking the story', () => {
  assert.equal(nextVisit('planned', .69, false), 'planned');
  assert.equal(nextVisit('planned', .70, false), 'waiting');
  assert.equal(nextVisit('waiting', .879, true), 'inside');
  assert.equal(nextVisit('waiting', .88, true), 'missed');
  assert.equal(nextVisit('planned', .90, true), 'missed');
  assert.equal(nextVisit('missed', .95, true), 'missed');
  assert.equal(nextVisit('inside', .95, false), 'inside');
  assert.equal(nextVisit('done', .95, true), 'done');
});
test('the first lesson, notebook and conversations protect the player from a ticking deadline', () => {
  assert.equal(timeRate('walk', 1, false, false), 0);
  assert.equal(timeRate('intro', 1, false, false), 0);
  assert.equal(timeRate('cine', 2, true, false), 0);
  assert.equal(timeRate('walk', 2, true, true), 0);
  assert.equal(timeRate('craft', 3, true, false), 0);
  for (const mode of ['brush', 'desk', 'cook']) assert.equal(timeRate(mode, 2, true, false), .12);
  assert.equal(timeRate('walk', 2, true, false), 1);
});
