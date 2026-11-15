import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSave, writeSave, resetSave, SAVE_KEY, DRAFT_KEY, type SavedGame } from '../src/story/save.ts';

test('damaged or obsolete saves fall back to a new game without throwing', () => {
  let value: string | null = null;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => value, setItem: (_: string, v: string) => { value = v; } } });
  for (const invalid of [null, '{', '{}', '{"version":1}', '{"version":2,"world":{}}']) { value = invalid; assert.equal(readSave(), null); }
  const save: SavedGame = { version: 2, story: { day: 2, visit: 'missed' }, art: { kite: [[1, 2]] }, home: { step: 2 }, world: { x: 450, y: 350, inside: false, fair: false, tau: .8 } };
  assert.equal(writeSave(save), true); assert.deepEqual(readSave(), save); assert.equal(SAVE_KEY, 'ink-street-v2');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem() { throw Error('Unavailable'); }, setItem() { throw Error('Quota'); } } });
  assert.equal(readSave(), null); assert.equal(writeSave(save), false);
});

test('reset prevents unload autosave from recreating the deleted journey', () => {
  const values = new Map([[SAVE_KEY, '{"version":2}'], [DRAFT_KEY, '{"title":"unfinished drawing"}']]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, next: string) => { values.set(key, next); },
    removeItem: (key: string) => { values.delete(key); },
  } });
  assert.equal(resetSave(), true);
  assert.equal(values.has(SAVE_KEY), false);
  assert.equal(values.has(DRAFT_KEY), false);
  assert.equal(writeSave({ version: 2, story: { day: 3 }, art: {}, home: {}, world: { x: 450, y: 350, inside: false, fair: false, tau: .8 } }), false);
  assert.equal(values.has(SAVE_KEY), false);
});
