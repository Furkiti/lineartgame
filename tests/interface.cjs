const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
let activeBrowser;
fs.mkdirSync(".local", { recursive: true });
(async () => {
  const b = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
    args: ["--no-sandbox"],
  });
  activeBrowser = b;
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.setDefaultTimeout(15000);
  const base = process.env.PLAYTEST_URL || "http://127.0.0.1:4173/";
  const url = new URL(base);
  url.search = "?debug&opening";
  await p.goto(url.href);
  await p.locator("#opening").tap();
  await p.waitForTimeout(350);
  assert.equal(
    await p
      .locator("#opening em")
      .evaluate((el) => getComputedStyle(el).visibility),
    "hidden",
  );
  assert.equal(await p.locator(".guide-caption:not([hidden])").count(), 0);
  await p.waitForTimeout(1800);
  const step = (n) => p.evaluate((n) => window.__step(n), n);
  await step(1);
  await p.locator(".street-guide").tap();
  await step(0.3);
  assert.equal(await p.locator(".guide-caption:not([hidden])").count(), 0);
  assert.equal(await p.locator("[data-companion]").count(), 1);
  assert.equal(await p.locator(".street-guide svg").count(), 0);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 140, y: 700 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 171, y: 680 }],
  });
  await step(0.25);
  const hint = await p.locator("[data-world-hint]").boundingBox(),
    joy = await p.locator("#stick").boundingBox();
  assert(hint.y + hint.height < joy.y - 15);
  await p.screenshot({ path: ".local/ui-01-reading-and-stick.png" });
  await step(0.8);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await step(0.3);
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.walkLearned),
    true,
  );
  // Request a route: one node leaves its dock and the same node returns.
  await p.evaluate(
    () => (window.__crane = document.querySelector("[data-companion]")),
  );
  await p.locator(".street-guide").tap();
  await step(1);
  assert.equal(
    await p.locator("[data-companion]").getAttribute("data-guiding"),
    "true",
  );
  assert.equal(await p.locator(".guide-caption:not([hidden])").count(), 0);
  await p.screenshot({ path: ".local/ui-02-single-crane-flight.png" });
  await step(8);
  assert.equal(
    await p.locator("[data-companion]").getAttribute("data-docked"),
    "true",
  );
  assert.equal(
    await p.evaluate(
      () => window.__crane === document.querySelector("[data-companion]"),
    ),
    true,
  );
  // Observe every action label during the automatic encounter.
  await p.evaluate(() => {
    window.__labels = [];
    new MutationObserver(() =>
      window.__labels.push(document.querySelector("#act").textContent),
    ).observe(document.querySelector("#act"), {
      childList: true,
      subtree: true,
    });
  });
  await p.keyboard.down("d");
  await step(14);
  await p.keyboard.up("d");
  await step(10);
  assert.equal(await p.evaluate(() => window.__game.story.mode), "brush");
  assert.equal(
    await p.evaluate(() =>
      window.__labels.some((t) => /Kenta ile konuş/.test(t)),
    ),
    false,
  );
  assert(
    Number(await p.locator("[data-lost-kite]").getAttribute("opacity")) < 0.03,
  );
  assert(
    (await p.locator("[data-drawing-template]").getAttribute("d")).length > 20,
  );
  await p.screenshot({ path: ".local/ui-03-kite-template.png" });
  // Isolated physical interactions use an established journey; no modal is bypassed by the player test.
  const fixture = {
    version: 2,
    story: {
      day: 1,
      created: true,
      walkLearned: true,
      met: true,
      kite: "done",
      dinner: "kenta",
      visit: "planned",
      invitedDay: 1,
      fresh: [],
    },
    art: {},
    home: {},
    world: { x: 457, y: 368, inside: false, fair: false, tau: 0.4 },
  };
  await p.evaluate(
    (s) => localStorage.setItem("ink-street-v2", JSON.stringify(s)),
    fixture,
  );
  url.search = "?debug";
  await p.goto(url.href);
  await step(0.1);
  await p.evaluate(() => {
    const g = window.__game;
    g.enter();
    g.player.x = 1355;
    g.player.y = 356;
  });
  await p.keyboard.down("d");
  await step(0.15);
  const a = await p.evaluate(() => window.__game.player.x);
  assert.equal(await p.evaluate(() => window.__game.home.busy), true);
  await step(0.55);
  const z = await p.evaluate(() => window.__game.player.x);
  assert(z > a + 4, "hanging the bundle must not stop movement");
  await step(0.6);
  await p.keyboard.up("d");
  assert.equal(await p.evaluate(() => window.__game.home.bagHung), true);
  await p.evaluate(() => {
    const g = window.__game;
    g.player.x = 1600;
    g.player.y = 370;
  });
  await step(0.1);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 195, y: 650 }],
  });
  await p.evaluate(() => {
    const g = window.__game;
    g.player.x = 1654;
    g.player.y = 356;
  });
  await step(0.1);
  assert.equal(await p.locator("#act").innerText(), "Dolabı aç");
  const action = await p.locator("#act").boundingBox();
  assert(
    action.y + action.height < 600,
    "action must be clear of the held thumb",
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await step(0.2);
  await p.screenshot({ path: ".local/ui-04-action-above-thumb.png" });
  await p.evaluate(() => {
    window.__game.player.x = 1340;
    window.__game.player.y = 352;
  });
  await p.keyboard.down("w");
  for (let i = 0; i < 30 && (await p.evaluate(() => window.__game.inside)); i++)
    await step(0.05);
  await p.keyboard.up("w");
  assert.equal(
    await p.evaluate(() => window.__game.inside),
    false,
    "crossing the doorway should exit without walking to the far wall",
  );
  await p.evaluate(() => window.__game.story._dbg.closeup.open(1));
  await step(1);
  for (let i = 0; i < 3; i++) {
    await p.touchscreen.tap(70, 680);
    await step(0.65);
  }
  await step(1);
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.closeup._step),
    2,
  );
  for (let i = 0; i < 3; i++) {
    await p.touchscreen.tap(70, 680);
    await step(0.75);
  }
  await step(1);
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.closeup._step),
    3,
  );
  for (let i = 0; i < 3; i++) {
    await p.touchscreen.tap(70, 680);
    await step(0.75);
  }
  await step(4);
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.closeup.isOpen),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: opening overlap, world text/thumb separation, single crane continuity/return, automatic Kenta, departing kite/template, unblocked bag, action placement, short doorway, touch-only kitchen",
  );
  await b.close();
})().catch(async (e) => {
  console.error(e);
  await activeBrowser?.close();
  process.exitCode = 1;
});
