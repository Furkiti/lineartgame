// The counter, up close. When you start making sushi the camera pushes in to the board
// and this layer takes over: the same ink and paper, drawn big, with the traveller's
// own hands and indigo sleeves doing what your finger does.
//   1 · stir the rice   — draw slow circles in the tub (too fast and it clumps)
//   2 · slice the fish  — swipe down along the dashed line, three times
//   3 · shape nigiri    — press and hold on a lump of rice; the slice drapes itself on
//   4 · plate them      — drag each piece onto the geta
import { f, pt, type Vec } from '../lib/ink.ts';
import { rgb, hex, mix } from '../village/kit.ts';
import { sfx, haptic, clamp01, lerp, easeOut, easeInOut, backOut, elasticOut, approach } from './fx.ts';

const NS = 'http://www.w3.org/2000/svg';
type Attrs = Record<string, string | number>;
function mk<K extends keyof SVGElementTagNameMap>(tag: K, a: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const k in a) n.setAttribute(k, String(a[k]));
  parent?.appendChild(n);
  return n;
}
const INK = 'currentColor', PAPER = 'var(--paper)';
const ink = (g: Element, d: string, w = 1.6, extra: Attrs = {}) => mk('path', { d, fill: 'none', stroke: INK, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra }, g);
const fill = (g: Element, d: string, c: string, w = 1.8, extra: Attrs = {}) => mk('path', { d, fill: c, stroke: INK, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra }, g);
const ell = (cx: number, cy: number, rx: number, ry: number) => `M${f(cx - rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`;
const C = {
  wood: hex('#d9b380'), woodDark: hex('#b98c58'), woodFace: hex('#c49a66'), board: hex('#efdcb6'), tub: hex('#c79a64'),
  copper: hex('#b8733f'), rice: hex('#fbf8ee'), riceRaw: hex('#ece5d2'), salmon: hex('#ec8c5f'), tuna: hex('#c8423a'),
  sleeve: hex('#34507a'), skin: hex('#f6e8d6'), geta: hex('#c79a64'), ginger: hex('#f2b3b0'), leaf: hex('#6e9a4e'), red: hex('#c8423a'),
};
type Pal = { inkT: number };
const tint = (c: number[], P: Pal, k = 0.5) => rgb(mix(c, mix(c, [12, 16, 30], 0.6), P.inkT * k));

// stations: what the camera frames for each step
const ST = {
  tub: [20, 110, 230, 290], board: [218, 118, 436, 286], plate: [222, 120, 640, 280], all: [10, 60, 640, 300],
} as const;
const TUB: Vec = [120, 190];
const BLOCK = { x0: 346, x1: 418, y0: 168, y1: 222, slice: 15 };
const MOUND: Vec[] = [[262, 236], [300, 238], [338, 236]];
const PILE: Vec[] = [[300, 192], [318, 188], [336, 192]]; // pivot of each fallen slice (it lies to the left of it)
const SLOT: Vec[] = [[492, 199], [534, 199], [576, 199]];

export function createCloseup(card: HTMLElement, { onStep, onDone, onExit }: { onStep: (n: number) => void; onDone: () => void; onExit: () => void }) {
  const svg = mk('svg', { class: 'closeup' }) as SVGSVGElement;
  card.appendChild(svg);
  const back = document.createElement('button');
  back.className = 'cu-back'; back.type = 'button'; back.textContent = '‹ Geri';
  card.appendChild(back);
  const title = document.createElement('div'); title.className = 'cu-title'; card.appendChild(title);
  const tip = document.createElement('div'); tip.className = 'cu-tip'; card.appendChild(tip);

  const world = mk('g', {}, svg);
  // ------------------------------------------------------------------ the scene, drawn big
  mk('rect', { x: -800, y: -600, width: 2400, height: 722, fill: PAPER }, world);
  const wallLines: string[] = [];
  for (let x = -790; x < 1600; x += 13) wallLines.push(`M${x} 66 L${x} 120`);
  ink(world, wallLines.join(' ') + ' M-800 66 L1600 66', 0.6, { opacity: 0.55 });
  ink(world, 'M-800 30 L1600 30', 1.4);
  // utensils hanging on the rail (just outlines, out of focus)
  ink(world, 'M300 30 L300 52 M300 52 q-7 0 -7 7 q0 7 7 7 q7 0 7 -7 q0 -7 -7 -7 M520 30 L520 48', 1.1, { opacity: 0.5 });
  mk('circle', { cx: 520, cy: 58, r: 10, fill: 'none', stroke: INK, 'stroke-width': 1, opacity: 0.5 }, world);
  const counterTop = fill(world, 'M-800 120 L1600 120 L1600 262 L-800 262Z', rgb(C.wood), 1.6);
  const grain: string[] = [];
  for (let i = 0; i < 9; i++) { const y = 132 + i * 14 + (i % 3) * 2; grain.push(`M-800 ${y} Q${100 + i * 40} ${y - 4} ${500 + i * 30} ${y + 2} T1600 ${y}`); }
  ink(world, grain.join(' '), 0.5, { opacity: 0.35 });
  const counterEdge = fill(world, 'M-800 262 L1600 262 L1600 271 L-800 271Z', rgb(C.woodDark), 1.6);
  const counterFace = fill(world, 'M-800 271 L1600 271 L1600 700 L-800 700Z', rgb(C.woodFace), 1.6);
  ink(world, 'M60 271 L60 700 M380 271 L380 700 M700 271 L700 700', 1.2);
  [[40, 310], [80, 310], [360, 310], [400, 310], [680, 310]].forEach(([x, y]) => fill(world, ell(x, y, 3, 7), PAPER, 1));

  // the tub
  const tubG = mk('g', {}, world);
  const tubSide = fill(tubG, `M${TUB[0] - 80} ${TUB[1]} L${TUB[0] - 74} ${TUB[1] + 44} Q${TUB[0]} ${TUB[1] + 66} ${TUB[0] + 74} ${TUB[1] + 44} L${TUB[0] + 80} ${TUB[1]}Z`, rgb(C.tub), 1.8);
  const bands = [16, 34].map((dy) => ink(tubG, `M${TUB[0] - 78} ${TUB[1] + dy} Q${TUB[0]} ${TUB[1] + dy + 22} ${TUB[0] + 78} ${TUB[1] + dy}`, 3, { stroke: rgb(C.copper) }));
  fill(tubG, ell(TUB[0], TUB[1], 80, 36), rgb(C.tub), 1.8);
  const rice = fill(tubG, ell(TUB[0], TUB[1] + 2, 70, 29), rgb(C.riceRaw), 1.2);
  const grainsG = mk('g', {}, tubG);
  const grains = Array.from({ length: 64 }, (_, i) => {
    const r = Math.sqrt((i + 0.5) / 64) * 0.92, th = i * 2.399;
    return { r, th, w: 0, n: mk('ellipse', { rx: 2.2, ry: 1.1, fill: PAPER, stroke: INK, 'stroke-width': 0.55, opacity: 0.85 }, grainsG) };
  });
  const lumps = fill(tubG, '', PAPER, 1.1, { opacity: 0 });
  const shine = ink(tubG, `M${TUB[0] - 40} ${TUB[1] - 12} Q${TUB[0] - 20} ${TUB[1] - 20} ${TUB[0] + 6} ${TUB[1] - 18} M${TUB[0] + 22} ${TUB[1] - 16} l8 -1`, 1.6, { stroke: '#ffffff', opacity: 0 });
  const steam = ink(tubG, '', 1.1, { opacity: 0.45 });
  const guideRing = mk('path', { d: ell(TUB[0], TUB[1] + 2, 44, 17), fill: 'none', stroke: rgb(C.red), 'stroke-width': 1.4, 'stroke-dasharray': '4 5', opacity: 0 }, tubG);
  const progRing = mk('path', { fill: 'none', stroke: rgb(C.red), 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0 }, tubG);
  const tubSay = mk('text', { x: TUB[0] - 40, y: TUB[1] - 48, 'text-anchor': 'middle', 'font-size': 15, 'font-style': 'italic', 'font-family': '"Iowan Old Style", Georgia, serif', fill: INK, opacity: 0 }, tubG);
  tubSay.textContent = 'yavaşça…';

  // the board, the block of salmon, the slices
  const board = fill(world, 'M228 150 L426 150 L432 240 L222 240Z', rgb(C.board), 1.8);
  fill(world, 'M222 240 L432 240 L432 249 L222 249Z', rgb(C.woodDark), 1.6);
  ink(world, 'M248 196 l14 -3 M396 230 l10 -2 M270 222 l8 1', 0.6, { opacity: 0.4 });
  const blockG = mk('g', {}, world);
  const clipId = 'cu-block-clip';
  const clip = mk('clipPath', { id: clipId }, svg);
  const clipRect = mk('path', {}, clip);
  const block = fill(blockG, '', rgb(C.salmon), 1.8);
  const blockFat = ink(blockG, '', 2.2, { stroke: '#fff3e6', 'clip-path': `url(#${clipId})` });
  const cutLine = mk('path', { fill: 'none', stroke: INK, 'stroke-width': 1.4, 'stroke-dasharray': '5 4', opacity: 0 }, blockG);
  const slices = [0, 1, 2].map((i) => {
    const g = mk('g', { opacity: 0 }, world);
    const body = fill(g, `M0 0 L${BLOCK.slice} 0 L${BLOCK.slice} ${BLOCK.y1 - BLOCK.y0} L0 ${BLOCK.y1 - BLOCK.y0}Z`, rgb(C.salmon), 1.5);
    ink(g, `M2 10 L${BLOCK.slice - 2} 4 M2 24 L${BLOCK.slice - 2} 18 M2 38 L${BLOCK.slice - 2} 32`, 1.6, { stroke: '#fff3e6' });
    return { g, body, t: -1 };
  });

  // rice lumps that become nigiri, and the slices that drape onto them
  const handsBack = mk('g', {}, world);
  const nigiri = [0, 1, 2].map((i) => {
    const g = mk('g', { opacity: 0 }, world);
    const shadow = mk('ellipse', { rx: 20, ry: 4, cy: 2, fill: INK, opacity: 0.12 }, g);
    const body = fill(g, '', PAPER, 1.6);
    const dots = ink(g, '', 1.2, { opacity: 0.7 });
    const top = mk('g', { opacity: 0 }, g);
    const topBody = fill(top, 'M-21 -14 Q-2 -26 22 -16 Q25 -10 20 -8 Q0 -14 -20 -6 Q-25 -8 -21 -14Z', rgb(C.salmon), 1.5);
    ink(top, 'M-12 -15 q4 -4 9 -5 M2 -17 q5 -2 10 -1 M-4 -11 q6 -3 12 -3', 1.4, { stroke: '#fff3e6' });
    return { g, shadow, body, dots, top, topBody, shape: 0, drape: -1, home: MOUND[i] as Vec, pos: [...MOUND[i]] as Vec, plated: -1, slot: -1, lift: 0 };
  });
  // the geta and its garnish
  const getaG = mk('g', {}, world);
  const getaTop = fill(getaG, 'M462 186 L610 186 L612 202 L460 202Z', rgb(C.geta), 1.8);
  fill(getaG, 'M466 202 L480 202 L480 222 L466 222Z M592 202 L606 202 L606 222 L592 222Z', rgb(C.woodDark), 1.6);
  ink(getaG, 'M470 192 L604 192', 0.5, { opacity: 0.4 });
  const slotGuides = SLOT.map(([x, y]) => mk('path', { d: ell(x, y - 6, 18, 6), fill: 'none', stroke: rgb(C.red), 'stroke-width': 1.2, 'stroke-dasharray': '3 4', opacity: 0 }, getaG));
  const garnish = mk('g', { opacity: 0 }, getaG);
  fill(garnish, 'M598 196 Q606 170 618 168 Q612 184 602 198Z', rgb(C.leaf), 1.3);
  [[608, 196], [614, 194], [611, 190]].forEach(([x, y]) => fill(garnish, ell(x, y, 5, 3), rgb(C.ginger), 1));
  fill(garnish, ell(594, 196, 4, 2.6), '#9cc46a', 1);

  // knife, paddle, hands
  const paddle = mk('g', { opacity: 0 }, world);
  ink(paddle, 'M0 0 L0 -86', 5, { stroke: rgb(C.woodDark) });
  ink(paddle, 'M0 0 L0 -86', 1.2);
  fill(paddle, ell(0, 8, 11, 15), rgb(mix(C.wood, [255, 250, 240], 0.5)), 1.6);
  const knife = mk('g', { opacity: 0 }, world);
  fill(knife, 'M-2 0 L-2 -52 Q-2 -58 6 -60 L8 -60 L8 0Z', PAPER, 1.6);
  ink(knife, 'M5 -4 L5 -54', 0.6, { opacity: 0.5 });
  fill(knife, 'M-3 0 L9 0 L9 6 L-3 6Z', rgb(C.woodDark), 1.4);
  fill(knife, 'M-2 6 L8 6 L7 52 L-1 52Z', rgb(C.wood), 1.6);
  const handsFront = mk('g', {}, world);
  const words = mk('g', {}, world);

  /**
   * A hand with a short stretch of indigo sleeve that fades out toward the elbow, so the
   * arms never bar across the counter. dir: where the forearm goes from the wrist (degrees,
   * 0 = right, 90 = down). ang: how the hand is turned (0 = fingers up).
   */
  let armN = 0;
  function arm(parent: Element) {
    const id = `cu-arm-${armN++}`;
    const grad = mk('linearGradient', { id: id + 'g', gradientUnits: 'userSpaceOnUse' }, svg);
    mk('stop', { offset: 0, 'stop-color': '#fff' }, grad);
    mk('stop', { offset: 0.45, 'stop-color': '#fff' }, grad);
    mk('stop', { offset: 1, 'stop-color': '#000' }, grad);
    const mask = mk('mask', { id: id + 'm', maskUnits: 'userSpaceOnUse', x: -3000, y: -3000, width: 6000, height: 6000 }, svg);
    mk('rect', { x: -3000, y: -3000, width: 6000, height: 6000, fill: `url(#${id}g)` }, mask);
    const g = mk('g', { mask: `url(#${id}m)` }, parent);
    const sleeve = fill(g, '', rgb(C.sleeve), 1.8);
    const cuff = ink(g, '', 1.3, { stroke: '#f3ead8' });
    const hand = mk('g', {}, g);
    const palm = fill(hand, '', rgb(C.skin), 1.6);
    const lines = ink(hand, '', 1.1);
    let kind = '';
    return {
      g,
      set(wrist: Vec, dir: number, ang: number, shape: 'grip' | 'press' | 'cup' | 'flat', press = 0, len = 66) {
        const a = dir * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
        const base: Vec = [wrist[0] + ux * len, wrist[1] + uy * len];
        grad.setAttribute('x1', f(wrist[0])); grad.setAttribute('y1', f(wrist[1]));
        grad.setAttribute('x2', f(base[0])); grad.setAttribute('y2', f(base[1]));
        const w0 = 15, w1 = 10.5;
        sleeve.setAttribute('d', `M${f(wrist[0] + nx * w1)} ${f(wrist[1] + ny * w1)} Q${f(wrist[0] + ux * len * 0.5 + nx * (w1 + 3))} ${f(wrist[1] + uy * len * 0.5 + ny * (w1 + 3))} ${f(base[0] + nx * w0)} ${f(base[1] + ny * w0)} L${f(base[0] - nx * w0)} ${f(base[1] - ny * w0)} Q${f(wrist[0] + ux * len * 0.5 - nx * (w1 + 2))} ${f(wrist[1] + uy * len * 0.5 - ny * (w1 + 2))} ${f(wrist[0] - nx * w1)} ${f(wrist[1] - ny * w1)}Z`);
        const cx = wrist[0] + ux * 7, cy = wrist[1] + uy * 7;
        cuff.setAttribute('d', `M${f(cx + nx * 9.6)} ${f(cy + ny * 9.6)} L${f(cx - nx * 9.6)} ${f(cy - ny * 9.6)}`);
        hand.setAttribute('transform', `translate(${f(wrist[0])} ${f(wrist[1])}) rotate(${f(ang)})`);
        if (kind !== shape + press.toFixed(2)) {
          kind = shape + press.toFixed(2);
          // hands drawn pointing up (−y) from the wrist at 0,0
          if (shape === 'grip') { palm.setAttribute('d', 'M-10 2 Q-13 -9 -10 -18 Q-4 -25 5 -23 Q12 -20 11 -11 L11 0 Q7 5 0 5 Q-7 5 -10 2Z'); lines.setAttribute('d', 'M-8 -16 Q-2 -14 4 -16 M-9 -9.5 Q-2 -7.5 4 -10 M-9 -3 Q-3 -1 4 -3.5 M7 -22 Q12 -24 13 -17'); }
          else if (shape === 'press') { const p = press * 2.6; palm.setAttribute('d', `M-10 2 Q-12 -8 -8 -13 L-6.6 ${f(-31 + p)} Q-6.4 ${f(-35 + p)} -3.4 ${f(-35 + p)} Q-0.6 ${f(-35 + p)} -0.6 ${f(-31 + p)} L-0.4 -19 L0.6 ${f(-33 + p)} Q0.8 ${f(-37 + p)} 3.8 ${f(-37 + p)} Q6.6 ${f(-37 + p)} 6.6 ${f(-33 + p)} L7.4 -14 Q12 -11 11 -5 L11 0 Q7 5 0 5 Q-7 5 -10 2Z`); lines.setAttribute('d', 'M-0.5 -19 L-0.5 -13 M7 -11 Q10 -12.6 11.6 -9.4'); }
          else if (shape === 'cup') { palm.setAttribute('d', 'M-11 2 Q-15 -12 -8 -23 Q-2 -29 5 -27 Q2 -21 2 -14 Q3.6 -7 12.6 -5.4 Q14.6 1.6 7 5 Q-5 7 -11 2Z'); lines.setAttribute('d', 'M-7 -20 Q-5.4 -14.6 -1.8 -12.6 M5 -27 Q9 -27 9 -23'); }
          else { palm.setAttribute('d', 'M-11 2 Q-13 -13 -9 -24 Q-5.4 -31 0 -31 Q5.4 -31 8 -24 Q12.6 -13 11 0 Q7 5 0 5 Q-7 5 -11 2Z'); lines.setAttribute('d', 'M-5.4 -27 L-5.4 -18 M0 -30 L0 -20 M5.4 -27 L5.4 -18'); }
        }
      },
      tint(P: Pal) { sleeve.setAttribute('fill', tint(C.sleeve, P)); palm.setAttribute('fill', tint(C.skin, P, 0.3)); },
    };
  }
  const rightHand = arm(handsFront), leftHand = arm(handsBack), leftFront = arm(handsFront);

  words.appendChild(tubSay);
  // ghost hand (local copy, so it lives in this layer's space)
  const ghostG = mk('g', { opacity: 0 }, world);
  const ghostTrail = mk('path', { fill: 'none', stroke: INK, 'stroke-width': 2, 'stroke-dasharray': '0.1 6', 'stroke-linecap': 'round', opacity: 0.6 }, world);
  world.insertBefore(ghostTrail, ghostG);
  fill(ghostG, 'M0 0 Q-3 -1 -3 3 L-3 18 Q-9 14 -12 17 Q-14 20 -10 24 L1 36 Q5 41 13 41 L20 41 Q29 41 30 31 L31 19 Q31 15 27 15 Q24 15 24 18 Q24 13 20 13 Q17 13 16 16 Q16 12 12 12 Q9 12 8 15 L4 3 Q3 0 0 0Z', PAPER, 1.6, { opacity: 0.95 });
  const ghostRing = mk('circle', { r: 9, fill: 'none', stroke: rgb(C.red), 'stroke-width': 2, opacity: 0 }, world);
  let ghost: { kind: 'path' | 'hold'; pts: Vec[]; t: number; period: number } | null = null, ghostOp = 0;

  // the hanko stamp at the end
  const stamp = mk('g', { opacity: 0 }, svg);
  mk('rect', { x: -26, y: -26, width: 52, height: 52, rx: 5, fill: rgb(C.red), stroke: rgb(C.red), 'stroke-width': 2 }, stamp);
  mk('rect', { x: -21, y: -21, width: 42, height: 42, rx: 3, fill: 'none', stroke: '#fbf3e6', 'stroke-width': 1.6 }, stamp);
  const stampText = mk('text', { x: 0, y: 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 30, 'font-weight': 800, 'font-family': '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif', fill: '#fbf3e6' }, stamp);
  stampText.textContent = '旨';

  // ------------------------------------------------------------------ state
  let open = false, op = 0, step = 0, stepT = 0, cam = { x0: 0, y0: 0, x1: 640, y1: 300 }, camFrom = { ...cam }, camTo = { ...cam }, camT = 1;
  let stir = 0, swirl = 0, clump = 0, lastAng: number | null = null, lastStirSnd = 0, sayT = 9, tipT = 0, idle = 0;
  let cuts = 0, knifeY = 0, cutting = false, cutStartY = 0, cutVel = 0;
  let holdI = -1, holdT = 0, pressPh = 0;
  let drag: { i: number; off: Vec } | null = null, plated = 0;
  let doneT = -1, taught: Record<number, boolean> = {}, advancing = false;
  let finger: Vec | null = null, fingerDown = false, lastPt: Vec | null = null, lastMoveT = 0;
  let scale = 1, ox = 0, oy = 0, now = 0;
  // transitions run on game time (so they pause with the game and never race the player)
  const later: { at: number; fn: () => void }[] = [];
  const after = (s: number, fn: () => void) => later.push({ at: now + s, fn });

  const STEP_TITLES = ['Pirinci karıştır', 'Balığı dilimle', 'Nigiri şekillendir', 'Tabağa diz'];
  const STEP_TIPS = ['Kapta parmağınla yavaş daireler çiz.', 'Kesik çizgi boyunca aşağı kaydır.', 'Pirincin üstüne basılı tut.', 'Nigirileri tabağa sürükle.'];
  function frameTo(r: readonly number[], instant = false) {
    camFrom = { ...cam }; camTo = { x0: r[0], y0: r[1], x1: r[2], y1: r[3] }; camT = instant ? 1 : 0;
    if (instant) cam = { ...camTo };
  }
  function setStep(n: number, instant = false) {
    step = n; stepT = 0; idle = 0; tipT = 0;
    title.innerHTML = n < 4 ? `<span>${n + 1} / 4</span> ${STEP_TITLES[n]}` : '';
    title.classList.remove('show'); void title.offsetWidth; title.classList.add('show');
    frameTo(n === 0 ? ST.tub : ST.board, instant);
    ghost = null;
  }
  const blockX0 = () => BLOCK.x0 + cuts * BLOCK.slice;
  function teach() {
    if (step === 0) ghost = { kind: 'path', pts: Array.from({ length: 25 }, (_, i) => [TUB[0] + Math.cos(i / 24 * 6.283 - 1.2) * 44, TUB[1] + 2 + Math.sin(i / 24 * 6.283 - 1.2) * 17] as Vec), t: 0, period: 2.6 };
    if (step === 1) { const x = blockX0() + BLOCK.slice; ghost = { kind: 'path', pts: [[x, BLOCK.y0 - 30], [x, BLOCK.y1 + 16]], t: 0, period: 1.8 }; }
    if (step === 2) { const i = nigiri.findIndex((n) => n.shape < 1); if (i >= 0) ghost = { kind: 'hold', pts: [[MOUND[i][0], MOUND[i][1] - 10]], t: 0, period: 2.2 }; }
    if (step === 3) { const i = nigiri.findIndex((n) => n.slot < 0); if (i >= 0) ghost = { kind: 'path', pts: [[nigiri[i].pos[0], nigiri[i].pos[1] - 10], [(nigiri[i].pos[0] + SLOT[plated][0]) / 2, 150], [SLOT[plated][0], SLOT[plated][1] - 10]], t: 0, period: 2.2 }; }
  }

  // ------------------------------------------------------------------ input
  const toWorld = (e: PointerEvent): Vec => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale]; };
  svg.addEventListener('pointerdown', (e) => {
    if (!open || doneT >= 0) return;
    e.preventDefault(); svg.setPointerCapture(e.pointerId);
    const p = toWorld(e); finger = p; fingerDown = true; lastPt = p; lastMoveT = now; idle = 0; ghost = null;
    if (step === 0) lastAng = Math.atan2((p[1] - TUB[1]) / 0.42, p[0] - TUB[0]);
    if (step === 1 && cuts < 3 && Math.abs(p[0] - (blockX0() + BLOCK.slice)) < 70 && p[1] < BLOCK.y1 + 20) { cutting = true; cutStartY = p[1]; knifeY = 0; }
    if (step === 2) { const i = nigiri.findIndex((n, k) => n.shape < 1 && Math.hypot(p[0] - MOUND[k][0], p[1] - MOUND[k][1] + 10) < 34); if (i >= 0) { holdI = i; holdT = 0; } }
    if (step === 3) { const i = nigiri.findIndex((n) => n.slot < 0 && Math.hypot(p[0] - n.pos[0], p[1] - n.pos[1] + 10) < 30); if (i >= 0) { drag = { i, off: [nigiri[i].pos[0] - p[0], nigiri[i].pos[1] - p[1]] }; sfx.tap(); haptic(6); } }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!fingerDown) return;
    const p = toWorld(e), dtm = Math.max(1 / 120, now - lastMoveT);
    if (step === 0 && lastAng !== null) {
      const a = Math.atan2((p[1] - TUB[1]) / 0.42, p[0] - TUB[0]);
      let d = a - lastAng; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      const speed = Math.abs(d) / dtm;
      const inTub = Math.hypot((p[0] - TUB[0]) / 80, (p[1] - TUB[1]) / 36) < 1.5;
      if (inTub) {
        swirl = lerp(swirl, d / dtm, 0.3);
        if (speed > 11) { clump = Math.min(1, clump + dtm * 1.6); if (sayT > 1.8) { sayT = 0; sfx.nope(); } }
        else stir += Math.abs(d) * (1 - clump * 0.7);
        if (now - lastStirSnd > 0.11 && Math.abs(d) > 0.01) { lastStirSnd = now; sfx.stir(speed); }
      }
      lastAng = a;
    }
    if (step === 1 && cutting) { cutVel = (p[1] - (lastPt?.[1] ?? p[1])) / dtm; knifeY = Math.max(0, p[1] - cutStartY); }
    if (step === 3 && drag) nigiri[drag.i].pos = [p[0] + drag.off[0], p[1] + drag.off[1]];
    finger = p; lastPt = p; lastMoveT = now;
  });
  const up = () => {
    if (!fingerDown) return;
    fingerDown = false; lastAng = null; holdI = -1;
    if (step === 1 && cutting) { cutting = false; if (knifeY < BLOCK.y1 - BLOCK.y0 + 6 && cutVel > 600) knifeY = 999; else if (knifeY < BLOCK.y1 - BLOCK.y0 + 6) knifeY = 0; }
    if (step === 3 && drag) {
      const n = nigiri[drag.i];
      if (n.pos[0] > 450 && n.pos[0] < 630 && n.pos[1] > 140 && n.pos[1] < 250) { n.slot = plated++; n.plated = 0; sfx.press(); haptic(10); }
      drag = null;
    }
  };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  back.addEventListener('click', () => { if (open) api.close(); });

  // ------------------------------------------------------------------ api
  const api = {
    get isOpen() { return open; },
    /** for headless checks: a close-up point in client pixels */
    _client(w: Vec): Vec { const r = svg.getBoundingClientRect(); return [r.left + ox + w[0] * scale, r.top + oy + w[1] * scale]; },
    _pts: { TUB, BLOCK, MOUND, SLOT },
    get _step() { return step; },
    /** open at a given recipe step (0…3) */
    open(from: number) {
      open = true; doneT = -1; taught = {};
      svg.classList.add('show'); back.classList.add('show'); tip.classList.remove('show');
      // restore the board to match the step
      stir = from > 0 ? 20 : 0; clump = 0; advancing = false;
      cuts = from > 1 ? 3 : from === 1 ? cuts : 0;
      nigiri.forEach((n, i) => { n.shape = from > 2 ? 1 : n.shape; n.drape = from > 2 ? 1 : n.drape; n.slot = -1; n.plated = -1; n.pos = [...MOUND[i]] as Vec; });
      if (from < 2) nigiri.forEach((n) => { n.shape = 0; n.drape = -1; });
      plated = 0; slices.forEach((s, i) => { s.t = cuts > i ? 9 : -1; });
      setStep(from, true);
      frameTo(ST.all, true); frameTo(from === 0 ? ST.tub : ST.board);
      op = 0;
    },
    close() { open = false; svg.classList.remove('show'); back.classList.remove('show'); title.classList.remove('show'); tip.classList.remove('show'); onExit(); },
    draw(t: number, dt: number, P: Pal) {
      now = t;
      for (let i = later.length - 1; i >= 0; i--) if (now >= later[i].at) { const fn = later[i].fn; later.splice(i, 1); fn(); }
      op = approach(op, open ? 1 : 0, 7, dt);
      if (!open && op < 0.01) return;
      // camera: ease between stations, fit to the card
      camT = Math.min(1, camT + dt / 0.9);
      if (step === 3 && doneT < 0 && camT >= 1) {
        // plating: the camera drifts after the piece you carry, toward the geta
        const lead = drag ? Math.max(327, Math.min(541, nigiri[drag.i].pos[0] + 50)) : plated >= 3 ? 541 : 327;
        const half = (ST.board[2] - ST.board[0]) / 2;
        cam = { x0: approach(cam.x0, lead - half, 4, dt), x1: approach(cam.x1, lead + half, 4, dt), y0: approach(cam.y0, ST.board[1], 4, dt), y1: approach(cam.y1, ST.board[3], 4, dt) };
      } else {
        const e = easeInOut(camT);
        cam = { x0: lerp(camFrom.x0, camTo.x0, e), y0: lerp(camFrom.y0, camTo.y0, e), x1: lerp(camFrom.x1, camTo.x1, e), y1: lerp(camFrom.y1, camTo.y1, e) };
      }
      const r = svg.getBoundingClientRect();
      const pad = 22, top = 70, bottom = 70;
      scale = Math.min((r.width - pad * 2) / (cam.x1 - cam.x0), (r.height - top - bottom) / (cam.y1 - cam.y0));
      ox = (r.width - (cam.x1 - cam.x0) * scale) / 2 - cam.x0 * scale;
      oy = top + (r.height - top - bottom - (cam.y1 - cam.y0) * scale) / 2 - cam.y0 * scale;
      const push = 1 + (1 - easeOut(op)) * 0.08; // a little push-in as it appears
      world.setAttribute('transform', `translate(${f(r.width / 2)} ${f(r.height / 2)}) scale(${f(push)}) translate(${f(-r.width / 2)} ${f(-r.height / 2)}) translate(${f(ox)} ${f(oy)}) scale(${f(scale)})`);
      svg.style.opacity = f(easeOut(op));
      stepT += dt; idle += dt; sayT += dt;
      // first time on a step: show the gesture; later only if the player seems stuck
      if (!taught[step] && stepT > 0.9 && step < 4) { taught[step] = true; teach(); tip.textContent = STEP_TIPS[step]; tip.classList.add('show'); tipT = 0; }
      if (taught[step] && !ghost && idle > 7 && !fingerDown && step < 4 && doneT < 0) { teach(); idle = 0; }
      tipT += dt; if (tipT > 4.5) tip.classList.remove('show');

      // colours of the hour
      counterTop.setAttribute('fill', tint(C.wood, P)); counterEdge.setAttribute('fill', tint(C.woodDark, P)); counterFace.setAttribute('fill', tint(C.woodFace, P));
      tubSide.setAttribute('fill', tint(C.tub, P)); board.setAttribute('fill', tint(C.board, P)); getaTop.setAttribute('fill', tint(C.geta, P));
      block.setAttribute('fill', tint(C.salmon, P, 0.35)); [rightHand, leftHand, leftFront].forEach((h) => h.tint(P));
      void bands;

      // ---------------- 1 · rice
      const stirP = clamp01(stir / (Math.PI * 2 * 2.5));
      swirl = approach(swirl, 0, 1.6, dt); clump = approach(clump, 0, fingerDown ? 0.4 : 1.2, dt);
      grains.forEach((g, i) => {
        g.th += (swirl * (1.15 - g.r * 0.6)) * dt * 0.55;
        const rr = g.r * (1 - clump * 0.25 * ((i % 3) / 2));
        const x = TUB[0] + Math.cos(g.th) * rr * 64, y = TUB[1] + 2 + Math.sin(g.th) * rr * 25;
        g.n.setAttribute('cx', f(x)); g.n.setAttribute('cy', f(y));
        g.n.setAttribute('transform', `rotate(${f((g.th * 57.3 + i * 37) % 180)} ${f(x)} ${f(y)})`);
      });
      rice.setAttribute('fill', rgb(mix(C.riceRaw, C.rice, stirP)));
      shine.setAttribute('opacity', f(stirP * 0.8 * (0.8 + 0.2 * Math.sin(t * 2))));
      lumps.setAttribute('opacity', f(clump));
      lumps.setAttribute('d', [0, 1, 2, 3].map((k) => ell(TUB[0] - 30 + k * 20 + Math.sin(t + k) * 2, TUB[1] - 2 + (k % 2) * 8, 7, 4)).join(' '));
      tubSay.setAttribute('opacity', f(sayT < 1.6 ? Math.min(1, sayT * 4) * (1 - clamp01((sayT - 1.2) / 0.4)) : 0));
      steam.setAttribute('d', [0, 1, 2].map((k) => { const x = TUB[0] - 26 + k * 26, s = Math.sin(t * 1.4 + k * 2.1); return `M${x} ${TUB[1] - 20} q${f(6 + s * 3)} -12 0 -24 q${f(-6 - s * 3)} -12 0 -24`; }).join(' '));
      guideRing.setAttribute('opacity', f(step === 0 ? 0.5 * (1 - stirP) : 0));
      if (step === 0 && stirP > 0.01) {
        const a = stirP * Math.PI * 2 - 1e-4;
        progRing.setAttribute('d', `M${TUB[0]} ${TUB[1] + 2 - 34} A54 34 0 ${a > Math.PI ? 1 : 0} 1 ${f(TUB[0] + Math.sin(a) * 54)} ${f(TUB[1] + 2 - Math.cos(a) * 34)}`);
        progRing.setAttribute('opacity', '0.9');
      } else progRing.setAttribute('opacity', '0');
      if (step === 0 && stirP >= 1 && !advancing) { advancing = true; sfx.success(); haptic(18); onStep(1); after(0.7, () => { advancing = false; if (open && step === 0) setStep(1); }); }

      // paddle in the right hand while stirring
      const stirring = step === 0;
      paddle.setAttribute('opacity', f(stirring ? 1 : 0));
      if (stirring) {
        const tgt: Vec = fingerDown && finger ? finger : [TUB[0] + Math.cos(t * 0.8) * 20, TUB[1] + Math.sin(t * 0.8) * 8];
        const inside: Vec = [TUB[0] + clampEll(tgt[0] - TUB[0], tgt[1] - TUB[1], 58, 22)[0], TUB[1] + clampEll(tgt[0] - TUB[0], tgt[1] - TUB[1], 58, 22)[1]];
        paddleTip[0] = approach(paddleTip[0], inside[0], 14, dt); paddleTip[1] = approach(paddleTip[1], inside[1], 14, dt);
        const lean = (paddleTip[0] - TUB[0]) * 0.25 + 12;
        paddle.setAttribute('transform', `translate(${f(paddleTip[0])} ${f(paddleTip[1])}) rotate(${f(lean)})`);
        const a = lean * Math.PI / 180, hx = paddleTip[0] + Math.sin(a) * 74, hy = paddleTip[1] - Math.cos(a) * 74;
        rightHand.set([hx + 2, hy + 12], 62, lean + 6, 'grip');
      }

      // ---------------- 2 · fish
      const x0 = blockX0();
      block.setAttribute('d', `M${f(x0)} ${BLOCK.y0 + 4} Q${f(x0)} ${BLOCK.y0} ${f(x0 + 4)} ${BLOCK.y0} L${BLOCK.x1 - 6} ${BLOCK.y0} Q${BLOCK.x1} ${BLOCK.y0} ${BLOCK.x1} ${BLOCK.y0 + 6} L${BLOCK.x1} ${BLOCK.y1} L${f(x0)} ${BLOCK.y1}Z`);
      clipRect.setAttribute('d', `M${f(x0)} ${BLOCK.y0} L${BLOCK.x1} ${BLOCK.y0} L${BLOCK.x1} ${BLOCK.y1} L${f(x0)} ${BLOCK.y1}Z`);
      const fat: string[] = []; for (let x = BLOCK.x0 - 40; x < BLOCK.x1 + 10; x += 13) fat.push(`M${x} ${BLOCK.y1 + 4} L${x + 40} ${BLOCK.y0 - 6}`);
      blockFat.setAttribute('d', fat.join(' '));
      const cx = x0 + BLOCK.slice;
      cutLine.setAttribute('d', `M${f(cx)} ${BLOCK.y0 - 6} L${f(cx)} ${BLOCK.y1 + 6}`);
      cutLine.setAttribute('opacity', f(step === 1 && cuts < 3 ? 0.55 + 0.25 * Math.sin(t * 4) : 0));
      cutLine.setAttribute('stroke-dashoffset', f(-t * 12));
      knife.setAttribute('opacity', f(step === 1 ? 1 : 0));
      if (step === 1) {
        if (!cutting && knifeY !== 999) knifeY = approach(knifeY, 0, 10, dt);
        if (knifeY === 999 || knifeY > BLOCK.y1 - BLOCK.y0 + 6) {
          // the cut: a slice tips over onto the board
          slices[cuts].t = 0; cuts++; knifeY = 0; cutting = false; sfx.slice(); haptic(14);
          onStep(cuts >= 3 ? 2 : 1);
          if (cuts >= 3) after(0.9, () => { if (open && step === 1) { sfx.success(); setStep(2); } });
        }
        // the blade hangs over the dashed line and follows your finger down through the fish
        const ky = BLOCK.y0 - 66 + Math.min(knifeY, BLOCK.y1 - BLOCK.y0 + 8) + (cutting ? 0 : Math.sin(t * 2.4) * 1.5);
        knife.setAttribute('transform', `translate(${f(cx + 3)} ${f(ky)}) rotate(180)`);
        rightHand.set([cx + 17, ky - 30], 24, -90, 'grip');
      }
      slices.forEach((s, i) => {
        if (s.t < 0) { s.g.setAttribute('opacity', '0'); return; }
        s.t += dt;
        const u = easeOut(clamp01(s.t / 0.55)), b = backOut(clamp01((s.t - 0.35) / 0.4));
        const sx0 = BLOCK.x0 + i * BLOCK.slice;
        // tips over its bottom-left corner, then slides to the pile
        const rot = lerp(0, -76, u), tx = lerp(sx0, PILE[i][0], b), ty = lerp(BLOCK.y1, PILE[i][1], b);
        const gone = step >= 2 ? nigiri[i].drape >= 0 ? 1 : 0 : 0;
        s.g.setAttribute('opacity', f(1 - gone));
        s.g.setAttribute('transform', `translate(${f(tx)} ${f(ty)}) rotate(${f(rot)}) translate(0 ${-(BLOCK.y1 - BLOCK.y0)})`);
      });

      // ---------------- 3 · shaping
      if (holdI >= 0 && fingerDown && step === 2) {
        holdT += dt; pressPh += dt * 5.5;
        const n = nigiri[holdI];
        const was = n.shape;
        n.shape = Math.min(1, n.shape + dt / 1.3);
        if (Math.floor(pressPh / Math.PI) !== Math.floor((pressPh - dt * 5.5) / Math.PI)) { sfx.press(); haptic(5); }
        if (was < 1 && n.shape >= 1) { n.drape = 0; holdI = -1; sfx.chime(); haptic(12); }
      }
      const pressNow = holdI >= 0 && fingerDown ? Math.max(0, Math.sin(pressPh)) : 0;
      nigiri.forEach((n, i) => {
        const visible = step >= 2 || (n.shape > 0) ? 1 : 0;
        n.g.setAttribute('opacity', f(visible));
        if (!visible) return;
        if (n.drape >= 0) n.drape += dt;
        const s = easeInOut(n.shape), pr = i === holdI ? pressNow : 0;
        // a rough lump → a neat oval dome
        const pts: Vec[] = [];
        for (let k = 0; k <= 10; k++) {
          const a = Math.PI + (k / 10) * Math.PI;
          const lumpy = 1 + (Math.sin(k * 2.1 + i * 1.7) * 0.09 + Math.sin(k * 3.3 + 1) * 0.05) * (1 - s);
          const rx = lerp(16, 21, s) * (1 + pr * 0.06), ry = lerp(15, 14, s) * (1 - pr * 0.14);
          pts.push([Math.cos(a) * rx * lumpy, Math.sin(a) * ry * lumpy]);
        }
        // a soft curve through the points
        let d = `M${pt(pts[0])}`;
        for (let k = 1; k < pts.length - 1; k++) d += ` Q${pt(pts[k])} ${f((pts[k][0] + pts[k + 1][0]) / 2)} ${f((pts[k][1] + pts[k + 1][1]) / 2)}`;
        n.body.setAttribute('d', d + ` L${pt(pts[pts.length - 1])} Q0 3.6 ${pt(pts[0])}Z`);
        n.dots.setAttribute('d', `M-8 -6 l2 0 M3 -9 l2 0 M-2 -3 l2 0 M9 -4 l2 0 M-12 -2 l2 0`);
        // the slice drapes on: lifts from the pile, arcs over, settles with a squash
        const dr = n.drape < 0 ? 0 : clamp01(n.drape / 0.55);
        const settle = n.drape < 0 ? 0 : elasticOut(clamp01((n.drape - 0.45) / 0.5));
        n.top.setAttribute('opacity', f(n.drape >= 0 ? 1 : 0));
        const from: Vec = [PILE[i][0] - 26 - n.pos[0], PILE[i][1] - 6 - n.pos[1]];
        const tx = lerp(from[0], 0, easeInOut(dr)), ty = lerp(from[1], 0, easeInOut(dr)) - Math.sin(Math.PI * dr) * 26;
        n.top.setAttribute('transform', `translate(${f(tx)} ${f(ty)}) rotate(${f(lerp(-60, 0, easeOut(dr)))}) scale(${f(lerp(0.7, 1, dr) * (1 + (1 - settle) * 0.05))} ${f(lerp(0.7, 1, dr) * (1 - (1 - settle) * 0.08))})`);
        // position: home, dragged, or on the geta
        let p = n.pos;
        if (n.slot >= 0) { n.plated += dt; const b = backOut(clamp01(n.plated / 0.45)); p = [lerp(n.pos[0], SLOT[n.slot][0], b), lerp(n.pos[1], SLOT[n.slot][1], b)]; if (n.plated > 0.45) n.pos = [...SLOT[n.slot]] as Vec; }
        else if (!drag || drag.i !== i) n.pos = [approach(n.pos[0], MOUND[i][0], 10, dt), approach(n.pos[1], MOUND[i][1], 10, dt)];
        n.lift = approach(n.lift, drag && drag.i === i ? 1 : 0, 12, dt);
        n.g.setAttribute('transform', `translate(${f(p[0])} ${f(p[1] - n.lift * 10)}) rotate(${f(n.lift * -4)}) scale(${f(1 + n.lift * 0.08)})`);
        n.shadow.setAttribute('transform', `translate(0 ${f(n.lift * 10)}) scale(${f(1 - n.lift * 0.2)})`);
        n.shadow.setAttribute('opacity', f(0.12 - n.lift * 0.05));
      });
      if (step === 2) {
        const i = holdI >= 0 ? holdI : nigiri.findIndex((n) => n.shape < 1);
        if (i >= 0) {
          const m = MOUND[i], p = holdI >= 0 ? pressNow : 0;
          // the left hand cups the rice from the side; two fingers of the right press its top
          leftHand.set([m[0] - 33, m[1] + 4], 150, 38, 'cup');
          const lift = holdI >= 0 ? 0 : 7;
          rightHand.set([m[0] + 31, m[1] - 22 + p * 2.4 - lift], 18, -101, 'press', p, 58);
        }
        if (nigiri.every((n) => n.shape >= 1) && nigiri.every((n) => n.drape > 0.9) && doneT < 0 && stepT > 0.5) { onStep(3); sfx.success(); setStep(3); }
      }
      // ---------------- 4 · plating
      slotGuides.forEach((g, i) => g.setAttribute('opacity', f(step === 3 && i === plated ? 0.5 + 0.4 * Math.sin(t * 4) : 0)));
      if (step === 3 && plated >= 3 && doneT < 0 && nigiri.every((n) => n.plated > 0.45)) { doneT = 0; camT = 1; cam = { ...cam }; frameTo([436, 112, 652, 282]); }
      if (doneT >= 0) {
        doneT += dt;
        garnish.setAttribute('opacity', f(easeOut(doneT / 0.4)));
        garnish.setAttribute('transform', `translate(600 196) scale(${f(backOut(clamp01(doneT / 0.5)))}) translate(-600 -196)`);
        const st = clamp01((doneT - 1.0) / 0.35);
        stamp.setAttribute('opacity', f(st > 0 ? 1 - clamp01((doneT - 2.6) / 0.4) : 0));
        stamp.setAttribute('transform', `translate(${f(r.width - 64)} ${f(r.height - 120)}) rotate(${f(-8 + (1 - st) * 14)}) scale(${f(lerp(2.2, 1, easeIn2(st)))})`);
        if (doneT > 1.35 && doneT - dt <= 1.35) { sfx.stamp(); haptic(24); }
        if (doneT > 3.1) { doneT = -1; onStep(4); onDone(); api.close(); }
      } else stamp.setAttribute('opacity', '0');
      // hands while plating: rest out of the way
      handsFront.setAttribute('opacity', f(step === 3 ? 0 : 1));
      handsBack.setAttribute('opacity', f(step === 2 ? 1 : 0));
      if (step !== 2) leftHand.set([-400, 800], 90, 0, 'flat');
      void leftFront;

      // ---------------- ghost hand
      ghostOp = approach(ghostOp, ghost ? 1 : 0, 6, dt);
      ghostG.setAttribute('opacity', f(ghostOp)); ghostTrail.setAttribute('opacity', f(ghostOp * 0.6));
      if (ghost) {
        ghost.t += dt;
        const u = (ghost.t % ghost.period) / ghost.period;
        let p = ghost.pts[0], press = 0;
        if (ghost.kind === 'path') {
          const s = clamp01((u - 0.1) / 0.72), seg = (ghost.pts.length - 1) * easeInOut(s), k = Math.min(ghost.pts.length - 2, Math.floor(seg)), fr = seg - k;
          p = [lerp(ghost.pts[k][0], ghost.pts[k + 1][0], fr), lerp(ghost.pts[k][1], ghost.pts[k + 1][1], fr)];
          press = u > 0.08 && u < 0.84 ? 1 : 0;
          ghostTrail.setAttribute('d', 'M' + ghost.pts.map(pt).join('L'));
        } else { press = u > 0.15 && u < 0.85 ? 1 : 0; ghostTrail.setAttribute('d', ''); }
        ghostG.setAttribute('transform', `translate(${f(p[0])} ${f(p[1])}) scale(${press ? 0.93 : 1})`);
        ghostRing.setAttribute('cx', f(p[0])); ghostRing.setAttribute('cy', f(p[1]));
        ghostRing.setAttribute('r', f(9 + (ghost.kind === 'hold' ? Math.sin(ghost.t * 6) * 3 + 4 : 0)));
        ghostRing.setAttribute('opacity', f(press * ghostOp * 0.8));
      } else ghostRing.setAttribute('opacity', '0');
    },
  };
  const paddleTip: Vec = [TUB[0], TUB[1]];
  return api;
}

const easeIn2 = (t: number) => t * t;
function clampEll(dx: number, dy: number, rx: number, ry: number): Vec {
  const d = Math.hypot(dx / rx, dy / ry);
  return d > 1 ? [dx / d, dy / d] : [dx, dy];
}
export type Closeup = ReturnType<typeof createCloseup>;
