// Roji: the little garden alley up to your gate.
//
// The first time you come home the whole alley is only a blue pencil sketch — its perspective
// lines still showing, the fence, the walls, the lantern, the gate, the stepping stones, all
// waiting. You stand at its mouth. A ring of ink closes on the next stepping stone with every beat
// (a quiet geta-tock marks the moment it lands); touch then and that whole stretch of the alley is
// drawn in ink before your eyes: the stone and its gravel, the curb, the bamboo fence and the
// plastered wall beside it, whatever grows there. Five touches, five stretches, from the street
// up to the gate. On the beat a stone lands straight and moss creeps round it; off the beat it
// lands crooked — still yours, still a path. Nothing fails. Every stone keeps a note of a
// five-note scale: when the alley is done it plays your rhythm back, and every time you walk home
// over the stones they play it again.
import { el, f, PAPER } from '../lib/ink.ts';
import { sfx, haptic, easeOut, easeInOut, clamp01, lerp, backOut } from './fx.ts';

type Vec = [number, number];
export type Stone = { q: number; tilt: number; gap: number };

// ------------------------------------------------------------------ geometry
/** the axis of the alley and the gate at its end */
const VX = 457;
/** the near edge of each stretch, from the street (358) to the gate (306) */
export const ROWS = [358, 344, 334, 325, 316, 306];
const MOUTH = 344;
/** half the width of the walk at a depth y (wider where it spills onto the street) */
const hw = (y: number) => y <= MOUTH ? lerp(8, 25, (y - 306) / 38) : 25 + (y - MOUTH) * .35;
/** the fence and the wall: half as tall as the old walls, so the sky and the garden show above */
const wallTop = (y: number) => y - lerp(10, 43, (Math.min(MOUTH, y) - 306) / 38);
/** where the stepping stones sit, alternating a little as stones in a roji do */
const SWAY = [0, -.2, .17, -.13, .06];
export const STONES: [number, number, number, number][] = ROWS.slice(0, 5).map((a, k) => {
  const b = ROWS[k + 1], c = (a + b) / 2, w = hw(c);
  return [VX + SWAY[k] * w, c, w * (k ? .4 : .5), (a - b) * (k ? .3 : .26)];
});
/** where you stand while the alley is drawn: at its mouth, to one side, so nothing hides it */
export const STAND: Vec = [433, 361];

export const BEAT = 1.05;
export const GRADE = { great: 0.13, good: 0.28 };
/** how a touch lands, given how far (seconds) it was from the ring settling */
export function grade(err: number, side: number): Stone {
  const e = Math.abs(err);
  if (e < GRADE.great) return { q: 1, tilt: 0, gap: 0 };
  if (e < GRADE.good) return { q: 0.72, tilt: side * 6, gap: 0 };
  return { q: 0.42, tilt: side * 13, gap: 0 };
}
/** old saves had the stones already: lay them straight */
export const normalizeStones = (s: unknown): Stone[] => Array.isArray(s) ? s.slice(0, STONES.length).map((x: any) => ({ q: clamp01(Number(x?.q) || 0.42), tilt: Math.max(-20, Math.min(20, Number(x?.tilt) || 0)), gap: Math.max(0, Math.min(3, Number(x?.gap) || BEAT)) })) : [];

const PENCIL = '#7c9cc6', RED = '#b94c3e', MOSS = '#7d9a5a', STONE = '#d8ccb6', BAMBOO = '#e2d2a0', WOOD = '#c4a074', PLASTER = '#f3ece0', LEAF = '#8fa86a', HYDRANGEA = '#a9b8dc';

// a little deterministic noise so stones are stones, not ellipses
const nz = (k: number, i: number) => Math.sin(k * 12.9898 + i * 78.233) * 43758.5453 % 1;
const P = (pts: Vec[], close = false) => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + (close ? 'Z' : '');
const Q = (a: Vec, c: Vec, b: Vec) => `M${f(a[0])} ${f(a[1])}Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`;

/** one drawn line of a stretch: its path, how thick, an optional wash of colour, and when in the stretch it is drawn */
type Line = { d: string; w: number; fill?: string; at: number; dur: number; stone?: boolean; glow?: boolean };

function stonePath(k: number, cx: number, cy: number, rx: number, ry: number) {
  const pts: Vec[] = [];
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, r = 1 + .09 * Math.sin(3 * a + k * 1.7) + .05 * Math.sin(5 * a + k);
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  // a smooth closed curve through the points
  let d = `M${f((pts[0][0] + pts[1][0]) / 2)} ${f((pts[0][1] + pts[1][1]) / 2)}`;
  for (let i = 1; i <= pts.length; i++) { const p = pts[i % pts.length], n = pts[(i + 1) % pts.length]; d += `Q${f(p[0])} ${f(p[1])} ${f((p[0] + n[0]) / 2)} ${f((p[1] + n[1]) / 2)}`; }
  return d + 'Z';
}

/** everything in stretch k of the alley, near to far */
function stretch(k: number): Line[] {
  const a = ROWS[k], b = ROWS[k + 1], L: Line[] = [];
  const [sx, sy, rx, ry] = STONES[k];
  const s = hw(sy) / 25;
  // the stepping stone, then the curbs either side, then the gravel raked along the walk
  L.push({ d: stonePath(k, sx, sy, rx, ry), w: .55 + .25 * s, fill: STONE, at: 0, dur: .42, stone: true });
  L.push({ d: Q([sx - rx * .7, sy + ry * .5], [sx, sy + ry * 1.15], [sx + rx * .72, sy + ry * .45]), w: .3, at: .3, dur: .2 });
  for (const side of [-1, 1]) {
    const e = (y: number) => VX + side * hw(y);
    L.push({ d: P([[e(a), a], [e(b), b]]), w: .6, at: .08, dur: .3 });
    const inset = 1.8 * s;
    L.push({ d: P([[e(a) - side * inset, a], [e(b) - side * inset * .7, b]]), w: .35, at: .14, dur: .3 });
    // curb stones: little cross joints
    const n = k ? 2 : 3;
    for (let i = 1; i <= n; i++) { const y = lerp(a, b, i / (n + 1)); L.push({ d: P([[e(y), y], [e(y) - side * inset * .9, y]]), w: .3, at: .3 + i * .03, dur: .1 }); }
    // gravel, raked in lines that run up the alley
    for (const fr of [.58, .8]) {
      const pts: Vec[] = []; for (let i = 0; i <= 6; i++) { const y = lerp(a - .6, b + .4, i / 6); pts.push([VX + side * fr * hw(y) + Math.sin(i * 1.7 + k) * .25 * s, y]); }
      L.push({ d: P(pts), w: .22, at: .2 + fr * .2, dur: .35 });
    }
  }
  if (k === 0) {
    // at the mouth, on the street: a long threshold slab, and the curved bamboo guards (inuyarai)
    // at the foot of both houses
    L.push({ d: P([[VX - 21, 345.2], [VX + 21, 345.2], [VX + 22.5, 347.6], [VX - 22.5, 347.6]], true), w: .5, fill: '#e3d9c6', at: .02, dur: .35 });
    for (const side of [-1, 1]) {
      const x0 = VX + side * 27, x1 = VX + side * 46;
      const ribs: string[] = [];
      for (let i = 0; i <= 7; i++) { const x = lerp(x0, x1, i / 7); ribs.push(Q([x, 330], [x + side * 3.6, 331], [x + side * 4.2, 344])); }
      L.push({ d: `M${f(x0)} 330L${f(x1)} 330` + ribs.join(''), w: .35, at: .35, dur: .5 });
      L.push({ d: Q([x0, 336], [lerp(x0, x1, .5) + side * 3, 336.4], [x1 + side * 3.6, 336.6]), w: .55, at: .65, dur: .25 });
    }
    return L;
  }
  // stretch k ≥ 1 lies inside the alley: the bamboo fence on the left, the plastered wall on the right
  for (const side of [-1, 1]) {
    const e = (y: number) => VX + side * hw(y);
    const base: Vec[] = [[e(a), a], [e(b), b]], top: Vec[] = [[e(b), wallTop(b)], [e(a), wallTop(a)]];
    if (side < 0) {
      L.push({ d: P([...base, ...top], true), w: .55, fill: BAMBOO, at: .12, dur: .4 });
      // slats, close together, then two binding rails
      const n = Math.max(3, Math.round((e(b) - e(a)) / 1.15)), slats: string[] = [];
      for (let i = 1; i < n; i++) { const u = i / n, y = lerp(a, b, u), x = e(y); slats.push(`M${f(x)} ${f(y)}L${f(x)} ${f(wallTop(y))}`); }
      L.push({ d: slats.join(''), w: .25, at: .3, dur: .4 });
      for (const h of [.3, .72]) { const r = (y: number) => lerp(y, wallTop(y), h); L.push({ d: P([[e(a), r(a)], [e(b), r(b)]]) + P([[e(a), r(a) - .9 * s], [e(b), r(b) - .9 * s]]), w: .45, at: .5 + h * .2, dur: .3 }); }
    } else {
      L.push({ d: P([...base, ...top], true), w: .55, fill: PLASTER, at: .12, dur: .4 });
      const mid = (y: number) => lerp(y, wallTop(y), .38);
      L.push({ d: P([[e(a), a], [e(b), b], [e(b), mid(b)], [e(a), mid(a)]], true), w: .45, fill: WOOD, at: .3, dur: .35 });
      const n = Math.max(2, Math.round((e(a) - e(b)) / 1.6)), boards: string[] = [];
      for (let i = 1; i < n; i++) { const y = lerp(a, b, i / n), x = e(y); boards.push(`M${f(x)} ${f(y)}L${f(x)} ${f(mid(y))}`); }
      L.push({ d: boards.join(''), w: .25, at: .45, dur: .35 });
      // a coping of little tiles along the top
      L.push({ d: P([[e(a) + .8 * s, wallTop(a) - .3], [e(b) + .5 * s, wallTop(b) - .3]]) + P([[e(a), wallTop(a) - 1.6 * s], [e(b), wallTop(b) - 1.1 * s]]), w: .6, at: .55, dur: .3 });
    }
  }
  if (k === 1) {
    // a stone lantern (tōrō) by the wall: footing, post, the fire box, its hat, the jewel
    const x = 473.6, y = 340.5, u = .9;
    L.push({ d: P([[x - 3 * u, y], [x + 3 * u, y], [x + 2.3 * u, y - 1.6 * u], [x - 2.3 * u, y - 1.6 * u]], true), w: .45, fill: STONE, at: .45, dur: .25 });
    L.push({ d: P([[x - 1 * u, y - 1.6 * u], [x - 1 * u, y - 7 * u], [x + 1 * u, y - 7 * u], [x + 1 * u, y - 1.6 * u]]), w: .45, fill: STONE, at: .55, dur: .25 });
    L.push({ d: P([[x - 2.6 * u, y - 7 * u], [x + 2.6 * u, y - 7 * u], [x + 2.3 * u, y - 11.5 * u], [x - 2.3 * u, y - 11.5 * u]], true), w: .45, fill: STONE, at: .65, dur: .25 });
    L.push({ d: P([[x - .9 * u, y - 8 * u], [x + .9 * u, y - 8 * u], [x + .9 * u, y - 10.5 * u], [x - .9 * u, y - 10.5 * u]], true), w: .3, fill: '#f6d58f', at: .75, dur: .15, glow: true });
    L.push({ d: `M${f(x - 4.4 * u)} ${f(y - 11.2 * u)}Q${f(x)} ${f(y - 15.6 * u)} ${f(x + 4.4 * u)} ${f(y - 11.2 * u)}Z`, w: .5, fill: STONE, at: .8, dur: .25 });
    L.push({ d: `M${f(x)} ${f(y - 14.2 * u)}m-.8 0a.8 .9 0 1 0 1.6 0a.8 .9 0 1 0 -1.6 0`, w: .4, fill: STONE, at: .9, dur: .12 });
    // a fern at its foot
    L.push({ d: Q([x - 3, y + .5], [x - 5, y - 3], [x - 7.5, y - 3.4]) + Q([x - 3.4, y + .4], [x - 4.4, y - 1.4], [x - 6.6, y - .8]), w: .35, at: .85, dur: .2 });
  }
  if (k === 2) {
    // a hydrangea against the fence, and a maple branch leaning over the wall
    const x = 443.6, y = 329.5;
    const heads: string[] = [];
    [[0, 0, 2.6], [-2.6, -.9, 2], [2.3, -1.6, 2.1], [.2, -3, 1.9]].forEach(([dx, dy, r]) => heads.push(`M${f(x + dx - r)} ${f(y + dy)}a${f(r)} ${f(r * .85)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r * .85)} 0 1 0 ${f(-2 * r)} 0`));
    L.push({ d: Q([x - 4, y + 2], [x, y + .4], [x + 4.4, y + 2.2]), w: .4, fill: LEAF, at: .45, dur: .2 });
    L.push({ d: heads.join(''), w: .35, fill: HYDRANGEA, at: .55, dur: .35 });
    const leaves: string[] = [];
    for (let i = 0; i < 5; i++) { const lx = lerp(484, 466, i / 4), ly = lerp(279, 289, i / 4) + Math.sin(i * 2) * 1.5; leaves.push(`M${f(lx)} ${f(ly)}l-1.6 -.6l.7 -1.4l.9 1l.9 -1l.7 1.4Z`); }
    L.push({ d: Q([488, 276], [478, 279], [464, 290]), w: .55, at: .5, dur: .3 });
    L.push({ d: leaves.join(''), w: .3, fill: '#d0694e', at: .7, dur: .3 });
  }
  if (k === 3) {
    // bamboo rising behind the fence, its leaves against the sky
    const culms: string[] = [], nodes: string[] = [], leaves: string[] = [];
    [[437.5, 1.3], [441, 1.05], [444.2, .85]].forEach(([x, w], i) => {
      const top = 252 + i * 5, base = wallTop(lerp(334, 325, (x - 436) / 10)) + 1;
      culms.push(`M${f(x - w / 2)} ${f(base)}L${f(x - w / 2 + .6)} ${top}M${f(x + w / 2)} ${f(base)}L${f(x + w / 2 + .6)} ${top}`);
      for (let y = base - 6; y > top + 3; y -= 7) { const xx = lerp(x, x + .6, (base - y) / (base - top)); nodes.push(`M${f(xx - w / 2)} ${f(y)}L${f(xx + w / 2)} ${f(y)}`); }
      for (let j = 0; j < 3; j++) { const ly = top + 4 + j * 6, lx = x + .6 + (j % 2 ? 1 : -1) * .4, dir = j % 2 ? 1 : -1; leaves.push(`M${f(lx)} ${f(ly)}q${f(dir * 3)} ${f(-1.4)} ${f(dir * 6.4)} ${f(.6)}q${f(-dir * 3.2)} ${f(.6)} ${f(-dir * 6.4)} ${f(-.6)}Z`); }
    });
    L.push({ d: culms.join(''), w: .4, at: .45, dur: .4 });
    L.push({ d: nodes.join(''), w: .35, at: .7, dur: .2 });
    L.push({ d: leaves.join(''), w: .3, fill: LEAF, at: .75, dur: .3 });
  }
  if (k === 4) {
    // the gate: the roof of your house beyond it, two posts, a little roof of its own, a lamp
    L.push({ d: 'M439 280.5Q457 278.6 475 280.5L471 275H443Z', w: .5, fill: '#cfc6b4', at: .2, dur: .35 });
    L.push({ d: 'M447.4 306V285.6M466.6 306V285.6M447.4 288.4H466.6', w: .7, at: .3, dur: .3 });
    L.push({ d: 'M444.6 286.2Q457 284.4 469.4 286.2L466.4 281.6H447.6Z', w: .6, fill: '#5b4a3a', at: .45, dur: .3 });
    L.push({ d: 'M447.6 281.6L457 279.2L466.4 281.6', w: .45, at: .6, dur: .2 });
    L.push({ d: 'M469.2 290.4h2.6v4.6h-2.6Z', w: .4, fill: '#f6d58f', at: .7, dur: .2, glow: true });
    L.push({ d: 'M470.5 288.4v2', w: .35, at: .68, dur: .1 });
  }
  return L;
}
const STRETCHES = ROWS.slice(0, 5).map((_, k) => stretch(k));
/** how long one stretch takes to draw itself */
const DRAW = 1.15;

export function createAlley(layer: Element) {
  const root = el('g', { 'data-alley': '' }, layer);
  // the pencil: perspective lines first, then every stretch as a light sketch
  const sketch = el('g', { 'data-alley-sketch': '' }, root);
  const guides = el('path', { d: 'M432 344L457 268M482 344L457 268M413 344L501 344M432 301L457 268M482 301L457 268', fill: 'none', stroke: PENCIL, 'stroke-width': .25, 'stroke-dasharray': '1.2 1.6', opacity: .55 }, sketch);
  const sketched = STRETCHES.map((lines, k) => {
    const g = el('g', { 'data-sketch': k }, sketch);
    for (const l of lines) {
      el('path', { d: l.d, fill: 'none', stroke: PENCIL, 'stroke-width': f(Math.max(.22, l.w * .55)), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .8 }, g);
      if (l.stone || l.fill) el('path', { d: l.d, fill: 'none', stroke: PENCIL, 'stroke-width': .2, 'stroke-dasharray': '1.4 1', opacity: .5, transform: `translate(.45 -.3)` }, g);
    }
    return g;
  });
  // the ink, stretch by stretch
  const inked = el('g', { 'data-alley-stones': '' }, root);
  type Drawn = { g: SVGGElement; k: number; t: number; paths: { n: SVGPathElement; l: Line }[]; tip: SVGCircleElement | null };
  let drawn: Drawn[] = [];
  const lights: SVGPathElement[] = [];

  // the gate at the end: two lattice panels that slide apart as you reach them
  const gateG = el('g', { 'data-gate': '' }, root);
  const gateLight = el('rect', { x: 449.4, y: 289.4, width: 15.2, height: 16.6, fill: '#f6d58f', opacity: 0 }, gateG);
  const gateClip = el('clipPath', { id: 'alley-gate-clip' }, gateG);
  el('rect', { x: 447.8, y: 288.6, width: 18.4, height: 17.6 }, gateClip);
  const gatePanels = [448.2, 457].map(x0 => {
    const pg = el('g', {}, el('g', { 'clip-path': 'url(#alley-gate-clip)' }, gateG));
    const lat: string[] = []; for (let x = x0 + 2.2; x < x0 + 8.6; x += 2.2) lat.push(`M${f(x)} 290.6V305`);
    el('path', { d: `M${x0} 288.6h8.8v17.6h-8.8Z`, fill: '#ece5d3', stroke: 'currentColor', 'stroke-width': .45 }, pg);
    el('path', { d: lat.join(' ') + ` M${x0} 291.6h8.8M${x0} 300h8.8`, fill: 'none', stroke: 'currentColor', 'stroke-width': .28 }, pg);
    return pg;
  });
  let gateOpen = 0, gatePrev = 0, gateCd = 0, gateEdge: 'shut' | 'open' | 'mid' = 'shut';

  const fx = el('g', { 'pointer-events': 'none' }, root);
  const zone = el('ellipse', { fill: RED, 'fill-opacity': 0, stroke: 'none' }, fx);
  const target = el('ellipse', { fill: 'none', stroke: RED, 'stroke-width': .35, 'stroke-dasharray': '1 1.2', opacity: 0 }, fx);
  const ring = el('ellipse', { fill: 'none', stroke: RED, 'stroke-width': .8, opacity: 0 }, fx);
  const blooms: { n: SVGEllipseElement; t: number; i: number; big: number }[] = [];
  const words: { n: SVGTextElement; t: number; y: number }[] = [];

  let stones: Stone[] = [];
  let playing = false, t0 = 0, now = 0, lastBeat = -1, lastTap = -1, finishT = -1, replayT = -1, replayAt = 0, replayI = 0;

  /** lay stretch k in ink; fresh = drawn line by line now, else there already */
  function ink(k: number, s: Stone, fresh: boolean) {
    const g = el('g', { 'data-stone': k, 'data-q': f(s.q) }, inked);
    const [sx, sy, rx, ry] = STONES[k];
    const paths = STRETCHES[k].map(l => {
      const n = el('path', { d: l.d, fill: l.fill ?? 'none', stroke: 'currentColor', 'stroke-width': f(l.w), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      if (l.stone) {
        n.setAttribute('transform', `rotate(${f(s.tilt)} ${f(sx)} ${f(sy)})`);
        n.setAttribute('stroke-width', f(l.w * (.85 + s.q * .3)));
      }
      if (l.glow) lights.push(n);
      if (fresh) { n.setAttribute('pathLength', '1'); n.setAttribute('stroke-dasharray', '1 1'); n.setAttribute('stroke-dashoffset', '1'); n.setAttribute('fill-opacity', '0'); n.setAttribute('opacity', '0'); }
      return { n, l };
    });
    // on the beat, moss creeps round the stone and a few tufts come up in the gravel
    if (s.q >= 1) {
      const m = el('g', { 'data-moss': '', opacity: fresh ? 0 : 1 }, g);
      const tufts: string[] = [];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + k, x = sx + Math.cos(a) * rx * 1.05, y = sy + Math.sin(a) * ry * 1.1 + ry * .3;
        tufts.push(`M${f(x)} ${f(y)}q${f(.3)} ${f(-.8 - (i % 2) * .4)} ${f(.8)} ${f(-1.3 - (i % 2) * .4)}M${f(x + .5)} ${f(y)}q${f(-.1)} ${f(-.7)} ${f(-.5)} ${f(-1.1)}`);
      }
      el('path', { d: tufts.join(''), fill: 'none', stroke: MOSS, 'stroke-width': .42, 'stroke-linecap': 'round' }, m);
      el('path', { d: `M${f(sx - rx * 1.15)} ${f(sy + ry * .4)}q${f(rx * .3)} ${f(ry * .9)} ${f(rx * .7)} ${f(ry * .7)}`, fill: 'none', stroke: MOSS, 'stroke-width': .9, 'stroke-linecap': 'round', opacity: .6 }, m);
      paths.push({ n: m as unknown as SVGPathElement, l: { d: '', w: 0, at: .85, dur: .3 } });
    }
    const tip = fresh ? el('circle', { r: .7, fill: 'currentColor', opacity: 0 }, fx) : null;
    if (fresh) drawn.push({ g, k, t: 0, paths, tip });
    sketched[k].setAttribute('opacity', fresh ? '1' : '0');
  }
  function render() {
    inked.replaceChildren(); drawn.forEach(d => d.tip?.remove()); drawn = []; lights.length = 0;
    stones.forEach((s, i) => ink(i, s, false));
    sketched.forEach((g, i) => g.setAttribute('opacity', i < stones.length ? '0' : '1'));
    guides.setAttribute('opacity', stones.length >= STONES.length ? '0' : '.55');
    gateG.style.display = stones.length >= STONES.length ? '' : 'none';
  }
  function bloom(i: number, big: number) {
    const [x, y, rx, ry] = STONES[i];
    const n = el('ellipse', { cx: f(x), cy: f(y), rx: f(rx), ry: f(ry), fill: 'currentColor', 'fill-opacity': .16, stroke: 'currentColor', 'stroke-width': .5, opacity: 0 }, fx);
    blooms.push({ n, t: 0, i, big });
  }
  function word(i: number, text: string, great: boolean) {
    const [x, y] = STONES[i];
    const n = el('text', { x: f(x + 14), y: f(y - 3), 'font-size': great ? 5.4 : 4.4, 'font-style': 'italic', 'font-family': 'Georgia,serif', fill: great ? RED : 'currentColor', stroke: PAPER, 'stroke-width': 1.2, 'paint-order': 'stroke', opacity: 0 }, fx);
    n.textContent = text; words.push({ n, t: 0, y: y - 3 });
  }

  const finishing = () => finishT >= 0 && finishT < 3.4;
  const phase = () => (((now - t0) / BEAT) % 1 + 1) % 1;
  const api = {
    get stones() { return stones; },
    set stones(s: Stone[]) { stones = s; render(); },
    get built() { return stones.length >= STONES.length; },
    get playing() { return playing; },
    get done() { return finishT > 3.2; },
    /** how far the ring is from settling (0 = settled), for headless checks */
    get phase() { return phase(); },
    /** where to stand while it is drawn */
    get hold(): Vec | null { return playing || finishing() ? STAND : null; },
    show(on: boolean) { root.style.display = on ? '' : 'none'; },
    /** coming out, the gate is still open behind you */
    openGate() { gateOpen = gatePrev = 1; gateEdge = 'open'; },
    /** the gate answers your walk: it slides open as you come close, and shuts behind you */
    gate(y: number, dt: number, lamp: number) {
      const want = api.built ? clamp01((341 - y) / 8) : 0;
      gateOpen += (want - gateOpen) * Math.min(1, dt * 6);
      const dv = dt > 0 ? (gateOpen - gatePrev) / dt : 0; gatePrev = gateOpen; gateCd -= dt;
      if (Math.abs(dv) > .3 && gateCd <= 0) { sfx.slide(Math.min(.7, Math.abs(dv) / 5)); gateCd = .08; }
      if (gateOpen > .92 && gateEdge !== 'open') { if (gateEdge === 'mid') { sfx.knock(); haptic(8); } gateEdge = 'open'; }
      else if (gateOpen < .05 && gateEdge !== 'shut') { if (gateEdge === 'mid') sfx.knock(); gateEdge = 'shut'; }
      else if (gateOpen > .1 && gateOpen < .85) gateEdge = 'mid';
      gatePanels.forEach((pg, i) => pg.setAttribute('transform', `translate(${f((i ? 1 : -1) * gateOpen * 8.2)} 0)`));
      gateLight.setAttribute('opacity', f(gateOpen * (.45 + lamp * .5)));
      // the lantern and the gate lamp burn in the evening
      lights.forEach(n => n.setAttribute('fill', lamp > .05 ? '#ffd27a' : '#f6d58f'));
      lights.forEach(n => n.style.filter = lamp > .05 ? `drop-shadow(0 0 ${f(1.5 * lamp)}px #ffc65c)` : '');
    },
    start(t: number) { stones = []; render(); playing = true; t0 = t; now = t; lastBeat = 0; lastTap = -1; finishT = -1; replayT = -1; },
    /** a touch: the next stretch is drawn, its stone straight or crooked depending on the beat */
    tap(t: number) {
      if (!playing) return null;
      now = t;
      // the ring lands once a beat after the last stretch: early touches are negative, late ones positive
      const e = now - t0;
      if (e < .15) return null; // a double touch, not a step
      const err = e - Math.max(1, Math.round(e / BEAT)) * BEAT;
      const i = stones.length;
      const s = grade(err, err < 0 ? -1 : 1);
      s.gap = lastTap < 0 ? BEAT : Math.min(3, now - lastTap); lastTap = now;
      stones.push(s); ink(i, s, true);
      sfx.stone(i, .6 + s.q * .4); sfx.paper(); haptic(s.q >= 1 ? 18 : 9);
      bloom(i, s.q >= 1 ? 2.4 : 1.6);
      word(i, s.q >= 1 ? 'tam!' : s.q > .6 ? 'güzel' : 'yamuk ama senin', s.q >= 1);
      // the next ring starts its beat now, so you are never rushed
      t0 = now; lastBeat = 0;
      if (stones.length >= STONES.length) { playing = false; finishT = 0; }
      return s;
    },
    /** walking home later: each stone plays its note as you step on it */
    stepOn(y: number, prevY: number) {
      if (!api.built || playing || finishing()) return;
      STONES.forEach(([, sy], i) => {
        if ((prevY - sy) * (y - sy) <= 0 && prevY !== y) { sfx.stone(i, .35 + stones[i].q * .25); bloom(i, 1.4); }
      });
    },
    update(t: number, dt: number) {
      now = t;
      // the ring closes evenly on the next stone and touches it exactly on the beat (the tock)
      if (playing) {
        const i = stones.length, [x, y, rx, ry] = STONES[i], p = phase();
        const k = 1 + (1 - p) * 2.3;
        ring.setAttribute('cx', f(x)); ring.setAttribute('cy', f(y));
        ring.setAttribute('rx', f(rx * k)); ring.setAttribute('ry', f(ry * k));
        ring.setAttribute('opacity', f(.2 + .75 * p));
        ring.setAttribute('stroke-width', f(.5 + .5 * p));
        target.setAttribute('cx', f(x)); target.setAttribute('cy', f(y)); target.setAttribute('rx', f(rx * 1.04)); target.setAttribute('ry', f(ry * 1.04)); target.setAttribute('opacity', '.85');
        // the moment to touch: the stone warms a little just before and after the ring lands
        const near = Math.min(p, 1 - p) * BEAT;
        zone.setAttribute('cx', f(x)); zone.setAttribute('cy', f(y)); zone.setAttribute('rx', f(rx)); zone.setAttribute('ry', f(ry));
        zone.setAttribute('fill-opacity', f(.22 * clamp01(1 - near / GRADE.great)));
        sketched[i].setAttribute('opacity', f(.8 + .2 * Math.sin(p * Math.PI)));
        const beat = Math.floor((now - t0) / BEAT);
        if (beat !== lastBeat) { lastBeat = beat; sfx.tick(true); }
      } else { ring.setAttribute('opacity', '0'); target.setAttribute('opacity', '0'); zone.setAttribute('fill-opacity', '0'); }
      // the stretches being drawn: each line runs out of the brush, then its wash soaks in
      for (let j = drawn.length - 1; j >= 0; j--) {
        const d = drawn[j]; d.t += dt;
        const u = d.t / DRAW;
        let tipAt: DOMPoint | null = null;
        for (const { n, l } of d.paths) {
          const a = clamp01((u - l.at) / l.dur);
          if (!l.d) { n.setAttribute('opacity', f(easeOut(a))); continue; }
          n.setAttribute('opacity', a > 0 ? '1' : '0');
          n.setAttribute('stroke-dashoffset', f(1 - easeInOut(a)));
          if (l.fill) n.setAttribute('fill-opacity', f(easeOut(clamp01((u - l.at - l.dur * .7) / .35))));
          if (a > 0 && a < 1 && !tipAt) { try { tipAt = n.getPointAtLength(n.getTotalLength() * easeInOut(a)); } catch { tipAt = null; } }
        }
        if (d.tip) {
          if (tipAt) { d.tip.setAttribute('cx', f(tipAt.x)); d.tip.setAttribute('cy', f(tipAt.y)); d.tip.setAttribute('opacity', '.9'); }
          else d.tip.setAttribute('opacity', '0');
        }
        // the pencil under it fades as the ink covers it
        sketched[d.k].setAttribute('opacity', f(1 - clamp01((u - .2) / .8)));
        if (u > 1.4) {
          for (const { n, l } of d.paths) { if (!l.d) continue; n.removeAttribute('pathLength'); n.removeAttribute('stroke-dasharray'); n.removeAttribute('stroke-dashoffset'); n.removeAttribute('fill-opacity'); }
          d.tip?.remove(); drawn.splice(j, 1);
        }
      }
      // finished: the guides go, the gate is drawn in, the path plays your five notes back
      if (finishing()) {
        finishT += dt;
        guides.setAttribute('opacity', f(.55 * (1 - clamp01(finishT / .8))));
        if (finishT > .5) { gateG.style.display = ''; gateG.setAttribute('opacity', f(easeOut(clamp01((finishT - .5) / .5)))); }
        if (finishT > 1 && replayT < 0) { replayT = 0; replayI = 0; replayAt = 0; }
        if (replayT >= 0 && replayI < stones.length) {
          replayT += dt;
          if (replayT >= replayAt) { sfx.stone(replayI, .8); bloom(replayI, 1.8); replayI++; replayAt += Math.max(.32, Math.min(.7, (stones[replayI]?.gap ?? BEAT) * .5)); }
        }
      }
      for (let k = blooms.length - 1; k >= 0; k--) {
        const b = blooms[k]; b.t += dt;
        const u = clamp01(b.t / .9), [, , rx, ry] = STONES[b.i];
        b.n.setAttribute('rx', f(rx * lerp(1, b.big, easeOut(u)))); b.n.setAttribute('ry', f(ry * lerp(1, b.big, easeOut(u))));
        b.n.setAttribute('opacity', f((1 - u) * .8));
        if (u >= 1) { b.n.remove(); blooms.splice(k, 1); }
      }
      for (let k = words.length - 1; k >= 0; k--) {
        const w = words[k]; w.t += dt;
        const u = clamp01(w.t / 1.5);
        w.n.setAttribute('opacity', f(u < .15 ? backOut(u / .15) : 1 - clamp01((u - .6) / .4)));
        w.n.setAttribute('y', f(w.y - u * 5));
        if (u >= 1) { w.n.remove(); words.splice(k, 1); }
      }
    },
  };
  render();
  return api;
}
export type Alley = ReturnType<typeof createAlley>;
