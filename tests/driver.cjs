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
    // an outline to trace: go over each stroke, a little off the line like a real hand
    if (await page.locator(".drawing-paper.show.tracing").count()) {
      for (let k = 0; k < 12; k++) {
        const d = await page.locator(".drawing-paper.show .trace-now").getAttribute("d");
        if (!d) break;
        const raw = d.replace(/^M/, "").split("L").map((s) => s.trim().split(/\s+/).map(Number));
        const pts = [];
        for (let i = 0; i < raw.length - 1; i++) for (let u = 0; u < 1; u += 0.25) pts.push([raw[i][0] + (raw[i + 1][0] - raw[i][0]) * u, raw[i][1] + (raw[i + 1][1] - raw[i][1]) * u]);
        pts.push(raw[raw.length - 1]);
        pts.forEach((p, i) => { p[0] += Math.sin(i) * 3; p[1] += Math.cos(i * 1.3) * 3; });
        await stroke(await mapSVG(".drawing-paper.show .paper-canvas", pts), 12);
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(300);
      const box = await page.locator(".drawing-paper.show [data-action=done]").boundingBox();
      const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [c] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(200);
      return;
    }
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
  // the icebox close-up, with real touches: swing the door, wipe the mist (first time each day),
  // then either take something (cut a salmon's string; drag to the tray) or put away what is on
  // the tray (drag each thing to a free dashed place of its own kind)
  async function icebox({ shot = '', note = true, take = 'somon' } = {}) {
    const adv = (s) => debug ? page.evaluate((s) => window.__step(s), s) : page.waitForTimeout(s * 1000);
    const until = async (fn, what) => { for (let i = 0; i < 80; i++) { if (await page.evaluate(fn)) return; await adv(.25); } throw Error('icebox: ' + what); };
    const at = (pts) => page.evaluate((pts) => pts.map((p) => window.__game.story._dbg.icebox._client(p)), pts);
    const things = () => page.evaluate(() => window.__game.story._dbg.icebox._things);
    const label = await page.evaluate(() => document.querySelector('#act').textContent);
    await action(label);
    await until(() => window.__game.story._dbg.icebox.isOpen, 'opens');
    await adv(.8);
    if (shot) await page.screenshot({ path: shot + '-1-door.png' });
    const P = await page.evaluate(() => window.__game.story._dbg.icebox._pts);
    await stroke(await at(Array.from({ length: 12 }, (_, i) => [P.HANDLE[0] - i * 17, P.HANDLE[1] + i])), 30);
    await until(() => window.__game.story._dbg.icebox.phase !== 'door', 'door swings open');
    if (await page.evaluate(() => window.__game.story._dbg.icebox.phase === 'wipe')) {
      await adv(.8);
      if (shot) await page.screenshot({ path: shot + '-2-mist.png' });
      const zig = []; for (let y = P.IN.y0 + 10; y < P.IN.y1; y += 22) { zig.push([P.IN.x0 + 12, y], [P.IN.x1 - 12, y + 11]); }
      await stroke(await at(zig), 20);
      await until(() => ['main', 'box'].includes(window.__game.story._dbg.icebox.phase), 'mist wiped');
    }
    // a carried plate: each nigiri into a compartment of the box, seen from above
    if (await page.evaluate(() => window.__game.story._dbg.icebox.phase === 'box')) {
      await adv(.8);
      if (shot) await page.screenshot({ path: shot + '-2-box.png' });
      const drag = async (from, to) => { const pts = Array.from({ length: 14 }, (_, i) => [from[0] + (to[0] - from[0]) * i / 13, from[1] + (to[1] - from[1]) * i / 13]); await stroke(await at(pts), 25); await adv(.45); };
      for (let k = 0; k < 8; k++) {
        const ps = await page.evaluate(() => window.__game.story._dbg.icebox._pieces);
        const pc = ps.find((x) => x.cell < 0); if (!pc) break;
        const cell = P.CELLS.findIndex((_, i) => !ps.some((x) => x.cell === i));
        await drag(pc.pos, P.CELLS[cell]);
        if (shot && k === 2) await page.screenshot({ path: shot + '-3-filling.png' });
      }
      await adv(1.2);
      if (shot) await page.screenshot({ path: shot + '-4-lid.png' });
      await until(() => !window.__game.story._dbg.icebox.isOpen, 'closes after the box');
      return;
    }
    await adv(1);
    const mode = await page.evaluate(() => window.__game.story._dbg.icebox.mode);
    if (note && mode === 'take') {
      const empty = (await page.evaluate(() => [...document.querySelectorAll('[data-icebox] [data-place]')].filter(n => n.getAttribute('data-place') !== 'dish' && !window.__game.story._dbg.icebox._things.some(t => t.kind === n.getAttribute('data-place'))).map(n => [n.getAttribute('data-place'), +n.getAttribute('data-place-i')])))[0];
      if (empty) { const [m] = await at([P.SPOTS[empty[0]][empty[1]]]); await page.touchscreen.tap(m[0], m[1]); await adv(.5); }
    }
    if (shot) await page.screenshot({ path: shot + '-3-shelves.png' });
    const drag = async (from, to) => { const pts = Array.from({ length: 16 }, (_, i) => [from[0] + (to[0] - from[0]) * i / 15, from[1] + (to[1] - from[1]) * i / 15]); await stroke(await at(pts), 30); await adv(.5); };
    if (mode === 'store') {
      for (let k = 0; k < 8; k++) {
        const list = await things(); const t = list.find(x => x.tray >= 0); if (!t) break;
        const free = P.SPOTS[t.kind].findIndex((_, i) => !list.some(x => x.kind === t.kind && x.spot === i));
        await drag(t.pos, P.SPOTS[t.kind][free]);
      }
      if (shot) await page.screenshot({ path: shot + '-4-stored.png' });
    } else {
      const kind = take === 'tamago' ? 'yumurta' : take === 'kyuri' ? 'salatalık' : take === 'dish' ? 'dish' : 'somon';
      if (kind === 'somon') {
        const s = (await things()).find(x => x.kind === 'somon' && x.tied);
        if (s) { await stroke(await at([[s.pos[0] - 30, s.pos[1] - 40], [s.pos[0] - 10, s.pos[1] - 12], [s.pos[0] + 10, s.pos[1] + 12], [s.pos[0] + 30, s.pos[1] + 40]]), 30); await adv(1); }
      }
      for (let k = 0; k < (kind === 'dish' ? 1 : 3); k++) {
        if (!(await page.evaluate(() => window.__game.story._dbg.icebox.phase === 'main'))) break;
        const t = (await things()).find(x => x.kind === kind && x.spot >= 0 && !x.tied); if (!t) break;
        await drag(t.pos, [P.TRAY[0], P.TRAY[1] - 12]);
        if (shot) await page.screenshot({ path: shot + `-4-tray-${k}.png` });
      }
    }
    await until(() => !window.__game.story._dbg.icebox.isOpen, 'closes');
  }
  // Ume's greengrocer: a ring around a crate's goods, then tie the bundle
  async function grocer(items = ['salatalık'], { shot = '' } = {}) {
    const adv = (s) => debug ? page.evaluate((s) => window.__step(s), s) : page.waitForTimeout(s * 1000);
    await action('Ume’den alışveriş');
    await page.waitForFunction(() => window.__game.story._dbg.grocer.isOpen);
    await adv(1);
    for (const item of items) {
      const g = await page.evaluate((item) => window.__game.story._dbg.grocer._goods.find(g => g.item === item && g.on < 0), item);
      const ring = Array.from({ length: 24 }, (_, i) => { const a = i / 23 * Math.PI * 2; return [g.pos[0] + Math.cos(a) * 11, g.pos[1] + Math.sin(a) * 11]; });
      await stroke(await page.evaluate((pts) => pts.map((p) => window.__game.story._dbg.grocer._client(p)), ring), 25);
      await adv(.8);
    }
    if (shot) await page.screenshot({ path: shot + '-picked.png' });
    await page.locator('.cu-serve.show').tap();
    for (let i = 0; i < 20 && await page.evaluate(() => window.__game.story._dbg.grocer.isOpen); i++) await adv(.25);
  }
  async function choice(i) {
    await page.waitForSelector(".choices.show");
    await page.locator(".choices.show button").nth(i).tap();
  }
  async function ready() {
    await page.waitForFunction(() => window.__game.story.canSave);
  }
  const advance = (s) => debug ? page.evaluate((s) => window.__step(s), s) : page.waitForTimeout(s * 1000);
  async function home() {
    if (await page.evaluate(() => window.__game.inside)) return;
    await walkTo(457, 365);
    // the first time home, the stepping stones are only pencil: press them in on the beat
    if (!(await page.evaluate(() => window.__game.story._dbg.alley.built))) {
      for (let i = 0; i < 160 && !(await page.evaluate(() => window.__game.story._dbg.alley.playing)); i++) { await drive(0, (await page.evaluate(() => window.__game.story.mode)) === 'walk' ? -1 : 0); await advance(.15); }
      await drive(0, 0);
      await alley();
    }
    await walkTo(457, 327, { inside: true });
  }
  /** touch as each ring settles on its stone (late = a crooked stone, but always a stone) */
  async function alley({ shot = '' } = {}) {
    for (let i = 0; i < 120 && !(await page.evaluate(() => window.__game.story._dbg.alley.playing)); i++) await advance(.25);
    for (let k = 0; k < 5; k++) {
      for (let i = 0; i < 400; i++) { const ph = await page.evaluate(() => window.__game.story._dbg.alley.phase); if (ph > .9 && ph < .985) break; await advance(debug ? .02 : .01); }
      await page.touchscreen.tap(195, 300);
      await advance(.15);
      if (shot && k === 2) await page.screenshot({ path: shot });
    }
    for (let i = 0; i < 120 && (await page.evaluate(() => window.__game.story.mode)) !== 'walk'; i++) await advance(.25);
  }
  /** Hana's 茶: go over each faint stroke from its red dot */
  async function shodo() {
    await page.waitForSelector(".sh-order.show");
    await page.locator(".sh-order button").tap();
    await advance(.6);
    for (let k = 0; k < 14; k++) {
      const s = await page.evaluate(() => window.__game.story._dbg.shodo._stroke);
      if (!s) break;
      const pts = [];
      for (let j = 0; j < s.length - 1; j++) for (let u = 0; u < 1; u += .125) pts.push([s[j][0] + (s[j + 1][0] - s[j][0]) * u + Math.sin(j + u) * 1.5, s[j][1] + (s[j + 1][1] - s[j][1]) * u]);
      pts.push(s[s.length - 1]);
      await stroke(await page.evaluate((pts) => pts.map((pt) => window.__game.story._dbg.shodo._client(pt)), pts), 18);
      await advance(.25);
    }
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
    alley,
    shodo,
    parts,
    action,
    icebox,
    grocer,
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
