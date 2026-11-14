// Mürekkep Sokağı — steer a traveller through the ink village with a thumb joystick
// and gather the paper cranes. The village (street, canal, sky, villagers, critters)
// comes from github.com/JDhruv14/line-art-animation (MIT).
import { el, inkDefs, run, f } from "./lib/ink.js";
import { W, H, LANE, rnd, clamp, lerp, smooth, rgb, hex, mix } from "./village/kit.js";
import { createSky, palette } from "./village/sky.js";
import { buildStreet } from "./village/houses.js";
import { buildCanal } from "./village/canal.js";
import { createKimono, createCyclist, createKid, createBoat } from "./village/people.js";
import { createCat, createSparrows, createSwallows, createPetals, createSmoke } from "./village/critters.js";
import { createPlayer, Y_MIN } from "./player.js";
import { buildHome } from "./village/home.js";
import { buildFair } from "./village/fair.js";
import { createCranes } from "./cranes.js";
import { createJoystick } from "./joystick.js";
import { createUI } from "./story/ui.js";
import { createStory } from "./story/story.js";
import { approach } from "./story/fx.js";
const GOAL = 12;
// The village sets thousands of attributes per frame, many to the value they already
// have (a lamp that is off, a firefly at noon). Skipping those spares the browser from
// repainting things that did not change — the biggest win on phones.
const setAttr = Element.prototype.setAttribute;
Element.prototype.setAttribute = function (name, value) {
    const v = String(value);
    if (this.getAttribute(name) !== v)
        setAttr.call(this, name, v);
};
const q = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const card = $('#card');
const svg = el('svg', { class: 'village', role: 'img', viewBox: `0 0 ${W} ${H}`, 'aria-label': 'Mürekkeple çizilmiş bir Japon sokağı; joystick ile yürüyen bir yolcu.' });
const ink = inkDefs(svg, 'v');
$('#village').appendChild(svg);
const defs = ink.defs;
const grad = (id, stops, attrs = {}) => { const g = el(attrs.radial ? 'radialGradient' : 'linearGradient', attrs.radial ? { id } : { id, x1: 0, y1: 0, x2: 1, y2: 0 }, defs); stops.forEach(([o, c, a]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g)); };
grad('v-beamR', [[0, '#fff1c2', 0.55], [1, '#fff1c2', 0]]);
grad('v-beamL', [[0, '#fff1c2', 0], [1, '#fff1c2', 0.55]]);
grad('v-cateye', [[0, '#e8ff9a', 1], [1, '#c8ff6a', 0]], { radial: true });
const layer = (parent = svg, attrs = {}) => el('g', attrs, parent);
const skyL = layer();
// The ink-wobble filter is costly over the whole scene, so it only goes on the moving figures
// (a strip along the street). ?ink puts it back on everything.
// Safari renders SVG filters on the CPU, so on touch screens the figures go without it too.
const INK_FIGURES = !q.has('ink') && !q.has('flat') && !matchMedia('(pointer: coarse)').matches;
const scene = layer(svg, q.has('ink') ? { filter: ink.filter } : {});
const back = layer(scene), birdsL = layer(scene), ground = layer(scene), houses = layer(scene), front = layer(scene);
const catL = layer(scene), shadowsL = layer(scene), walkers = layer(scene, INK_FIGURES ? { filter: ink.filter } : {}), canalL = layer(scene), boatL = layer(scene), willowL = layer(scene), petalL = layer(scene, { style: 'pointer-events:none' });
// screen-blending the glows makes Safari composite the whole scene off-screen every frame
const glow = layer(svg, { style: (q.has('blend') ? 'mix-blend-mode:screen;' : '') + 'pointer-events:none' });
const strokeL = layer(svg, { style: 'pointer-events:none' }); // brush ink drawn by the player
// ------------------------------------------------------------------ time
// the story is the default; ?turna brings back the timed paper-crane game
const STORY = !q.has('turna');
let tau = q.has('tau') ? +q.get('tau') : q.has('start') ? +q.get('start') : STORY ? 0.3 : 0.64;
let scrub = null;
const frozenTau = q.has('tau');
const DAY_SECONDS = q.has('day') ? +q.get('day') : STORY ? 420 : 150;
// ------------------------------------------------------------------ wind from the pointer
let wind = 0.3, windTarget = 0.3, lastX = null, lastT = 0;
svg.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (lastX !== null && !svg.classList.contains('scrubbing'))
        windTarget = clamp(windTarget + ((e.clientX - lastX) / Math.max(8, now - lastT)) * 0.8, -2.4, 2.4);
    lastX = e.clientX;
    lastT = now;
});
const on = (node, fn) => node.addEventListener('pointerdown', (e) => { e.stopPropagation(); fn(e); });
const toSvg = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
// ------------------------------------------------------------------ world
const sky = createSky(svg, skyL, defs, {
    onScrub: (v) => { scrub = v; if (v !== null)
        tau = v; },
    onShoot: () => palette(tau).night > 0.4,
    draggable: !STORY, // in the story, time is not yours to push
});
const street = buildStreet({ back, houses, front, glow }, defs);
const canal = buildCanal({ ground, canalL, willowL, glow }, defs);
const smoke = createSmoke(back, street.chimney);
const sparrows = createSparrows(birdsL, { wireY: street.wireY });
const swallows = createSwallows(birdsL);
const petals = createPetals(petalL, { blossoms: street.blossoms, canal });
const cat = createCat(catL, glow, { x: 548, y: 330 });
const boat = createBoat(boatL, glow, { onRipple: (x, y) => canal.ring(x, y, 2) });
street.windows.forEach((w) => canal.addRefl(() => w.lit, (w.x0 + w.x1) / 2, Math.min(40, (w.x1 - w.x0) * 0.8)));
street.lanterns.forEach((l) => canal.addRefl(() => smooth(l.thr, l.thr + 0.2, P.lamp), l.x, 8));
canal.addRefl(() => smooth(0.2, 0.45, P.lamp), street.lamp.x, 14);
street.lanterns.forEach((l) => { l.grp.style.cursor = 'pointer'; on(l.grp, () => l.poke()); });
street.norens.forEach((n) => { n.grp.style.cursor = 'pointer'; on(n.grp, () => n.poke()); });
const hits = layer(scene);
const hitPath = (d, fn) => { const n = el('path', { d, fill: 'transparent', style: 'cursor:pointer' }, hits); on(n, fn); return n; };
hitPath(street.shoji.hit, () => street.shoji.poke());
hitPath('M402 202 L422 202 L422 236 L402 236Z', () => street.furin.poke());
let shake = 0;
const shakeTree = (n = 46) => { shake = 1; petals.burst(n); };
on(street.canopy, () => shakeTree());
on(sparrows.hit, () => sparrows.flush());
on(cat.hit, () => cat.poke());
on(boat.g, () => boat.poke());
on(willowL, () => canal.willowPoke());
const waterHit = el('rect', { x: 0, y: 400, width: W, height: H - 300, fill: 'transparent' }, canalL);
on(waterHit, (e) => { const p = toSvg(e); canal.poke(p.x, p.y); });
canalL.insertBefore(waterHit, canalL.children[2] || null);
// ------------------------------------------------------------------ villagers
const people = [];
const spawn = { kimono: 2, bike: 7, kid: 4 };
function addPerson(kind, x) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const sx = x ?? (dir > 0 ? -60 : W + 60);
    let p;
    if (kind === 'kimono')
        p = createKimono(walkers, glow, { dir, x: sx, y: LANE.back + rnd(-1, 1), lantern: P.lamp > 0.5 });
    if (kind === 'bike')
        p = createCyclist(walkers, glow, { dir, x: sx, y: LANE.front + rnd(-1, 1) });
    if (kind === 'kid')
        p = createKid(walkers, glow, { dir, x: sx, y: LANE.mid + rnd(-1, 1) });
    p.greeted = false;
    on(p.g, () => p.poke());
    people.push(p);
}
// ------------------------------------------------------------------ you, the cranes, the joystick
const player = createPlayer(walkers, q.has('x') ? +q.get('x') : 200, 368);
const cranes = createCranes(walkers, shadowsL, glow);
const stick = createJoystick(card, $('#stick'), $('#knob'));
// ------------------------------------------------------------------ the bath house at the end of the street is home
const home = buildHome(svg);
const DOOR = { x: 457, w: 12 }; // the gate at the end of the middle alley
// walking home means walking into the alley: up the stepping stones to the gate
const ALLEY = { x: 457, mouth: 12, deep: 326, enter: 332, x0: 450, x1: 464 };
let exitHold = 0;
const STREET = { bounds: { x0: 14, x1: 946 }, view: { x0: 0, x1: W } };
let inside = false, inFair = false, fade = 0, fadeTo = 0, pending = null, hintUntil = -1, tNow = 0, tipUntil = -1;
const fadeN = $('#fade'), actN = $('#act');
const go = (fn) => { if (!pending) {
    pending = fn;
    fadeTo = 1;
} };
function enter() {
    inside = true;
    [skyL, scene, glow, strokeL].forEach((n) => (n.style.display = 'none'));
    home.root.style.display = '';
    home.actors.appendChild(player.g);
    player.x = home.spawn.x;
    player.y = home.spawn.y;
    player.setHeading(Math.PI / 2);
    player.bounds = { ...home.bounds, y0: Y_MIN };
    camSnap = true;
    if (!STORY && home.made === 0) {
        hintN.innerHTML = 'Mutfağa geç, tezgâhta suşi hazırla.';
        hintN.classList.remove('gone');
        hintUntil = tNow + 4;
    }
}
function exit() {
    inside = false;
    [skyL, scene, glow, strokeL].forEach((n) => (n.style.display = ''));
    home.root.style.display = 'none';
    walkers.appendChild(player.g);
    // you come out of the gate, at the far end of the alley, facing the street
    player.x = DOOR.x;
    player.y = STORY ? ALLEY.enter + 4 : Y_MIN + 3;
    player.setHeading(Math.PI / 2);
    player.bounds = { ...STREET.bounds, y0: STORY ? ALLEY.deep : Y_MIN };
    camSnap = true;
}
const atDoor = () => !inside && !inFair && Math.abs(player.x - DOOR.x) < DOOR.w && player.y < 362;
// ------------------------------------------------------------------ the summer fair, past the west end of the street
const fair = buildFair(svg, { glow: 'url(#v-warmglow)' });
svg.insertBefore(fair.root, home.root);
// a signpost and two lanterns at the street's west end point the way
const sign = layer(front);
sign.innerHTML = `<path d="M24 352 L24 296 M30 352 L30 296" fill="none" stroke="currentColor" stroke-width="1.1"/>
  <path d="M14 300 L44 300 L48 307 L44 314 L14 314Z" fill="#e8d2a6" stroke="currentColor" stroke-width="0.7"/>
  <text x="29" y="307.4" font-size="9" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="#c8423a" font-family='"Hiragino Mincho ProN","Yu Mincho",serif'>祭</text>
  <path d="M20 307 l-4 0 m2 -2 l-2 2 l2 2" fill="none" stroke="currentColor" stroke-width="0.6"/>`;
let fairSeen = false;
function enterFair() {
    inFair = true;
    [skyL, scene, glow, strokeL].forEach((n) => (n.style.display = 'none'));
    fair.root.style.display = '';
    fair.actors.appendChild(player.g);
    player.x = fair.spawn.x;
    player.y = fair.spawn.y;
    player.setHeading(0);
    player.bounds = { ...fair.bounds, y0: Y_MIN };
    camSnap = true;
    if (!fairSeen && STORY) {
        fairSeen = true;
        story?.onFair();
    }
}
function exitFair() {
    inFair = false;
    [skyL, scene, glow, strokeL].forEach((n) => (n.style.display = ''));
    fair.root.style.display = 'none';
    walkers.appendChild(player.g);
    player.x = 40;
    player.y = 362;
    player.setHeading(0);
    player.bounds = { ...STREET.bounds, y0: Y_MIN };
    camSnap = true;
}
const atFairGate = () => !inside && player.x < 44;
function act() {
    if (pending || winN.classList.contains('show'))
        return;
    if (story?.act())
        return;
    if (!inside && atFairGate()) {
        go(inFair ? exitFair : enterFair);
        return;
    }
    if (!inside) {
        if (atDoor() && !STORY)
            go(enter);
        return;
    }
    const r = home.act(player);
    if (r === 'exit')
        go(exit);
    else if ((r === 'cook' || r === 'sleep') && story)
        story.onHome(r);
}
actN.addEventListener('click', act);
addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key.toLowerCase() === 'e') {
    e.preventDefault();
    act();
} });
// ------------------------------------------------------------------ camera: follows you, or frames what the story wants
const VBCAM = !q.has('slide');
let vb = { x: 0, y: 0, w: W, h: H }, cardW = 1, cardH = 1;
let cam = { cx: 0, cy: 0, z: 1 }, camSnap = true;
// framing rules (portrait first): a little zoom, the figure two-thirds down — above the thumb —
// room ahead of where you walk, and a dead zone so small steps don't move the picture
const OLD_CAM = q.get('cam') === 'eski';
let camAnchor = 0, camLead = 0, idleT = 0;
function frame() {
    const r = card.getBoundingClientRect();
    cardW = r.width;
    cardH = r.height;
    const aspect = r.width / Math.max(1, r.height);
    const w = clamp(H * aspect, 200, aspect > 1.2 ? 820 : W);
    const h = Math.min(H, w / aspect);
    vb.w = w;
    vb.h = h;
    vb.y = H - h;
    // the whole street is drawn once at screen scale and the camera just slides it (GPU),
    // instead of changing the viewBox, which would repaint every line every frame
    k = r.width / w;
    if (VBCAM) {
        svg.style.width = `${r.width}px`;
        svg.style.height = `${r.height}px`;
        svg.setAttribute('preserveAspectRatio', 'xMidYMax slice');
    }
    else {
        svg.style.width = `${W * k}px`;
        svg.style.height = `${H * k}px`;
    }
}
let k = 1;
addEventListener('resize', frame);
frame();
// ------------------------------------------------------------------ game state & hud
const countN = $('#count'), timeN = $('#time'), hintN = $('#hint'), winN = $('#win');
let score = 0, elapsed = 0, playing = true, best = Infinity;
try {
    best = +(localStorage.getItem('ink-best') ?? Infinity) || Infinity;
}
catch { }
const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const bump = () => { countN.classList.remove('bump'); void countN.offsetWidth; countN.classList.add('bump'); };
function reset() {
    score = 0;
    elapsed = 0;
    playing = true;
    winN.classList.remove('show');
    countN.textContent = `0 / ${GOAL}`;
    if (!cranes.list.some((c) => c.state === 'hover' && Math.abs(c.x - player.x) < 120))
        cranes.spawn(player.x, player.x + (player.x > 800 ? -75 : 75));
    while (cranes.list.filter((c) => c.state === 'hover').length < 3)
        cranes.spawn(player.x);
}
$('#again').addEventListener('click', reset);
if (!STORY)
    reset();
else {
    card.classList.add('story');
    $('.score').style.display = 'none';
    hintN.textContent = '';
    hintN.classList.add('gone');
}
// ------------------------------------------------------------------ the story: signs in the world, scenes, the close-up kitchen
const bannerN = $('#banner');
const ui = STORY ? createUI(svg) : null;
const story = STORY && ui ? createStory({
    svg, card, ui, home, player, cat,
    layers: { front, walkers, glow, stroke: strokeL },
    env: {
        setTau: (v) => { tau = v; },
        fade: (v) => { fadeTo = v; },
        isFaded: () => fade >= 1,
        isOpened: () => opened,
        tip: (text, sticky = false) => { if (text) {
            hintN.textContent = text;
            hintN.classList.remove('gone');
            tipUntil = sticky ? Infinity : tNow + 4.5;
        }
        else {
            hintN.classList.add('gone');
            tipUntil = -1;
        } },
        banner: (a, b) => { bannerN.innerHTML = `<b>${a}</b><span>${b}</span>`; bannerN.classList.remove('show'); void bannerN.offsetWidth; bannerN.classList.add('show'); },
    },
}) : null;
card.addEventListener('pointerdown', (e) => story?.touch(e), true);
// ------------------------------------------------------------------ opening: two shoji doors slide apart
const openingN = $('#opening');
let opened = !STORY || (q.has('debug') && !q.has('opening'));
if (opened)
    openingN.remove();
else
    openingN.addEventListener('click', () => {
        if (opened)
            return;
        opened = true;
        openingN.classList.add('open');
        story?.opened();
        setTimeout(() => openingN.remove(), 2400);
    });
const near = (a, b, dx, ay, by, dy) => Math.abs(a - b) < dx && Math.abs(ay - by) < dy;
let cdCat = 0, cdBirds = 0, cdTree = 0;
const clock = $('#clock');
const period = (h) => (h < 4 ? 'gece yarısı' : h < 6 ? 'şafak' : h < 10 ? 'sabah' : h < 15 ? 'öğle' : h < 17.5 ? 'ikindi' : h < 19.5 ? 'akşam' : 'gece');
// ------------------------------------------------------------------ frame
let P = palette(tau), lastInk = '', lastPaper = '';
let started = false;
run((t, dt) => {
    dt = dt || 1 / 60;
    if (scrub === null && !frozenTau)
        tau = (tau + dt / DAY_SECONDS) % 1;
    P = palette(tau);
    // restyle only when the colour actually changes: every change restyles every line
    const inkS = rgb(P.ink), paperS = rgb(P.paper);
    if (inkS !== lastInk) {
        lastInk = inkS;
        svg.style.color = inkS;
        card.style.setProperty('--ink', inkS);
    }
    if (paperS !== lastPaper) {
        lastPaper = paperS;
        svg.style.setProperty('--paper', paperS);
        card.style.setProperty('--paper', paperS);
    }
    windTarget = lerp(windTarget, 0.3 + 0.25 * Math.sin(t * 0.21) + 0.15 * Math.sin(t * 0.67), 0.012);
    wind = lerp(wind, windTarget, 0.05);
    // you
    tNow = t;
    let j = stick.read();
    const lock = inside ? home.lock : null;
    if (pending || lock || story?.freeze)
        j = { x: 0, y: 0 };
    if (lock) {
        const e = 1 - Math.exp(-dt * 10);
        player.x = lerp(player.x, lock.x, e);
        player.y = lerp(player.y, lock.y, e);
    }
    player.faceTo = lock ? lock.heading : null;
    player.pose = inside ? home.pose : { work: 0, chop: 0, hold: 0 };
    // the alley: past its mouth you can walk in, growing smaller, the street falling behind
    let alleyDepth = 0;
    if (STORY && !inside && !inFair) {
        const deep = player.y < Y_MIN - 0.5, inMouth = Math.abs(player.x - ALLEY.x) < ALLEY.mouth;
        player.bounds = deep ? { x0: ALLEY.x0, x1: ALLEY.x1, y0: ALLEY.deep } : { ...STREET.bounds, y0: inMouth ? ALLEY.deep : Y_MIN };
        alleyDepth = clamp((Y_MIN - player.y) / (Y_MIN - ALLEY.deep), 0, 1);
        player.scale = 1 - alleyDepth * 0.3;
        if (player.y < ALLEY.enter && j.y < -0.2 && !pending)
            go(enter);
    }
    else
        player.scale = 1;
    // inside: walk to the genkan door and keep going, and you are out
    if (STORY && inside && !pending && !story?.freeze) {
        const atGenkan = Math.abs(player.x - (home.spawn.x - 4)) < 22 && player.y <= Y_MIN + 1.5;
        exitHold = atGenkan && j.y < -0.35 ? exitHold + dt : 0;
        if (exitHold > 0.3) {
            exitHold = 0;
            go(exit);
        }
    }
    player.update(t, dt, j.x, j.y, P, wind);
    if (!STORY && stick.touched && t > hintUntil)
        hintN.classList.add('gone');
    if (STORY && tipUntil > 0 && t > tipUntil) {
        hintN.classList.add('gone');
        tipUntil = -1;
    }
    if (inside)
        home.draw(t, dt, P, player);
    if (inFair)
        fair.draw(t, dt, P, wind, player);
    // fade through the paper when going in or out
    fade = clamp(fade + (fadeTo ? dt : -dt) * 3.4, 0, 1);
    if (fade >= 1 && pending) {
        pending();
        pending = null;
        fadeTo = 0;
    }
    fadeN.style.opacity = f(fade);
    story?.update({ t, dt, P, wind, tau, inside, fair: inFair, base: { w: vb.w, h: vb.h }, stickActive: stick.active, stickTouched: stick.touched });
    const sp = story ? story.prompt() : null;
    const hp = inside ? home.prompt(player) : null;
    const label = pending || sp === '' ? null : sp ?? (inside ? (STORY && hp === 'Dışarı çık' ? null : hp) : atFairGate() ? (inFair ? 'Sokağa dön' : 'Panayıra git') : atDoor() && !winN.classList.contains('show') && !STORY ? 'İçeri gir' : null);
    if (label && actN.textContent !== label)
        actN.textContent = label;
    actN.classList.toggle('show', !!label);
    // camera: eases after you and leads a little where you face, or glides to what the story frames
    const view = inside ? home.view : inFair ? fair.view : STREET.view;
    // inside, the room is framed a little closer than the street
    let follow;
    if (OLD_CAM)
        follow = inside && STORY ? { cx: player.x + player.face * vb.w * 0.05, cy: 324, z: Math.min(1.5, vb.h / 200) } : { cx: player.x + player.face * vb.w * 0.08, cy: H - vb.h / 2, z: 1 };
    else {
        const portrait = cardW / Math.max(1, cardH) < 0.8;
        const z = inside ? Math.min(1.5, vb.h / 200) : portrait ? 1.08 : 1;
        const w = vb.w / z, h = vb.h / z;
        // dead zone: the anchor only moves when you get more than a little way from it
        const dz = w * 0.1;
        if (camSnap)
            camAnchor = player.x;
        if (player.x - camAnchor > dz)
            camAnchor = player.x - dz;
        else if (camAnchor - player.x > dz)
            camAnchor = player.x + dz;
        // standing still a while: drift back to centre you
        idleT = player.moving > 0.05 ? 0 : idleT + dt;
        if (idleT > 1.2)
            camAnchor = approach(camAnchor, player.x, 0.6, dt);
        // lead from where you are actually going, not where you face
        const vx = Math.cos(player.heading) * player.moving * Math.min(1, player.speed / 30);
        camLead = approach(camLead, vx * w * 0.17, player.moving > 0.05 ? 1.1 : 0.7, dt);
        // feet two-thirds of the way down the frame (street level ~366, floor ~362)
        const ratio = portrait || inside ? 0.67 : 0.76;
        follow = { cx: camAnchor + camLead, cy: (inside ? 362 : 366) - (ratio - 0.5) * h, z };
        if (alleyDepth > 0)
            follow = { cx: lerp(follow.cx, ALLEY.x, alleyDepth), cy: lerp(follow.cy, 300, alleyDepth * 0.8), z: z * (1 + alleyDepth * 0.7) };
    }
    const want = story?.cam ?? follow;
    if (camSnap) {
        cam = { ...want };
        camSnap = false;
    }
    else {
        const rate = story?.cam ? 2.4 : 3.5;
        cam.cx = approach(cam.cx, want.cx, rate, dt);
        cam.cy = approach(cam.cy, want.cy, rate, dt);
        cam.z = Math.exp(approach(Math.log(cam.z), Math.log(want.z), rate * 0.9, dt));
    }
    const cw = vb.w / cam.z, ch = vb.h / cam.z;
    let cx0 = cam.cx - cw / 2;
    cx0 = view.x1 - view.x0 <= cw ? (view.x0 + view.x1 - cw) / 2 : clamp(cx0, view.x0, view.x1 - cw);
    const cy0 = clamp(cam.cy - ch / 2, 0, (OLD_CAM || inside ? H : H + 90) - ch);
    vb.x = cx0;
    if (VBCAM)
        svg.setAttribute('viewBox', `${f(cx0)} ${f(cy0)} ${f(cw)} ${f(ch)}`);
    else
        svg.style.transform = `translate3d(${f(-vb.x * k)}px, ${f(-vb.y * k)}px, 0)`;
    if (ui) {
        const ppu = Math.max(cardW / cw, cardH / ch), vw = cardW / ppu, vh = cardH / ppu;
        ui.draw(dt, ppu, { x: cx0 + (cw - vw) / 2, y: cy0 + (ch - vh), w: vw, h: vh });
    }
    sky.draw(tau, t, dt, P, wind);
    street.applyRed(P);
    const sinceDusk = (tau - 0.75 + 1) % 1;
    street.windows.forEach((w) => {
        let lit = smooth(w.thr, w.thr + 0.25, P.lamp);
        if (w.lateOff < 9 && sinceDusk > w.lateOff - 0.75 && sinceDusk < 0.5)
            lit = 0;
        w.lit = lerp(w.lit, lit, 0.08);
        const fill = rgb(mix(P.paper, mix(hex('#ffd58a'), hex('#f0a24e'), w.warmth), w.lit * 0.92));
        if (fill !== w.lastFill) {
            w.lastFill = fill;
            w.n.style.fill = fill;
            w.glow.setAttribute('opacity', f(w.lit * 0.8));
        }
    });
    const L = street.lamp, lampOn = smooth(0.2, 0.45, P.lamp);
    const lampS = rgb(mix(P.paper, hex('#fff1c9'), lampOn));
    if (lampS !== L.last) {
        L.last = lampS;
        L.node.style.fill = lampS;
        L.cone.setAttribute('opacity', f(lampOn * 0.75));
        L.glow.setAttribute('opacity', f(lampOn));
    }
    street.norens.forEach((n) => n.draw(t, dt, wind, tau, P));
    street.lanterns.forEach((l) => l.draw(t, dt, wind, P));
    street.furin.draw(t, dt, wind);
    street.shoji.draw(t, dt, P);
    shake = Math.max(0, shake - dt * 1.5);
    street.canopy.setAttribute('transform', `translate(${f(Math.sin(t * 40) * shake * 2.4 + wind * 0.9)} ${f(Math.cos(t * 31) * shake * 1.2)})`);
    smoke.draw(t, dt, P, wind, tau);
    sparrows.draw(t, dt, P);
    swallows.draw(t, dt, P);
    petals.draw(t, dt, P, wind);
    cat.draw(t, dt, P);
    canal.draw(t, dt, P, wind, null, tau, lampOn);
    boat.draw(t, dt, P, wind);
    // the world notices you
    cdCat -= dt;
    cdBirds -= dt;
    cdTree -= dt;
    if (cdCat < 0 && near(player.x, 548, 26, player.y, 352, 4)) {
        cat.poke();
        cdCat = 12;
    }
    if (cdBirds < 0 && !inside && player.running > 0.6 && player.x > 520) {
        sparrows.flush();
        cdBirds = 8;
    }
    if (cdTree < 0 && player.running > 0.6 && player.x > 405 && player.x < 515 && player.y < 360) {
        shakeTree(24);
        cdTree = 7;
    }
    // villagers
    if (!started) {
        started = true;
        addPerson('kimono', 520);
        addPerson('kimono', 860);
        addPerson('bike', 700);
    }
    const dayish = tau > 0.28 && tau < 0.72, lateNight = tau > 0.96 || tau < 0.22;
    for (const k in spawn) {
        spawn[k] -= dt * 1.4;
        if (spawn[k] < 0) {
            if (k === 'kimono') {
                spawn[k] = rnd(9, 16);
                if (!lateNight || Math.random() < 0.3)
                    addPerson('kimono');
            }
            if (k === 'bike') {
                spawn[k] = rnd(9, 16);
                if (!lateNight)
                    addPerson('bike');
            }
            if (k === 'kid') {
                spawn[k] = rnd(12, 22);
                if (dayish && !STORY)
                    addPerson('kid');
            } // in the story, Kenta is the only boy on the street
        }
    }
    for (let i = people.length - 1; i >= 0; i--) {
        const p = people[i];
        p.draw(t, dt, P, wind);
        if (!p.greeted && near(p.x, player.x, 18, p.y, player.y, 7)) {
            p.greeted = true;
            p.poke();
        }
        if (p.done) {
            p.remove();
            people.splice(i, 1);
        }
        else if (p.ringing && Math.random() < dt * 4)
            sparrows.flush();
    }
    // cranes
    const got = cranes.draw(t, dt, P, inside ? -9999 : player.x, player.y, player.dir);
    if (got && playing) {
        score += got;
        bump();
        countN.textContent = `${Math.min(score, GOAL)} / ${GOAL}`;
        if (score >= GOAL) {
            playing = false;
            const isBest = elapsed < best;
            if (isBest) {
                best = elapsed;
                try {
                    localStorage.setItem('ink-best', String(best));
                }
                catch { }
            }
            $('#winTime').textContent = fmt(elapsed);
            $('#winBest').textContent = isBest ? 'yeni rekor!' : `en iyi ${fmt(best)}`;
            winN.classList.add('show');
        }
    }
    if (!STORY && playing && !inside && cranes.list.filter((c) => c.state === 'hover').length < 3)
        cranes.spawn(player.x);
    if (!STORY && playing && !inside && stick.touched)
        elapsed += dt;
    timeN.textContent = fmt(elapsed);
    // depth: whoever is nearer the canal is drawn in front
    const all = [...people, ...(inside || inFair ? [] : [player]), ...(story ? story.sortables() : []), ...cranes.list.map((c) => ({ g: c.g, y: c.y + 0.5 }))];
    all.sort((a, b) => a.y - b.y);
    let prev = null;
    for (const p of all) {
        if (p.g.previousElementSibling !== prev)
            walkers.insertBefore(p.g, prev ? prev.nextSibling : walkers.firstChild);
        prev = p.g;
    }
    const hrs = tau * 24, h = Math.floor(hrs), m = Math.floor((hrs - h) * 60);
    clock.innerHTML = `<b>${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}</b> <span>${period(hrs)}</span>`;
});
window.__game = { player, cranes, people, home, act, enter, exit, story, ui, get tau() { return tau; }, setTau: (v) => { tau = v; }, get score() { return score; }, get inside() { return inside; }, get inFair() { return inFair; }, enterFair, exitFair };
