const assert = require("node:assert/strict");
const { launchGame } = require("./driver.cjs");
let d;
(async () => {
  d = await launchGame();
  const { page: p } = d;
  const wait = (fn, timeout = 60000) =>
    p.waitForFunction(fn, null, { timeout });
  await p.locator("#opening").tap();
  await p.waitForSelector('.arrival-card.show');
  await wait(()=>window.__game.story.mode==='walk');
  await p.screenshot({path:'.local/v6-full-01-walk-lesson.png'});
  await d.drive(-1,0);
  await wait(()=>window.__game.story._dbg.q.walkLearned);
  await d.drive(0,0);
  await wait(()=>document.querySelector('svg.village').textContent.replace(/\s/g,'').includes('uçurtmasıkaçıyor'));
  assert.equal(await p.locator('[data-lost-kite]').getAttribute('data-state'),'escaping');
  await d.drive(1,0);
  await wait(()=>window.__game.story.mode==='cine');
  await d.drive(0,0);
  await wait(()=>!!document.querySelector('[data-speaker=Kenta]'));
  assert((await p.locator('svg.village').textContent()).replace(/\s/g,'').includes('Deniz!Uçurtmamı'),'Kenta calls the traveller by name');
  assert.equal(await p.evaluate(()=>window.__game.story._dbg.kenta.dir),-1);
  await wait(() => window.__game.story.mode === "brush");
  await p.waitForTimeout(1100);
  const kite = await p.evaluate(() => {
    const [x, y] = window.__game.story._dbg.drawingAt();
    return [
      [x, y - 25],
      [x + 22, y],
      [x, y + 25],
      [x - 22, y],
      [x, y - 25],
    ];
  });
  await d.stroke(await d.mapSVG("svg.village", kite), 150);
  await d.choice(0);
  await wait(()=>document.querySelector('svg.village').textContent.replace(/\s/g,'').includes('BenTurna'));
  await wait(
    () =>
      window.__game.story.mode === "walk" &&
      window.__game.story._dbg.q.homeShown,
  );
  assert.equal(await p.locator('[data-companion]').getAttribute('data-guiding'),'true','the crane leads the way home');
  await p.screenshot({ path: ".local/v5-full-02-home-direction.png" });
  console.log("opening and home direction passed");
  await d.home();
  await d.walkTo(1372, 356);
  await wait(() => window.__game.home.bagHung);
  // Reversible threshold, with a real walk rather than an exit button.
  await d.walkTo(1340, 352);
  await p.waitForTimeout(500);
  const open = await p.evaluate(() => window.__game.home.doorOpen);
  assert(open > 0.2 && open < 0.85);
  await d.walkTo(1340, 374);
  await p.waitForTimeout(650);
  assert((await p.evaluate(() => window.__game.home.doorOpen)) < 0.1);
  await d.outside();
  await d.home();
  await d.walkTo(1654, 356);
  await d.icebox();
  await wait(() => window.__game.home.prep === 1);
  await p.waitForTimeout(2200);
  await d.walkTo(1591, 356);
  await wait(() => window.__game.home.prep === 2);
  await d.action("Suşi hazırla");
  await p.waitForSelector(".closeup.show");
  await p.waitForTimeout(1400);
  const circles = await p.evaluate(() =>
    Array.from({ length: 121 }, (_, i) =>
      window.__game.story._dbg.closeup._client([
        120 + Math.cos((i / 40) * Math.PI * 2) * 44,
        192 + Math.sin((i / 40) * Math.PI * 2) * 17,
      ]),
    ),
  );
  console.log("physical kitchen opened");
  await d.stroke(circles, 35);
  await wait(() => window.__game.story._dbg.closeup._step === 1);
  await p.waitForTimeout(1100);
  for (let i = 0; i < 6; i++) {
    const pts = await p.evaluate(() =>
      [
        [258, 150],
        [258, 247],
      ].map((q) => window.__game.story._dbg.closeup._client(q)),
    );
    await d.drag(...pts, 30);
    await p.waitForTimeout(550);
  }
  await wait(() => window.__game.story._dbg.closeup._step === 2);
  await d.holdUntil([65,680],()=>window.__game.story._dbg.closeup._shapes.every(s=>s>=1));
  await wait(() => window.__game.story._dbg.closeup._step === 3);
  await p.waitForTimeout(1200);
  for (let i = 0; i < 6; i++) {
    const pts = await p.evaluate((i) => {
      const c = window.__game.story._dbg.closeup;
      return [c._plating.sources[i], c._plating.slots[i]].map(([x, y]) =>
        c._client([x, y - 10]),
      );
    }, i);
    await d.drag(...pts);
    await p.waitForTimeout(650);
  }
  await p.locator(".cu-serve.show").tap();
  await wait(() => !window.__game.story._dbg.closeup.isOpen, 12000);
  assert.equal(await p.evaluate(() => window.__game.home.step), 5);
  await d.walkTo(1486, 356);
  await wait(() => window.__game.home.step === 6);
  await wait(() => window.__game.home.canEat, 45000);
  await d.action('Birlikte ye');
  await p.waitForTimeout(1150);
  assert.equal(await p.locator('[data-food-piece][data-eating="lift"]').count(),1);
  assert(await p.evaluate(()=>window.__game.home.reach!==null));
  await p.screenshot({path:'.local/v6-full-03-shared-meal.png'});
  await wait(()=>window.__game.home.offeredLast);
  await p.screenshot({path:'.local/v6-full-04-last-offer.png'});
  await d.choice(1);
  await d.ready();
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.eveningChoice),
    "home",
  );
  assert.equal(await p.locator("[data-paw-tracks]").isVisible(), false);
  await d.sleep(1);
  console.log(
    "PASS day 1: companion reply, moving kite, invitation, physical kitchen/meal, quiet evening → day 2",
  );
  // The next days are played from the actual saved journey: no clock/state/position changes.
  await d.outside();
  await d.walkTo(600, 356);
  await d.action("Hana ile konuş");
  await d.shodo();
  await d.choice(1);
  await d.ready();
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.souvenir),
    "water",
  );
  await d.walkTo(490, 356);
  await d.action("Su kabını doldur");
  await d.ready();
  assert.equal(
    await p.locator('[data-gift="water"] ellipse').getAttribute("fill"),
    "#b7d2d1",
  );
  await p.reload();
  await d.ready();
  assert.equal(await p.evaluate(() => window.__game.story._dbg.q.order), true);
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.giftUsed),
    true,
  );
  await d.sleep(2);
  console.log(
    "PASS day 2: Hana, exact sign, bird-water choice and reload persistence → day 3",
  );
  await d.outside();
  await d.walkTo(730, 356);
  await d.action("Kuru bir köşe kuralım");
  await d.choice(1);
  await d.parts();
  await d.paperDraw();
  await d.ready();
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.project),
    "paws",
  );
  assert((await p.locator("[data-awning-art] path").count()) >= 2);
  await p.screenshot({ path: ".local/v5-full-04-rain-shelter.png" });
  await d.sleep(3);
  console.log(
    "PASS day 3: drag-built shelter, exact multi-stroke canopy, usable dry corner → day 4",
  );
  await d.outside();
  await d.walkTo(730, 356);
  await d.action("Çanın dilini yenile");
  await d.choice(1);
  await d.paperDraw();
  await d.parts();
  await d.ready();
  assert.equal(
    await p.locator("[data-wind-chime]").getAttribute("data-place"),
    "corner",
  );
  await p.screenshot({ path: ".local/v5-full-05-shared-chime.png" });
  // The animal is optional: this path returns home without waiting for it.
  await d.sleep(4);
  console.log(
    "PASS day 4: own chime tag, physical tying, public placement; no required fox → day 5",
  );
  await d.outside();
  await d.walkTo(730, 356);
  await d.action("Buluşmayı hazırlayalım");
  await d.choice(0);
  await d.paperDraw();
  await d.ready();
  await d.action("Çayları uzat");
  await d.parts();
  await d.choice(0);
  await d.ready();
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.gathering),
    true,
  );
  assert((await p.locator("[data-gathering-art]").count()) >= 3);
  await p.screenshot({ path: ".local/v5-full-06-neighborhood-gathering.png" });
  await d.sleep(5);
  const q = await p.evaluate(() => window.__game.story._dbg.q);
  assert.equal(q.history.length, 5);
  assert.equal(q.tookMemento, true);
  assert.equal(q.day, 6);
  assert.equal(q.fox, false);
  assert.equal(
    q.history[0].entries.some((e) => e.id === "fox"),
    false,
  );
  assert.equal(
    q.history[4].entries.some((e) => e.id === "gathering"),
    true,
  );
  assert.deepEqual(d.errors, []);
  console.log(
    "PASS five complete days using actual touch input and the normal game clock, with saves, alternatives and five distinct memories",
  );
  await d.close();
})().catch(async (e) => {
  if (d) await d.fail(e);
  else console.error(e);
  process.exitCode = 1;
});
