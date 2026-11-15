const assert = require("node:assert/strict");
const { launchGame } = require("./driver.cjs");
const base = (story = {}, world = {}, home = {}, art = {}) => ({
  version: 2,
  story: {
    arcVersion: 5,
    day: 2,
    dayIntro: 2,
    created: true,
    walkLearned: true,
    met: true,
    kite: "done",
    dinner: "alone",
    visit: "done",
    homeShown: true,
    visitedHome: true,
    fresh: [],
    ...story,
  },
  world: { x: 600, y: 356, inside: false, fair: false, tau: 0.36, ...world },
  home: { bagHung: true, ...home },
  art: {
    kite: [
      [0, -20],
      [20, 0],
      [0, 20],
      [-20, 0],
      [0, -20],
    ],
    ...art,
  },
});
let d;
async function stage(seed) {
  if (d) await d.close();
  d = await launchGame({ seed, debug: true, record: false });
  await step(0.25);
  return d.page;
}
const step = (n) => d.page.evaluate((n) => window.__step(n), n);
async function advanceUntil(selector, maxSeconds = 40) {
  for (let i = 0; i < maxSeconds; i++) {
    if (
      (await d.page.locator(selector).count()) &&
      (await d.page.locator(selector).first().isVisible())
    )
      return;
    await step(1);
  }
  throw Error('not reached '+selector);
}
async function settle(){
 for(let i=0;i<40;i++){if(await d.page.evaluate(()=>window.__game.story.canSave))return;await step(1);}
 throw Error('did not settle');
}
(async()=>{
 let p=await stage(undefined);
     assert.equal(await p.locator('.arrival-card.show').count(),1);
  assert((await p.locator('.arrival-card').textContent()).includes('Mürekkep Sokağı'));
  assert.equal(await p.evaluate(()=>window.__game.story.mode),'intro');
  await p.screenshot({path:'.local/v6-ui-day-and-place.png'});
  await step(3);await p.waitForTimeout(500);
  assert.equal(await p.evaluate(()=>window.__game.story.mode),'walk');
  const hand=await p.locator('[data-gesture-hand]').boundingBox();
  assert(hand.y>844*.73,'walking demonstration stays by the thumb');
  await p.screenshot({path:'.local/v6-ui-walking-first.png'});
  await d.drive(0,-1);await step(2.1);await d.drive(0,0);
  await step(1);
  assert.equal(await p.locator('[data-companion]').count(),1);
  assert.equal(await p.locator('[data-companion]').getAttribute('data-guiding'),'true');
  assert((await p.locator('svg.village').textContent()).includes('Ben Turna.'));
  await step(8);
  assert.equal(await p.evaluate(()=>window.__game.story._dbg.q.guideMet),true);
  await p.waitForTimeout(500);
  await p.screenshot({path:'.local/v6-ui-turna-return.png'});
  assert.deepEqual(d.errors,[]);
  console.log('PASS day/place card → walking lesson → automatic single-crane introduction');

  p = await stage(base());
  await step(0.5);
  await p.waitForTimeout(550);
  const initial = await p.locator("#act").boundingBox();
  assert(initial);
  for (const [x, y] of [
    [80, 690],
    [300, 720],
    [185, 700],
  ]) {
    await p.touchscreen.tap(x, y);
    await step(0.2);
    const box = await p.locator("#act").boundingBox();
    assert(
      Math.abs(box.y - initial.y) < 0.5,
      "touching the scene must not move the action",
    );
  }
  await p.screenshot({ path: ".local/v5-ui-fixed-action.png" });
  console.log("PASS action stays at the same coordinates across scene touches");

  p = await stage(base({ order: true }, { x: 550 }));
  await d.drive(1, 0);
  await step(2);
  let ahead = await p.evaluate(() => {
    const s = document.querySelector("svg.village"),
      p = s.createSVGPoint();
    p.x = window.__game.player.x;
    p.y = window.__game.player.y;
    return p.matrixTransform(s.getScreenCTM()).x;
  });
  assert(ahead < 390 * 0.45, "right walk must show more street ahead");
  const before = await p.evaluate(() => window.__game.camera.cx);
  await d.drive(-1, 0);
  await step(0.05);
  assert(
    Math.abs((await p.evaluate(() => window.__game.camera.cx)) - before) < 4,
    "camera may not snap on reversal",
  );
  await step(2);
  ahead = await p.evaluate(() => {
    const s = document.querySelector("svg.village"),
      p = s.createSVGPoint();
    p.x = window.__game.player.x;
    p.y = window.__game.player.y;
    return p.matrixTransform(s.getScreenCTM()).x;
  });
  assert(ahead > 390 * 0.55, "left walk must reveal the left side");
  await d.drive(0, 0);
  await p.screenshot({ path: ".local/v5-ui-camera-left.png" });
  console.log(
    "PASS directional lead, smooth reversal and both travel directions",
  );

  p = await stage(
    base({ day: 1, dayIntro: 1, kite: "sad", met: false }, { x: 170 }),
  );
  await step(0.4);
  assert.equal(
    await p.locator("[data-lost-kite]").getAttribute("data-state"),
    "escaping",
  );
  const t1 = await p.locator("[data-lost-kite]").getAttribute("transform");
  await step(1.5);
  const t2 = await p.locator("[data-lost-kite]").getAttribute("transform");
  assert.notEqual(t1, t2);
  assert.equal(await p.evaluate(() => window.__game.story._dbg.q.met), false);
  await d.drive(1, 0);
  for (
    let i = 0;
    i < 10 && (await p.evaluate(() => window.__game.story.mode === "walk"));
    i++
  )
    await step(0.5);
  await d.drive(0, 0);
  await step(1);
  assert.equal(await p.evaluate(() => window.__game.story._dbg.kenta.dir), -1);
  await step(13);
  assert.equal(await p.evaluate(() => window.__game.story.mode), "brush");
  assert(
    Number(await p.locator("[data-lost-kite]").getAttribute("opacity")) < 0.03,
  );
  assert(
    (await p.locator("[data-drawing-template]").getAttribute("d")).length > 20,
  );
  await p.screenshot({ path: ".local/v5-ui-kite-template.png" });
  console.log(
    "PASS old kite already escaping before dialogue; Kenta faces us; template remains",
  );

  p = await stage(
    base({ day: 1, dayIntro: 1, visitedHome: false }, { x: 450 }),
  );
  await step(1);
  await step(12);
  assert(
    (await p.locator("[data-world-hint]").textContent()).includes("taşlı"),
  );
  assert(
    Number(await p.locator("[data-world-hint]").getAttribute("opacity")) > 0.9,
  );
  console.log("PASS stone-alley explanation remains readable until entering");

  p = await stage(
    base(
      { day: 1, dayIntro: 1 },
      { x: 1591, y: 356, inside: true },
      { step: 1, prep: 2 },
    ),
  );
  await p.evaluate(() => window.__game.story._dbg.closeup.open(1));
  await step(1.3);
  await p.touchscreen.tap(65, 680);
  await step(0.8);
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.closeup._step),
    1,
    "a tap is not a slicing gesture",
  );
  for (let i = 0; i < 3; i++) {
    const pts = await p.evaluate(() =>
      [
        [258, 150],
        [258, 247],
      ].map((q) => window.__game.story._dbg.closeup._client(q)),
    );
    await d.drag(...pts, 25);
    await step(0.8);
  }
  await step(1.2);
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.closeup._step),
    2,
  );
  await d.hold([65,680],.45);
  const partial=await p.evaluate(()=>window.__game.story._dbg.closeup._shapes[0]);
  assert(partial>.25&&partial<.6);
  await step(1);
  assert.equal(await p.evaluate(()=>window.__game.story._dbg.closeup._shapes[0]),partial,'release stops rice shaping');
  await d.hold([65,680],3.7);
  await step(1.5);
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.closeup._step),
    3,
  );
  await p.touchscreen.tap(65, 680);
  await step(0.8);
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.closeup._step),
    3,
  );
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.closeup.isOpen),
    true,
  );
  await p.locator('[data-pattern=triangle]').tap();await step(1);
  const foodBox=await p.locator('[data-nigiri="0"]').boundingBox();
  assert(foodBox.width>55,'plating view keeps the nigiri large enough to arrange');
  for (let i = 0; i < 3; i++) {
    const pts = await p.evaluate((i) => {
      const c = window.__game.story._dbg.closeup;
      return [c._plating.sources[i], c._plating.slots[i]].map(([x, y]) =>
        c._client([x, y - 10]),
      );
    }, i);
    await d.drag(...pts);
    await step(0.7);
  }
  await p.locator(".cu-serve.show").tap();
  await step(4);
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.closeup.isOpen),
    false,
  );
  assert.equal(await p.evaluate(()=>window.__game.home.plateLayout),'triangle');
  console.log(
    "PASS progressive cutting, hold/release shaping, close-view drag plating and retained triangular layout",
  );

  p = await stage(
    base(
      { day: 1, dayIntro: 1 },
      { x: 1486, y: 356, inside: true, tau: 0.71 },
      { step: 6, prep: 2, eaten: 0 },
    ),
  );
  await step(0.3);
  await d.action("Ye");
  await step(1.15);
  assert.equal(
    await p.locator('[data-food-piece][data-eating="lift"]').count(),
    1,
  );
  let gap = await p.evaluate(() => {
    const g = window.__game;
    return Math.hypot(
      g.home.reach[0] - g.player.rightHand[0],
      g.home.reach[1] - g.player.rightHand[1],
    );
  });
  assert(gap < 3);
  await p.screenshot({ path: ".local/v5-ui-food-reaches-mouth.png" });
  await step(1.3);
  assert.equal(await p.evaluate(() => window.__game.home.eaten), 1);
  await step(7);
  assert.equal(await p.evaluate(()=>window.__game.home.made),1);
  console.log(
    "PASS food is carried by the visible hand before a bite is taken",
  );

  p = await stage(
    base(
      { day: 3, dayIntro: 3, order: true, souvenir: "cushion", giftUsed: true },
      { x: 730 },
    ),
  );
  await step(17);
  await d.action("Kuru bir köşe kuralım");
  await advanceUntil(".choices.show");
  await d.choice(0);
  await advanceUntil(".handwork.show");
  const tau = await p.evaluate(() => window.__game.tau);
  await step(5);
  assert.equal(
    await p.evaluate(() => window.__game.tau),
    tau,
    "building must not run an appointment clock",
  );
  const [a, b] = await d.mapSVG(".handwork svg", [
    [60, 437],
    [96, 292],
  ]);
  await d.drag(a, b);
  await step(0.7);
  await p.reload();
  await step(0.5);
  assert.equal(await p.evaluate(() => window.__game.story._dbg.q.project), "");
  assert.deepEqual(
    await p.evaluate(() => window.__game.story._dbg.q.shelterParts),
    [0],
  );
  await d.action("Köşeye devam et");
  await advanceUntil(".handwork.show");
  await d.parts();
  await advanceUntil(".drawing-paper.show");
  await d.stroke(
    await d.mapSVG(".paper-canvas", [
      [75, 145],
      [120, 90],
      [170, 150],
      [75, 145],
    ]),
    70,
  );
  await d.stroke(
    await d.mapSVG(".paper-canvas", [
      [105, 160],
      [125, 180],
      [145, 160],
    ]),
    70,
  );
  const draft = await p.locator(".paper-ink").getAttribute("d");
  await p.reload();
  await step(0.5);
  await d.action("Köşeye devam et");
  await advanceUntil(".drawing-paper.show");
  assert.equal(
    await p.locator(".paper-ink").getAttribute("d"),
    draft,
    "reopening the task must restore the exact unfinished drawing",
  );
  await p.locator("[data-action=done]").tap();
  await settle();
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.project),
    "tea",
  );
  assert.equal(await p.locator("[data-awning-art] path").count(), 2);
  await p.screenshot({ path: ".local/v5-ui-tea-shelter.png" });
  console.log(
    "PASS alternate tea shelter, cancellation/reload/resume, full multi-stroke drawing",
  );

  p = await stage(
    base(
      {
        day: 4,
        dayIntro: 4,
        order: true,
        project: "tea",
        souvenir: "cushion",
        giftUsed: true,
      },
      { x: 730 },
      {},
      {
        project: [
          [
            [80, 90],
            [140, 150],
            [170, 100],
          ],
        ],
      },
    ),
  );
  await step(17);
  await d.action("Çanın dilini yenile");
  await advanceUntil(".choices.show");
  await d.choice(0);
  await advanceUntil(".drawing-paper.show");
  await d.paperDraw();
  await advanceUntil(".handwork.show");
  await p.locator(".handwork-back").tap();
  await settle();
  await p.reload();
  await step(0.6);
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.chimePlace),
    "home",
  );
  await d.action("Çanın dilini yenile");
  await advanceUntil(".handwork.show");
  await d.parts();
  await step(1);
  await settle();
  assert.equal(
    await p.locator("[data-wind-chime]").getAttribute("data-place"),
    "home",
  );
  assert.equal(await p.locator("[data-chime-art] path").count(), 2);
  assert.deepEqual(d.errors, []);
  console.log(
    "PASS own-door chime choice, saved drawing and tying after a cancelled task",
  );

  p = await stage(
    base(
      {
        day: 5,
        dayIntro: 5,
        order: true,
        project: "tea",
        chime: true,
        chimePlace: "home",
        souvenir: "cushion",
        giftUsed: true,
      },
      { x: 730 },
      {},
      {
        project: [
          [
            [80, 90],
            [140, 150],
            [170, 100],
          ],
        ],
        chime: [
          [
            [90, 100],
            [150, 130],
          ],
        ],
      },
    ),
  );
  await step(17);
  await d.action("Buluşmayı hazırlayalım");
  await advanceUntil(".choices.show");
  await d.choice(1);
  await advanceUntil(".drawing-paper.show");
  await d.paperDraw();
  await settle();
  await d.action("Fırçaları uzat");
  await advanceUntil(".handwork.show");
  await d.parts();
  await step(1);
  await advanceUntil(".choices.show");
  await d.choice(1);
  await settle();
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.festivalMode),
    "drawing",
  );
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.tookMemento),
    false,
  );
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.gathering),
    true,
  );
  assert.deepEqual(d.errors, []);
  await p.screenshot({ path: ".local/v5-ui-drawing-gathering.png" });
  console.log(
    "PASS alternate drawing gathering and a memory kept in the shared corner",
  );
  await d.close();
  d = null;
  console.log("PASS all interface regressions and alternate chapter branches");
})().catch(async (e) => {
  if (d) await d.fail(e);
  else console.error(e);
  process.exitCode = 1;
});
