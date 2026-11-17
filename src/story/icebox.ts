// The wooden icebox, up close. Each thing you do in it is one brush verb:
//   1 · open   — take the brass handle and swing the door open
//   2 · wipe   — the inside has misted over; wipe it with your finger to see the shelves
//   3 · cut    — the salmon is wrapped in paper and tied: one stroke across the string cuts it
//   4 · take   — lower the fish onto the bamboo tray below
// What is missing is drawn as a dashed outline, the way the notebook draws unfinished things:
// touch one and the traveller makes a mental note (that is the shopping list for the market).
import { f, pt, type Vec } from '../lib/ink.ts';
import { sfx, haptic, clamp01, lerp, easeOut, easeInOut, backOut, approach } from './fx.ts';

const NS = 'http://www.w3.org/2000/svg';
type Attrs = Record<string, string | number>;
function mk<K extends keyof SVGElementTagNameMap>(tag: K, a: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const k in a) n.setAttribute(k, String(a[k]));
  parent?.appendChild(n);
  return n;
}
const INK = 'currentColor', PAPER = '#fff9ed';
const ink = (g: Element, d: string, w = 2, extra: Attrs = {}) => mk('path', { d, fill: 'none', stroke: INK, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra }, g);
const fill = (g: Element, d: string, c: string, w = 2, extra: Attrs = {}) => mk('path', { d, fill: c, stroke: INK, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra }, g);
const rect = (x0: number, y0: number, x1: number, y1: number) => `M${x0} ${y0}H${x1}V${y1}H${x0}Z`;
const ell = (cx: number, cy: number, rx: number, ry: number) => `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`;
const C = { wood: '#d9b380', woodLight: '#e4c493', woodDark: '#b98c58', zinc: '#dcd8cc', brass: '#c9a24a', ice: '#e3eeec', salmon: '#ec8c5f', paper: '#f5ead2', plum: '#c8423a', ginger: '#f2b3b0', bamboo: '#d8bf86' };

// the box, in a 320 × 540 sheet
const BOX = { x0: 36, x1: 284, y0: 56, y1: 490 };
const IN = { x0: 52, x1: 268, y0: 164, y1: 470 };     // the food compartment behind the door
const HINGE = 50, HANDLE: Vec = [252, 320];
const PKG = { cx: 112, cy: 237, w: 78, h: 34 };       // the paper-wrapped salmon on the top shelf
const TRAY: Vec = [160, 516];

export type IceboxMissing = 'salatalık' | 'mandalina';
const MISSING: { id: IceboxMissing; name: string; at: Vec; d: string }[] = [
  { id: 'salatalık', name: 'Salatalık', at: [244, 344], d: 'M210 356 Q214 344 258 334 Q266 334 264 340 Q222 356 214 360 Q208 360 210 356Z M214 346 Q218 334 254 324 Q262 324 260 330 Q224 344 218 350 Q212 350 214 346Z' },
  { id: 'mandalina', name: 'Mandalina', at: [112, 446], d: `${ell(92, 452, 14, 12)} ${ell(124, 454, 14, 12)} ${ell(108, 434, 13, 11)} M108 423 q4 -6 10 -5` },
];

export function createIcebox(card: HTMLElement, { onTake, onExit, onNote }: { onTake: () => void; onExit: () => void; onNote: (missing: IceboxMissing[]) => void }) {
  const svg = mk('svg', { class: 'icebox-view', viewBox: '0 0 320 540', preserveAspectRatio: 'xMidYMid meet', 'data-icebox': '' }) as SVGSVGElement;
  svg.style.display = 'none'; svg.style.opacity = '0';
  card.appendChild(svg);
  const back = document.createElement('button'); back.className = 'cu-back'; back.type = 'button'; back.textContent = '‹ Geri'; card.appendChild(back);
  const title = document.createElement('div'); title.className = 'cu-title'; card.appendChild(title);
  const tip = document.createElement('div'); tip.className = 'cu-tip'; card.appendChild(tip);
  [back, title, tip].forEach(n => (n.style.display = 'none'));

  const world = mk('g', {}, svg);
  // the kitchen wall and floor, out of focus
  mk('rect', { x: -400, y: -400, width: 1120, height: 1400, fill: '#f8efdb' }, world);
  const planks: string[] = []; for (let x = -390; x < 720; x += 22) planks.push(`M${x} -400V500`);
  ink(world, planks.join(''), .8, { opacity: .25 });
  fill(world, 'M-400 500H720V1000H-400Z', '#c49a66', 2);
  ink(world, 'M-400 512H720', .8, { opacity: .35 });

  // the box itself
  fill(world, rect(BOX.x0, BOX.y0, BOX.x1, BOX.y1), C.wood, 2.4);
  fill(world, rect(BOX.x0 + 10, BOX.y1, BOX.x0 + 26, BOX.y1 + 10) + rect(BOX.x1 - 26, BOX.y1, BOX.x1 - 10, BOX.y1 + 10), C.woodDark, 2);
  ink(world, `M${BOX.x0 + 6} ${BOX.y0 + 6}H${BOX.x1 - 6}`, .7, { opacity: .4 });
  // the ice chamber, open behind a little lattice: a block of ice, sweating
  fill(world, rect(52, 70, 268, 150), '#c9d6d2', 2);
  const iceBlock = fill(world, 'M70 146 L76 84 L244 80 L250 146Z', C.ice, 2);
  ink(world, 'M120 92 l10 22 l-6 14 M190 88 l-8 18 l12 20 M154 100 l4 10', 1.1, { opacity: .55 });
  ink(world, 'M84 94 l18 -2 M214 92 l20 -1', 2.2, { stroke: '#ffffff', opacity: .8 });
  const lattice: string[] = []; for (let x = 70; x < 268; x += 22) lattice.push(`M${x} 70V150`);
  ink(world, lattice.join('') + 'M52 110H268', 2.6, { stroke: C.woodDark });
  ink(world, lattice.join('') + 'M52 110H268', .8);
  const drips = [0, 1, 2].map(() => mk('ellipse', { rx: 1.6, ry: 2.4, fill: '#cfe3e0', stroke: INK, 'stroke-width': .8, opacity: 0 }, world));
  void iceBlock;

  // the food compartment, zinc-lined, two shelves
  fill(world, rect(IN.x0, IN.y0, IN.x1, IN.y1), C.zinc, 2);
  ink(world, 'M52 262H268 M52 366H268', 3.2);
  ink(world, 'M52 268H268 M52 372H268', .7, { opacity: .45 });
  const contents = mk('g', {}, world);
  // top shelf: soy sauce, a saucer of pickled ginger
  fill(contents, 'M200 262 L200 214 Q200 204 206 200 L206 190 L216 190 L216 200 Q222 204 222 214 L222 262Z', '#5b4237', 1.8);
  fill(contents, rect(203, 222, 219, 244), PAPER, 1.2);
  mk('text', { x: 211, y: 238, 'text-anchor': 'middle', 'font-size': 11, 'font-family': '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif', fill: INK }, contents).textContent = '醤';
  fill(contents, 'M234 262 Q234 254 252 254 Q270 254 268 262Z', PAPER, 1.6);
  fill(contents, 'M240 256 q6 -8 12 -2 q6 -6 10 2Z', C.ginger, 1.2);
  // middle shelf: a bowl of eggs, the plum jar with a blank label
  fill(contents, ell(84, 340, 11, 13) + ell(104, 338, 11, 13) + ell(94, 330, 11, 13), PAPER, 1.6);
  fill(contents, 'M66 344 Q70 366 94 366 Q118 366 122 344Z', '#b98c58', 1.8);
  fill(contents, 'M156 366 L156 318 Q156 312 162 312 L194 312 Q200 312 200 318 L200 366Z', '#eef3f0', 1.6, { opacity: .95 });
  [[166, 352], [182, 356], [174, 340], [190, 340], [168, 326]].forEach(([x, y]) => fill(contents, ell(x, y, 6, 5.4), C.plum, 1.2));
  fill(contents, rect(154, 304, 202, 314), C.woodDark, 1.6);
  fill(contents, rect(164, 330, 192, 348), PAPER, 1.1, { 'data-jar-label': '' });
  // bottom: a covered miso pot
  fill(contents, 'M196 470 Q192 430 230 428 Q268 430 264 470Z', '#a9774b', 1.8);
  fill(contents, 'M194 430 Q230 418 266 430 Q230 438 194 430Z', '#c49a66', 1.6);
  ink(contents, 'M230 420 v-6', 3);

  // what is missing: dashed outlines, breathing a little
  const ghosts = MISSING.map((m) => {
    const g = mk('g', { 'data-missing': m.id, style: 'cursor:pointer' }, contents);
    mk('path', { d: m.d, fill: 'transparent', stroke: INK, 'stroke-width': 1.5, 'stroke-dasharray': '4 4', 'stroke-linecap': 'round', opacity: .55 }, g);
    const note = mk('g', { opacity: 0 }, g);
    const nw = m.name.length * 6.4 + 34;
    fill(note, `M${m.at[0] - nw / 2} ${m.at[1] - 44} h${nw} v20 h${-nw / 2 + 4} l-4 6 l-4 -6 h${-nw / 2 + 4}Z`, PAPER, 1.1);
    mk('text', { x: m.at[0], y: m.at[1] - 30, 'text-anchor': 'middle', 'font-size': 11, 'font-style': 'italic', 'font-family': '"Iowan Old Style", Georgia, serif', fill: INK }, note).textContent = `${m.name} bitmiş`;
    return { ...m, g, note, t: -1 };
  });

  // the salmon in its paper, tied with a string
  const fish = mk('g', { 'data-icebox-fish': '' }, contents);
  const fishBody = fill(fish, rect(-34, -13, 34, 15), C.salmon, 1.8);
  ink(fish, 'M-26 12 L-14 -10 M-12 12 L0 -10 M2 12 L14 -10 M16 12 L26 -6', 2.2, { stroke: '#fff3e6' });
  const wrapL = fill(fish, 'M-39 -17 L0 -17 L0 17 L-39 17Z', C.paper, 1.8);
  const wrapR = fill(fish, 'M0 -17 L39 -17 L39 17 L0 17Z', C.paper, 1.8);
  const wrapFold = ink(fish, 'M-39 -17 L-30 -8 M39 -17 L30 -8 M-39 17 L-30 8 M39 17 L30 8', .9, { opacity: .55 });
  const stringH = [ink(fish, 'M-39 1 L0 1', 1.6, { stroke: '#8a5a3c' }), ink(fish, 'M0 1 L39 1', 1.6, { stroke: '#8a5a3c' })];
  const stringV = [ink(fish, 'M0 -17 L0 1', 1.6, { stroke: '#8a5a3c' }), ink(fish, 'M0 1 L0 17', 1.6, { stroke: '#8a5a3c' })];
  const bow = ink(fish, 'M0 -17 q-9 -9 -12 -2 q4 4 12 2 q9 -9 12 -2 q-4 4 -12 2', 1.4, { stroke: '#8a5a3c' });
  void fishBody;

  // mist over the inside: a pale veil with a mask your finger wipes through
  const maskId = 'icebox-wipe';
  const mask = mk('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 320, height: 540 }, svg);
  mk('rect', { x: 0, y: 0, width: 320, height: 540, fill: '#fff' }, mask);
  const wipes = mk('path', { fill: 'none', stroke: '#000', 'stroke-width': 34, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mask);
  const mist = mk('g', { mask: `url(#${maskId})`, opacity: 0, 'data-icebox-mist': '', 'pointer-events': 'none' }, world);
  mk('rect', { x: IN.x0, y: IN.y0, width: IN.x1 - IN.x0, height: IN.y1 - IN.y0, fill: '#f3f6f4', opacity: .93 }, mist);
  const beads: string[] = []; for (let i = 0; i < 60; i++) { const x = IN.x0 + 8 + ((i * 53) % 200), y = IN.y0 + 8 + ((i * 97) % 290); beads.push(ell(x, y, 1.3, 1.6)); }
  mk('path', { d: beads.join(''), fill: '#ffffff', stroke: INK, 'stroke-width': .4, opacity: .5 }, mist);

  // the door, hinged on the left
  const door = mk('g', {}, world);
  const doorFace = fill(door, rect(48, 160, 272, 474), C.woodLight, 2.4);
  const doorPanel = ink(door, 'M64 178H256V456H64Z M70 184H250V450H70Z', 1, { opacity: .6 });
  fill(door, rect(HANDLE[0] - 5, HANDLE[1] - 26, HANDLE[0] + 5, HANDLE[1] + 26), C.brass, 1.8, { 'data-icebox-handle': '' });
  ink(door, `M${HANDLE[0]} ${HANDLE[1] - 18}V${HANDLE[1] + 18}`, .8, { opacity: .5 });
  [[188], [430]].forEach(([y]) => fill(world, rect(40, y, 54, y + 16), C.brass, 1.6));
  const puffs = [0, 1, 2, 3].map(() => ink(world, '', 1.4, { stroke: '#9fb3b0', opacity: 0 }));

  // the bamboo tray below, where the fish goes
  const tray = mk('g', { opacity: 0 }, world);
  fill(tray, `M${TRAY[0] - 58} ${TRAY[1] - 8} Q${TRAY[0]} ${TRAY[1] + 16} ${TRAY[0] + 58} ${TRAY[1] - 8} L${TRAY[0] + 52} ${TRAY[1] - 14} Q${TRAY[0]} ${TRAY[1] + 6} ${TRAY[0] - 52} ${TRAY[1] - 14}Z`, C.bamboo, 1.8);
  const weave: string[] = []; for (let x = -44; x <= 44; x += 11) weave.push(`M${TRAY[0] + x} ${TRAY[1] - 10 + Math.abs(x) * .1}l3 ${f(9 - Math.abs(x) * .1)}`);
  ink(tray, weave.join(''), .8, { opacity: .6 });
  const trayRing = mk('path', { d: ell(TRAY[0], TRAY[1] - 6, 46, 9), fill: 'none', stroke: '#c8423a', 'stroke-width': 1.4, 'stroke-dasharray': '4 5', opacity: 0 }, tray);

  // your stroke while cutting, and pieces of string falling away
  const slash = ink(world, '', 2.6, { opacity: 0 });
  const bits = [0, 1].map(() => ink(world, '', 1.6, { stroke: '#8a5a3c', opacity: 0 }));

  // a ghost finger that shows the gesture once (and again if you seem stuck)
  const ghostG = mk('g', { opacity: 0, 'pointer-events': 'none' }, svg);
  const ghostTrail = mk('path', { fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-dasharray': '.1 5', opacity: .55 }, ghostG);
  const ghostHand = mk('g', {}, ghostG);
  mk('path', { d: 'M0 0 Q-1.6 -0.4 -1.6 1.6 L-1.4 9 Q-4.6 7 -6 8.6 Q-6.8 10 -4.8 12 L0.4 18 Q2.6 20.6 6.6 20.6 L10 20.6 Q14.6 20.4 15 15.6 L15.4 9.6 Q15.4 7.6 13.4 7.6 Q12.2 7.6 11.8 8.8 Q11.8 6.6 9.8 6.6 Q8.4 6.6 8 8 Q8 6 6 6 Q4.4 6 4 7.4 L1.8 1.6 Q1.6 0 0 0Z', fill: PAPER, stroke: INK, 'stroke-width': .9, 'stroke-linejoin': 'round', transform: 'scale(1.9)' }, ghostHand);
  const ghostRing = mk('circle', { r: 9, fill: 'none', stroke: '#c8423a', 'stroke-width': 1.6, opacity: 0 }, ghostG);

  // ------------------------------------------------------------------ state
  type Phase = 'door' | 'wipe' | 'cut' | 'take' | 'done';
  let open = false, op = 0, phase: Phase = 'door', phaseT = 0, idle = 0, now = 0;
  let doorOpen = 0, doorTarget = 0, dragging = false, finger: Vec | null = null, lastPt: Vec | null = null;
  let wipePath = '', covered = new Set<number>(), mistOp = 0;
  let slashPts: Vec[] = [], slashOp = 0, cutT = -1;
  let fishPos: Vec = [PKG.cx, PKG.cy], fishDrag: Vec | null = null, fishLift = 0, takenT = -1, closeT = -1;
  let ghost: { pts: Vec[]; t: number; period: number } | null = null, ghostOp = 0, taught: Partial<Record<Phase, boolean>> = {};
  const noted = new Set<IceboxMissing>();
  const GRID = { cols: 9, rows: 12 };

  const TITLES: Record<Phase, string> = { door: 'Kapağı aç', wipe: 'Buğuyu sil', cut: 'İpi kes', take: 'Tepsiye indir', done: '' };
  const TIPS: Record<Phase, string> = {
    door: 'Pirinç kolu tut, kapağı sola doğru çek.',
    wipe: 'İçerisi buğulanmış. Parmağınla sil.',
    cut: 'Somon üst rafta. İpini tek bir çizgiyle kes.',
    take: 'Somonu aşağıdaki tepsiye indir.',
    done: '',
  };
  function setPhase(p: Phase) {
    phase = p; phaseT = 0; idle = 0; ghost = null;
    // a finger still down from the last step starts nothing in this one; lift and touch again
    dragging = false; lastPt = null; fishDrag = null; slashPts = [];
    const n = ['door', 'wipe', 'cut', 'take'].indexOf(p);
    title.innerHTML = n >= 0 ? `<span>${n + 1} / 4</span> ${TITLES[p]}` : '';
    title.classList.remove('show'); void title.offsetWidth; if (n >= 0) title.classList.add('show');
    tip.classList.remove('show');
  }
  function teach() {
    if (phase === 'door') ghost = { pts: [[HANDLE[0], HANDLE[1]], [HANDLE[0] - 70, HANDLE[1] + 6], [HANDLE[0] - 150, HANDLE[1] + 4]], t: 0, period: 2.4 };
    if (phase === 'wipe') ghost = { pts: Array.from({ length: 9 }, (_, i) => [90 + (i % 2) * 140, 200 + i * 30] as Vec), t: 0, period: 3 };
    if (phase === 'cut') ghost = { pts: [[PKG.cx - 30, PKG.cy - 42], [PKG.cx + 34, PKG.cy + 40]], t: 0, period: 1.9 };
    if (phase === 'take') ghost = { pts: [[fishPos[0], fishPos[1]], [TRAY[0], TRAY[1] - 10]], t: 0, period: 2.4 };
  }
  const local = (e: PointerEvent): Vec => {
    const m = svg.getScreenCTM(); const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const r = m ? p.matrixTransform(m.inverse()) : p; return [r.x, r.y];
  };
  const crosses = (a: Vec, b: Vec, c: Vec, d: Vec) => {
    const o = (p: Vec, q: Vec, r: Vec) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  };
  function wipeAt(p: Vec) {
    wipePath += lastPt ? `L${pt(p)}` : `M${pt(p)}l.1 0`;
    wipes.setAttribute('d', wipePath);
    // count the whole swept line, not only the sampled points (a quick swipe is sparse)
    const from = lastPt ?? p, n = Math.max(1, Math.ceil(Math.hypot(p[0] - from[0], p[1] - from[1]) / 8));
    for (let k = 0; k <= n; k++) {
      const q: Vec = [lerp(from[0], p[0], k / n), lerp(from[1], p[1], k / n)];
      for (let c = 0; c < GRID.cols; c++) for (let r = 0; r < GRID.rows; r++) {
        const cx = IN.x0 + (c + .5) * (IN.x1 - IN.x0) / GRID.cols, cy = IN.y0 + (r + .5) * (IN.y1 - IN.y0) / GRID.rows;
        if (Math.hypot(cx - q[0], cy - q[1]) < 20) covered.add(c * 100 + r);
      }
    }
  }

  svg.addEventListener('pointerdown', (e) => {
    if (!open || phase === 'done' || dragging) return;
    e.preventDefault(); svg.setPointerCapture(e.pointerId);
    const p = local(e); finger = p; lastPt = null; dragging = true; idle = 0; ghost = null;
    // a dashed outline: what is missing
    const g = (e.target as Element).closest?.('[data-missing]');
    if (g && phase !== 'door' && mistOp < .5) {
      const m = ghosts.find(x => x.id === g.getAttribute('data-missing'))!;
      m.t = 0; noted.add(m.id); sfx.paper(); haptic(5); dragging = false; return;
    }
    if (phase === 'wipe') { wipeAt(p); lastPt = p; }
    if (phase === 'cut') { slashPts = [p]; slashOp = 1; }
    if (phase === 'take' && Math.abs(p[0] - fishPos[0]) < 46 && Math.abs(p[1] - fishPos[1]) < 30) { fishDrag = [fishPos[0] - p[0], fishPos[1] - p[1]]; sfx.tap(); haptic(6); }
    if (phase === 'door' && Math.hypot(p[0] - HANDLE[0], p[1] - HANDLE[1]) > 60 && !(p[0] > 120 && p[1] > 160 && p[1] < 474)) dragging = false;
  });
  svg.addEventListener('pointermove', (e) => {
    if (!dragging || !open) return;
    const p = local(e);
    if (phase === 'door') doorOpen = doorTarget = clamp01((HANDLE[0] - p[0]) / 190);
    if (phase === 'wipe') { wipeAt(p); lastPt = p; if (Math.random() < .25) sfx.stir(2); }
    if (phase === 'cut' && finger) {
      slashPts.push(p);
      const a = slashPts[slashPts.length - 2] ?? p;
      const o = (q: Vec): Vec => [fishPos[0] + q[0], fishPos[1] + q[1]];
      // the string runs across and down the parcel: any stroke through it cuts it
      if (cutT < 0 && (crosses(a, p, o([-39, 1]), o([39, 1])) || crosses(a, p, o([0, -17]), o([0, 17])))) {
        cutT = 0; sfx.slice(); haptic(14);
      }
    }
    if (phase === 'take' && fishDrag) fishPos = [p[0] + fishDrag[0], p[1] + fishDrag[1]];
    finger = p;
  });
  const up = () => {
    if (!dragging) return;
    dragging = false; lastPt = null;
    if (phase === 'door') { if (doorOpen > .38) { doorTarget = 1; sfx.paper(); haptic(10); } else doorTarget = 0; }
    if (phase === 'take' && fishDrag) {
      fishDrag = null;
      if (Math.hypot(fishPos[0] - TRAY[0], fishPos[1] - (TRAY[1] - 10)) < 60) { takenT = 0; sfx.press(); haptic(12); }
      else sfx.nope();
    }
  };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  back.addEventListener('click', () => { if (open) api.close(); });

  const api = {
    get isOpen() { return open; },
    get phase() { return phase; },
    get noted() { return [...noted]; },
    /** for headless checks: a sheet point in client pixels */
    _client(p: Vec): Vec { const m = svg.getScreenCTM()!; const q = svg.createSVGPoint(); q.x = p[0]; q.y = p[1]; const r = q.matrixTransform(m); return [r.x, r.y]; },
    _pts: { HANDLE, PKG, TRAY, IN, MISSING: MISSING.map(m => m.at) },
    get _fish() { return fishPos; },
    open() {
      open = true; op = 0; doorOpen = doorTarget = 0; dragging = false; wipePath = ''; wipes.setAttribute('d', ''); covered = new Set(); mistOp = 0;
      cutT = -1; slashOp = 0; fishPos = [PKG.cx, PKG.cy]; fishDrag = null; takenT = closeT = -1; taught = {};
      [wrapL, wrapR, wrapFold, bow, ...stringH, ...stringV].forEach(n => { n.setAttribute('transform', ''); n.setAttribute('opacity', n === wrapFold ? '.55' : '1'); });
      ghosts.forEach(g => { g.t = -1; });
      svg.style.display = 'block'; svg.classList.add('show');
      [back, title, tip].forEach(n => (n.style.display = 'block')); back.classList.add('show');
      setPhase('door');
    },
    close(done = false) {
      open = false; dragging = false; svg.classList.remove('show'); svg.style.display = 'none'; svg.style.opacity = '0';
      [back, title, tip].forEach(n => { n.classList.remove('show'); n.style.display = 'none'; });
      if (noted.size) onNote([...noted]);
      if (done) onTake(); else onExit();
    },
    draw(t: number, dt: number) {
      now = t; void now;
      if (!open) return;
      op = approach(op, closeT >= 0 ? 0 : 1, 7, dt);
      svg.style.opacity = f(easeOut(op));
      phaseT += dt; idle += dt;
      if (!taught[phase] && phaseT > .7 && phase !== 'done') { taught[phase] = true; teach(); tip.textContent = TIPS[phase]; tip.classList.add('show'); }
      if (taught[phase] && !ghost && !dragging && idle > 6 && phase !== 'done') { teach(); idle = 0; }

      // the ice sweats: a drip now and then
      drips.forEach((d, i) => { const u = (t * .35 + i * .33) % 1, x = 92 + i * 64; d.setAttribute('cx', f(x)); d.setAttribute('cy', f(148 + u * 14)); d.setAttribute('opacity', f(u < .85 ? .8 : 0)); });

      // 1 · the door swings on its hinge (past flat, showing its edge)
      if (!dragging || phase !== 'door') doorOpen = approach(doorOpen, doorTarget, doorTarget > doorOpen ? 6 : 9, dt);
      const s = 1 - easeInOut(doorOpen) * 1.16;
      door.setAttribute('transform', `translate(${HINGE} 0) scale(${f(s)} 1) translate(${-HINGE} 0)`);
      doorFace.setAttribute('fill', s < 0 ? C.woodDark : C.woodLight);
      doorPanel.setAttribute('opacity', s < 0 ? '0' : '.6');
      if (phase === 'door' && doorOpen > .97 && doorTarget === 1) { mistOp = 1; setPhase('wipe'); }
      // a breath of cold air when it opens
      puffs.forEach((p, i) => {
        const age = phase === 'door' ? 0 : clamp01((phaseT - i * .15) / 1.6);
        const x = 90 + i * 46, y = 240 - age * 90;
        p.setAttribute('d', `M${f(x)} ${f(y)} q10 -10 0 -20 q-8 -8 2 -18`);
        p.setAttribute('opacity', f(phase === 'wipe' && age < 1 ? (1 - age) * .55 : 0));
      });

      // 2 · mist, wiped away
      mist.setAttribute('opacity', f(mistOp));
      if (phase === 'wipe' && covered.size > GRID.cols * GRID.rows * .5) { sfx.chime(); haptic(10); setPhase('cut'); }
      if (phase !== 'wipe' && phase !== 'door') mistOp = approach(mistOp, 0, 3, dt);

      // missing things: a little note above the outline
      ghosts.forEach((g) => {
        if (g.t >= 0) g.t += dt;
        const shown = g.t >= 0 && g.t < 2.6;
        g.note.setAttribute('opacity', f(shown ? Math.min(1, g.t * 5) * (1 - clamp01((g.t - 2.2) / .4)) : 0));
        g.note.setAttribute('transform', `translate(0 ${f(shown ? (1 - backOut(clamp01(g.t / .35))) * 6 : 0)})`);
      });

      // 3 · your stroke, and the string giving way
      slashOp = approach(slashOp, dragging && phase === 'cut' ? 1 : 0, 4, dt);
      slash.setAttribute('d', slashPts.length > 1 ? 'M' + slashPts.map(pt).join('L') : '');
      slash.setAttribute('opacity', f(slashOp * .85));
      if (cutT >= 0) {
        cutT += dt;
        const u = easeOut(clamp01(cutT / .5)), w = easeInOut(clamp01((cutT - .25) / .6));
        [stringH[0], stringV[0], bow].forEach(n => n.setAttribute('opacity', f(1 - u)));
        [stringH[1], stringV[1]].forEach(n => n.setAttribute('opacity', f(1 - u)));
        bits.forEach((b, i) => {
          const fall = cutT * cutT * 160, x = fishPos[0] + (i ? 14 : -18), y = fishPos[1] + fall;
          b.setAttribute('d', `M${f(x)} ${f(y)} q${i ? 8 : -8} 4 ${i ? 4 : -4} 12`);
          b.setAttribute('opacity', f(cutT < .9 ? 1 - cutT / .9 : 0));
        });
        // the paper falls open to both sides
        wrapL.setAttribute('transform', `translate(${f(-w * 16)} ${f(w * 3)}) rotate(${f(-w * 12)} -39 17) scale(${f(1 - w * .55)} 1)`);
        wrapR.setAttribute('transform', `translate(${f(w * 16)} ${f(w * 3)}) rotate(${f(w * 12)} 39 17) scale(${f(1 - w * .55)} 1)`);
        wrapFold.setAttribute('opacity', f(.55 * (1 - w)));
        if (phase === 'cut' && cutT > .9) { sfx.success(); setPhase('take'); }
      }

      // 4 · lower the fish onto the tray
      tray.setAttribute('opacity', f(phase === 'take' || phase === 'done' ? Math.min(1, phaseT * 3) : 0));
      trayRing.setAttribute('opacity', f(phase === 'take' && takenT < 0 ? .45 + Math.sin(t * 3) * .2 : 0));
      fishLift = approach(fishLift, fishDrag ? 1 : 0, 12, dt);
      if (phase === 'take' && !fishDrag && takenT < 0) fishPos = [approach(fishPos[0], PKG.cx, 9, dt), approach(fishPos[1], PKG.cy, 9, dt)];
      if (takenT >= 0) {
        takenT += dt;
        fishPos = [approach(fishPos[0], TRAY[0], 12, dt), approach(fishPos[1], TRAY[1] - 12, 12, dt)];
        if (phase === 'take') setPhase('done');
        if (takenT > .5) doorTarget = 0, doorOpen = approach(doorOpen, 0, 5, dt);
        if (takenT > 1.1 && closeT < 0) closeT = 0;
      }
      // the fish leaves the shelf: it is drawn over the door from now on
      if ((phase === 'take' || phase === 'done') && fish.parentNode !== world) world.insertBefore(fish, slash);
      if (phase !== 'take' && phase !== 'done' && fish.parentNode !== contents) contents.appendChild(fish);
      fish.setAttribute('transform', `translate(${f(fishPos[0])} ${f(fishPos[1] - fishLift * 6)}) rotate(${f(fishLift * -3)}) scale(${f(1 + fishLift * .06)})`);
      if (closeT >= 0) { closeT += dt; if (closeT > .55) { api.close(true); return; } }

      // the ghost finger
      ghostOp = approach(ghostOp, ghost ? 1 : 0, 6, dt);
      ghostG.setAttribute('opacity', f(ghostOp));
      if (ghost) {
        ghost.t += dt;
        const u = (ghost.t % ghost.period) / ghost.period, k = clamp01((u - .1) / .7), seg = (ghost.pts.length - 1) * easeInOut(k);
        const i = Math.min(ghost.pts.length - 2, Math.floor(seg)), fr = seg - i;
        const p: Vec = [lerp(ghost.pts[i][0], ghost.pts[i + 1][0], fr), lerp(ghost.pts[i][1], ghost.pts[i + 1][1], fr)];
        const press = u > .08 && u < .84 ? 1 : 0;
        ghostTrail.setAttribute('d', 'M' + ghost.pts.map(pt).join('L'));
        ghostHand.setAttribute('transform', `translate(${f(p[0])} ${f(p[1])}) scale(${press ? .93 : 1})`);
        ghostRing.setAttribute('cx', f(p[0])); ghostRing.setAttribute('cy', f(p[1])); ghostRing.setAttribute('opacity', f(press * .8));
      }
    },
  };
  return api;
}
export type Icebox = ReturnType<typeof createIcebox>;
