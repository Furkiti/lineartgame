const assert = require("node:assert/strict");
const { launchGame } = require("./driver.cjs");
const seed = (story = {}, world = {}, home = {}, art = {}) => ({
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
    order: true,
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
const step = (n) => d.page.evaluate((n) => window.__step(n), n);
async function open(s, viewport) {
  if (d) await d.close();
  d = await launchGame({ seed: s, debug: true, record: false, viewport });
  await step(0.3);
  return d.page;
}
async function until(selector, max = 50) {
  for (let i = 0; i < max; i++) {
    if (
      (await d.page.locator(selector).count()) &&
      (await d.page.locator(selector).first().isVisible())
    )
      return;
    await step(1);
  }
  throw Error(selector + " did not appear");
}
async function settle() {
  for (let i = 0; i < 50; i++) {
    if (await d.page.evaluate(() => window.__game.story.canSave)) return;
    await step(1);
  }
  throw Error("scene did not finish");
}
(async () => {
  let p = await open(
    seed(
      { day: 1, dayIntro: 1, order: false, visit: "none" },
      { x: 1486, y: 356, inside: true },
      { step: 6, prep: 2 },
    ),
  );
  assert.equal(await p.evaluate(() => window.__game.home.canEat), false);
  await d.action("Pencereyi arala");
  await settle();
  await d.action("Sofrayı süsle");
  await d.paperDraw();
  await settle();
  await step(20);
  assert.equal(await p.evaluate(() => window.__game.home.canEat), true);
  assert(
    !(await p.locator("[data-world-hint]").textContent()).includes("Kenta"),
  );
  for (let i = 0; i < 3; i++) {
    await p.locator("#act").tap();
    await step(2.7);
  }
  await until(".choices.show");
  await d.choice(1);
  await settle();
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.supperTogether),
    false,
  );
  assert.equal(await p.evaluate(() => window.__game.home.canSleep), true);
  assert.equal(await p.evaluate(() => window.__game.story._dbg.q.fox), false);
  await p.screenshot({ path: ".local/v5-edge-solo-evening.png" });
  assert.deepEqual(d.errors, []);
  console.log(
    "PASS solo supper: sunset, no fictitious guest, real bites, bedtime without a night quest",
  );

  p = await open(seed({ order: false }));
  await d.action("Hana ile konuş");
  await until(".choices.show");
  await d.choice(1);
  await until(".shodo.show");
  await p.waitForSelector(".sh-order.show");
  await p.locator(".sh-order button").tap();
  await step(1.2);
  const strokes = [
    [
      [14, 24],
      [50, 23],
      [86, 24],
    ],
    [
      [34, 11],
      [36, 24],
      [38, 36],
    ],
    [
      [66, 11],
      [64, 24],
      [62, 36],
    ],
    [
      [50, 33],
      [38, 46],
      [14, 60],
    ],
    [
      [50, 33],
      [64, 46],
      [88, 60],
    ],
    [
      [27, 65],
      [50, 64],
      [73, 65],
    ],
    [
      [50, 53],
      [50, 74],
      [50, 92],
      [44, 87],
    ],
    [
      [37, 74],
      [32, 80],
      [25, 87],
    ],
    [
      [63, 74],
      [68, 80],
      [75, 87],
    ],
  ];
  for (let i = 0; i < strokes.length; i++) {
    const expanded = [];
    for (let j = 0; j < strokes[i].length - 1; j++) {
      const [a, b] = [strokes[i][j], strokes[i][j + 1]];
      for (let k = 0; k < 8; k++)
        expanded.push([
          a[0] + ((b[0] - a[0]) * k) / 8,
          a[1] + ((b[1] - a[1]) * k) / 8,
        ]);
    }
    expanded.push(strokes[i].at(-1));
    const points = await p.evaluate(
      (pts) => pts.map((pt) => window.__game.story._dbg.shodo._client(pt)),
      expanded,
    );
    await d.stroke(points, 20);
    await step(0.2);
    assert.equal(
      await p.evaluate(() => window.__game.story._dbg.shodo._i),
      i + 1,
    );
  }
  await step(5);
  await until(".choices.show");
  await d.choice(0);
  await settle();
  assert.equal(
    (await p.evaluate(() => window.__game.story.snapshot().art.sign)).length,
    9,
  );
  await p.locator(".defter-btn").tap();
  assert.equal(
    await p
      .locator(
        '.defter.show .cell.done svg path[transform="translate(8 8) scale(.44)"]',
      )
      .count(),
    1,
  );
  await p.locator(".defter.show .close").tap();
  await p.waitForTimeout(700);
  await p.screenshot({ path: ".local/v5-edge-calligraphy.png" });
  assert.deepEqual(d.errors, []);
  console.log(
    "PASS calligraphy alternative: nine actual strokes, gift choice and exact notebook art",
  );

  p = await open(seed({ souvenir: "water", giftUsed: true }, { x: 700 }));
  assert.equal(
    await p.locator('[data-cat="street"] rect').getAttribute("x"),
    "680",
  );
  await d.action("Kediye oyuncak çiz");
  await until(".choices.show");
  await d.choice(0);
  await until(".drawing-paper.show");
  await d.paperDraw();
  await until(".choices.show");
  await d.choice(0);
  await settle();
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.catHome),
    true,
  );
  assert.equal(
    await p.locator('[data-cat="street"]').evaluate((g) => g.style.display),
    "none",
  );
  await step(1);
  assert.equal(
    await p
      .locator('circle[fill="url(#v-cateye)"]')
      .evaluateAll((nodes) =>
        nodes.every((n) => Number(n.getAttribute("opacity")) === 0),
      ),
    true,
  );
  assert.equal(
    (await p.evaluate(() => window.__game.story.snapshot().art.toyDrawing))
      .length,
    2,
  );
  console.log(
    "PASS farther cat, arbitrary two-stroke toy, invite-home choice and no floating night eyes",
  );

  p = await open(
    seed(
      {
        day: 4,
        dayIntro: 4,
        project: "paws",
        chime: true,
        chimePlace: "corner",
        giftUsed: true,
      },
      { x: 730, tau: 0.72 },
      {},
      {
        project: [
          [
            [80, 90],
            [140, 150],
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
  await step(19);
  assert.equal(await p.evaluate(() => window.__game.story._dbg.q.fox), true);
  await settle();
  assert(
    !(await p.locator("svg.village").textContent()).includes(
      "Kıpırdamadan bekle",
    ),
  );
  await p.screenshot({ path: ".local/v5-edge-optional-fox.png" });
  console.log(
    "PASS optional animal follows the rain footprints and a quiet corner",
  );

  p = await open(seed({ day: 7, dayIntro: 7, project: "" }, { x: 730 }));
  await step(1);
  assert.equal(
    await p.locator("[data-rain]").evaluate((g) => g.style.display),
    "",
  );
  assert((await p.locator("[data-rain]").getAttribute("d")).length > 100);
  assert.equal(await p.locator("#act").textContent(), "Kuru bir köşe kuralım");
  console.log(
    "PASS an unfinished rain chapter still has its weather and action on a later day",
  );

  for (const viewport of [
    { width: 588, height: 1280 },
    { width: 844, height: 390 },
  ]) {
    p = await open(seed({ order: false }), viewport);
    await step(0.7);
    const a = await p.locator("#act").boundingBox();
    assert(
      a.x >= 0 &&
        a.y >= 0 &&
        a.x + a.width <= viewport.width &&
        a.y + a.height <= viewport.height,
    );
    await p.touchscreen.tap(90, viewport.height * 0.84);
    await step(0.3);
    const b = await p.locator("#act").boundingBox();
    assert(Math.abs(a.y - b.y) < 0.5);
    await d.action("Hana ile konuş");
    await until(".choices.show");
    await d.choice(0);
    await until(".drawing-paper.show");
    await p.waitForTimeout(600);
    await p.screenshot({ path: `.local/v5-edge-paper-${viewport.width}.png` });
    const box = await p.locator(".paper-canvas").boundingBox();
    assert(box.width > 100 && box.height > 60);
    await p.locator("[data-action=leave]").tap();
    await settle();
    assert.equal(await p.evaluate(() => window.__game.story.facing), null);
    assert.deepEqual(
      await p.evaluate(() => [
        document.querySelector("#card").scrollLeft,
        document.querySelector("#card").scrollTop,
      ]),
      [0, 0],
    );
    assert.deepEqual(d.errors, []);
  }
  console.log(
    "PASS larger phone and landscape: stable controls, readable drawing area, cancellable tasks",
  );
  p = await open(seed({ order: false }));
  await d.action("Hana ile konuş");
  await until(".choices.show");
  await d.choice(0);
  await until(".drawing-paper.show");
  await d.stroke(
    await d.mapSVG(".paper-canvas", [
      [80, 140],
      [120, 90],
      [160, 140],
      [80, 140],
    ]),
    50,
  );
  assert(await p.evaluate(() => localStorage.getItem("ink-street-draft-v1")));
  await p.locator("[data-action=leave]").tap();
  await settle();
  p.once("dialog", (dialog) => dialog.accept());
  const reload = p.waitForEvent("domcontentloaded");
  await p.locator("#clock").tap();
  await p.locator("#clock").tap();
  await reload;
  assert.equal(
    await p.evaluate(() => localStorage.getItem("ink-street-v2")),
    null,
  );
  assert.equal(
    await p.evaluate(() => localStorage.getItem("ink-street-draft-v1")),
    null,
  );
  console.log("PASS clock reset removes both journey and unfinished drawings");
  await d.close();
  d = null;
  console.log("PASS edge cases and alternate play styles");
})().catch(async (e) => {
  if (d) await d.fail(e);
  else console.error(e);
  process.exitCode = 1;
});
