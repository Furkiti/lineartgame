const assert = require("node:assert/strict");
const fs = require("node:fs");
const touch = process.env.PLAY_INPUT !== "keyboard";
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
    hasTouch: touch,
    ...(process.env.RECORD_PLAYTHROUGH
      ? {
          recordVideo: {
            dir: ".local/playthrough-video",
            size: { width: 390, height: 844 },
          },
        }
      : {}),
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(20000);
  const errors = [];
  p.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("BROWSER ERROR", e.message);
  });
  const cdp = await ctx.newCDPSession(p);
  let down = false,
    held = new Set();
  async function drive(x, y) {
    if (touch) {
      if (!x && !y) {
        if (down)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
        down = false;
        return;
      }
      if (!down) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: 140, y: 710 }],
        });
        down = true;
      }
      const mag = Math.hypot(x, y);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 140 + (x / mag) * 34, y: 710 + (y / mag) * 34 }],
      });
    } else {
      const wanted = new Set();
      if (x > 0) wanted.add("d");
      if (x < 0) wanted.add("a");
      if (y > 0) wanted.add("s");
      if (y < 0) wanted.add("w");
      for (const k of held) if (!wanted.has(k)) await p.keyboard.up(k);
      for (const k of wanted) if (!held.has(k)) await p.keyboard.down(k);
      held = wanted;
    }
  }
  const click = (locator) => (touch ? locator.tap() : locator.click());
  async function stroke(points, delay) {
    if (touch) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: points[0][0], y: points[0][1] }],
      });
      for (const pt of points) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: pt[0], y: pt[1] }],
        });
        await p.waitForTimeout(delay);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await p.mouse.move(...points[0]);
      await p.mouse.down();
      for (const pt of points) {
        await p.mouse.move(...pt);
        await p.waitForTimeout(delay);
      }
      await p.mouse.up();
    }
  }
  const tap = (x, y) => (touch ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
  await p.goto(process.env.PLAYTEST_URL || "http://127.0.0.1:4173/");
  await click(p.locator("#opening"));
  await p.waitForTimeout(2800);
  assert.equal(await p.locator(".drawing-paper.show").count(), 0);
  await p.screenshot({ path: ".local/rev-01-intro.png" });
  const start = await p.evaluate(() => window.__game.player.x);
  await drive(1, 0);
  await p.waitForTimeout(1000);
  await drive(0, 0);
  assert.equal(await p.evaluate(() => window.__game.player.x), start);
  console.log("intro waits for reader at", start);
  await click(p.locator(".street-guide"));
  await p.waitForFunction(() => window.__game.story.mode === "walk");
  async function walkTo(x, y, { inside, timeout = 30000 } = {}) {
    const begun = Date.now();
    while (Date.now() - begun < timeout) {
      const state = await p.evaluate(() => {
        const g = window.__game;
        return {
          x: g.player.x,
          y: g.player.y,
          inside: g.inside,
          mode: g.story.mode,
        };
      });
      if (
        (inside !== undefined && state.inside === inside) ||
        (inside === undefined &&
          Math.abs(state.x - x) < 3 &&
          Math.abs(state.y - y) < 2)
      ) {
        await drive(0, 0);
        return;
      }
      await drive(
        state.mode === "walk"
          ? state.x < x - 2
            ? 1
            : state.x > x + 2
              ? -1
              : 0
          : 0,
        state.mode === "walk"
          ? state.y < y - 1
            ? 1
            : state.y > y + 1
              ? -1
              : 0
          : 0,
      );
      await p.waitForTimeout(80);
    }
    throw Error(
      "walk timeout " +
        JSON.stringify(
          await p.evaluate(() => ({
            x: window.__game.player.x,
            y: window.__game.player.y,
            mode: window.__game.story.mode,
          })),
        ),
    );
  }
  // Actual movement to the encounter; no world-position changes or state mutation.
  await drive(1, 0);
  await p.waitForFunction(() => window.__game.story.mode === "cine", null, {
    timeout: 20000,
  });
  await drive(0, 0);
  console.log(
    "walked into Kenta",
    await p.evaluate(() => window.__game.player.x),
  );
  await p.waitForFunction(() => window.__game.story.mode === "brush");
  await p.waitForTimeout(1200);
  await p.screenshot({ path: ".local/rev-02-world-drawing.png" });
  const pts = await p.evaluate(() => {
    const svg = document.querySelector("svg.village"),
      at = window.__game.story._dbg.drawingAt(),
      m = svg.getScreenCTM();
    return Array.from({ length: 65 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2,
        q = svg.createSVGPoint();
      q.x = at[0] + Math.cos(a) * 24;
      q.y = at[1] + Math.sin(a) * 29;
      const c = q.matrixTransform(m);
      return [c.x, c.y];
    });
  });
  await stroke(pts, 15);
  await p.waitForFunction(
    () =>
      !![...document.querySelectorAll("text")].find((n) =>
        n.textContent.includes("Akşam yemeğe sana"),
      ),
    null,
    { timeout: 15000 },
  );
  assert.equal(await p.locator(".choices.show").count(), 0);
  await p.waitForSelector(".choices.show");
  await p.screenshot({ path: ".local/rev-03-invitation.png" });
  await click(p.locator(".choices.show button").first());
  await p.waitForFunction(
    () =>
      window.__game.story.mode === "walk" &&
      window.__game.story._dbg.q.homeShown,
    null,
    { timeout: 20000 },
  );
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.kenta.g.style.display),
    "none",
  );
  console.log("Kenta hopped away; home revealed");
  await p.screenshot({ path: ".local/rev-04-home-reveal.png" });
  await walkTo(457, 365);
  await walkTo(457, 327, { inside: true });
  console.log("entered home");
  await walkTo(1372, 356);
  await p.waitForFunction(() => window.__game.home.bagHung);
  assert.equal(await p.evaluate(() => window.__game.player.carryBundle), false);
  await p.screenshot({ path: ".local/rev-05-bag.png" });
  // Door must part, close if we retreat, then open fully as we actually walk out.
  await walkTo(1340, 352);
  await p.waitForTimeout(800);
  let open = await p.evaluate(() => window.__game.home.doorOpen);
  assert(open > 0.25 && open < 0.7, open);
  await p.screenshot({ path: ".local/rev-06-door-parted.png" });
  await walkTo(1340, 374);
  await p.waitForTimeout(700);
  assert((await p.evaluate(() => window.__game.home.doorOpen)) < 0.08);
  await walkTo(1340, 340, { inside: false });
  console.log("door reverse and exit work");
  await walkTo(457, 327, { inside: true });
  await walkTo(1654, 356);
  await p.waitForFunction(
    () => document.querySelector("#act").textContent === "Dolabı aç",
  );
  await click(p.locator("#act"));
  await p.waitForFunction(() => window.__game.home.prep === 1);
  await p.waitForTimeout(2200);
  await walkTo(1562, 356);
  await p.waitForFunction(() => window.__game.home.prep === 2);
  assert.equal(await p.locator("#act").innerText(), "Suşi hazırla");
  await click(p.locator("#act"));
  await p.waitForSelector(".closeup.show");
  await p.waitForTimeout(1400);
  console.log("auto bag/fish, explicit fridge/cooking");
  const close = () => p.evaluate(() => window.__game.story._dbg.closeup._step);
  let circle = await p.evaluate(() => {
    const c = window.__game.story._dbg.closeup;
    return Array.from({ length: 121 }, (_, i) =>
      c._client([
        120 + Math.cos((i / 40) * Math.PI * 2) * 44,
        192 + Math.sin((i / 40) * Math.PI * 2) * 17,
      ]),
    );
  });
  await stroke(circle, 35);
  await p.waitForFunction(
    () => window.__game.story._dbg.closeup._step === 1,
    null,
    { timeout: 6000 },
  );
  console.log("stirred real rice circles");
  for (let i = 0; i < 3; i++) {
    await tap(65, 680);
    await p.waitForTimeout(650);
  }
  await p.waitForFunction(
    () => window.__game.story._dbg.closeup._step === 2,
    null,
    { timeout: 6000 },
  );
  for (let i = 0; i < 3; i++) {
    await tap(65, 680);
    await p.waitForTimeout(750);
  }
  await p.waitForFunction(
    () => window.__game.story._dbg.closeup._step === 3,
    null,
    { timeout: 6000 },
  );
  await p.screenshot({ path: ".local/rev-07-shaped-from-bottom.png" });
  console.log("shaped rice while finger stayed away from food");
  for (let i = 0; i < 3; i++) {
    await tap(65, 680);
    await p.waitForTimeout(700);
  }
  await p.waitForFunction(
    () => !window.__game.story._dbg.closeup.isOpen,
    null,
    { timeout: 9000 },
  );
  assert.equal(await p.evaluate(() => window.__game.home.step), 5);
  console.log("plated by tapping away, tray taken automatically");
  await walkTo(1486, 356);
  await p.waitForFunction(() => window.__game.home.step === 6);
  await p.screenshot({ path: ".local/rev-08-table.png" });
  assert.equal(await p.getByText("Tabağı al", { exact: true }).count(), 0);
  assert.equal(await p.getByText("Masaya koy", { exact: true }).count(), 0);
  // Optional rituals provide something meaningful to do while sunset arrives naturally.
  const mealReady = Date.now();
  if ((await p.locator("#act").innerText()) === "Pencereyi arala") {
    await click(p.locator("#act"));
    await p.waitForFunction(
      () =>
        window.__game.story.mode === "walk" &&
        window.__game.story._dbg.q.windowMoment,
    );
    if ((await p.locator("#act").innerText()) === "Sofrayı süsle") {
      await click(p.locator("#act"));
      await p.waitForSelector(".drawing-paper.show");
      const cloth = await p.locator(".paper-canvas").evaluate((svg) => {
        const m = svg.getScreenCTM();
        return [
          [85, 140],
          [120, 90],
          [155, 140],
          [85, 140],
        ].map(([x, y]) => {
          const p = svg.createSVGPoint();
          p.x = x;
          p.y = y;
          const q = p.matrixTransform(m);
          return [q.x, q.y];
        });
      });
      await stroke(cloth, 120);
      await click(p.locator("[data-action=done]"));
      await p.waitForFunction(
        () =>
          window.__game.story.mode === "walk" &&
          window.__game.story._dbg.q.tableDecor,
      );
      assert((await p.locator("[data-table-art] path").count()) > 1);
      await p.screenshot({ path: ".local/rev-09-personal-supper.png" });
    }
  }
  // Wait naturally for the invited guest, without a skip-time menu.
  await p.waitForFunction(() => window.__game.home.canEat, null, {
    timeout: 45000,
  });
  for (let i = 0; i < 3; i++) {
    await p.waitForFunction(() => !window.__game.home.busy);
    await click(p.locator("#act"));
    await p.waitForTimeout(2000);
  }
  await p.waitForFunction(() => window.__game.story._dbg.q.sushi, null, {
    timeout: 30000,
  });
  assert.equal(
    await p.evaluate(() => window.__game.story._dbg.q.visit),
    "done",
  );
  assert(
    Date.now() - mealReady < 90000,
    "cooking must not lead to minutes of empty waiting",
  );
  console.log("shared dinner completed; checking the night objective");
  await p.waitForFunction(
    () =>
      [...document.querySelectorAll("[data-world-hint] text")]
        .map((n) => n.textContent)
        .join(" ")
        .includes("sokak lambasının"),
    null,
    { timeout: 12000 },
  );
  await walkTo(1340, 356);
  await walkTo(1340, 340, { inside: false });
  await walkTo(400, 365);
  await p.waitForFunction(() => window.__game.story._dbg.q.fox, null, {
    timeout: 45000,
  });
  await p.waitForFunction(() => window.__game.story.mode === "walk", null, {
    timeout: 15000,
  });
  await p.screenshot({ path: ".local/rev-10-night-visitor.png" });
  await walkTo(457, 365);
  await walkTo(457, 327, { inside: true });
  await walkTo(1416, 356);
  await p.waitForFunction(
    () => document.querySelector("#act").textContent === "Uyu",
  );
  await click(p.locator("#act"));
  await p.waitForSelector(".defter.show");
  await p.screenshot({ path: ".local/rev-11-day-memory.png" });
  assert(
    (await p.locator(".defter.show").innerText()).includes("Soframdaki desen"),
  );
  await click(p.locator(".defter.show .close"));
  await p.waitForFunction(
    () =>
      window.__game.story._dbg.q.day === 2 &&
      window.__game.story.mode === "walk",
    null,
    { timeout: 15000 },
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS real touch input, normal day: opening → kite → home/door → tap cooking → personal supper → dinner → fox → sleep → second morning",
  );
  await ctx.close();
  await b.close();
})().catch(async (e) => {
  console.error(e);
  await activeBrowser?.close();
  process.exitCode = 1;
});
