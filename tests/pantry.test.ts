import test from 'node:test';
import assert from 'node:assert/strict';
import { START, normalize, makeable, use, store, missing, morningGift, bundleFits, recipeFor, canFeed, normalizeDishes, normalizeBasket } from '../src/story/pantry.ts';

test('a new home can make salmon or tamago, and lists what is missing', () => {
  assert.deepEqual(makeable(START), ['somon', 'tamago']);
  assert.deepEqual(missing(START), ['salatalık', 'mandalina']);
});

test('cooking uses exactly the recipe; staples are never counted', () => {
  const p = use(START, 'tamago');
  assert.equal(p.yumurta, 0);
  assert.equal(p.somon, 1);
  assert.deepEqual(makeable(p), ['somon']);
});

test('putting groceries away fills outlined places; what does not fit stays in the bundle', () => {
  const { pantry, left } = store(START, ['somon', 'somon', 'salatalık']);
  assert.equal(pantry.somon, 2);
  assert.deepEqual(left, ['somon']);
  assert.equal(pantry['salatalık'], 1);
});

test('the greengrocer never lets you carry more than the icebox can hold', () => {
  assert.equal(bundleFits(START, [], 'somon'), true);
  assert.equal(bundleFits(START, ['somon'], 'somon'), false, 'one salmon place is free');
  assert.equal(bundleFits(START, ['yumurta', 'yumurta', 'mandalina', 'mandalina'], 'salatalık'), false, 'a bundle holds four');
});

test('mandarins belong to no recipe', () => {
  assert.equal(recipeFor('mandalina'), null);
  assert.equal(recipeFor('salatalık')?.id, 'kyuri');
});

test('a morning with nothing to cook and nothing put away finds eggs at the door', () => {
  const empty = { somon: 0, yumurta: 0, 'salatalık': 0, mandalina: 1 };
  assert.equal(canFeed(empty, []), false);
  const g = morningGift(empty, []);
  assert.equal(g.gift, true);
  assert.deepEqual(makeable(g.pantry), ['tamago']);
  assert.equal(morningGift(empty, [['somon']]).gift, false, 'a dish put away is dinner too');
});

test('saved data is cleaned up', () => {
  assert.deepEqual(normalize({ somon: 9, yumurta: -1, mandalina: 'x' }), { somon: 2, yumurta: 0, 'salatalık': 0, mandalina: 0 });
  assert.deepEqual(normalize(undefined), START);
  assert.deepEqual(normalizeDishes(['somon', 'pizza', 'kyuri']), [['somon', 'kyuri']], 'an old flat list becomes a box');
  assert.deepEqual(normalizeDishes([['somon', 'x'], [], ['kyuri'], ['tamago']]), [['somon'], ['kyuri']], 'two boxes at most, none empty');
  assert.deepEqual(normalizeBasket(['somon', 'x', 'yumurta', 'yumurta', 'mandalina', 'somon']), ['somon', 'yumurta', 'yumurta', 'mandalina']);
});
