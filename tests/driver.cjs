const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");

async function launchGame({
  seed,
  debug = false,
  viewport = { width: 390, height: 844 },
  record = !!process.env.RECORD_PLAYTHROUGH,
} = {}) {
  fs.mkdirSync(".local", { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    ...(record
      ? { recordVideo: { dir: ".local/playthrough-video", size: viewport } }
      : {}),
  });
  if (seed)
    await context.addInitScript((seed) => {
      if (
        location.protocol.startsWith("http") &&
        !sessionStorage.getItem("test-fixture-loaded")
      ) {
        localStorage.setItem("ink-street-v2", JSON.stringify(seed));
        sessionStorage.setItem("test-fixture-loaded", "1");
      }
    }, seed);
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  const base = new URL(process.env.PLAYTEST_URL || "http://127.0.0.1:4173/");
  if (debug) base.searchParams.set("debug", "");
  await page.goto(base.href);
  let down = false;
  async function drive(x, y) {
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
        touchPoints: [{ x: 135, y: viewport.height * 0.84 }],
      });
      down = true;
    }
    const mag = Math.hypot(x, y);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: 135 + (x / mag) * 34, y: viewport.height * 0.84 + (y / mag) * 34 },
      ],
    });
    if(debug) await page.waitForTimeout(45); // Chromium may coalesce touchmove until the next frame.
  }
  async function stroke(points, delay = 28) {
    await drive(0, 0);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: points[0][0], y: points[0][1] }],
    });
    for (const [x, y] of points) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y }],
      });
      if (delay) await page.waitForTimeout(delay);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  async function hold(point,seconds){
    await drive(0,0);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point[0],y:point[1]}]});
    if(debug) await page.evaluate(n=>window.__step(n),seconds);else await page.waitForTimeout(seconds*1000);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  async function holdUntil(point,fn){
    await drive(0,0);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point[0],y:point[1]}]});
    try{await page.waitForFunction(fn,null,{timeout:20000});}finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  }
  async function drag(a, b, delay = 25) {
    await stroke(
      Array.from({ length: 19 }, (_, i) => [
        a[0] + ((b[0] - a[0]) * i) / 18,
        a[1] + ((b[1] - a[1]) * i) / 18,
      ]),
      delay,
    );
  }
  async function walkTo(x, y, { inside, timeout = 45000 } = {}) {
    const begun = Date.now();
    while (Date.now() - begun < timeout) {
      const s = await page.evaluate(() => {
        const g = window.__game;
        return {
          x: g.player.x,
          y: g.player.y,
          inside: g.inside,
          mode: g.story.mode,
        };
      });
      if (
        (inside !== undefined && s.inside === inside) ||
        (inside === undefined && Math.abs(s.x - x) < 3 && Math.abs(s.y - y) < 2)
      ) {
        await drive(0, 0);
        return;
      }
      await drive(
        s.mode === "walk" ? (s.x < x - 2 ? 1 : s.x > x + 2 ? -1 : 0) : 0,
        s.mode === "walk" ? (inside !== undefined ? -1 : s.y < y - 1 ? 1 : s.y > y + 1 ? -1 : 0) : 0,
      );
      await page.waitForTimeout(75);
    }
    throw Error(
      "walk timeout: " +
        JSON.stringify(
          await page.evaluate(() => ({
            x: window.__game.player.x,
            y: window.__game.player.y,
            mode: window.__game.story.mode,
          })),
        ),
    );
  }
  async function mapSVG(selector, points) {
    return page.locator(selector).evaluate((svg, points) => {
      const m = svg.getScreenCTM();
      return points.map(([x, y]) => {
        const p = svg.createSVGPoint();
        p.x = x;
        p.y = y;
        const q = p.matrixTransform(m);
        return [q.x, q.y];
      });
    }, points);
  }
  async function paperDraw() {
    await page.waitForSelector(".drawing-paper.show");
    await stroke(
      await mapSVG(".drawing-paper.show .paper-canvas", [
        [75, 145],
        [100, 98],
        [130, 135],
        [164, 95],
        [170, 150],
        [75, 145],
      ]),
      70,
    );
    // A second independent stroke catches accidental per-stroke fitting/distortion.
    await stroke(
      await mapSVG(".drawing-paper.show .paper-canvas", [
        [111, 160],
        [125, 181],
        [144, 162],
      ]),
      70,
    );
    await page.locator(".drawing-paper.show [data-action=done]").tap();
  }
  async function parts() {
    await page.waitForSelector(".handwork.show");
    const work = page.locator(".handwork.show");
    for (
      let i = 0;
      i < (await work.locator("[data-handwork-part]").count());
      i++
    ) {
      const part = work.locator(`[data-handwork-part="${i}"]`);
      if ((await part.getAttribute("data-placed")) === "true") continue;
      const [a, b] = await work.locator("svg").evaluate((svg, i) => {
        const nodes = [
          svg.querySelector(`[data-handwork-part="${i}"]`),
          svg.querySelector(`[data-handwork-target="${i}"]`),
        ];
        return nodes.map((n) => {
          const p = svg.createSVGPoint();
          p.x = p.y = 0;
          const q = p.matrixTransform(n.getScreenCTM());
          return [q.x, q.y];
        });
      }, i);
      await drag(a, b);
      await page.waitForTimeout(650);
      assert.equal(
        await part.getAttribute("data-placed"),
        "true",
        `part ${i} should settle in its target`,
      );
      assert.deepEqual(
        await page.evaluate(() => [
          document.querySelector("#card").scrollLeft,
          document.querySelector("#card").scrollTop,
        ]),
        [0, 0],
        "dragging must not scroll the game frame",
      );
    }
  }
  async function action(label) {
    await drive(0, 0);
    await page.waitForFunction(
      (label) =>
        document.querySelector("#act").classList.contains("show") &&
        document.querySelector("#act").textContent === label,
      label,
    );
    await page.locator("#act").tap();
  }
  // the icebox close-up, with real touches: swing the door, wipe the mist, note what is missing,
  // cut the string, lower the fish onto the tray
  async function icebox({ shot = '', note = true } = {}) {
    const adv = (s) => debug ? page.evaluate((s) => window.__step(s), s) : page.waitForTimeout(s * 1000);
    const until = async (fn, what) => { for (let i = 0; i < 80; i++) { if (await page.evaluate(fn)) return; await adv(.25); } throw Error('icebox: ' + what); };
    const box = () => window.__game.story._dbg.icebox;
    const at = (pts) => page.evaluate((pts) => pts.map((p) => window.__game.story._dbg.icebox._client(p)), pts);
    await action('Dolabı aç');
    await until(() => window.__game.story._dbg.icebox.isOpen, 'opens');
    await adv(.8);
    if (shot) await page.screenshot({ path: shot + '-1-door.png' });
    const P = await page.evaluate(() => window.__game.story._dbg.icebox._pts);
    await stroke(await at(Array.from({ length: 12 }, (_, i) => [P.HANDLE[0] - i * 17, P.HANDLE[1] + i])), 30);
    await until(() => window.__game.story._dbg.icebox.phase === 'wipe', 'door swings open');
    await adv(.8);
    if (shot) await page.screenshot({ path: shot + '-2-mist.png' });
    const zig = []; for (let y = P.IN.y0 + 10; y < P.IN.y1; y += 22) { zig.push([P.IN.x0 + 12, y], [P.IN.x1 - 12, y + 11]); }
    await stroke(await at(zig), 20);
    await until(() => window.__game.story._dbg.icebox.phase === 'cut', 'mist wiped');
    await adv(1);
    if (note) { const [m] = await at([P.MISSING[0]]); await page.touchscreen.tap(m[0], m[1]); await adv(.5); }
    if (shot) await page.screenshot({ path: shot + '-3-shelves.png' });
    await stroke(await at([[P.PKG.cx - 34, P.PKG.cy - 44], [P.PKG.cx - 10, P.PKG.cy - 14], [P.PKG.cx + 10, P.PKG.cy + 14], [P.PKG.cx + 34, P.PKG.cy + 44]]), 30);
    await until(() => window.__game.story._dbg.icebox.phase === 'take', 'string cut');
    await adv(.6);
    if (shot) await page.screenshot({ path: shot + '-4-open-parcel.png' });
    const fish = await page.evaluate(() => window.__game.story._dbg.icebox._fish);
    const pts = Array.from({ length: 16 }, (_, i) => [fish[0] + (P.TRAY[0] - fish[0]) * i / 15, fish[1] + (P.TRAY[1] - 12 - fish[1]) * i / 15]);
    await stroke(await at(pts), 30);
    await adv(.4);
    if (shot) await page.screenshot({ path: shot + '-5-tray.png' });
    await until(() => !window.__game.story._dbg.icebox.isOpen, 'closes with the fish');
    void box;
  }
  async function choice(i) {
    await page.waitForSelector(".choices.show");
    await page.locator(".choices.show button").nth(i).tap();
  }
  async function ready() {
    await page.waitForFunction(() => window.__game.story.canSave);
  }
  async function home() {
    if (await page.evaluate(() => window.__game.inside)) return;
    await walkTo(457, 365);
    await walkTo(457, 327, { inside: true });
  }
  async function outside() {
    if (!(await page.evaluate(() => window.__game.inside))) return;
    await walkTo(1340, 356);
    await walkTo(1340, 340, { inside: false });
  }
  async function sleep(day) {
    await home();
    await walkTo(1416, 356);
    await action("Uyu");
    await page.waitForSelector(".defter.show");
    await page.screenshot({ path: `.local/v5-day-${day}-memory.png` });
    await page.locator(".defter.show .close").tap();
    await page.waitForFunction(
      (day) =>
        window.__game.story._dbg.q.day === day + 1 &&
        window.__game.story._dbg.q.dayIntro === day + 1 &&
        window.__game.story.canSave,
      day,
      { timeout: 35000 },
    );
  }
  async function close() {
    await context.close();
    await browser.close();
  }
  async function fail(error) {
    console.error(error);
    try {
      console.error(
        await page.evaluate(() => ({
          q: window.__game?.story._dbg.q,
          inside: window.__game?.inside,
          pos: [window.__game?.player.x, window.__game?.player.y],
          mode: window.__game?.story.mode,
          text: document.body.innerText,
          errors: [],
        })),
      );
      await page.screenshot({ path: ".local/v5-failure.png" });
    } catch {}
    await close();
  }
  return {
    browser,
    context,
    page,
    errors,
    cdp,
    drive,
    stroke,
    drag,
    hold,
    holdUntil,
    walkTo,
    mapSVG,
    paperDraw,
    parts,
    action,
    icebox,
    choice,
    ready,
    home,
    outside,
    sleep,
    close,
    fail,
  };
}
module.exports = { launchGame };
