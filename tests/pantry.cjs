// The icebox as a pantry: cook from what is there, put a plate away, serve it later, and shop at
// Ume's stall — all with real touches, and the counts must follow what the hands did.
const assert = require('node:assert/strict');
const { launchGame } = require('./driver.cjs');
let d;
const seed = (story = {}, home = {}, world = {}) => ({ version: 2, story: { arcVersion: 5, day: 2, dayIntro: 2, created: true, walkLearned: true, guideMet: true, met: true, kite: 'done', dinner: 'alone', visit: 'done', homeShown: true, visitedHome: true, order: true, iceboxDay: 2, fresh: [], ...story }, world: { x: 1654, y: 356, inside: true, fair: false, tau: .45, ...world }, home: { bagHung: true, ...home }, art: {} });
async function stage(s) { if (d) await d.close(); d = await launchGame({ debug: true, seed: s }); await step(.4); return d.page; }
const step = n => d.page.evaluate(n => __step(n), n);
const q = () => d.page.evaluate(() => __game.story._dbg.q);
(async () => {
  // two eggs make tamago: the egg places empty, the kitchen and the close-up turn yellow
  let p = await stage(seed({ pantry: { somon: 0, yumurta: 3, 'salatalık': 0, mandalina: 1 } }, { step: 0, prep: 0 }));
  await d.icebox({ take: 'tamago', shot: '.local/v9-tamago' }); await step(2.5);
  assert.equal((await q()).pantry.yumurta, 1);
  assert.equal(await p.evaluate(() => __game.home.topping), 'tamago');
  assert.equal(await p.evaluate(() => __game.home.prep), 1, 'the eggs are in your hands');
  await p.evaluate(() => { __game.player.x = 1591; }); await step(2.2);
  await d.action('Suşi hazırla'); await step(1.4);
  assert.equal(await p.locator('svg.closeup').getAttribute('data-topping'), 'tamago');
  assert.equal(await p.locator('.cu-title').first().textContent().then(t => t.includes('Pirinci')), true);
  console.log('PASS two eggs from the icebox become tamago on the board and in the close-up');

  // a plate you carry goes onto the dish shelf, piece by piece
  p = await stage(seed({}, { step: 5, prep: 2, topping: 'kyuri', pieces: ['kyuri', 'kyuri', 'kyuri'] }));
  await d.icebox({ shot: '.local/v9-store-plate' });
  assert.deepEqual((await q()).dishes, ['kyuri', 'kyuri', 'kyuri']);
  assert.equal(await p.evaluate(() => __game.home.step), 0, 'the kitchen is free again');
  assert.equal(await p.evaluate(() => __game.home.made), 1, 'a batch put away counts as made, so the next one starts fresh');
  console.log('PASS a carried plate is put away on the dish shelf');

  // later it comes out again and is carried like a fresh plate
  await step(1);
  await d.icebox({ take: 'dish', shot: '.local/v9-serve' });
  assert.deepEqual((await q()).dishes, []);
  assert.equal(await p.evaluate(() => __game.home.step), 5);
  assert.deepEqual(await p.evaluate(() => __game.home.plate), ['kyuri', 'kyuri', 'kyuri']);
  console.log('PASS a dish put away comes out as a plate to serve');

  // the market: a ring around cucumbers and eggs, the bundle tied, carried home, put away
  p = await stage(seed({ pantry: { somon: 0, yumurta: 0, 'salatalık': 0, mandalina: 0 }, shopping: ['salatalık'] }, { step: 0, prep: 0 }, { x: 2600 + 125, y: 940, inside: false, market: true }));
  await step(.6);
  await d.grocer(['salatalık', 'yumurta'], { shot: '.local/v9-grocer' });
  const basket = (await q()).basket;
  assert.equal(basket.length >= 2, true, 'a ring takes what is inside it: ' + JSON.stringify(basket));
  assert(basket.includes('salatalık') && basket.includes('yumurta'));
  assert.deepEqual((await q()).shopping, [], 'bought things leave the list');
  assert.equal(await p.locator('[data-grocery-bundle]').getAttribute('opacity'), '1', 'the bundle is in your hands');
  await p.screenshot({ path: '.local/v9-carrying.png' });
  // home: the bundle goes onto the fresh shelves
  await p.evaluate(() => { __game.exitMarket(); }); await step(.5);
  await p.evaluate(() => { __game.enter(); }); await step(.6);
  await p.evaluate(() => { __game.player.x = 1654; __game.player.y = 356; }); await step(.6);
  await p.screenshot({ path: '.local/v9-home-with-bundle.png' });
  await d.icebox({ shot: '.local/v9-store-groceries' });
  const after = await q();
  assert.deepEqual(after.basket, []);
  assert.equal(after.pantry['salatalık'], basket.filter(x => x === 'salatalık').length);
  assert.equal(after.pantry.yumurta, basket.filter(x => x === 'yumurta').length);
  assert.equal(await p.locator('[data-grocery-bundle]').getAttribute('opacity'), '0');
  console.log('PASS Ume’s ring picking, the tied bundle carried home and shelved in its own places');

  // nothing to cook and nothing put away: a neighbour's eggs in the morning
  p = await stage(seed({ pantry: { somon: 0, yumurta: 0, 'salatalık': 0, mandalina: 0 }, dishes: [], order: true }, { step: 0, prep: 0 }, { x: 1416, tau: .9 }));
  await d.action('Uyu');
  for (let i = 0; i < 40 && !(await p.locator('.defter.show').count()); i++) await step(.5);
  await p.locator('.defter.show .close').tap();
  for (let i = 0; i < 40 && (await q()).day !== 3; i++) await step(.5);
  await step(6);
  assert.equal((await q()).pantry.yumurta, 2);
  console.log('PASS an empty icebox never strands you: eggs at the door in the morning');
  assert.deepEqual(d.errors, []);
  await d.close();
})().catch(async e => { console.error(e); try { await d?.page.screenshot({ path: '.local/v9-failure.png' }); await d?.close(); } catch {} process.exit(1); });
