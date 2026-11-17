// The wooden icebox, up close. Two shelves for fresh things, one shelf for dishes you cooked.
// Everything you do in it is one brush verb:
//   open   — take the brass handle and swing the door open
//   wipe   — the first time each day it has misted over: wipe it with your finger
//   cut    — salmon comes wrapped in paper and tied: one stroke across the string cuts it
//   move   — drag a thing to the bamboo tray (to cook it or serve it), or from the tray to its
//            dashed place on a shelf (to put it away). Every kind has its own outlined places,
//            like a well-kept icebox: things only settle where they belong.
// Empty places stay dashed, the way the notebook draws unfinished things; touching the outline
// of something you have none of makes a mental note — the shopping list for the greengrocer.
import { f, pt, type Vec } from '../lib/ink.ts';
import { sfx, haptic, clamp01, lerp, easeOut, easeInOut, backOut, approach } from './fx.ts';
import { ITEMS, ITEM_IDS, LOOK, PIECES, recipeFor, type Item, type Topping, type Pantry, type Box } from './pantry.ts';

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
const C = { wood: '#d9b380', woodLight: '#e4c493', woodDark: '#b98c58', zinc: '#dcd8cc', brass: '#c9a24a', ice: '#e3eeec', paper: '#f5ead2', bamboo: '#d8bf86', lacquer: '#7a2f2a', orange: '#f0a046', leaf: '#6e9a4e', string: '#8a5a3c' };

// the box, in a 320 × 540 sheet
const BOX = { x0: 36, x1: 284, y0: 56, y1: 490 };
const IN = { x0: 52, x1: 268, y0: 164, y1: 470 };     // the food compartment behind the door
const HINGE = 50, HANDLE: Vec = [252, 320];
const TRAY: Vec = [160, 516];

// every kind of thing has its own outlined places
type Kind = Item | 'dish';
const SPOTS: Record<Kind, Vec[]> = {
  somon: [[90, 244], [166, 244]],
  mandalina: [[216, 247], [246, 247]],
  yumurta: [[78, 349], [100, 349], [122, 349], [144, 349]],
  'salatalık': [[214, 338], [214, 355]],
  dish: [[111, 443], [213, 443]],   // two lacquer boxes (jūbako) of six
};
// the outline of one thing, drawn around its own origin
const SHAPE: Record<Kind, string> = {
  somon: rect(-32, -15, 32, 15),
  mandalina: ell(0, 0, 13, 12),
  yumurta: ell(0, 0, 9, 11.5),
  'salatalık': 'M-44 2 Q-46 -6 -36 -7 L38 -7 Q46 -6 45 1 Q44 7 36 7 L-36 7 Q-44 7 -44 2Z',
  dish: rect(-42, -15, 42, 17),
};
export type IceboxResult =
  | { mode: 'take'; cook: Topping; used: Item[] }
  | { mode: 'take'; serve: Topping[]; box: number }
  | { mode: 'store' };
export type IceboxOpen = { mode: 'take' | 'store'; pantry: Pantry; dishes: Box[]; carrying?: { items?: Item[]; pieces?: Topping[] }; wipe: boolean };

export function createIcebox(card: HTMLElement, { onDone, onExit, onNote }: { onDone: (r: IceboxResult) => void; onExit: () => void; onNote: (missing: Item[]) => void }) {
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
  fill(world, 'M70 146 L76 84 L244 80 L250 146Z', C.ice, 2);
  ink(world, 'M120 92 l10 22 l-6 14 M190 88 l-8 18 l12 20 M154 100 l4 10', 1.1, { opacity: .55 });
  ink(world, 'M84 94 l18 -2 M214 92 l20 -1', 2.2, { stroke: '#ffffff', opacity: .8 });
  const lattice: string[] = []; for (let x = 70; x < 268; x += 22) lattice.push(`M${x} 70V150`);
  ink(world, lattice.join('') + 'M52 110H268', 2.6, { stroke: C.woodDark });
  ink(world, lattice.join('') + 'M52 110H268', .8);
  const drips = [0, 1, 2].map(() => mk('ellipse', { rx: 1.6, ry: 2.4, fill: '#cfe3e0', stroke: INK, 'stroke-width': .8, opacity: 0 }, world));

  // the food compartment, zinc-lined: two shelves of fresh things, a lower one for dishes
  fill(world, rect(IN.x0, IN.y0, IN.x1, IN.y1), C.zinc, 2);
  ink(world, 'M52 262H268 M52 366H268', 3.2);
  ink(world, 'M52 268H268 M52 372H268', .7, { opacity: .45 });
  const fixtures = mk('g', {}, world);
  // a little wooden egg rack, two lacquer trays for dishes, a paper tag
  fill(fixtures, 'M66 362H156V366H66Z', C.woodDark, 1.4);
  fill(fixtures, rect(68, 456, 154, 462) + rect(170, 456, 256, 462), C.lacquer, 1.6);
  fill(fixtures, 'M134 382H186V396H134Z', PAPER, 1.1);
  mk('text', { x: 160, y: 392.5, 'text-anchor': 'middle', 'font-size': 9, 'font-style': 'italic', 'font-family': '"Iowan Old Style", Georgia, serif', fill: INK }, fixtures).textContent = 'yemeklerim';

  // dashed places for every kind; the ones of something you have none of can be touched
  const outlines = mk('g', {}, world);
  const places = (Object.keys(SPOTS) as Kind[]).flatMap(kind => SPOTS[kind].map((at, i) => {
    const n = mk('path', { d: SHAPE[kind], transform: `translate(${at[0]} ${at[1]})`, fill: 'transparent', stroke: INK, 'stroke-width': 1.3, 'stroke-dasharray': '4 4', 'stroke-linecap': 'round', opacity: .5, 'data-place': kind, 'data-place-i': i }, outlines);
    return { kind, i, at, n };
  }));
  const noteG = mk('g', { opacity: 0, 'pointer-events': 'none' }, world);
  const noteBody = fill(noteG, '', PAPER, 1.1);
  const noteText = mk('text', { 'text-anchor': 'middle', 'font-size': 11, 'font-style': 'italic', 'font-family': '"Iowan Old Style", Georgia, serif', fill: INK }, noteG);
  let noteT = -1, noteAt: Vec = [0, 0];
  function note(at: Vec, text: string) {
    noteText.textContent = text; noteAt = [Math.max(70, Math.min(250, at[0])), at[1] - 22]; noteT = 0;
    const w = text.length * 5.6 + 22;
    noteBody.setAttribute('d', `M${f(-w / 2)} -16 h${f(w)} v20 h${f(-w / 2 + 4)} l-4 6 l-4 -6 h${f(-w / 2 + 4)}Z`);
    noteText.setAttribute('x', '0'); noteText.setAttribute('y', '-2');
  }

  // the things themselves: on the shelves they sit behind the mist and the door; on the tray, or
  // in your hand, they come to the front
  const things = mk('g', {}, world);
  type Thing = { kind: Kind; topping?: Topping; tops?: Topping[]; spot0?: number; g: SVGGElement; pos: Vec; spot: number; tray: number; isNew: boolean; tied: boolean; cutT: number; parts?: { wrapL: SVGPathElement; wrapR: SVGPathElement; fold: SVGPathElement; strings: SVGPathElement[]; bits: SVGPathElement[] }; lift: number };
  let list: Thing[] = [];
  function drawThing(kind: Kind, topping?: Topping, tops?: Topping[]) {
    const g = mk('g', { 'data-thing': kind, ...(topping ? { 'data-topping': topping } : {}) }, things);
    const t: Thing = { kind, topping, tops, g, pos: [0, 0], spot: -1, tray: -1, isNew: false, tied: false, cutT: -1, lift: 0 };
    if (kind === 'somon') {
      fill(g, rect(-27, -11, 27, 13), LOOK.somon.fill, 1.8);
      ink(g, 'M-20 10 L-10 -8 M-8 10 L2 -8 M4 10 L14 -8 M16 10 L22 -2', 2, { stroke: LOOK.somon.line });
      const wrapL = fill(g, 'M-32 -15 L0 -15 L0 15 L-32 15Z', C.paper, 1.8), wrapR = fill(g, 'M0 -15 L32 -15 L32 15 L0 15Z', C.paper, 1.8);
      const fold = ink(g, 'M-32 -15 L-24 -7 M32 -15 L24 -7 M-32 15 L-24 7 M32 15 L24 7', .9, { opacity: .55 });
      const strings = ['M-32 1 L32 1', 'M0 -15 L0 15', 'M0 -15 q-8 -8 -11 -2 q4 4 11 2 q8 -8 11 -2 q-4 4 -11 2'].map(d => ink(g, d, 1.5, { stroke: C.string }));
      const bits = [0, 1].map(() => ink(g, '', 1.5, { stroke: C.string, opacity: 0 }));
      t.parts = { wrapL, wrapR, fold, strings, bits }; t.tied = true;
    } else if (kind === 'yumurta') fill(g, ell(0, 0, 9, 11.5), '#fbf6ea', 1.6);
    else if (kind === 'mandalina') { fill(g, ell(0, 0, 13, 12), C.orange, 1.6); ink(g, 'M-6 -4 q2 -3 5 -3', 1.2, { stroke: '#fbd29a' }); fill(g, 'M0 -12 q4 -7 10 -5 q-3 6 -10 5Z', C.leaf, 1); }
    else if (kind === 'salatalık') { fill(g, SHAPE['salatalık'], '#6f9d45', 1.6); ink(g, 'M-30 -2 l1 0 M-14 2 l1 0 M2 -3 l1 0 M18 1 l1 0 M32 -2 l1 0', 2, { stroke: '#d9e9bf' }); }
    else if (tops) drawBoxFront(g, tops);
    else {
      const look = LOOK[topping ?? 'somon'];
      fill(g, 'M-12 3 Q-13 -5 0 -6 Q13 -5 12 3Z', PAPER, 1.4);
      fill(g, 'M-13 -3 Q-1 -12 13 -5 Q14 -2 11 -1 Q0 -6 -11 0Z', look.fill, 1.3);
      if (look.band) fill(g, 'M-2 -9 L3 -9 L4 3 L-1 3Z', look.band, 1);
      else ink(g, 'M-6 -5 q3 -2 6 -2 M2 -6 q3 -1 6 0', 1.2, { stroke: look.line });
    }
    list.push(t);
    return t;
  }

  /** a lacquer box from the front: lid, band, a paper tag with what is inside */
  function drawBoxFront(g: SVGGElement, tops: Topping[]) {
    fill(g, rect(-40, -6, 40, 16), C.lacquer, 1.8);
    fill(g, rect(-42, -14, 42, -5), '#5e2420', 1.8);
    ink(g, 'M-40 4H40', 1, { stroke: '#d8b05a', opacity: .9 });
    fill(g, rect(-14, -2, 14, 11), PAPER, 1);
    tops.forEach((tp, i) => mk('circle', { cx: f(-10 + (i % 3) * 10), cy: f(i < 3 ? 2 : 7.4), r: 2.4, fill: LOOK[tp].fill, stroke: INK, 'stroke-width': .6 }, g));
    mk('path', { d: 'M-4 -14 q4 -7 8 0', fill: 'none', stroke: '#c8423a', 'stroke-width': 1.6 }, g);
  }

  // ------------------------------------------------------------------ filling a box, seen from above
  // the carried plate's nigiri go into the six compartments of a lacquer box, one by one;
  // then the lid slides on, a red cord is tied, and the box goes onto the dish shelf
  const BOXV = { x: 160, y: 236, w: 216, h: 150 };
  const CELLS: Vec[] = [0, 1, 2, 3, 4, 5].map(i => [BOXV.x - BOXV.w / 3 + (i % 3) * BOXV.w / 3, BOXV.y - BOXV.h / 4 + Math.floor(i / 3) * BOXV.h / 2] as Vec);
  const PLATE_Y = 420;
  const fillG = mk('g', { opacity: 0, 'data-box-fill': '' }, world);
  mk('rect', { x: -400, y: -400, width: 1120, height: 1400, fill: '#f3e6cc', opacity: .96 }, fillG);
  const boxTop = mk('g', {}, fillG);
  fill(boxTop, `M${BOXV.x - BOXV.w / 2 - 10} ${BOXV.y - BOXV.h / 2 - 10}h${BOXV.w + 20}v${BOXV.h + 20}h${-BOXV.w - 20}Z`, C.lacquer, 2.4);
  fill(boxTop, `M${BOXV.x - BOXV.w / 2} ${BOXV.y - BOXV.h / 2}h${BOXV.w}v${BOXV.h}h${-BOXV.w}Z`, '#2b1715', 1.6);
  const cellN = CELLS.map(([x, y], i) => {
    const c = mk('g', { 'data-cell': i }, boxTop);
    fill(c, rect(x - BOXV.w / 6 + 4, y - BOXV.h / 4 + 4, x + BOXV.w / 6 - 4, y + BOXV.h / 4 - 4), '#efe3c8', 1.2);
    // a green baran leaf divider in each compartment
    fill(c, `M${x - 22} ${y + 26} L${x - 14} ${y - 26} L${x - 8} ${y + 4} L${x - 2} ${y - 18} L${x + 2} ${y + 26}Z`, '#7f9f58', .9, { opacity: .55 });
    const ring = mk('path', { d: ell(x, y, 24, 18), fill: 'none', stroke: '#c8423a', 'stroke-width': 1.4, 'stroke-dasharray': '3 4', opacity: 0 }, c);
    return { c, ring };
  });
  const lid = mk('g', { opacity: 0 }, fillG);
  fill(lid, `M${BOXV.x - BOXV.w / 2 - 12} ${BOXV.y - BOXV.h / 2 - 12}h${BOXV.w + 24}v${BOXV.h + 24}h${-BOXV.w - 24}Z`, '#5e2420', 2.4);
  ink(lid, `M${BOXV.x - BOXV.w / 2} ${BOXV.y - BOXV.h / 2 + 6}h${BOXV.w}M${BOXV.x - BOXV.w / 2} ${BOXV.y + BOXV.h / 2 - 6}h${BOXV.w}`, 1.2, { stroke: '#d8b05a' });
  mk('text', { x: BOXV.x, y: BOXV.y + 10, 'text-anchor': 'middle', 'font-size': 34, 'font-family': '"Hiragino Mincho ProN","Yu Mincho",serif', fill: '#d8b05a' }, lid).textContent = '重';
  const cord = mk('g', { opacity: 0 }, fillG);
  ink(cord, `M${BOXV.x} ${BOXV.y - BOXV.h / 2 - 14}V${BOXV.y + BOXV.h / 2 + 14}M${BOXV.x - BOXV.w / 2 - 14} ${BOXV.y}H${BOXV.x + BOXV.w / 2 + 14}`, 3, { stroke: '#c8423a' });
  ink(cord, `M${BOXV.x} ${BOXV.y} q-18 -16 -26 -4 q8 10 26 4 q18 -16 26 -4 q-8 10 -26 4 l-8 22 M${BOXV.x} ${BOXV.y} l8 22`, 3, { stroke: '#c8423a' });
  const geta2 = mk('g', {}, fillG);
  fill(geta2, `M48 ${PLATE_Y - 18}H272L276 ${PLATE_Y + 20}H44Z`, C.woodLight, 2);
  ink(geta2, `M56 ${PLATE_Y - 10}H264`, .8, { opacity: .4 });
  const boxLabel = mk('text', { x: BOXV.x, y: BOXV.y + BOXV.h / 2 + 34, 'text-anchor': 'middle', 'font-size': 12, 'font-style': 'italic', 'font-family': '"Iowan Old Style", Georgia, serif', fill: INK }, fillG);
  type Piece = { top: Topping; g: SVGGElement; pos: Vec; home: Vec; cell: number; lift: number; pop: number };
  let pieces: Piece[] = [], boxT = -1, packed: Topping[] = [], boxSpot = -1, pdrag: { p: Piece; off: Vec } | null = null;
  /** a nigiri from above: a rice oval and its topping */
  function drawPieceTop(parent: Element, top: Topping) {
    const g = mk('g', { 'data-piece': top }, parent);
    mk('ellipse', { cx: 2, cy: 4, rx: 25, ry: 15, fill: INK, opacity: .14 }, g);
    fill(g, ell(0, 0, 25, 15), PAPER, 1.6);
    const L = LOOK[top];
    fill(g, 'M-24 -4 Q-20 -15 0 -14 Q22 -14 26 -3 Q22 10 0 10 Q-22 10 -24 -4Z', L.fill, 1.5);
    if (L.band) fill(g, 'M-4 -15 L5 -15 L5 11 L-4 11Z', L.band, 1);
    else ink(g, 'M-14 -6 q8 -5 16 -4 M2 -8 q8 -2 14 2', 1.6, { stroke: L.line });
    return g;
  }
  function openBox(tops: Topping[]) {
    pieces.forEach(p => p.g.remove());
    const n = tops.length;
    pieces.forEach(p => p.g.remove());
    pieces = tops.map((top, i) => { const home: Vec = [160 + (i - (n - 1) / 2) * 38, PLATE_Y - (i % 2) * 4]; return { top, g: drawPieceTop(fillG, top), pos: [...home] as Vec, home, cell: -1, lift: 0, pop: -1 }; });
    packed = []; boxT = -1; pdrag = null;
    lid.setAttribute('opacity', '0'); cord.setAttribute('opacity', '0');
    [boxTop, lid, cord].forEach(n => n.removeAttribute('transform')); geta2.setAttribute('opacity', '1');
  }
  const freeCell = (p: Vec) => { let best = -1, d = 70; CELLS.forEach((c, i) => { const k = Math.hypot(c[0] - p[0], c[1] - p[1]); if (k < d && !pieces.some(x => x.cell === i)) { d = k; best = i; } }); return best; };

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

  // the bamboo tray below: where things leave from, or arrive to
  const tray = mk('g', { opacity: 0 }, world);
  fill(tray, `M${TRAY[0] - 66} ${TRAY[1] - 8} Q${TRAY[0]} ${TRAY[1] + 16} ${TRAY[0] + 66} ${TRAY[1] - 8} L${TRAY[0] + 60} ${TRAY[1] - 14} Q${TRAY[0]} ${TRAY[1] + 6} ${TRAY[0] - 60} ${TRAY[1] - 14}Z`, C.bamboo, 1.8);
  const weave: string[] = []; for (let x = -52; x <= 52; x += 13) weave.push(`M${TRAY[0] + x} ${TRAY[1] - 10 + Math.abs(x) * .1}l3 ${f(9 - Math.abs(x) * .1)}`);
  ink(tray, weave.join(''), .8, { opacity: .6 });
  const trayRing = mk('path', { d: ell(TRAY[0], TRAY[1] - 6, 54, 10), fill: 'none', stroke: '#c8423a', 'stroke-width': 1.4, 'stroke-dasharray': '4 5', opacity: 0 }, tray);
  const trayLabel = mk('text', { x: TRAY[0], y: TRAY[1] + 20, 'text-anchor': 'middle', 'font-size': 11, 'font-style': 'italic', 'font-family': '"Iowan Old Style", Georgia, serif', fill: INK }, tray);
  const front = mk('g', {}, world);

  // your stroke while cutting
  const slash = ink(world, '', 2.6, { opacity: 0 });

  // a ghost finger that shows the gesture once (and again if you seem stuck)
  const ghostG = mk('g', { opacity: 0, 'pointer-events': 'none' }, svg);
  const ghostTrail = mk('path', { fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-dasharray': '.1 5', opacity: .55 }, ghostG);
  const ghostHand = mk('g', {}, ghostG);
  mk('path', { d: 'M0 0 Q-1.6 -0.4 -1.6 1.6 L-1.4 9 Q-4.6 7 -6 8.6 Q-6.8 10 -4.8 12 L0.4 18 Q2.6 20.6 6.6 20.6 L10 20.6 Q14.6 20.4 15 15.6 L15.4 9.6 Q15.4 7.6 13.4 7.6 Q12.2 7.6 11.8 8.8 Q11.8 6.6 9.8 6.6 Q8.4 6.6 8 8 Q8 6 6 6 Q4.4 6 4 7.4 L1.8 1.6 Q1.6 0 0 0Z', fill: PAPER, stroke: INK, 'stroke-width': .9, 'stroke-linejoin': 'round', transform: 'scale(1.9)' }, ghostHand);
  const ghostRing = mk('circle', { r: 9, fill: 'none', stroke: '#c8423a', 'stroke-width': 1.6, opacity: 0 }, ghostG);

  // ------------------------------------------------------------------ state
  type Phase = 'door' | 'wipe' | 'box' | 'main' | 'done';
  let open = false, op = 0, phase: Phase = 'door', phaseT = 0, idle = 0, mode: 'take' | 'store' = 'take', wipeToday = true;
  let doorOpen = 0, doorTarget = 0, dragging = false, finger: Vec | null = null, lastPt: Vec | null = null;
  let wipePath = '', covered = new Set<number>(), mistOp = 0;
  let slashPts: Vec[] = [], slashOp = 0, drag: { t: Thing; off: Vec; from: { spot: number; tray: number } } | null = null;
  let doneT = -1, closeT = -1, result: IceboxResult | null = null;
  let ghost: { pts: Vec[]; t: number; period: number } | null = null, ghostOp = 0, taught: Partial<Record<Phase, boolean>> = {};
  const noted = new Set<Item>();
  const GRID = { cols: 9, rows: 12 };
  const stepsOf = () => (['door', ...(wipeToday ? ['wipe'] : []), boxing ? 'box' : 'main'] as Phase[]);
  let boxing = false;

  const onTray = () => list.filter(t => t.tray >= 0).sort((a, b) => a.tray - b.tray);
  const spotFree = (kind: Kind, i: number) => !list.some(t => t.kind === kind && t.spot === i && t !== drag?.t);
  const target = (t: Thing): Vec => t.tray >= 0 ? trayPos(t.tray, onTray().length) : t.spot >= 0 ? SPOTS[t.kind][t.spot] : t.pos;
  function trayPos(i: number, n: number): Vec { const gap = n > 3 ? 30 : 36; return [TRAY[0] + (i - (n - 1) / 2) * gap, TRAY[1] - 12]; }
  function relayTray() { onTray().forEach((t, i) => (t.tray = i)); }
  const tied = () => list.find(t => t.tied && t.spot >= 0);

  const TITLES = (p: Phase) => p === 'door' ? 'Kapağı aç' : p === 'wipe' ? 'Buğuyu sil' : p === 'box' ? 'Kutuyu doldur' : mode === 'store' ? 'Dolaba diz' : 'Tepsiye indir';
  function tipFor(p: Phase) {
    if (p === 'door') return 'Pirinç kolu tut, kapağı sola doğru çek.';
    if (p === 'wipe') return 'İçerisi buğulanmış. Parmağınla sil.';
    if (p === 'box') return 'Nigirileri kutunun gözlerine tek tek yerleştir.';
    if (mode === 'store') return 'Tepsidekileri raftaki kesik çizgili yerlerine sürükle.';
    const salmon = tied();
    return salmon ? 'Pişireceğini ya da hazır bir yemeği tepsiye indir. Somonun ipini önce tek çizgiyle kes.' : 'Pişireceğini ya da hazır bir yemeği tepsiye indir.';
  }
  function setPhase(p: Phase) {
    phase = p; phaseT = 0; idle = 0; ghost = null;
    // a finger still down from the last step starts nothing in this one; lift and touch again
    dragging = false; lastPt = null; drag = null; slashPts = [];
    const steps = stepsOf(), n = steps.indexOf(p);
    title.innerHTML = n >= 0 ? `<span>${n + 1} / ${steps.length}</span> ${TITLES(p)}` : '';
    title.classList.remove('show'); void title.offsetWidth; if (n >= 0) title.classList.add('show');
    tip.classList.remove('show');
  }
  function teach() {
    if (phase === 'door') ghost = { pts: [[HANDLE[0], HANDLE[1]], [HANDLE[0] - 70, HANDLE[1] + 6], [HANDLE[0] - 150, HANDLE[1] + 4]], t: 0, period: 2.4 };
    if (phase === 'wipe') ghost = { pts: Array.from({ length: 9 }, (_, i) => [90 + (i % 2) * 140, 200 + i * 30] as Vec), t: 0, period: 3 };
    if (phase === 'box') { const pc = pieces.find(x => x.cell < 0), c = CELLS.findIndex((_, i) => !pieces.some(x => x.cell === i)); if (pc && c >= 0) ghost = { pts: [[...pc.pos], [...CELLS[c]]], t: 0, period: 2.2 }; return; }
    if (phase !== 'main') return;
    if (mode === 'store') {
      const t = onTray()[0]; if (!t) return;
      const i = SPOTS[t.kind].findIndex((_, k) => spotFree(t.kind, k)); if (i < 0) return;
      ghost = { pts: [[...t.pos], [...SPOTS[t.kind][i]]], t: 0, period: 2.4 };
    } else {
      const salmon = tied();
      const first = list.find(t => t.spot >= 0 && !t.tied && (t.kind === 'dish' || recipeFor(t.kind as Item)));
      if (salmon && (!first || first.kind !== 'yumurta')) ghost = { pts: [[salmon.pos[0] - 26, salmon.pos[1] - 36], [salmon.pos[0] + 28, salmon.pos[1] + 34]], t: 0, period: 1.9 };
      else if (first) ghost = { pts: [[...first.pos], [TRAY[0], TRAY[1] - 12]], t: 0, period: 2.4 };
    }
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
  const hitThing = (p: Vec) => [...list].reverse().find(t => {
    const s = t.kind === 'somon' ? [34, 18] : t.kind === 'salatalık' ? [46, 10] : t.kind === 'dish' ? [44, 18] : [16, 15];
    return Math.abs(p[0] - t.pos[0]) < s[0] && Math.abs(p[1] - t.pos[1]) < s[1];
  });
  const canMove = (t: Thing) => mode === 'store' ? t.isNew : !t.isNew;

  // what the tray holds, and whether it is a whole recipe (or a plate of dishes)
  function trayState() {
    const items = onTray();
    if (!items.length) return { group: '' as '' | 'dish' | Topping, done: false, label: '' };
    if (items[0].kind === 'dish') return { group: 'dish' as const, done: true, label: `${items[0].tops?.length ?? 0} parça` };
    const r = recipeFor(items[0].kind as Item)!;
    const [[need, n]] = Object.entries(r.needs) as [Item, number][];
    return { group: r.id, done: items.length >= n, label: `${r.name} · ${items.length}/${n} ${ITEMS[need].name.toLowerCase()}` };
  }
  function accepts(t: Thing) {
    const s = trayState();
    if (t.kind === 'dish') return !s.group ? true : 'Tepside başka bir şey var.';
    const r = recipeFor(t.kind as Item);
    if (!r) return `${ITEMS[t.kind as Item].name} tatlılık; yemeğe gerekmez.`;
    if (!s.group) return true;
    if (s.group !== r.id) return 'Tepside başka bir şey var.';
    return !s.done || 'Bu kadarı yeter.';
  }

  svg.addEventListener('pointerdown', (e) => {
    if (!open || phase === 'done' || dragging) return;
    e.preventDefault(); svg.setPointerCapture(e.pointerId);
    const p = local(e); finger = p; lastPt = null; dragging = true; idle = 0; ghost = null;
    if (phase === 'wipe') { wipeAt(p); lastPt = p; return; }
    if (phase === 'box') {
      const pc = [...pieces].reverse().find(x => x.cell < 0 && Math.hypot(p[0] - x.pos[0], p[1] - x.pos[1]) < 30);
      if (pc && boxT < 0) { pdrag = { p: pc, off: [pc.pos[0] - p[0], pc.pos[1] - p[1]] }; fillG.appendChild(pc.g); sfx.tap(); haptic(6); } else dragging = false;
      return;
    }
    if (phase === 'door') { if (Math.hypot(p[0] - HANDLE[0], p[1] - HANDLE[1]) > 60 && !(p[0] > 120 && p[1] > 160 && p[1] < 474)) dragging = false; return; }
    // an empty place of something you have none of: a note for the market
    const place = (e.target as Element).closest?.('[data-place]');
    const t = hitThing(p);
    if (!t && place) {
      const kind = place.getAttribute('data-place') as Kind, i = +place.getAttribute('data-place-i')!;
      if (kind !== 'dish' && !list.some(x => x.kind === kind)) { noted.add(kind); note(SPOTS[kind][i], `${ITEMS[kind].name} bitmiş`); sfx.paper(); haptic(5); }
      else if (kind === 'dish') note(SPOTS.dish[i], 'Bir kutu yemek buraya sığar');
      dragging = false; return;
    }
    if (t && !t.tied && canMove(t)) { drag = { t, off: [t.pos[0] - p[0], t.pos[1] - p[1]], from: { spot: t.spot, tray: t.tray } }; t.spot = -1; t.tray = -1; relayTray(); sfx.tap(); haptic(6); return; }
    if (t && !canMove(t) && mode === 'store') { note(t.pos, 'Önce tepsidekileri yerleştir'); dragging = false; return; }
    // anything else starts a stroke: across a tied parcel, it cuts the string
    slashPts = [p]; slashOp = 1;
  });
  svg.addEventListener('pointermove', (e) => {
    if (!dragging || !open) return;
    const p = local(e);
    if (phase === 'door') doorOpen = doorTarget = clamp01((HANDLE[0] - p[0]) / 190);
    if (phase === 'wipe') { wipeAt(p); lastPt = p; if (Math.random() < .25) sfx.stir(2); }
    if (phase === 'box' && pdrag) pdrag.p.pos = [p[0] + pdrag.off[0], p[1] + pdrag.off[1]];
    if (phase === 'main') {
      if (drag) drag.t.pos = [p[0] + drag.off[0], p[1] + drag.off[1]];
      else if (slashPts.length) {
        const a = slashPts[slashPts.length - 1] ?? p; slashPts.push(p);
        for (const t of list) if (t.tied && t.spot >= 0 && t.cutT < 0) {
          const o = (q: Vec): Vec => [t.pos[0] + q[0], t.pos[1] + q[1]];
          if (crosses(a, p, o([-32, 1]), o([32, 1])) || crosses(a, p, o([0, -15]), o([0, 15]))) { t.cutT = 0; t.tied = false; sfx.slice(); haptic(14); }
        }
      }
    }
    finger = p;
  });
  const up = () => {
    if (!dragging) return;
    dragging = false; lastPt = null; slashPts = [];
    if (phase === 'box' && pdrag) {
      const pc = pdrag.p; pdrag = null;
      const c = freeCell(pc.pos);
      if (c >= 0) { pc.cell = c; pc.pop = 0; packed[c] = pc.top; sfx.stone(Math.min(4, pieces.filter(x => x.cell >= 0).length - 1), .7); haptic(10); }
      else sfx.nope();
      if (pieces.every(x => x.cell >= 0)) { boxT = 0; sfx.success(); }
    }
    if (phase === 'door') { if (doorOpen > .38) { doorTarget = 1; sfx.paper(); haptic(10); } else doorTarget = 0; }
    if (phase === 'main' && drag) {
      const { t, from } = drag; drag = null;
      const nearTray = Math.hypot(t.pos[0] - TRAY[0], t.pos[1] - (TRAY[1] - 10)) < 70;
      let spot = -1, best = 36;
      SPOTS[t.kind].forEach((at, i) => { const d = Math.hypot(at[0] - t.pos[0], at[1] - t.pos[1]); if (d < best && spotFree(t.kind, i)) { best = d; spot = i; } });
      // a free place of its own kind wins (the dish shelf sits just above the tray)
      if (spot >= 0) { t.spot = spot; sfx.press(); haptic(8); }
      else if (nearTray && mode === 'take') {
        const ok = accepts(t);
        if (ok === true) { t.tray = onTray().length; sfx.press(); haptic(9); }
        else { note(t.pos, ok); sfx.nope(); t.spot = from.spot; t.tray = from.tray; }
      } else if (nearTray && mode === 'store') { t.tray = onTray().length; }
      else { if (mode === 'store' && from.spot < 0 && t.tray < 0) t.tray = onTray().length; else { t.spot = from.spot; t.tray = from.tray; } sfx.nope(); }
      relayTray();
      checkDone();
    }
  };
  function checkDone() {
    if (doneT >= 0) return;
    if (mode === 'store' && !onTray().length) { result = { mode: 'store' }; doneT = 0; sfx.success(); haptic(14); }
    if (mode === 'take') {
      const s = trayState();
      if (!s.done) return;
      const items = onTray();
      result = s.group === 'dish' ? { mode: 'take', serve: [...(items[0].tops ?? [])], box: items[0].spot0 ?? 0 } : { mode: 'take', cook: s.group as Topping, used: items.map(t => t.kind as Item) };
      doneT = 0; sfx.success(); haptic(14);
    }
  }
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  back.addEventListener('click', () => { if (open) api.close(); });

  const api = {
    get isOpen() { return open; },
    get phase() { return phase; },
    get mode() { return mode; },
    get noted() { return [...noted]; },
    /** for headless checks: a sheet point in client pixels */
    _client(p: Vec): Vec { const m = svg.getScreenCTM()!; const q = svg.createSVGPoint(); q.x = p[0]; q.y = p[1]; const r = q.matrixTransform(m); return [r.x, r.y]; },
    _pts: { HANDLE, TRAY, IN, SPOTS, CELLS },
    get _pieces() { return pieces.map(p => ({ top: p.top, pos: p.pos, cell: p.cell })); },
    /** where each thing is (headless checks drag them) */
    get _things() { return list.map(t => ({ kind: t.kind, topping: t.topping, pos: t.pos, spot: t.spot, tray: t.tray, tied: t.tied, isNew: t.isNew })); },
    open(o: IceboxOpen) {
      open = true; op = 0; mode = o.mode; wipeToday = o.wipe;
      doorOpen = doorTarget = 0; dragging = false; drag = null; wipePath = ''; wipes.setAttribute('d', ''); covered = new Set(); mistOp = 0;
      slashOp = 0; doneT = closeT = -1; result = null; taught = {}; noteT = -1;
      list.forEach(t => t.g.remove()); list = [];
      // what is already inside, in its places
      for (const id of ITEM_IDS) for (let i = 0; i < o.pantry[id]; i++) { const t = drawThing(id); t.spot = i; t.pos = [...SPOTS[id][i]]; }
      o.dishes.forEach((tops, i) => { const t = drawThing('dish', undefined, tops); t.spot = t.spot0 = i; t.pos = [...SPOTS.dish[i]]; });
      // a plate you carry is packed into a box first, seen from above
      boxing = !!o.carrying?.pieces?.length; boxSpot = o.dishes.length; boxT = -1; pdrag = null;
      fillG.setAttribute('opacity', '0');
      if (boxing) { openBox(o.carrying!.pieces!.slice(0, PIECES)); svg.appendChild(fillG); svg.appendChild(ghostG); }
      // what you brought, laid out on the tray
      const carry: Thing[] = [];
      (o.carrying?.items ?? []).forEach(id => carry.push(drawThing(id)));
      carry.forEach((t, i) => { t.isNew = true; t.tray = i; t.pos = trayPos(i, carry.length); if (t.kind === 'somon') t.tied = true; });
      // a dish shelf holds two plates' worth; never more than there is room for
      svg.style.display = 'block'; svg.classList.add('show');
      [back, title, tip].forEach(n => (n.style.display = 'block')); back.classList.add('show');
      setPhase('door');
    },
    close(done = false) {
      open = false; dragging = false; svg.classList.remove('show'); svg.style.display = 'none'; svg.style.opacity = '0';
      [back, title, tip].forEach(n => { n.classList.remove('show'); n.style.display = 'none'; });
      if (noted.size) { onNote([...noted]); noted.clear(); }
      if (done && result) onDone(result); else onExit();
    },
    draw(t: number, dt: number) {
      if (!open) return;
      op = approach(op, closeT >= 0 ? 0 : 1, 7, dt);
      svg.style.opacity = f(easeOut(op));
      phaseT += dt; idle += dt;
      if (!taught[phase] && phaseT > .7 && phase !== 'done') { taught[phase] = true; teach(); tip.textContent = tipFor(phase); tip.classList.add('show'); }
      if (taught[phase] && !ghost && !dragging && idle > 6 && phase !== 'done') { teach(); idle = 0; }

      // the ice sweats: a drip now and then
      drips.forEach((d, i) => { const u = (t * .35 + i * .33) % 1, x = 92 + i * 64; d.setAttribute('cx', f(x)); d.setAttribute('cy', f(148 + u * 14)); d.setAttribute('opacity', f(u < .85 ? .8 : 0)); });

      // the door swings on its hinge (past flat, showing its edge)
      if (!dragging || phase !== 'door') doorOpen = approach(doorOpen, doorTarget, doorTarget > doorOpen ? 6 : 9, dt);
      const s = 1 - easeInOut(doorOpen) * 1.16;
      door.setAttribute('transform', `translate(${HINGE} 0) scale(${f(s)} 1) translate(${-HINGE} 0)`);
      doorFace.setAttribute('fill', s < 0 ? C.woodDark : C.woodLight);
      doorPanel.setAttribute('opacity', s < 0 ? '0' : '.6');
      if (phase === 'door' && doorOpen > .97 && doorTarget === 1) { if (wipeToday) { mistOp = 1; setPhase('wipe'); } else setPhase(boxing ? 'box' : 'main'); }
      puffs.forEach((p, i) => {
        const age = phase === 'door' ? 0 : clamp01((phaseT - i * .15) / 1.6);
        const x = 90 + i * 46, y = 240 - age * 90;
        p.setAttribute('d', `M${f(x)} ${f(y)} q10 -10 0 -20 q-8 -8 2 -18`);
        p.setAttribute('opacity', f(phase !== 'door' && phase !== 'done' && age < 1 && phaseT < 2 ? (1 - age) * .55 : 0));
      });

      // filling the box: the view tilts to look down into it
      const showBox = phase === 'box' || (boxT >= 0 && boxT < 2.6);
      fillG.setAttribute('opacity', f(approach(+(fillG.getAttribute('opacity') ?? 0), showBox ? 1 : 0, 6, dt)));
      fillG.style.display = +(fillG.getAttribute('opacity') ?? 0) > .01 ? '' : 'none';
      if (phase === 'box' || boxT >= 0) {
        const placed = pieces.filter(x => x.cell >= 0).length;
        boxLabel.textContent = boxT < 0 ? `${placed} / ${pieces.length}` : 'Afiyetle saklanır.';
        cellN.forEach((c, i) => c.ring.setAttribute('opacity', f(pdrag && !pieces.some(x => x.cell === i) ? .6 + Math.sin(t * 6) * .25 : !pieces.some(x => x.cell === i) && i < pieces.length ? .25 : 0)));
        for (const pc of pieces) {
          if (pc !== pdrag?.p) { const g = pc.cell >= 0 ? CELLS[pc.cell] : pc.home; pc.pos = [approach(pc.pos[0], g[0], 14, dt), approach(pc.pos[1], g[1], 14, dt)]; }
          pc.lift = approach(pc.lift, pc === pdrag?.p ? 1 : 0, 12, dt);
          if (pc.pop >= 0) pc.pop += dt;
          const squash = pc.pop >= 0 && pc.pop < .35 ? Math.sin(pc.pop / .35 * Math.PI) * .12 : 0;
          pc.g.setAttribute('transform', `translate(${f(pc.pos[0])} ${f(pc.pos[1] - pc.lift * 8)}) scale(${f(1 + pc.lift * .1 + squash)} ${f(1 + pc.lift * .1 - squash)})`);
        }
        if (boxT >= 0) {
          boxT += dt;
          // the lid slides on from the top, the cord is tied, then it all shrinks onto the shelf
          const u = easeInOut(clamp01((boxT - .2) / .6));
          lid.setAttribute('opacity', f(u > 0 ? 1 : 0)); lid.setAttribute('transform', `translate(0 ${f((1 - u) * -300)})`);
          if (boxT > .8 && boxT - dt <= .8) { sfx.knock(); haptic(12); }
          const k = clamp01((boxT - 1.0) / .4); cord.setAttribute('opacity', f(k)); cord.setAttribute('transform', `translate(${BOXV.x} ${BOXV.y}) scale(${f(backOut(k))}) translate(${-BOXV.x} ${-BOXV.y})`);
          if (boxT > 1.1 && boxT - dt <= 1.1) sfx.paper();
          const fly = easeInOut(clamp01((boxT - 1.6) / .9));
          const to = SPOTS.dish[Math.min(SPOTS.dish.length - 1, boxSpot)];
          const sc = lerp(1, 84 / (BOXV.w + 24), fly);
          pieces.forEach(x => x.g.setAttribute('opacity', boxT > .85 ? '0' : '1'));
          [boxTop, lid, cord].forEach(n => n.setAttribute('transform', `translate(${f(lerp(0, to[0] - BOXV.x, fly))} ${f(lerp(0, to[1] - BOXV.y, fly))}) translate(${BOXV.x} ${BOXV.y}) scale(${f(sc)}) translate(${-BOXV.x} ${-BOXV.y})` + (n === lid ? ` translate(0 ${f((1 - u) * -300)})` : '')));
          geta2.setAttribute('opacity', f(1 - fly));
          if (boxT > 2.5 && doneT < 0) {
            const th = drawThing('dish', undefined, packed.filter(Boolean)); th.spot = th.spot0 = Math.min(SPOTS.dish.length - 1, boxSpot); th.pos = [...SPOTS.dish[th.spot]];
            result = { mode: 'store' }; doneT = 0; setPhase('done'); haptic(14);
          }
        }
      }

      // mist, wiped away
      mist.setAttribute('opacity', f(mistOp));
      if (phase === 'wipe' && covered.size > GRID.cols * GRID.rows * .5) { sfx.chime(); haptic(10); setPhase(boxing ? 'box' : 'main'); }
      if (phase !== 'wipe' && phase !== 'door') mistOp = approach(mistOp, 0, 3, dt);

      // outlines: an empty place breathes a little; a filled one hides under its thing
      places.forEach(pl => {
        const filled = list.some(x => x.kind === pl.kind && x.spot === pl.i && x !== drag?.t);
        const wanted = drag && drag.t.kind === pl.kind;
        pl.n.setAttribute('opacity', f(filled ? 0 : wanted ? .75 + Math.sin(t * 5) * .2 : .42 + Math.sin(t * 2 + pl.i) * .08));
        pl.n.setAttribute('stroke', wanted ? '#c8423a' : INK);
      });
      if (noteT >= 0) { noteT += dt; if (noteT > 2.4) noteT = -1; }
      noteG.setAttribute('opacity', f(noteT >= 0 ? Math.min(1, noteT * 5) * (1 - clamp01((noteT - 2) / .4)) : 0));
      noteG.setAttribute('transform', `translate(${f(noteAt[0])} ${f(noteAt[1] + (noteT >= 0 ? (1 - backOut(clamp01(noteT / .35))) * 6 : 0))})`);

      // your stroke
      slashOp = approach(slashOp, dragging && !drag && phase === 'main' ? 1 : 0, 4, dt);
      slash.setAttribute('d', slashPts.length > 1 ? 'M' + slashPts.map(pt).join('L') : slash.getAttribute('d') ?? '');
      slash.setAttribute('opacity', f(slashOp * .85));

      // things settle where they belong; a parcel whose string was cut falls open
      for (const th of list) {
        if (th !== drag?.t) { const g = target(th); th.pos = [approach(th.pos[0], g[0], 12, dt), approach(th.pos[1], g[1], 12, dt)]; }
        th.lift = approach(th.lift, th === drag?.t ? 1 : 0, 12, dt);
        th.g.setAttribute('transform', `translate(${f(th.pos[0])} ${f(th.pos[1] - th.lift * 6)}) rotate(${f(th.lift * -3)}) scale(${f(1 + th.lift * .07)})`);
        if (th.parts && th.cutT >= 0) {
          th.cutT += dt;
          const u = easeOut(clamp01(th.cutT / .5)), w = easeInOut(clamp01((th.cutT - .25) / .6));
          th.parts.strings.forEach(n => n.setAttribute('opacity', f(1 - u)));
          th.parts.bits.forEach((b, i) => { const fall = th.cutT * th.cutT * 160; b.setAttribute('d', `M${i ? 12 : -16} ${f(fall)} q${i ? 8 : -8} 4 ${i ? 4 : -4} 12`); b.setAttribute('opacity', f(th.cutT < .9 ? 1 - th.cutT / .9 : 0)); });
          th.parts.wrapL.setAttribute('transform', `translate(${f(-w * 12)} ${f(w * 2)}) rotate(${f(-w * 12)} -32 15) scale(${f(1 - w * .6)} 1)`);
          th.parts.wrapR.setAttribute('transform', `translate(${f(w * 12)} ${f(w * 2)}) rotate(${f(w * 12)} 32 15) scale(${f(1 - w * .6)} 1)`);
          th.parts.fold.setAttribute('opacity', f(.55 * (1 - w)));
        } else if (th.parts) {
          th.parts.strings.forEach(n => n.setAttribute('opacity', th.tied ? '1' : '0'));
          [th.parts.wrapL, th.parts.wrapR].forEach(n => n.setAttribute('transform', ''));
          th.parts.fold.setAttribute('opacity', '.55'); th.parts.bits.forEach(b => b.setAttribute('opacity', '0'));
        }
      }
      for (const th of list) { const want = th === drag?.t || th.tray >= 0 || (th.isNew && th.spot < 0) ? front : things; if (th.g.parentNode !== want) want.appendChild(th.g); }
      // the one you hold is drawn on top
      if (drag && front.lastChild !== drag.t.g) front.appendChild(drag.t.g);

      // the tray
      const ts = trayState();
      tray.setAttribute('opacity', f(phase === 'main' || phase === 'done' ? Math.min(1, phaseT * 3 + (doneT >= 0 ? 1 : 0)) : mode === 'store' ? .9 : 0));
      trayRing.setAttribute('opacity', f(phase === 'main' && mode === 'take' && !ts.done ? .45 + Math.sin(t * 3) * .2 : 0));
      trayLabel.textContent = mode === 'take' && phase === 'main' ? ts.label : '';
      // done: the door swings shut, the view fades back to the kitchen
      if (doneT >= 0) {
        doneT += dt;
        if (phase !== 'done') setPhase('done');
        if (doneT > .5) doorTarget = 0;
        if (doneT > 1.2 && closeT < 0) closeT = 0;
      }
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
