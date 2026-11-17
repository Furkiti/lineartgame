// Five connected, unhurried days in the ink street. Some things you must do because they are the fun
// part (draw Kenta's kite, cook dinner); others are yours to choose (decorate the lantern
// at your door, draw the cat a toy and take it home, wait for the fox). A few questions
// have two answers, and the evening goes the way you answered.
//   morning  — the paper crane introduces itself; Kenta's kite is stuck in the cherry tree
//   day      — your home (the nameplate says so), the blank lantern, the cat on the bench
//   evening  — hang up your bundle, fish from the icebox, sushi up close, dinner (with Kenta?)
//   later    — a tea sign, a rain shelter, a wind chime, a shared gathering; a fox is optional
// Whatever you draw stays exactly as you drew it: the kite's sail is your line, the lantern
// carries your strokes, the cat plays with your shape, and the notebook keeps all of them.
import { el, f, pt, PAPER, type Vec } from '../lib/ink.ts';
import { IX } from '../village/home.ts';
import { rgb, hex, mix, smooth } from '../village/kit.ts';
import { type UI } from './ui.ts';
import { createKenta, createStuckKite, createKite, createStroke, recognise, type Kenta } from './kenta.ts';
import { createFox } from './fox.ts';
import { createCloseup } from './closeup.ts';
import { createShodo, CHA, brush, compare } from './shodo.ts';
import { createIcebox, type IceboxResult } from './icebox.ts';
import { createGrocer } from './greengrocer.ts';
import { START, ITEMS, DISH_BOXES, PIECES, type Box, normalize, normalizeDishes, normalizeBasket, use, store as storeItems, makeable, canFeed, morningGift, type Item, type Topping } from './pantry.ts';
import { createNotebook, SKETCH, type Entry } from './notebook.ts';
import { createPaper, fitLine, fitDrawing, linePath } from './paper.ts';
import { MOTIFS } from './motifs.ts';
import { createAlley, normalizeStones, STONES, STAND, BEAT, type Stone } from './alley.ts';
import { nextVisit, timeRate, type Visit } from './schedule.ts';
import { type SavedGame } from './save.ts';
import { createResident } from './resident.ts';
import { createHandwork } from './handwork.ts';
import { SEATS } from './dining.ts';
import { DAYS, nextChapter, dayComplete, eveningTarget } from './journey.ts';
import { sfx, haptic, wakeAudio, inkRing, approach, clamp01, easeOut, easeIn, backOut, lerp } from './fx.ts';

type Home = {
  root: SVGGElement; surfaces: SVGGElement; beginSleep(): void; guestSeat: number; diningGuest: { x: number; y: number; hand: Vec; head: Vec } | null; guestReach: Vec | null; offeredLast: boolean; newDay(): void; canEat: boolean; canCook: boolean; busy: boolean; made: number; setPlateDesign(pattern: 'row' | 'triangle', garnish?: boolean): void; takePlate(): void; fromIcebox(t?: Topping): void; storeDish(): Topping[]; takeDish(t: Topping[]): void; readonly plate: Topping[]; readonly topping: Topping; iceboxPrompt: string | null; windowOpen: boolean; decorateTable(paths: string[]): void;
  actors: SVGGElement; step: number; eaten: number; canSleep: boolean; prep: number; bagHung: boolean; catHome: boolean;
  setStep(n: number): void; prompt(pl: unknown): string | null;
};
type Player = { x: number; y: number; heading: number; moving: number; faceTo: number | null; carryBundle: boolean; identity: { head: string; mark: string; body: string }; setHeading(h: number): void; g: SVGGElement };
type Cat = { g: SVGGElement; poke(): void };
type Ctx = {
  t: number; dt: number; P: { inkT: number; night: number; lamp: number; paper: number[] }; wind: number; tau: number; inside: boolean; fair: boolean;
  base: { w: number; h: number }; stickActive: boolean; stickTouched: boolean;
};
type Cam = { cx: number; cy: number; z: number } | null;
type Wait = number | (() => boolean);
type Scene = Generator<Wait, void, unknown>;

const KENTA_HOME: Vec = [285, 357];
/** where you stop, at Kenta's left, the first time you meet */
const MEET_GAP = 30;
const STUCK: Vec = [316, 196];
// home is down the alley in the middle of the street: the little gate at its end
const DOOR_X = 457;
const PLATE: Vec = [441, 302];           // the nameplate on the alley wall
const LANTERN = { x: 475, top: 272, cy: 287, r: 8.2, h: 22 };
const BATH_X = 826;                      // the big building at the east end is the neighbourhood bath
const CAT: Vec = [700, 330];
const HANA: Vec = [622, 358];
const CORNER: Vec = [730, 354];
const BENCH = { x0: 670, x1: 744, y: 330 };
const WARM = hex('#ffcf7e');

/** a stroke's centre line, fitted into the notebook's 60×60 box */
function sketchOf(lines: Vec[][], extra = ''): string {
  const all = lines.flat();
  if (!all.length) return extra;
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = 42 / Math.max(8, x1 - x0, y1 - y0), ox = 30 - ((x0 + x1) / 2) * s, oy = 30 - ((y0 + y1) / 2) * s;
  return lines.filter((l) => l.length > 1).map((l) => 'M' + l.map((p) => pt([p[0] * s + ox, p[1] * s + oy])).join('L')).join(' ') + (extra ? ' ' + extra : '');
}

export function createStory(o: {
  svg: SVGSVGElement; card: HTMLElement; ui: UI; home: Home; player: Player; cat: Cat; saved?: SavedGame | null;
  layers: { front: Element; walkers: Element; glow: Element; stroke: Element };
  env: { localModal?():boolean; localGuide?():boolean; extraEntries?():Entry[]; setTau(v: number): void; fade(v: number): void; isFaded(): boolean; isOpened(): boolean; tip(text: string | null, sticky?: boolean): void; banner(a: string, b: string): void };
}) {
  const { svg, card, ui, home, player, cat, layers, env } = o;
  const paper = createPaper(card, () => { mode = 'walk'; cam = null; focusOn = null; script = null; card.classList.remove('brush-focus'); });
  const art = { portrait: [] as Vec[][], seal: [] as Vec[][], head: [] as Vec[], body: [] as Vec[], sign: [] as string[], project: [] as Vec[][], table: [] as Vec[][], chime: [] as Vec[][], toyDrawing: [] as Vec[][], invitation: [] as Vec[][], ...(o.saved?.art ?? {}) };
  const drawOnPaper = (options: Parameters<typeof paper.open>[0]) => { paper.open({ ...options, then: lines => { options.then(lines); } }); };
  function applyIdentity() { player.identity = { head: linePath(fitLine(art.head, 0, 0, 8), true), body: linePath(fitLine(art.body, 0, 0, 12)), mark: art.seal.map(l => linePath(fitLine(l, 0, 0, 5))).join(' ') }; }
  applyIdentity();

  // ------------------------------------------------------------------ cast & props
  const kenta = createKenta(layers.walkers, KENTA_HOME[0], KENTA_HOME[1]);
  kenta.want.sad = 1;
  const hana = createResident(layers.walkers, 'Hana', HANA[0], HANA[1]);
  hana.visible = false;
  const catBench = el('g', { 'data-cat-bench': '' }, layers.front);
  catBench.innerHTML = '<path d="M670 330H744V335H670ZM677 335V343M737 335V343" fill="#b89770" stroke="currentColor" stroke-width=".8"/><path d="M674 333H740" stroke="currentColor" stroke-width=".45"/>';
  const stuck = createStuckKite(layers.front, STUCK);
  const kite = createKite(layers.front);
  const stroke = createStroke(layers.stroke);
  const focus = el('g', { display: 'none', 'pointer-events': 'none', 'data-drawing-focus': 'kite' }, layers.stroke);
  layers.stroke.insertBefore(focus, layers.stroke.firstChild);
  el('rect', { x: -2000, y: -2000, width: 6000, height: 6000, fill: PAPER, opacity: .38 }, focus);
  const halo = el('radialGradient', { id: 'drawing-halo' }, el('defs', {}, svg));
  el('stop', { offset: '0%', 'stop-color': PAPER, 'stop-opacity': .98 }, halo);
  el('stop', { offset: '65%', 'stop-color': PAPER, 'stop-opacity': .9 }, halo);
  el('stop', { offset: '100%', 'stop-color': PAPER, 'stop-opacity': .12 }, halo);
  const focusPatch = el('ellipse', { rx: 53, ry: 62, fill: 'url(#drawing-halo)', stroke: '#b65042', 'stroke-opacity': .32, 'stroke-width': .65, 'stroke-dasharray': '2 3' }, focus);
  const focusOutline = el('path', { fill: 'none', stroke: '#b65042', 'stroke-width': .65, 'stroke-dasharray': '2 2', opacity: .45, 'data-drawing-template': '' }, focus);
  const drawingAt = (): Vec => [kenta.x + 32, 268];
  let brushIdle = 0;

  const fox = createFox(layers.walkers, layers.glow);
  let guest: Kenta | null = null, guestAte = 0;

  // your home, from outside: a wooden nameplate, a mailbox, and a blank paper lantern
  const homeFront = el('g', {}, layers.front);
  // where home is, said the way this street says things: a red seal stamped over your gate (家, home),
  // and on the pavement, the spot to stop at — an ink ring with two geta prints in it
  const homeBeacon = el('g', { opacity: 0, 'pointer-events': 'none', 'data-home-beacon': '' }, layers.front);
  const sealG = el('g', {}, homeBeacon);
  el('rect', { x: -4.6, y: -4.6, width: 9.2, height: 9.2, rx: 1.3, fill: '#b94c3e', stroke: '#8e3328', 'stroke-width': .35 }, sealG);
  el('rect', { x: -3.7, y: -3.7, width: 7.4, height: 7.4, rx: .8, fill: 'none', stroke: '#fbf3e6', 'stroke-width': .35 }, sealG);
  const sealT = el('text', { x: 0, y: .3, 'font-size': 6, 'font-weight': 700, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fbf3e6', 'font-family': '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif' }, sealG); sealT.textContent = '家';
  const sealCap = el('text', { x: 6.4, y: 1.4, 'font-size': 3.6, 'font-style': 'italic', fill: '#8e3328', 'font-family': 'Georgia,serif', stroke: PAPER, 'stroke-width': .9, 'paint-order': 'stroke' }, sealG); sealCap.textContent = 'evim';
  const sealSplash = el('ellipse', { cx: 0, cy: 0, rx: 5, ry: 5, fill: 'none', stroke: '#b94c3e', 'stroke-width': .6, opacity: 0 }, homeBeacon);
  let sealAt = -1; // -1 not stamped yet · ≥0 seconds since it was stamped
  const standMark = el('g', { opacity: 0, 'pointer-events': 'none', 'data-stand-mark': '' }, layers.front);
  const markPulse = el('ellipse', { cx: STAND[0], cy: STAND[1] + 1, rx: 9, ry: 2.8, fill: 'none', stroke: '#b94c3e', 'stroke-width': .5 }, standMark);
  el('ellipse', { cx: STAND[0], cy: STAND[1] + 1, rx: 8, ry: 2.5, fill: '#f5d48c', 'fill-opacity': .35, stroke: '#b94c3e', 'stroke-width': .75, 'stroke-dasharray': '7 1.4 3 1.2' }, standMark);
  el('path', { d: `M${STAND[0] - 2.6} ${STAND[1] + .2}l1.6 0l.3 1.9l-2.1 0Z M${STAND[0] + 1} ${STAND[1] - .6}l1.6 0l.3 1.9l-2.1 0Z`, fill: '#b94c3e', opacity: .7 }, standMark);
  // a little ink drop bobbing over it, until you are close
  const markDrop = el('path', { d: `M${STAND[0]} ${STAND[1] - 4}c-1.6 -2.2 -2.4 -3.6 -2.4 -4.8a2.4 2.4 0 0 1 4.8 0c0 1.2 -.8 2.6 -2.4 4.8Z`, fill: '#b94c3e', stroke: PAPER, 'stroke-width': .5 }, standMark);
  el('path', { d: `M${PLATE[0] - 4.6} ${PLATE[1] - 11} L${PLATE[0] + 4.6} ${PLATE[1] - 11} L${PLATE[0] + 4.6} ${PLATE[1] + 11} L${PLATE[0] - 4.6} ${PLATE[1] + 11}Z`, fill: '#e8d2a6', stroke: 'currentColor', 'stroke-width': 0.7 }, homeFront);
  const plateText = el('text', { x: PLATE[0], y: PLATE[1] - 1, 'font-size': 6.2, 'font-weight': 700, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'writing-mode': 'vertical-rl', 'font-family': '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif', fill: 'currentColor' }, homeFront);
  plateText.textContent = '旅人';
  el('path', { d: `M${PLATE[0] - 2} ${PLATE[1] + 7} l2 -1.6 l2 1.6 l-2 1.6Z`, fill: '#c8423a' }, homeFront);
  const MAIL_X = 434, MB = MAIL_X - 7;
  el('path', { d: `M${MB} 318 L${MB + 14} 318 L${MB + 14} 331 L${MB} 331Z M${MB + 2} 322 L${MB + 12} 322 M${MB + 7} 331 L${MB + 7} 344`, fill: '#a8794d', stroke: 'currentColor', 'stroke-width': 0.6 }, homeFront);
  const mailFlag = el('path', { d: `M${MB + 14} 319 L${MB + 14} 309 L${MB + 20} 310.8 L${MB + 14} 312.8`, fill: '#c8423a', stroke: 'currentColor', 'stroke-width': 0.4 }, homeFront);
  const letterN = document.createElement('div'); letterN.className = 'letter';
  letterN.innerHTML = `<div class="paper"><p class="to">Sevgili yeni komşum,</p>
    <p>Bu akşam sokağın batı ucunda, kanalın döndüğü yerde <b>yaz panayırı</b> var.
    Fenerler yanacak, davul çalacak, takoyaki kokusu her yeri saracak. Hava kararınca havai fişekler de var.</p>
    <p>Gelirsen sevinirim. Kenta da orada olur, eminim.</p>
    <p class="from">— Hana <i>花</i></p><button type="button">Katla</button></div>`;
  card.appendChild(letterN);
  const hanaLetter = letterN.querySelector('.paper')!.innerHTML;
  let letterClosed = false;
  letterN.querySelector('button')!.addEventListener('click', () => { letterN.classList.remove('show'); letterClosed = true; sfx.paper(); });
  // the lantern: whatever you draw on it stays, and glows at night
  const L = LANTERN;
  const lanternD = `M${L.x - L.r * 0.75} ${L.top + 4} Q${L.x - L.r * 1.18} ${L.top + 4 + L.h / 2} ${L.x - L.r * 0.75} ${L.top + 4 + L.h} L${L.x + L.r * 0.75} ${L.top + 4 + L.h} Q${L.x + L.r * 1.18} ${L.top + 4 + L.h / 2} ${L.x + L.r * 0.75} ${L.top + 4}Z`;
  const lantern = el('g', {}, layers.front);
  el('path', { d: `M${L.x} ${L.top - 4} L${L.x} ${L.top + 2}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.5 }, lantern);
  const lanternBody = el('path', { d: lanternD, fill: PAPER, stroke: 'currentColor', 'stroke-width': 0.7 }, lantern);
  const clipId = 'lantern-art-clip';
  el('path', { d: lanternD }, el('clipPath', { id: clipId }, svg));
  const lanternArt = el('g', { 'clip-path': `url(#${clipId})` }, lantern);
  el('path', { d: [1, 2, 3, 4].map((k) => { const yy = L.top + 4 + (L.h * k) / 5; return `M${L.x - L.r * 1.1} ${yy} Q${L.x} ${yy + 1} ${L.x + L.r * 1.1} ${yy}`; }).join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': 0.3, opacity: 0.5, 'clip-path': `url(#${clipId})` }, lantern);
  el('path', { d: `M${L.x - L.r * 0.6} ${L.top + 2} L${L.x + L.r * 0.6} ${L.top + 2} L${L.x + L.r * 0.6} ${L.top + 4.4} L${L.x - L.r * 0.6} ${L.top + 4.4}Z M${L.x - L.r * 0.6} ${L.top + 3.6 + L.h} L${L.x + L.r * 0.6} ${L.top + 3.6 + L.h} L${L.x + L.r * 0.6} ${L.top + 6.4 + L.h} L${L.x - L.r * 0.6} ${L.top + 6.4 + L.h}Z`, fill: 'currentColor' }, lantern);
  const lanternGlow = el('circle', { cx: L.x, cy: L.cy, r: 34, fill: 'url(#v-warmglow)', opacity: 0 }, layers.glow);
  const lanternLines: Vec[][] = [];

  // the workshop (a plaque by the door) and the tea house's blank sign, waiting for a hand
  const ATELIER_X = 346;
  const atelier = el('g', {}, layers.front);
  atelier.innerHTML = `<path d="M${ATELIER_X} 282 L${ATELIER_X} 288" stroke="currentColor" stroke-width="0.5"/>
    <path d="M${ATELIER_X - 7} 288 L${ATELIER_X + 7} 288 L${ATELIER_X + 7} 310 L${ATELIER_X - 7} 310Z" fill="#e8d2a6" stroke="currentColor" stroke-width="0.7"/>
    <text x="${ATELIER_X}" y="299.4" font-size="10" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="currentColor" font-family='"Hiragino Mincho ProN","Yu Mincho",serif'>墨</text>
    <path d="M${ATELIER_X - 3} 307 l3 -1.6 l3 1.6" stroke="#c8423a" stroke-width="0.8" fill="none"/>`;
  const SIGN = { x: 594, y: 242, w: 26 };
  const teaSign = el('g', {}, layers.front);
  el('path', { d: `M${SIGN.x - 9} ${SIGN.y - 16} L${SIGN.x - 9} ${SIGN.y - 13} M${SIGN.x + 9} ${SIGN.y - 16} L${SIGN.x + 9} ${SIGN.y - 13}`, stroke: 'currentColor', 'stroke-width': 0.5, fill: 'none' }, teaSign);
  el('path', { d: `M${SIGN.x - 13} ${SIGN.y - 13} L${SIGN.x + 13} ${SIGN.y - 13} L${SIGN.x + 13} ${SIGN.y + 13} L${SIGN.x - 13} ${SIGN.y + 13}Z`, fill: '#e8d2a6', stroke: 'currentColor', 'stroke-width': 0.8 }, teaSign);
  const signWait = el('path', { d: `M${SIGN.x - 9} ${SIGN.y - 9} L${SIGN.x + 9} ${SIGN.y - 9} L${SIGN.x + 9} ${SIGN.y + 9} L${SIGN.x - 9} ${SIGN.y + 9}Z`, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.5, 'stroke-dasharray': '1.6 1.4', opacity: 0.6 }, teaSign);
  const signInk = el('g', { transform: `translate(${SIGN.x - 9.5} ${SIGN.y - 9.5}) scale(0.19)` }, teaSign);
  const shodo = createShodo(card, {
    onDone: (strokes, score) => {
      art.sign = strokes;
      signInk.innerHTML = strokes.map((d) => `<path d="${d}" fill="currentColor"/>`).join('');
      signWait.setAttribute('opacity', '0');
      run(orderDelivered(score));
    },
    onExit: () => { if (mode === 'desk') { mode = 'walk'; cam = null; focusOn = null; } },
  });

  // guided toys for the cat: pick one, then go over its outline (your hand stays in it)
  const TOYS: { name: string; c: string; pts: Vec[]; deco: string }[] = [
    { name: 'Top', c: '#c8423a', pts: Array.from({ length: 25 }, (_, i) => [Math.sin(i / 24 * 6.283) * 7, -Math.cos(i / 24 * 6.283) * 7] as Vec), deco: 'M-7 0 Q0 -3 7 0 M-4.6 -5 Q0 -7 4.6 -5' },
    { name: 'Balık', c: '#e8743a', pts: [[-9, 0], [-5, -4.6], [2, -4.4], [6, -1.4], [10, -5], [10, 5], [6, 1.4], [2, 4.4], [-5, 4.6], [-9, 0]], deco: 'M-5.6 -1 l0.1 0 M2 -4 Q0.6 0 2 4 M-1 -3 l0 1 M-1 2 l0 1' },
    { name: 'Fare', c: '#bdb6a8', pts: [[-9, 2], [-6, -3], [0, -5.6], [6, -3.6], [8, 1], [6, 4], [-6, 4], [-9, 2]], deco: 'M-5.6 -0.6 l0.1 0 M-1 -5 a2.4 2.4 0 1 1 -0.1 0 M8 1 Q14 0 13 -5 Q12 -8 15 -9' },
  ];
  const TOY_AT: Vec = [690, 309];
  const toyTmpl = el('path', { fill: 'none', stroke: '#c8423a', 'stroke-width': 0.7, 'stroke-dasharray': '1.6 1.4', opacity: 0 }, layers.stroke);
  const tmplWorld = (k: number) => TOYS[k].pts.map((p) => [TOY_AT[0] + p[0], TOY_AT[1] + p[1]] as Vec);
  /** a closed outline drawn from anywhere, either way round: find the best match */
  function matchLoop(user: Vec[], tmpl: Vec[]) {
    let best = { err: 1e9, blend: [] as Vec[] };
    for (const seq of [user, [...user].reverse()]) {
      for (let k = 0; k < seq.length; k += Math.max(1, Math.floor(seq.length / 16))) {
        const rot = [...seq.slice(k), ...seq.slice(0, k)];
        const r = compare(rot, tmpl, 0.4);
        if (r.err < best.err) best = r;
      }
    }
    return best;
  }

  // the toy you draw for the cat
  const toyG = el('g', {}, layers.front);
  const toy = { on: false, p: [0, 0] as Vec, v: [0, 0] as Vec, rot: 0, w: 0, t: 0, ground: 352, line: [] as Vec[] };

  // ------------------------------------------------------------------ notebook
  const notebook = createNotebook(card);
  const q = {
    kite: 'sad' as 'sad' | 'talked' | 'done', dinner: '' as '' | 'kenta' | 'alone', sushi: false, fox: false,
    lantern: false, toy: false, toyKind: 0, catHome: false, letter: false, fair: false, order: false, fresh: new Set<string>(), day: 1, slept: 0,
    name: '', shopping: [] as string[], pantry: { ...START }, dishes: [] as Box[], basket: [] as Item[], iceboxDay: 0, grocerMet: false, created: false, walkLearned: false, guideMet: false, met: false, homeSeen: false, homeShown: false, visitedHome: false, kentaAway: false, nightHint: false, windowMoment: false, tableDecor: false,
    visit: 'none' as Visit, invitedDay: 0, missedNote: false, reminded: false,
    day2Seen: false, day3Seen: false, souvenir: '' as '' | 'cushion' | 'water', coins: 0,
    project: '' as '' | 'tea' | 'paws' | 'lanterns', projectPlan: '' as '' | 'tea' | 'paws', projectDay: 0, gathering: false, keepsake: false, tookMemento: false,
    arcVersion: 5, dayIntro: 1, giftUsed: false, supperTogether: false,
    chime: false, chimePlace: '' as '' | 'home' | 'corner', chimeTied: false,
    festivalArt: false, festivalMode: 'tea' as 'tea' | 'drawing',
    shelterParts: [] as number[], servedParts: [] as number[],
    eveningChoice: '' as '' | 'lantern' | 'home',
    events: [] as { day: number; id: string }[],
    alley: [] as Stone[],
    history: [] as { dayN: number; entries: Entry[]; sentence: string }[],
  };
  if (o.saved) { const { fresh, ...state } = o.saved.story; Object.assign(q, state); q.fresh = new Set(Array.isArray(fresh) ? fresh : []); }
  if (!Array.isArray(q.events)) q.events = [];
  if (!Array.isArray(q.shopping)) q.shopping = [];
  q.pantry = normalize(q.pantry); q.dishes = normalizeDishes(q.dishes); q.basket = normalizeBasket(q.basket);
  if (!Array.isArray(q.shelterParts)) q.shelterParts = [];
  if (!Array.isArray(q.servedParts)) q.servedParts = [];
  // the stepping stones home: pressed in ink the first time you come; older homes already had them
  q.alley = normalizeStones(q.alley);
  if (o.saved && !q.alley.length && (q.visitedHome || q.day > 1)) q.alley = STONES.map(() => ({ q: 1, tilt: 0, gap: BEAT }));
  if (o.saved && o.saved.story.arcVersion !== 5) {
    // Preserve the old drawings and choices; the new shared ending still has a beginning.
    q.gathering = false; q.festivalArt = false;
    q.dayIntro = Math.max(1, q.day - 1);
    q.projectPlan = q.project === 'tea' ? 'tea' : q.project ? 'paws' : '';
    q.arcVersion = 5;
  }
  if (o.saved && o.saved.story.guideMet === undefined && q.walkLearned) q.guideMet = true;
  if (o.saved && q.kite === 'done') q.homeShown = true;
  let departing = false, nextHop = 0;
  let kiteLine: Vec[] = o.saved?.art.kite ?? [];
  if (kiteLine.length && q.kite === 'done') { kite.birth(kiteLine); stuck.remove(); kenta.want.sad = 0; kenta.want.raise = 1; }
  for (const d of art.sign) el('path', { d, fill: 'currentColor' }, signInk);
  if (q.order) signWait.setAttribute('opacity', '0');
  for (const line of o.saved?.art.lantern ?? []) { lanternLines.push(line); el('path', { d: brush(line, .5), fill: 'currentColor' }, lanternArt); }
  if (art.table.length) home.decorateTable(fitDrawing(art.table, 0, 0, 28).map(l => linePath(l)));
  home.catHome = q.catHome; if (q.catHome) cat.g.style.display = 'none';
  if (q.toy && o.saved?.art.toy?.length) {
    toy.line = o.saved.art.toy; toy.on = true; toy.p = [700, 324]; toy.ground = 324; toy.t = 2;
    const drawing = fitDrawing(art.toyDrawing.length ? art.toyDrawing : [toy.line], 0, 0, q.toyKind === 0 ? 14 : q.toyKind === 1 ? 19 : 17);
    const body = drawing.reduce((a, b) => a.length > b.length ? a : b, [] as Vec[]);
    drawing.forEach(l => el('path', { d: linePath(l, l === body), fill: l === body ? TOYS[q.toyKind]?.c ?? '#c8423a' : 'none', stroke: 'currentColor', 'stroke-width': .7 }, toyG));
  }
  const entries = (): Entry[] => [
    ...(env.extraEntries?.() ?? []),
    { id: 'self', title: 'Benim çizgim', hint: '', sketch: sketchOf(art.portrait), done: art.portrait.length > 0 },
    { id: 'kite', title: 'Kenta’nın uçurtması', hint: 'Kiraz ağacının altında biri üzgün.', sketch: kiteLine.length ? sketchOf([[...kiteLine, kiteLine[0]]]) : SKETCH.kite, done: q.kite === 'done', fresh: q.fresh.has('kite') },
    { id: 'order', title: 'Çay evindeki çizgim', hint: 'Hana çay evinde.', sketch: art.sign.length ? art.sign.join(' ') : CHA.map(c => 'M' + c.pts.map(p => pt([8 + p[0] * .44, 8 + p[1] * .44])).join('L')).join(' '), transform: art.sign.length ? 'translate(8 8) scale(.44)' : '', solid: art.sign.length > 0, done: q.order, fresh: q.fresh.has('order') },
    { id: 'lantern', title: 'Kapımın feneri', hint: 'Kapının yanındaki fener bomboş.', sketch: q.lantern ? sketchOf(lanternLines) : SKETCH.lantern, done: q.lantern, fresh: q.fresh.has('lantern') },
    { id: 'toy', title: q.catHome ? 'Eve gelen kedi' : 'Kedinin oyuncağı', hint: 'Bankta bir kedi uyukluyor.', sketch: q.toy ? sketchOf(art.toyDrawing.length ? art.toyDrawing : [toy.line]) : SKETCH.cat, done: q.toy, fresh: q.fresh.has('toy') },
    { id: 'fair', title: 'Yaz panayırı', hint: q.letter ? 'Sokağın batı ucunda, akşam.' : 'Posta kutusunda bir şey var.', sketch: SKETCH.fair, done: q.fair, fresh: q.fresh.has('fair') },
    { id: 'sushi', title: q.dinner === 'kenta' ? 'Kenta’yla akşam yemeği' : q.dinner === 'alone' ? 'Sessiz bir akşam yemeği' : 'Akşam yemeği', hint: 'Mutfakta suşi yap.', sketch: SKETCH.sushi, done: q.sushi, fresh: q.fresh.has('sushi') },
    { id: 'table', title: 'Soframdaki desen', hint: '', sketch: sketchOf(art.table), done: q.tableDecor, fresh: q.fresh.has('table') },
    { id: 'corner', title: q.souvenir === 'water' ? 'Pencere misafirleri' : 'Pencere köşem', hint: 'Çay evinin siparişiyle başlar.', sketch: q.souvenir === 'water' ? 'M10 36 Q30 50 50 36 M14 36 Q30 29 46 36 M28 22 q4 -8 9 -2 l5 0' : 'M10 34 Q30 28 50 34 L48 46 Q30 50 12 46Z', done: !!q.souvenir },
    { id: 'project', title: q.project === 'tea' ? 'Mahallenin çay köşesi' : 'Patilerin kuru köşesi', hint: 'Üçüncü gün, ağacın altında.', sketch: sketchOf(art.project), done: !!q.project },
    { id: 'chime', title: q.chimePlace === 'corner' ? 'Köşenin sesi' : 'Kapımın sesi', hint: 'Yağmurdan sonra.', sketch: sketchOf(art.chime), done: q.chime, fresh: q.fresh.has('chime') },
    { id: 'invitation', title: 'Buluşmanın işareti', hint: '', sketch: sketchOf(art.invitation), done: q.festivalArt },
    { id: 'gathering', title: q.festivalMode === 'tea' ? 'Birlikte çay' : 'Aynı masada çizgiler', hint: '', sketch: sketchOf(art.invitation), done: q.gathering, fresh: q.fresh.has('gathering') },
    { id: 'fox', title: 'Gece misafiri', hint: 'Gece fenerin altında… sessizce.', sketch: SKETCH.fox, done: q.fox, fresh: q.fresh.has('fox') },
  ].filter(e => e.done || e.id === 'kite' || (q.day >= 2 && e.id === 'order') || (q.day >= 3 && e.id === 'project'));
  const defterBtn = document.createElement('button');
  defterBtn.type = 'button'; defterBtn.className = 'defter-btn'; defterBtn.setAttribute('aria-label', 'Defter');
  defterBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 3h11a3 3 0 0 1 3 3v15H8a3 3 0 0 1-3-3Z M8 3v18 M11 8h5 M11 11h5"/></svg><span class="dots">${'<i></i>'.repeat(7)}</span>`;
  card.appendChild(defterBtn);
  const dots = [...defterBtn.querySelectorAll('.dots i')] as HTMLElement[];
  const refreshDots = () => { [q.kite === 'done', q.order, q.lantern, q.toy, q.fair, q.sushi, q.fox].forEach((d, i) => dots[i].classList.toggle('on', d)); };
  defterBtn.addEventListener('click', () => {
    if (mode !== 'walk' || paper.isOpen || script || env.localModal?.()) return;
    sfx.tap();
    notebook.show({ dayN: q.day, subtitle: 'bugün', entries: entries(), sentence: daySentence(false), button: 'Kapat', history: q.history, seal: sketchOf(art.seal) });
  });
  const mark = (id: string) => {
    q.fresh.add(id);
    if (!q.events.some(e => e.day === q.day && e.id === id)) q.events.push({ day: q.day, id });
    refreshDots();
    defterBtn.classList.remove('bump'); void defterBtn.offsetWidth; defterBtn.classList.add('bump');
  };
  function daySentence(end: boolean) {
    const s: string[] = [];
    if (q.events.some(e => e.day === q.day && e.id === 'kite')) s.push('Kenta’ya bir uçurtma çizdim');
    if (q.events.some(e => e.day === q.day && e.id === 'order')) s.push('çay evinin tabelasını yazdım');
    if (q.events.some(e => e.day === q.day && e.id === 'lantern')) s.push('kapımın fenerine resim yaptım');
    if (q.events.some(e => e.day === q.day && e.id === 'toy')) s.push(q.catHome ? 'bir kedi eve geldi' : 'bankta bir kediyle oynadık');
    if (q.events.some(e => e.day === q.day && e.id === 'fair')) s.push('panayırın fenerleri altında dolaştım');
    if (q.sushi) s.push(q.supperTogether ? 'Kenta’yla suşi yedik' : 'akşamı sessizce, suşiyle geçirdim');
    if (q.events.some(e => e.day === q.day && e.id === 'table')) s.push('soframa bir desen çizdim');
    if (q.events.some(e => e.day === q.day && e.id === 'gift')) s.push(q.souvenir === 'water' ? 'pencereme kuşlar uğradı' : 'kendime bir pencere köşesi yaptım');
    if (q.events.some(e => e.day === q.day && e.id === 'project')) s.push(q.project === 'tea' ? 'yağmurda birlikte çay içilecek bir yer kurduk' : 'patiler için kuru bir köşe kurduk');
    if (q.events.some(e => e.day === q.day && e.id === 'chime')) s.push(q.chimePlace === 'home' ? 'kapıma kendi çizgimle bir çan astım' : 'ortak köşeye bir çan astım');
    if (q.events.some(e => e.day === q.day && e.id === 'gathering')) s.push(q.festivalMode === 'tea' ? 'komşulara çay uzattım' : 'komşularla aynı masada çizdik');
    if (q.visit === 'missed') s.push('Kenta kapıma bir not bıraktı');
    if (q.events.some(e => e.day === q.day && e.id === 'fox')) s.push('gece bir tilki yanıma oturdu');
    if (!s.length) return end ? 'Sakin bir gün.' : 'Sayfa henüz boş.';
    const txt = s.join(', ').replace(/, ([^,]*)$/, ' ve $1') + '.';
    return txt[0].toUpperCase() + txt.slice(1);
  }

  // ------------------------------------------------------------------ choices: two answers, both fine
  const choiceBox = document.createElement('div'); choiceBox.className = 'choices'; card.appendChild(choiceBox);
  let picked = -1;
  function* choose(opts: string[]): Generator<Wait, number, unknown> {
    picked = -1;
    yield () => !ui.typing; yield .35;
    choiceBox.innerHTML = opts.map((s, i) => `<button type="button" data-i="${i}" class="${i ? 'alt' : ''}" style="--i:${i}">${s}</button>`).join('');
    choiceBox.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { picked = +(b as HTMLElement).dataset.i!; sfx.tap(); haptic(8); }));
    choiceBox.classList.add('show');
    yield () => picked >= 0;
    choiceBox.classList.remove('show'); ui.dismissDialogue();
    return picked;
  }

  // ------------------------------------------------------------------ the brush pad
  type Purpose = 'kite' | 'lantern' | 'toy';
  let purpose: Purpose = 'kite';
  const pad = document.createElement('div'); pad.className = 'brushpad'; card.appendChild(pad);
  const toWorld = (cx: number, cy: number): Vec => { const p = svg.createSVGPoint(); p.x = cx; p.y = cy; const m = svg.getScreenCTM(); const r = m ? p.matrixTransform(m.inverse()) : p; return [r.x, r.y]; };
  // the drawing patch (an ellipse around drawingAt): how far out a point is (1 = on its edge), and the point pulled back inside
  const AREA = { rx: 50, ry: 59 };
  const inArea = (p: Vec) => { const a = drawingAt(); return Math.hypot((p[0] - a[0]) / AREA.rx, (p[1] - a[1]) / AREA.ry); };
  const areaClamp = (p: Vec): Vec => { if (purpose !== 'kite') return p; const k = inArea(p); if (k <= 1) return p; const a = drawingAt(); return [a[0] + (p[0] - a[0]) / k, a[1] + (p[1] - a[1]) / k]; };
  let drawing = false, lastPt: { p: Vec; t: number } | null = null, fails = 0, lanternStrokes = 0;
  pad.addEventListener('pointerdown', (e) => {
    if (mode !== 'brush') return;
    e.preventDefault(); pad.setPointerCapture(e.pointerId); wakeAudio();
    const p = toWorld(e.clientX, e.clientY);
    // only the paper patch takes ink: a touch outside it just shows where to draw
    if (purpose === 'kite' && inArea(p) > 1) { focusPatch.animate([{ strokeOpacity: .32 }, { strokeOpacity: 1, strokeWidth: 1.4 }, { strokeOpacity: .32 }], { duration: 520 }); sfx.tap(); return; }
    drawing = true; brushIdle = 0; stroke.clear(); ui.hideGesture(); env.tip(null);
    stroke.add(p, 0); lastPt = { p, t: performance.now() };
    sfx.paper();
  });
  pad.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = areaClamp(toWorld(e.clientX, e.clientY)), now = performance.now();
    const sp = lastPt ? Math.hypot(p[0] - lastPt.p[0], p[1] - lastPt.p[1]) / Math.max(1, now - lastPt.t) * 1000 : 0;
    stroke.add(p, sp); lastPt = { p, t: now };
  });
  const lift = () => { if (!drawing) return; drawing = false; judge(); };
  pad.addEventListener('pointerup', lift); pad.addEventListener('pointercancel', lift);

  // ------------------------------------------------------------------ kitchen close-up
  const closeup = createCloseup(card, {
    onStep: (n) => home.setStep(n),
    onDesign: d => home.setPlateDesign(d.pattern, d.garnish),
    onDone: () => { home.takePlate(); env.tip('Tabak elinde. Masaya doğru yürü.'); },
    onExit: () => { mode = 'walk'; cam = null; },
  });

  closeup.restore(o.saved?.art.cooking);
  // the icebox, up close. Two shelves of fresh things and one of dishes you made: take something
  // to cook or a plate to serve, or put away what you carried in (a plate, or the market bundle).
  let iceNote: Item[] = [], iceboxPlate = false;
  const icebox = createIcebox(card, {
    onDone: (r: IceboxResult) => {
      mode = 'walk'; cam = null;
      if (r.mode === 'store') {
        if (iceboxPlate) { q.dishes = [...q.dishes, home.storeDish()].filter(b => b.length).slice(0, DISH_BOXES); env.tip('Yemeklerin dolapta. İstediğin akşam çıkarıp yiyebilirsin.'); }
        else { const { pantry, left } = storeItems(q.pantry, q.basket); q.pantry = pantry; q.basket = left; q.shopping = q.shopping.filter(x => q.pantry[x as Item] === 0); }
      } else if ('cook' in r) { q.pantry = use(q.pantry, r.cook); home.fromIcebox(r.cook); closeup.setTopping(r.cook); }
      else { q.dishes = q.dishes.filter((_, i) => i !== r.box); home.takeDish(r.serve); env.tip('Tabak elinde. Masaya götür ya da dolaba geri koy.'); }
      afterIcebox();
    },
    onExit: () => { mode = 'walk'; cam = null; afterIcebox(); },
    onNote: (m) => { iceNote = m.filter(x => !q.shopping.includes(x)); q.shopping = [...new Set([...q.shopping, ...m])]; },
  });
  function afterIcebox() {
    if (!iceNote.length) return;
    const names = iceNote.map(x => ITEMS[x].name);
    iceNote = [];
    think(`${names.join(' ile ')} bitmiş. Pazarda Ume’ye uğrarım.`);
  }
  // Ume's greengrocer: draw a ring around what you want; the bundle comes home in your hands
  const grocer = createGrocer(card, {
    onDone: (items) => {
      mode = 'walk'; cam = null;
      q.basket = items; q.shopping = q.shopping.filter(x => !items.includes(x as Item));
      env.tip(q.grocerMet ? 'Bohça elinde. Evdeki dolaba yerleştir.' : 'Ume: “Komşudan para alınmaz. Bir gün bana bir çizim getirirsin.”');
      q.grocerMet = true;
    },
    onExit: () => { mode = 'walk'; cam = null; },
  });
  // the bundle in your hands, wherever you walk
  const sack = el('g', { 'data-grocery-bundle': '', opacity: 0, 'pointer-events': 'none' }, layers.front);
  el('path', { d: 'M-5 -1 Q-6 -6 0 -6 Q6 -6 5 -1 Q5 4 0 4 Q-5 4 -5 -1Z', fill: '#34507a', stroke: 'currentColor', 'stroke-width': .5 }, sack);
  el('path', { d: 'M-2 -6 q-3 -3 -1 -4 q2 0 3 3 q1 -3 3 -3 q2 1 -1 4', fill: '#34507a', stroke: 'currentColor', 'stroke-width': .45 }, sack);
  el('path', { d: 'M-4 1 q2 -1.5 4 0 t4 0', fill: 'none', stroke: '#e8eef4', 'stroke-width': .4 }, sack);
  // ------------------------------------------------------------------ state & a tiny script runner
  let mode: 'intro' | 'walk' | 'cine' | 'brush' | 'cook' | 'sleep' | 'desk' | 'craft' | 'alley' = q.created ? 'walk' : 'intro';
  const syncControls = () => card.classList.toggle('controls-locked', mode !== 'walk');
  let cam: Cam = null;
  let focusOn: (() => Vec) | null = null;
  let seated = false;
  let script: Scene | null = null, waitT = 0, waitFn: (() => boolean) | null = null;
  let ctx: Ctx;
  let blocks = true; // the intro runs in the background and blocks nothing
  const run = (g: Scene, block = true) => { script = g; blocks = block; waitT = 0; waitFn = null; advance(); };
  function advance() {
    while (script) {
      const r = script.next();
      if (r.done) { script = null; return; }
      if (typeof r.value === 'number') { waitT = r.value; return; }
      waitFn = r.value as () => boolean; return;
    }
  }
  /** a camera framing that fits a scene rectangle */
  const fit = (x0: number, y0: number, x1: number, y1: number, zmax = 3): Cam => ({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, z: Math.max(1, Math.min(zmax, ctx.base.w / (x1 - x0), ctx.base.h / (y1 - y0))) });
  const playerHead = (): Vec => [player.x, player.y - 50];
  const kentaHead = (): Vec => [kenta.head[0], kenta.head[1] - 6];
  const guestHead = (): Vec => guest ? [guest.head[0], guest.head[1] - 6] : [0, 0];
  const think = (s: string, d?: number) => ui.say(playerHead, s, d, 'thought');
  const hanaHead = (): Vec => hana.head;
  function* sayLine(at: () => Vec, text: string): Scene {
    const b = ui.say(at, text);
    yield () => b.t >= b.dur - .3;
  }
  const handwork = createHandwork(card, () => { mode = 'walk'; cam = null; focusOn = null; script = null; });
  const catHead = (): Vec => [CAT[0], CAT[1] - 14];

  // objectives drive the guide crane and the hint ladder
  type Obj = { at: () => Vec; near: () => boolean; inside: boolean; since: number; guided: boolean } | null;
  let obj: Obj = null;
  const setObj = (at: () => Vec, near: () => boolean, inside: boolean) => { obj = { at, near, inside, since: 0, guided: false }; };
  const toDoor = () => setObj(() => [DOOR_X, 300], () => ctx.inside, false);

  // ------------------------------------------------------------------ scenes
  const arrival = document.createElement('div'); arrival.className = 'arrival-card';
  arrival.innerHTML = '<small>1. gün</small><h1>Mürekkep Sokağı</h1><i aria-hidden="true"></i>';
  card.appendChild(arrival);
  // The first minute teaches by letting you play. Nothing ever stops your feet: the walking
  // hint is there from the first moment and leaves as soon as you walk. Then you notice your
  // little neighbour's kite getting away. The crane only introduces itself later, once it has
  // something to show you (the way home).
  const who = () => q.name || 'Deniz';
  let craneOut = q.guideMet, craneScene = false;
  ui.speaker(kentaHead, 'Kenta'); ui.speaker(guestHead, 'Kenta'); ui.speaker(hanaHead, 'Hana'); ui.speaker(ui.craneAt, 'Turna');
  function* craneLine(text: string): Scene {
    const b = ui.say(ui.craneAt, text);
    yield () => b.t >= b.dur - .3;
  }
  function* intro(): Scene {
    mode = 'intro';
    yield () => env.isOpened();
    arrival.classList.add('show');
    yield 2.7;
    arrival.classList.remove('show');
    q.created = true;
    mode = 'walk'; cam = null;
    yield .35;
    ui.showWalkingGesture(); env.tip('Parmağını ekranda kaydır.', true);
    let last: Vec = [player.x, player.y], walked = 0, movingFor = 0;
    yield () => {
      walked += Math.hypot(player.x - last[0], player.y - last[1]); last = [player.x, player.y];
      if (player.moving > .2) movingFor += ctx.dt;
      // Loops count too; pushing against the pavement edge must not trap the first lesson.
      return walked > 22 || walked > 8 && movingFor > 1.4;
    };
    q.walkLearned = true; ui.hideGesture(); env.tip(null);
    yield 1.1;
    // over there: a gust takes Kenta's kite out of the cherry tree. The camera widens to show it
    // (you keep walking) and the traveller recognises him.
    if (!q.met) {
      stuck.release();
      cam = fit(Math.min(player.x, kenta.x) - 40, 150, Math.max(player.x + 40, STUCK[0] + 60), 392, 2.2);
      yield .7;
      think('Aa! Kenta’nın uçurtması kaçıyor!');
      yield 2.6;
      if (mode === 'walk' && !q.met) cam = null;
    }
  }

  let meetStep = false; // the first meeting: you settle at Kenta's left side
  function* talk(): Scene {
    mode = 'cine'; obj = null; ui.guide(null); focusOn = () => [kenta.x, kenta.y]; ui.hint(playerHead, null);
    const x0 = Math.min(player.x, kenta.x), x1 = Math.max(player.x, kenta.x);
    cam = fit(x0 - 45, 268, x1 + 45, 382, 2.2);
    meetStep = true;
    player.faceTo = kenta.x > player.x ? 0.25 : Math.PI - 0.25;
    kenta.dir = player.x < kenta.x ? -1 : 1;
    kenta.want.sad = 0.4;
    q.met = true;
    yield .5;
    yield* sayLine(kentaHead, `${who()}! Uçurtmamı kaçırdım…`);
    kenta.want.look = 1;
    yield* sayLine(kentaHead, 'Rüzgâr ipini kopardı, uçup gitti.');
    q.kite = 'talked'; kenta.want.look = 0;
    cam = fit(kenta.x - 65, 220, kenta.x + 90, 390, 2);
    kenta.want.sad = 0.2;
    yield* sayLine(kentaHead, 'Sen çok güzel çiziyorsun. Bana yenisini çizer misin?');
    meetStep = false;
    startBrush('kite');
  }

  // the brush, for one of three things
  function startBrush(what: Purpose) {
    // The portable brush is always available; hanging the bundle never blocks art.
    purpose = what; mode = 'brush'; ui.sparkle(null); fails = 0; lanternStrokes = 0; obj = null; ui.guide(null);
    pad.classList.add('show'); card.classList.add('brush-focus');
    // the same line weight on screen however close the camera is
    stroke.setScale(what === 'lantern' ? 0.32 : what === 'toy' ? 0.62 : 1);
    if (what === 'kite') {
      card.classList.remove('brush-focus');
      card.classList.add('world-drawing'); brushIdle = 0;
      const at = drawingAt(); focus.setAttribute('display', ''); focusPatch.setAttribute('cx', f(at[0])); focusPatch.setAttribute('cy', f(at[1]));
      focusOutline.setAttribute('d', linePath([[at[0], at[1] - 24], [at[0] + 18, at[1]], [at[0], at[1] + 24], [at[0] - 18, at[1]], [at[0], at[1] - 24]]));
      cam = fit(kenta.x - 48, 194, kenta.x + 100, 386, 2.2);
      env.tip('Açık alana bir şekil çiz. Uçlarını birleştir.', true);
    } else if (what === 'lantern') {
      pad.classList.remove('show'); card.classList.remove('brush-focus');
      drawOnPaper({ title: 'Fenerine bir hilal.', tip: 'Soluk çizginin üstünden geç. Gece ışık bu çizgilerden vuracak.', trace: MOTIFS.lantern.strokes, done: 'Fenere asalım', then: lines => {
        for (const line of lines) {
          const points = line.map(p => [L.x + (p[0] - 120) * .055, L.top + 4 + (p[1] - 10) / 240 * L.h] as Vec);
          lanternLines.push(points); el('path', { d: brush(points, .5), fill: 'currentColor' }, lanternArt);
        }
        run(lanternDone());
      } });
    } else {
      pad.classList.remove('show'); card.classList.remove('brush-focus');
      const openToy = () => drawOnPaper({ title: `Kediye bir ${TOYS[q.toyKind].name.toLowerCase()}.`, tip: 'Soluk çizginin üstünden geç. Nasıl çizersen onunla oynayacak.', trace: [fitLine(TOYS[q.toyKind].pts, 120, 125, 150)], done: 'Pisiye verelim', then: lines => {
        art.toyDrawing = fitDrawing(lines, TOY_AT[0], TOY_AT[1], q.toyKind === 0 ? 14 : q.toyKind === 1 ? 19 : 17);
        const world = art.toyDrawing.reduce((a, b) => a.length > b.length ? a : b, [] as Vec[]);
        run(toyBorn(world, 15));
      } });
      openToy();
    }
  }

  function endBrush() {
    pad.classList.remove('show'); card.classList.remove('brush-focus', 'world-drawing'); focus.setAttribute('display', 'none'); ui.hideGesture(); env.tip(null);
    if (purpose === 'lantern' && lanternStrokes > 0 && mode === 'brush') { run(lanternDone()); return; }
    if (mode === 'brush') { mode = 'walk'; cam = null; focusOn = null; }
  }

  function judge() {
    const pts = stroke.points;
    const r = recognise(pts);
    if (purpose === 'lantern') {
      // every stroke on the lantern stays; strokes beside it fade
      const onIt = pts.filter((p) => Math.abs(p[0] - L.x) < L.r * 1.25 && p[1] > L.top + 2 && p[1] < L.top + L.h + 6).length;
      if (r.kind === 'tiny' && pts.length < 2) { stroke.vanish(); return; }
      if (onIt < pts.length * 0.5) { stroke.vanish(); return; }
      const n = stroke.copy(lanternArt);
      n.setAttribute('fill', 'currentColor');
      lanternLines.push(pts.slice());
      stroke.clear(); lanternStrokes++; sfx.press(); haptic(6);
      if (lanternStrokes === 1) env.tip('Bitince “Bitti”ye bas.');
      return;
    }
    if (purpose === 'toy') {
      if (r.size < 5) { stroke.vanish(); return; }
      const m = matchLoop(pts, tmplWorld(q.toyKind));
      if (m.err > 6) { stroke.vanish(); sfx.nope(); env.tip('Kesik çizgiye biraz daha yakın çiz.'); ui.showGesture('path', () => tmplWorld(q.toyKind), { period: 2.8 }); return; }
      toyTmpl.setAttribute('opacity', '0');
      run(toyBorn(m.blend, r.size)); return;
    }
    // the kite: any closed shape flies, exactly as drawn
    if (r.kind === 'tiny') { stroke.vanish(); return; }
    const gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
    if (gap < Math.max(10, r.size * 0.5) && r.size >= 10) { run(kiteBorn(pts.slice(), r.corners)); return; }
    fails++;
    stroke.vanish(); sfx.nope(); haptic(10);
    kenta.hop();
    env.tip('Bir ucunu ötekine kavuştur. Nasıl çizersen öyle uçacak.', true);
  }

  function* kiteBorn(pts: Vec[], corners: number): Scene {
    mode = 'cine'; pad.classList.remove('show'); card.classList.remove('brush-focus'); env.tip(null); ui.hideGesture();
    focus.setAttribute('display', 'none'); card.classList.remove('world-drawing');
    kiteLine = pts;
    stroke.vanish(); kite.birth(pts); stuck.remove();
    sfx.chime(); haptic(16);
    yield 1.1;
    kenta.hop(); kenta.want.raise = 1; kenta.want.sad = 0; kenta.want.look = 0.6;
    sfx.pop(); ui.heart(kentaHead());
    cam = fit(kenta.x - 75, 125, kenta.x + 95, 388, 2.2);
    yield 1.8;
    ui.say(kentaHead, corners <= 1 ? 'Yuvarlak bir uçurtma! Hiç görmemiştim!' : corners >= 5 ? 'Yıldız gibi bir uçurtma! Çok güzel!' : corners === 2 ? 'Ne tuhaf, ne güzel bir uçurtma!' : 'Tam bir uçurtma! Benim uçurtmam!');
    q.kite = 'done'; mark('kite'); sfx.success();
    yield 2;
    kenta.want.look = 0;
    cam = fit(Math.min(player.x, kenta.x) - 45, 268, Math.max(player.x, kenta.x) + 45, 382, 2.2);
    const question = ui.say(kentaHead, `${who()}, akşam yemeğe sana gelebilir miyim?`, 60);
    yield () => question.t >= .12 + question.full.join('').length / 34;
    yield .45;
    const a = yield* choose(['Gel, birlikte yeriz.', 'Başka akşam olsun.']);
    if (a === 0) {
      q.dinner = 'kenta'; q.visit = 'planned'; q.invitedDay = q.day; kenta.hop(); ui.heart(kentaHead()); sfx.pop();
      ui.say(kentaHead, 'Yaşasın! Akşam görüşürüz!', 1.9);
    } else {
      q.dinner = 'alone'; kenta.want.sad = 0.5;
      ui.say(kentaHead, 'Olur. Yarın uçururken görüşürüz!', 1.9);
    }
    yield 1.5;
    // he runs off with his kite; the crane is already on its way down while he goes
    focusOn = null; kenta.faceTarget = null; kenta.want.talk = 0; kenta.want.sad = 0;
    departing = true; kenta.want.wave = .65; kenta.walkTo(600, 357);
    cam = null; mode = 'walk';
    craneOut = craneScene = true; ui.companionArrive(); ui.guide(() => [player.x + 18, player.y - 44]);
    let flying = 0;
    yield () => (flying += ctx.dt) > 3 || ui.craneAt()[1] > player.y - 80 && flying > .8;
    mode = 'cine'; focusOn = () => ui.craneAt();
    yield* craneLine(`Merhaba ${who()}! Ben Turna, yol arkadaşın.`);
    yield* craneLine(q.dinner === 'kenta' ? 'Akşama misafirin var. Gel, evini göstereyim!' : 'Gel, önce evini göstereyim!');
    q.homeShown = true; focusOn = null; mode = 'walk'; craneScene = false;
    // it flies ahead to the mouth of the stone alley and waits there while you walk
    const mouth = (): Vec => [DOOR_X, Math.max(300, Math.min(player.y - 40, 318))];
    ui.guide(mouth); toDoor();
    let waited = 0;
    yield () => { waited += ctx.dt; return ctx.inside || (!alley.built && atStand()) || alley.built && Math.abs(player.x - DOOR_X) < 22 && player.y < 352 || waited > 45; };
    if (!ctx.inside && waited <= 45 && !alley.built) { yield* buildAlley(); return; }
    if (!ctx.inside && waited <= 45) yield* craneLine('İşte! Ara sokağın sonu senin evin.');
    ui.guide(null);
    yield 1.2;
    yield* craneLine('Yolunu ararsan beni köşede bul, bana dokun.');
    q.guideMet = true;
  }

  // ------------------------------------------------------------------ roji: pressing the stepping stones home
  const alley = createAlley(layers.front);
  alley.stones = q.alley;
  svg.querySelectorAll('[data-static-stones]').forEach(n => (n as SVGElement).style.display = 'none');
  let alleyY = 0;
  /** at the ink ring at the mouth of the alley: stop here and the alley is drawn */
  const atStand = () => Math.abs(player.x - STAND[0]) < 11 && Math.abs(player.y - STAND[1]) < 10;
  function* buildAlley(): Scene {
    mode = 'alley'; obj = null; env.tip(null); focusOn = null; ui.hideGesture();
    ui.guide(() => [DOOR_X + 17, 290]);
    cam = fit(DOOR_X - 46, 256, DOOR_X + 46, 374, 3.4);
    yield .6;
    sealAt = 0;
    yield .5;
    yield* craneLine('İşte evin! Ama yolu daha kurşun kalemle duruyor.');
    yield* craneLine('Halka taşa indiği an dokun. Yolu birlikte çizelim.');
    alley.start(ctx.t);
    env.tip('Halka taşın üstüne indiği an ekrana dokun.', true);
    ui.showGesture('tap', () => [[STONES[0][0], STONES[0][1]]], { period: BEAT });
    yield () => alley.stones.length > 0;
    ui.hideGesture(); env.tip(null);
    yield () => alley.done;
    q.alley = alley.stones.map(s => ({ ...s }));
    ui.guide(null); sfx.chime();
    const great = q.alley.filter(s => s.q >= 1).length;
    think(great >= 4 ? 'Evimin yolu. Adımlarım gibi düzgün.' : great >= 2 ? 'Evimin yolu. Biraz yamuk, tam benim gibi.' : 'Yamuk yumuk ama benim yolum.', 2.6);
    yield 2.4;
    yield* craneLine('Taşlar adımını hatırlar. Her eve dönüşünde çalarlar.');
    q.guideMet = true;
    mode = 'walk'; cam = null;
    env.tip('Taşların üstünden yukarı yürü. Kapın orada.', true);
  }

  function* toyPick(): Scene {
    mode = 'cine';
    cam = fit(CAT[0] - 62, 262, CAT[0] + 54, 370, 3);
    yield 0.8;
    ui.say(catHead, 'Miyav?', 60);
    think('Ona ne çizsem?', 60);
    const k = yield* choose(TOYS.map((t) => t.name));
    ui.say(catHead, '…', 0.4); ui.say(playerHead, '…', 0.3);
    q.toyKind = k;
    yield 0.4;
    mode = 'walk';
    startBrush('toy');
  }

  function* workshop(): Scene {
    mode = 'cine'; obj = null; ui.guide(null); env.tip(null); focusOn = () => [hana.x, hana.y];
    hana.talking = true; cam = fit(Math.min(player.x, hana.x) - 40, 274, Math.max(player.x, hana.x) + 40, 380, 2.4);
    yield* sayLine(hanaHead, 'Ben Hana. Kenta uçurtmanı gösterdi; sokağın yeni çizeri sensin demek.');
    yield* sayLine(hanaHead, 'Tabelam soldu. Kapıma senden bir işaret bırakır mısın?');
    yield* sayLine(playerHead, 'Çay evine en çok 茶 yakışır. Fırçayı alayım.');
    hana.talking = false;
    mode = 'desk'; shodo.open();
  }

  function* orderDelivered(_score: number): Scene {
    mode = 'cine'; focusOn = () => [hana.x, hana.y];
    signInk.innerHTML = art.sign.map(d => `<path d="${d}" fill="currentColor"/>`).join(''); signWait.setAttribute('opacity', '0');
    cam = fit(SIGN.x - 56, SIGN.y - 36, SIGN.x + 60, 380, 2.6);
    q.order = true; mark('order'); ui.sparkle(() => [SIGN.x, SIGN.y]); sfx.chime();
    yield 1.6; hana.talking = true;
    yield* sayLine(hanaHead, 'Şimdi uzaktan bile buranın çay evi olduğu anlaşılıyor. Senin çizginle.');
    yield* chooseSouvenir();
    hana.talking = false; ui.sparkle(null); focusOn = null; mode = 'walk'; cam = null;
    env.tip(q.souvenir === 'water' ? 'Kabı kapının yanına bıraktın. Eve dönerken su doldurabilirsin.' : 'Minder evinde, pencerenin yanında. İlk oturuş senin.', true);
  }

  function* lanternDone(): Scene {
    mode = 'cine';
    q.lantern = true; mark('lantern'); sfx.chime(); haptic(12);
    cam = fit(L.x - 60, L.top - 30, L.x + 60, L.top + 60, 4);
    yield 1.2;
    ui.heart([L.x, L.top - 4]);
    yield 1.0;
    think('Kapımda artık benim fenerim var. Gece yanınca görürüm.', 3.4);
    yield 3.2;
    mode = 'walk'; cam = null;
  }

  function* toyBorn(pts: Vec[], size: number): Scene {
    mode = 'cine'; pad.classList.remove('show'); card.classList.remove('brush-focus'); env.tip(null); ui.hideGesture();
    // the shape you drew, as you drew it, becomes a toy that drops onto the bench
    // your line, eased onto the outline, filled in the toy's colour, with its little details
    const T = TOYS[q.toyKind];
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    toyG.innerHTML = '';
    el('path', { d: 'M' + pts.map((p) => pt([p[0] - cx, p[1] - cy])).join('L') + 'Z', fill: T.c, opacity: 0.9 }, toyG);
    el('path', { d: brush([...pts, pts[0]].map((p) => [p[0] - cx, p[1] - cy] as Vec), 0.9), fill: 'currentColor' }, toyG);
    for (const line of art.toyDrawing) { if (line === pts) continue; el('path', { d: linePath(line.map(p => [p[0] - cx, p[1] - cy] as Vec)), fill: 'none', stroke: 'currentColor', 'stroke-width': .6, 'stroke-linecap': 'round' }, toyG); }
    stroke.clear();
    toyG.setAttribute('transform', '');
    toy.on = true; toy.p = [cx, cy]; toy.v = [0, 0]; toy.rot = 0; toy.w = 0; toy.t = 0; toy.line = pts;
    toy.ground = (cx > BENCH.x0 && cx < BENCH.x1 ? BENCH.y : 352) - Math.min(8, size * 0.3);
    sfx.chime();
    yield 1.0;
    cat.poke(); sfx.pop();
    yield 1.2;
    // the cat bats it about
    for (let k = 0; k < 4; k++) {
      toy.v = [(CAT[0] - toy.p[0] > 0 ? -1 : 1) * (14 + Math.random() * 10) * (k % 2 ? -1 : 1), -26 - Math.random() * 10];
      toy.w = (Math.random() - 0.5) * 400; sfx.tap();
      yield 0.9;
    }
    q.toy = true; mark('toy'); sfx.success();
    ui.heart([CAT[0], CAT[1] - 20]);
    yield 1.4;
    ui.say(catHead, 'Miyav?', 60);
    think('Kedi bana bakıyor…', 2.6);
    const a = yield* choose(['Eve gel, pisi', 'Burada kalsın']);
    if (a === 0) {
      q.catHome = true; home.catHome = true;
      ui.say(catHead, 'Mrrr…', 2);
      yield 1.4;
      cat.g.style.transition = 'opacity 1.2s'; cat.g.style.opacity = '0';
      think('Önden eve doğru koştu. Kapı aralıktı galiba.', 3);
      yield 1.2;
      cat.g.style.display = 'none';
    } else {
      ui.say(catHead, 'Mrr.', 1.2);
      think('Bank ona yakışıyor. Oyuncağı da onda kalsın.', 3);
    }
    yield 2.2;
    mode = 'walk'; cam = null;
  }

  function* readLetter(): Scene {
    letterN.querySelector('.paper')!.innerHTML = hanaLetter;
    letterN.querySelector('button')!.addEventListener('click', () => { letterClosed = true; letterN.classList.remove('show'); });
    mode = 'cine';
    cam = fit(MAIL_X - 50, 260, MAIL_X + 30, 380, 3);
    player.faceTo = -Math.PI / 2;
    yield 0.9;
    mailFlag.setAttribute('d', `M${MB + 14} 319 L${MB + 24} 319 L${MB + 22.4} 325 L${MB + 14} 323`);
    sfx.paper();
    letterClosed = false; letterN.classList.add('show');
    yield () => letterClosed;
    q.letter = true;
    player.faceTo = null;
    think('Panayır… sokağın batı ucunda. Akşam bakarım.', 3);
    env.tip('Panayır sokağın batı ucunda. İstediğin zaman gidebilirsin.');
    yield 1;
    mode = 'walk'; cam = null;
  }

  function* iceboxIn(): Scene {
    mode = 'cook'; obj = null; ui.guide(null); env.tip(null);
    player.faceTo = -Math.PI / 2;
    cam = fit(IX + 330, 270, IX + 380, 350, 4);
    yield .6;
    // a plate in your hands goes onto the dish shelf; a market bundle onto the fresh shelves
    iceboxPlate = home.step === 5;
    const carrying = iceboxPlate ? { pieces: home.plate } : q.basket.length ? { items: [...q.basket] } : undefined;
    icebox.open({ mode: carrying ? 'store' : 'take', pantry: q.pantry, dishes: q.dishes, carrying, wipe: q.iceboxDay !== q.day });
    q.iceboxDay = q.day;
    player.faceTo = null;
  }

  function* cookIn(): Scene {
    mode = 'cook'; obj = null; ui.guide(null); env.tip(null);
    player.faceTo = -0.66;
    cam = fit(IX + 250, 286, IX + 334, 340, 4);
    yield 0.9;
    closeup.setTopping(home.topping);
    closeup.open(Math.min(3, home.step), `${q.day}:${home.made}`);
    player.faceTo = null;
  }

  function* guestArrives(): Scene {
    mode = 'walk';
    guest = createKenta(home.actors, IX + 30, 356); guestAte = 0;
    guest.want.sad = 0; guest.dir = 1; guest.speed = 34;
    guest.g.setAttribute('opacity', '0');
    kenta.g.style.display = 'none'; kite.draw(0, 0, 0, null); // the street Kenta has come over
    yield 0.6;
    guest.g.setAttribute('opacity', '1'); sfx.tap();
    ui.say(guestHead, home.step < 4 ? 'Geldim! Birlikte hazırlarız.' : 'Geldim! Sofraya oturuyorum.');
    home.guestSeat = Math.abs(player.x - IX - SEATS[1]) < Math.abs(player.x - IX - SEATS[0]) ? 0 : 1;
    guest.walkTo(IX + SEATS[home.guestSeat], 358);
    yield () => !guest || !guest.walking;
    if (!guest) return; guest.dir = home.guestSeat === 0 ? 1 : -1; guest.seated = true;
    ui.say(guestHead, 'Itadakimasu!');
  }

  function* chooseEvening(): Scene {
    if (q.day > 1 || q.eveningChoice) return;
    ui.say(playerHead, 'İlk akşamım. Evime küçük bir iz daha bırakabilirim.', 60);
    const a = yield* choose(['Kapımdaki feneri çizeyim.', 'Bu akşam evimde dinleneyim.']);
    q.eveningChoice = a === 0 ? 'lantern' : 'home';
  }
  function afterSupper() {
    focusOn = null; mode = 'walk'; cam = null; objectiveKey = ''; refreshObjective(true);
    if (q.eveningChoice === 'lantern' && !q.lantern) env.tip('Kapındaki boş feneri gözüne kestirdin. Çizgin gece oradan görünecek.', true);
    else env.tip('Sofra toplandı. İstersen evde kal; futon pencerenin solunda.', true);
  }
  function* guestLeaves(): Scene {
    mode = 'cine'; env.tip(null); focusOn = () => guest ? [guest.x, guest.y] : [player.x + 30, player.y];
    cam = fit(IX + 140, 276, IX + 240, 372, 2.6);
    yield* sayLine(guestHead, home.offeredLast ? 'Son parçayı da bana verdin. Bu sofrayı unutmayacağım.' : q.tableDecor ? 'Sofradaki deseni de sen mi çizdin? Benim uçurtmamla aynı evden çıktı!' : 'Uçurtmam da bu akşam da çok güzeldi. Teşekkür ederim.');
    yield* sayLine(guestHead, 'Hana’nın çay tabelası solmuş. Yarın ona uçurtmayı göstereceğim.');
    q.supperTogether = true; q.visit = 'done'; q.sushi = true; mark('sushi');
    yield* chooseEvening();
    yield* sayLine(guestHead, 'Yarın sokakta görüşürüz. İyi geceler!');
    guest!.seated = false; guest!.speed = 36; guest!.walkTo(IX + 30, 356); afterSupper();
    yield () => !guest || !guest.walking;
    guest?.g.remove(); guest = null; home.guestSeat = -1; home.diningGuest = null;
  }

  function* dinnerAlone(): Scene {
    mode = 'cine'; env.tip(null); focusOn = null; cam = fit(IX + 140, 258, IX + 245, 374, 2.5);
    yield* sayLine(playerHead, q.visit === 'missed' ? 'Kenta’yla bu akşam denk gelemedik. Başka bir akşam yine sofra kurulur.' : 'Yeni evimde ilk sofra. Sokaktaki sesler pencereye kadar geliyor.');
    q.supperTogether = false; q.sushi = true; mark('sushi');
    yield* chooseEvening(); afterSupper();
  }

  let stillT = 0, foxSit = 0, foxDone = 0, toldStill = false, insideKey = '', arrived = q.homeSeen, ateSeen = 0, bathSeen = false;
  let alleyTaught = 0, exitTaught = 0, insideT = 0; // 0 not yet · >0 showing until this time · -1 done
  function* foxMoment(): Scene {
    mode = 'cine'; env.tip(null);
    q.fox = true; mark('fox'); sfx.chime(); haptic(12);
    ui.heart([fox.x, fox.y - 26]);
    cam = fit(Math.min(player.x, fox.x) - 50, 290, Math.max(player.x, fox.x) + 50, 380, 2.6);
    yield 3.6;
    fox.leave();
    yield 2.4;
    ui.stillness(null);
    yield* sayLine(playerHead, 'Biraz durunca, buraya kimin uğradığını görüyorsun.');
    mode = 'walk'; cam = null;
    objectiveKey = ''; refreshObjective(true);
  }

  function* sleep(): Scene {
    mode = 'sleep'; env.tip(null); obj = null; focusOn = null; ui.guide(null);
    cam = fit(IX + 80, 290, IX + 172, 372, 3);
    home.beginSleep();
    yield 2.65;
    env.fade(1);
    yield () => env.isFaded();
    let closed = false;
    const today = new Set(q.events.filter(e => e.day === q.day).map(e => e.id));
    const page = { dayN: q.day, entries: entries().filter(e => today.has(e.id)).map(e => ({ ...e, fresh: false })), sentence: daySentence(true) };
    q.history = [...q.history.filter(p => p.dayN !== q.day), page];
    notebook.show({ dayN: q.day, subtitle: 'gün bitti', entries: page.entries, sentence: page.sentence, button: 'Günaydın', seal: sketchOf(art.seal), then: () => { closed = true; } });
    q.fresh.clear();
    yield () => closed;
    q.slept = q.day; q.day++;
    home.newDay(); player.x = IX + 116; player.y = 356; guest?.g.remove(); guest = null; ateSeen = guestAte = 0;
    q.sushi = false; q.reminded = false; q.nightHint = false; insideKey = '';
    const gift = morningGift(q.pantry, q.dishes); q.pantry = gift.pantry; let eggs = gift.gift;
    if ((q.visit === 'planned' || q.visit === 'waiting') && q.invitedDay < q.day) q.visit = 'missed';
    if (q.visit === 'inside') q.visit = 'done';
    q.kentaAway = false; kenta.g.style.display = ''; kenta.walkTo(KENTA_HOME[0], KENTA_HOME[1]);
    player.carryBundle = !home.bagHung;
    env.setTau(0.27);
    cam = null;
    env.fade(0);
    yield 1;
    env.banner(`${q.day}. gün`, 'Mürekkep Sokağı');
    mode = 'walk';
    if (eggs) { eggs = false; yield 3.2; env.tip('Kapının önünde küçük bir sepet: Hana iki yumurta bırakmış. Dolaba koydum.'); }
  }

  // ------------------------------------------------------------------ what the action button offers on the street
  const nearKenta = () => Math.abs(player.x - kenta.x) < 34 && Math.abs(player.y - kenta.y) < 18 && kenta.g.style.display !== 'none';
  const nearLantern = () => Math.abs(player.x - L.x) < 6;
  const nearCat = () => Math.abs(player.x - CAT[0]) < 30 && cat.g.style.display !== 'none';
  function offer(): { label: string; go: () => void } | null {
    if (ctx.fair || (script && blocks)) return null;
    if (ctx.inside) {
      const atTable = Math.abs(player.x - IX - 186) < 35 && player.y < 370;
      if (atTable && q.souvenir === 'cushion' && !q.giftUsed && home.step === 0) return { label: 'Pencerede biraz otur', go: () => run(useGift()) };
      return null;
    }
    const nearCorner = Math.abs(player.x - CORNER[0]) < 49;
    const chapter = nextChapter(q);
    if (chapter === 'sign' && Math.abs(player.x - hana.x) < 36) return { label: 'Hana ile konuş', go: () => run(workshop()) };
    if (chapter === 'shelter' && nearCorner) return { label: q.shelterParts.length ? 'Köşeye devam et' : 'Kuru bir köşe kuralım', go: () => run(neighborhoodProject()) };
    if (chapter === 'chime' && nearCorner) return { label: 'Çanın dilini yenile', go: () => run(makeChime()) };
    if (chapter === 'invitation' && nearCorner) return { label: 'Buluşmayı hazırlayalım', go: () => run(prepareGathering()) };
    if (chapter === 'gather' && nearCorner) return { label: q.festivalMode === 'tea' ? 'Çayları uzat' : 'Fırçaları uzat', go: () => run(gathering()) };
    if (q.souvenir === 'water' && !q.giftUsed && Math.abs(player.x - 490) < 24) return { label: 'Su kabını doldur', go: () => run(useGift()) };
    if (q.chime && Math.abs(player.x - (q.chimePlace === 'corner' ? CORNER[0] + 32 : 468)) < 16) return { label: 'Çanı dinle', go: () => { sfx.chime(); ui.heart([player.x, player.y - 30]); } };
    if (q.visit === 'missed' && !q.missedNote && Math.abs(player.x - MAIL_X) < 18) return { label: 'Kenta’nın notu', go: () => run(missedNote()) };
    if (q.day >= 2 && q.visit === 'missed' && nearKenta()) return { label: 'Başka akşam birlikte?', go: () => run(reinvite()) };
    if (q.day >= 6 && !q.letter && Math.abs(player.x - MAIL_X) < 15) return { label: 'Mektubu al', go: () => run(readLetter()) };
    if (q.kite === 'talked' && nearKenta()) return { label: 'Fırçayı çıkar', go: () => startBrush('kite') };
    if (q.kite === 'done' && !q.lantern && nearLantern()) return { label: 'Fenere bir şey çiz', go: () => startBrush('lantern') };
    if (q.kite === 'done' && !q.toy && nearCat()) return { label: 'Kediye oyuncak çiz', go: () => run(toyPick()) };
    return null;
  }

  let objectiveKey = '';
  function refreshObjective(force = false) {
    if (!ctx || mode !== 'walk' || (script && !force)) return;
    const chapter = nextChapter(q), key = [q.day, chapter, ctx.inside, q.giftUsed, q.lantern, q.eveningChoice].join(':');
    if (key === objectiveKey) return;
    objectiveKey = key;
    if (chapter === 'kite') setObj(kentaHead, nearKenta, false);
    else if (chapter === 'supper') { if (!ctx.inside) toDoor(); }
    else if (chapter === 'sign') setObj(hanaHead, () => !ctx.inside && Math.abs(player.x - hana.x) < 32, false);
    else if (['shelter', 'chime', 'invitation', 'gather'].includes(chapter)) setObj(() => [CORNER[0], 304], () => !ctx.inside && Math.abs(player.x - CORNER[0]) < 36, false);
    else if (q.eveningChoice === 'lantern' && !q.lantern) setObj(() => [L.x, L.cy], nearLantern, false);
    else if (q.souvenir && !q.giftUsed) {
      if (q.souvenir === 'water') setObj(() => [490, 336], () => !ctx.inside && Math.abs(player.x - 490) < 24, false);
      else if (ctx.inside) setObj(() => [IX + 186, 304], () => Math.abs(player.x - IX - 186) < 30, true);
      else toDoor();
    } else if (ctx.inside) setObj(() => [IX + 116, 336], () => Math.abs(player.x - IX - 116) < 20, true);
    else toDoor();
  }
  function contextDirection() {
    const chapter = nextChapter(q);
    if (chapter === 'kite') return q.met ? 'Kenta kiraz ağacının altında, uçurtmasını bekliyor.' : 'Kenta kiraz ağacının altında. Uçurtması kaçtı.';
    if (chapter === 'sign') return 'Hana çay evinde. Dünkü uçurtmanı duymuş.';
    if (chapter === 'shelter') return 'Hana ile Kenta bankın yanında, yağmurdan kaçıyor.';
    if (chapter === 'chime') return 'Çan, dün kurduğun köşede.';
    if (chapter === 'invitation' || chapter === 'gather') return 'Komşular senin köşende buluşuyor.';
    if (q.eveningChoice === 'lantern' && !q.lantern) return 'Boş fener evinin kapısında.';
    if (q.souvenir && !q.giftUsed) return q.souvenir === 'water' ? 'Su kabı kapının yanında.' : 'Minder evde, pencerenin yanında.';
    return ctx.inside ? 'Futon pencerenin solunda. Gece olunca dinlenebilirsin.' : 'Evin taşlı ara sokağın sonunda.';
  }


  let guideUntil = 0;
  const help = document.createElement('div'); help.className = 'street-guide'; help.setAttribute('role', 'button'); help.tabIndex = 0;
  help.setAttribute('aria-label', 'Turna: yol göster');
  help.innerHTML = '<span class="guide-caption" hidden></span>';
  card.appendChild(help);
  const caption = help.querySelector('.guide-caption') as HTMLElement;
  function guideCaption(text: string | null) {
    if (mode === 'intro') { caption.hidden = !text; caption.textContent = text ?? ''; }
    else { caption.hidden = true; ui.hint(playerHead, text, !q.walkLearned); }
  }
  help.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); help.click(); } });
  help.addEventListener('click', () => {
    if (mode !== 'walk' || notebook.isOpen || !ui.companionDocked) return;
    if(env.localGuide?.()){sfx.paper();return;}
    if (obj && ctx.inside && !obj.inside) { ui.guide(() => [IX + 40, 322]); guideUntil = ctx.t + 5; guideCaption('Kapıdan çıkalım. Sonra sokaktaki hedefe bakarız.'); }
    else if (obj && obj.inside === ctx.inside && !ctx.fair) { ui.guide(obj.at); guideUntil = ctx.t + 5; guideCaption(ctx.inside && nextChapter(q) === 'supper' ? 'Mutfakta sıradaki yere bakalım.' : contextDirection()); }
    else guideCaption(contextDirection());
    sfx.paper();
  });
  function* missedNote(): Scene {
    mode = 'cine'; q.missedNote = true;
    letterN.querySelector('.paper')!.innerHTML = `<p class="to">Kapını çaldım, seni bulamadım.</p><p>Uçurtma hâlâ çok güzel uçuyor. Başka akşam birlikte yeriz.</p><p class="from">— Kenta</p><button type="button">Cebime koy</button>`;
    letterClosed = false;
    letterN.querySelector('button')!.addEventListener('click', () => { letterClosed = true; letterN.classList.remove('show'); });
    letterN.classList.add('show'); yield () => letterClosed;
    mode = 'walk';
  }
  function* reinvite(): Scene {
    mode = 'cine'; ui.say(kentaHead, 'Bu akşam bir daha deneyelim mi?', 60);
    const a = yield* choose(['Akşam bekliyorum.', 'Bugün dolaşacağım.']);
    if (a === 0) { q.visit = 'planned'; q.dinner = 'kenta'; q.invitedDay = ctx.tau >= .7 ? q.day + 1 : q.day; q.reminded = false; ui.say(kentaHead, q.invitedDay > q.day ? 'Yarın gün batınca kapındayım!' : 'Gün batınca kapındayım!', 2); yield 2; }
    mode = 'walk';
  }
  function* secondMorning(): Scene {
    mode = 'cine'; q.dayIntro = q.day; q.day2Seen = q.day >= 2; q.day3Seen = q.day >= 3;
    env.tip(null); focusOn = null;
    const chapter = nextChapter(q);
    if (chapter === 'sign') {
      yield* sayLine(playerHead, q.supperTogether ? 'Kenta küçük bir teşekkür bırakmış. Dünkü uçurtmanın resmi de yanında.' : 'Dünkü uçurtmanın küçük bir resmi kapıya bırakılmış. Kenta’dan.');
      yield* sayLine(playerHead, 'Arkasında bir not: “Hana seninle tanışmak istiyor. Çay evinde.”');
    } else if (chapter === 'shelter') {
      yield* sayLine(playerHead, 'Yağmur başlamış. Dün seçtiğim köşe artık daha da güzel geliyor.');
      yield* sayLine(playerHead, q.catHome ? 'Kedi evde kıvrılmış. Hana dışarıdaki bankı kurutmaya çalışıyor.' : 'Hana örtüleri topluyor. Banktaki kedi de kuru bir yer arıyor.');
    } else if (chapter === 'chime') {
      yield* sayLine(playerHead, 'Yağmur dinmiş. Dün gerdiğimiz örtü rüzgârda kıpırdıyor.');
      yield* sayLine(playerHead, 'Kenta köşede bir çan bulmuş; kâğıt dili kopmuş. Beni bekliyor.');
    } else if (chapter === 'invitation') {
      yield* sayLine(playerHead, 'Hana birkaç fincan, Kenta da kâğıt getirmiş. Bugün bizim köşede buluşacaklarmış.');
    } else {
      yield* sayLine(playerHead, 'Çizgilerim yerli yerinde. Bugün mahallede acele edecek bir şey yok.');
    }
    mode = 'walk'; cam = null; objectiveKey = ''; refreshObjective(true);
  }

  function* chooseSouvenir(): Scene {
    if (q.souvenir) return;
    ui.say(hanaHead, 'Bu da benden. Evine hangisi yakışır?', 60);
    const a = yield* choose(['Pencere minderi', 'Kuşlar için su kabı']);
    q.souvenir = a === 0 ? 'cushion' : 'water'; mark('gift');
    yield* sayLine(hanaHead, a === 0 ? q.day === 2 ? 'Pencereden sokağı dinlemek için. Yarın yağmur diyorlar.' : 'Böyle havada pencerenin yanında oturmak da güzel.' : q.day === 2 ? 'Kuşlar kapını öğrenir artık. Yarın yağmurdan önce bir doldur.' : 'Kuşlar kapını öğrenir artık. Yağmurda da uğrarlar.');
  }

  function* useGift(): Scene {
    mode = 'cine'; env.tip(null);
    if (q.souvenir === 'water') {
      cam = fit(456, 302, 526, 378, 2.8); sfx.stir(2); yield .8; q.giftUsed = true;
      yield* sayLine(playerHead, 'Su tamam. İlk misafir kapıyı çalmadan geldi bile.');
    } else {
      home.windowOpen = true; seated = true; cam = fit(IX + 142, 260, IX + 227, 367, 2.6);
      yield* sayLine(playerHead, 'Minder tam buraya göre. Çay evindeki tabelam da pencereden görünüyor.');
      q.giftUsed = true;
    }
    mark('gift'); seated = false; mode = 'walk'; cam = null;
    env.tip('Bugünün çizgisi sokakta kaldı. Akşam evinde dinlenebilirsin.');
  }

  function* neighborhoodProject(): Scene {
    mode = 'cine'; obj = null; ui.guide(null); env.tip(null); focusOn = () => [kenta.x, kenta.y];
    cam = fit(CORNER[0] - 70, 260, CORNER[0] + 62, 383, 2.3);
    if (!q.projectPlan) {
      yield* sayLine(kentaHead, q.catHome ? 'Hana’nın bankı sırılsıklam oluyor. Serçeler de yağmurdan kaçıyor.' : 'Hana’nın bankı yağmurda sırılsıklam oluyor. Pisi de altına sığamıyor.');
      yield* sayLine(hanaHead, 'Bir örtü ve iki direk buldum. Burayı birlikte kullansak?');
      const a = yield* choose(['Yağmurda çay içilecek bir köşe.', 'Patiler için kuru bir köşe.']);
      q.projectPlan = a === 0 ? 'tea' : 'paws';
    }
    let built = false; mode = 'craft';
    handwork.open('shelter', { restored: q.shelterParts, onPlaced: ids => { q.shelterParts = ids; }, then: () => { built = true; } });
    yield () => built;
    mode = 'cine'; let drawn = false;
    drawOnPaper({ kicker: q.projectPlan === 'tea' ? 'Birlikte çay içilecek bir yer.' : 'Yağmurdan kaçan patilere.', title: q.projectPlan === 'tea' ? 'Örtüye dalgalar.' : 'Örtüye bir pati.', tip: 'Soluk çizgilerin üstünden geç. Desenin örtüye aynen geçecek.', trace: (q.projectPlan === 'tea' ? MOTIFS.waves : MOTIFS.paw).strokes, done: 'Örtüyü gerelim', then: lines => { art.project = lines; drawn = true; } });
    yield () => drawn;
    q.project = q.projectPlan; q.projectDay = q.day; mark('project'); sfx.success(); drawnProject = ''; mode = 'cine'; focusOn = () => [hana.x, hana.y];
    yield* sayLine(hanaHead, q.project === 'tea' ? 'İlk fincanı buraya koydum. Yağmurun altında üşümeden oturabileceğiz.' : 'Kuru minderler de burada. Bir tek “miyav” yazımız eksik.');
    ui.heart([CAT[0], CAT[1] - 20]); cat.poke();
    yield* sayLine(kentaHead, 'Daha dün boştu burası. Şimdi senin desenin var.');
    focusOn = null; mode = 'walk'; cam = null; objectiveKey = '';
    env.tip('Örtünün altında kalıp yağmuru dinleyebilir, sonra evine dönebilirsin.', true);
  }

  function* makeChime(): Scene {
    mode = 'cine'; env.tip(null); obj = null; focusOn = () => [kenta.x, kenta.y];
    cam = fit(CORNER[0] - 65, 260, CORNER[0] + 62, 380, 2.3);
    if (!q.chimePlace) {
      yield* sayLine(kentaHead, 'Şu çan örtünün altında kalmış. Camı sağlam, kâğıt dili kopmuş.');
      yield* sayLine(hanaHead, 'Rüzgârı duyabilmesi için ona yeni bir dil çizelim. Nerede çalsın?');
      const a = yield* choose(['Evimin kapısında.', 'Hepimizin köşesinde.']);
      q.chimePlace = a === 0 ? 'home' : 'corner';
    }
    if (!art.chime.length) {
      let drawn = false;
      drawOnPaper({ kicker: 'Rüzgârın götürdüğüne yeni bir çizgi.', title: 'Çanın kâğıt dili: bir japon balığı.', tip: 'Soluk çizginin üstünden geç. Rüzgârda o yüzecek.', trace: MOTIFS.goldfish.strokes, done: 'İpine bağlayalım', then: lines => { art.chime = lines; drawn = true; } });
      yield () => drawn;
    }
    let tied = false; mode = 'craft';
    const preview = fitDrawing(art.chime, 0, 0, 27).map(l => `<path d="${linePath(l)}" fill="none" stroke="#b65042" stroke-width="1.3"/>`).join('');
    handwork.open('chime', { preview, then: () => { tied = true; } }); yield () => tied;
    q.chime = q.keepsake = q.chimeTied = true; mark('chime'); mode = 'cine'; sfx.chime();
    yield* sayLine(kentaHead, q.chimePlace === 'home' ? 'Rüzgâr geçince senin kapın cevap verecek.' : 'Buraya gelen herkes senin çanını duyacak.');
    yield* sayLine(hanaHead, 'Yağmurda küçük ayak izleri de kalmış. Köşede otururken belki sahibini görürsün.');
    focusOn = null; mode = 'walk'; cam = null; objectiveKey = '';
    env.tip(q.chimePlace === 'home' ? 'Çanın kapında. Dokunup sesini dinleyebilirsin.' : 'Çanın örtünün yanında. Rüzgâr geldikçe çalacak.', true);
  }

  function* prepareGathering(): Scene {
    mode = 'cine'; env.tip(null); focusOn = () => [hana.x, hana.y];
    yield* sayLine(hanaHead, 'Bu köşeye artık herkes uğruyor. Bugün biraz birlikte kalsak?');
    yield* sayLine(kentaHead, 'Uçurtmamı da getirdim! Sen buluşmanın işaretini çiz.');
    const a = yield* choose(['Açık bir çay sofrası.', 'Sessiz bir çizim buluşması.']);
    q.festivalMode = a === 0 ? 'tea' : 'drawing'; let drawn = false;
    drawOnPaper({ kicker: 'Mahallenin yeni buluşma yeri.', title: q.festivalMode === 'tea' ? 'Flamaya bir fincan.' : 'Flamaya bir ensō.', tip: 'Soluk çizginin üstünden geç. Flamada önceki çizgilerinin yanında olacak.', trace: (q.festivalMode === 'tea' ? MOTIFS.teacup : MOTIFS.enso).strokes, done: 'Köşeye asalım', then: lines => { art.invitation = lines; q.festivalArt = true; drawn = true; } });
    yield () => drawn;
    mark('invitation'); drawnProject = ''; mode = 'cine';
    yield* sayLine(hanaHead, q.festivalMode === 'tea' ? 'Fincanlar hazır. Birer tane uzatır mısın?' : 'Kâğıtları serdim. Fırçaları da sen uzat.');
    mode = 'walk'; focusOn = null; cam = null; objectiveKey = '';
    env.tip(q.festivalMode === 'tea' ? 'Sofra burada. Komşulara çay uzatabilirsin.' : 'Herkes yerleşti. Fırçaları uzatalım.', true);
  }

  function* gathering(): Scene {
    mode = 'craft'; env.tip(null); obj = null; let served = false;
    handwork.open(q.festivalMode, { restored: q.servedParts, onPlaced: ids => { q.servedParts = ids; }, then: () => { served = true; } }); yield () => served;
    mode = 'cine'; focusOn = () => [hana.x, hana.y];
    q.gathering = true; mark('gathering');
    cam = fit(CORNER[0] - 72, 255, CORNER[0] + 72, 385, 2.2);
    yield* sayLine(kentaHead, 'İlk gün bana bir uçurtma çizmiştin. Bak şimdi neler oldu.');
    yield* sayLine(hanaHead, q.chimePlace === 'home' ? 'Kapındaki çan, tabelam, bu örtü… Evinle sokak birbirine karıştı.' : q.project === 'tea' ? 'Tabelam, bu örtü, şu çan… Sokağın her köşesinde senden bir çizgi var.' : 'Kuru patiler, tabelam, şu çan… Küçük şeyler birikip bir yer oluyor.');
    ui.say(hanaHead, 'Buluşmadan bir hatıra nereye kalsın?', 60);
    const a = yield* choose(['Evime alayım.', 'Köşede, hepimizde kalsın.']);
    q.tookMemento = a === 0;
    yield* sayLine(playerHead, a === 0 ? 'Eve götürdüğüm küçük bir mahalle.' : 'Yarın gelen de bizim çizgilerimizi görecek.');
    mode = 'walk'; cam = null; focusOn = null; objectiveKey = '';
    env.tip('Bu köşe yarın da burada. Evde defterine bugünü bırakabilirsin.', true);
  }

  const personal = el('g', { transform: `translate(${IX + 90} 278) scale(.14)`, 'pointer-events': 'none' }, home.root);
  personal.innerHTML = `<rect x="-3" y="-3" width="246" height="266" fill="#fdf7e8" stroke="#5d4e39" stroke-width="5"/>${art.portrait.map(l => `<path d="${linePath(l)}" fill="none" stroke="#443c30" stroke-width="3"/>`).join('')}`;
  const thanks = el('g', { transform: `translate(169 334) rotate(-8) scale(.65 .22)`, 'data-thanks-card': '' }, home.surfaces);
  thanks.innerHTML = `<path d="M-12 -9H12V7H-12Z" fill="#fff6df" stroke="currentColor" stroke-width=".5"/>${fitDrawing([kiteLine], 0, -1, 12).map(l => `<path d="${linePath(l, true)}" fill="none" stroke="#bd5143" stroke-width=".65"/>`).join('')}`;
  let thanksDrawn = kiteLine.length > 0;
  const doorSeal = el('path', { fill: 'none', stroke: '#b8483d', 'stroke-width': .7, transform: `translate(${PLATE[0]} ${PLATE[1]})` }, homeFront);
  const cushion = el('g', { transform: `translate(${IX + 185} 351)`, 'data-gift': 'cushion' }, home.root);
  cushion.innerHTML = '<path d="M-20 -3Q0 -10 20 -3L18 5Q0 9 -18 5Z" fill="#b54d42" stroke="currentColor" stroke-width=".8"/><path d="M-10 -1Q0 3 10 -1" fill="none" stroke="#e4c8a8" stroke-width=".7"/>';
  const bowl = el('g', { transform: 'translate(490 346)', 'data-gift': 'water' }, layers.front);
  bowl.innerHTML = '<path d="M-9 -3Q0 8 9 -3Z" fill="#c9b59b" stroke="currentColor" stroke-width=".7"/><ellipse cx="0" cy="-3" rx="9" ry="2.7" fill="#eee2cc" stroke="currentColor" stroke-width=".6"/>';
  const bowlWater = bowl.querySelector('ellipse')!;
  const bowlBird = el('g', { opacity: 0 }, bowl);
  bowlBird.innerHTML = '<path d="M7 -8q5 -7 10 -1l3 0-3 2q-2 5-8 2ZM13 -3v5m3-6v6" fill="#e4d7b6" stroke="currentColor" stroke-width=".5"/>';
  const bell = el('g', { transform: 'translate(468 266)', 'data-wind-chime': '', style: 'cursor:pointer' }, layers.front);
  bell.innerHTML = '<path d="M0 -8V0M-4 7Q-5 -1 0 -1Q5 -1 4 7Z" fill="#d0d6c4" stroke="currentColor" stroke-width=".6"/><path d="M0 6V19l4 1v12l-8 -1V19Z" fill="#f4e7c9" stroke="currentColor" stroke-width=".5"/><g data-chime-art></g><rect x="-12" y="-12" width="24" height="48" fill="transparent"/>';
  let bellImpulse = 0;
  bell.addEventListener('pointerdown', e => { e.stopPropagation(); if (q.chime) { bellImpulse = 1; sfx.chime(); } });
  const rain = el('path', { fill: 'none', stroke: '#6d8d98', 'stroke-width': .5, opacity: .3, 'pointer-events': 'none', 'data-rain': '' }, layers.front);
  const roofDrips = el('path', { fill: 'none', stroke: '#719591', 'stroke-width': .6, opacity: .55 }, layers.front);
  const puddle = el('g', { style: 'cursor:pointer' }, layers.front);
  puddle.innerHTML = '<ellipse cx="660" cy="379" rx="19" ry="3" fill="#b9d6db" opacity=".38"/><ellipse cx="660" cy="379" rx="10" ry="1.5" fill="none" stroke="#72929c" stroke-width=".5"/>';
  puddle.addEventListener('pointerdown', () => { ui.heart([660, 375]); sfx.tap(); });
  const tracks = el('path', { d: [0,1,2,3,4].map(i => `M${806-i*12} ${371+(i%2)*3}a1.2 1 0 1 0 .1 0m-1-2l.2-.2m1-.2l.2-.2`).join(' '), fill: 'none', stroke: '#78624e', 'stroke-width': .6, opacity: .45, 'data-paw-tracks': '' }, layers.front);
  const projectG = el('g', { transform: `translate(${CORNER[0]} 0)`, 'data-neighborhood': 'corner' }, layers.front);
  const projectInk = el('g', {}, projectG);
  const memento = el('g', { transform: `translate(${IX + 210} 285)`, 'data-home-memory': '' }, home.root);
  const neighbors = [createResident(layers.walkers, 'Yui', CORNER[0] - 26, 365, '#727e60')];
  neighbors.forEach(n => { n.visible = false; });
  let drawnProject = '', drawnChime = '', portraitDrawn = q.created, bellT = 0;
  function drawNeighborhood(c: Ctx) {
    thanks.style.display = q.day >= 2 ? '' : 'none';
    if (!thanksDrawn && kiteLine.length) {
      thanksDrawn = true;
      fitDrawing([kiteLine], 0, -1, 12).forEach(l => el('path', { d: linePath(l, true), fill: 'none', stroke: '#bd5143', 'stroke-width': .65 }, thanks));
    }
    const wet = q.day >= 3 && (!q.project || q.projectDay === q.day && c.tau < .74) && !c.inside && !c.fair;
    rain.style.display = puddle.style.display = roofDrips.style.display = wet ? '' : 'none';
    if (wet) {
      const drops: string[] = [];
      for (let i = 0; i < 60; i++) {
        const x = (i * 83.7 + c.t * 17) % 960, y = 150 + (i * 41 + c.t * 95) % 240;
        if (q.project && x > CORNER[0] - 53 && x < CORNER[0] + 53 && y > 291 && y < 356) continue;
        drops.push(`M${f(x)} ${f(y)}l-2 7`);
      }
      rain.setAttribute('d', drops.join(' '));
      roofDrips.setAttribute('d', q.project ? [-1,1].map(side => `M${CORNER[0]+side*54} ${f(292+(c.t*21)%38)}l-1 3`).join(' ') : '');
    }
    tracks.style.display = q.day >= 4 && !q.fox && q.project ? '' : 'none';
    hana.visible = q.day >= 2 && !c.fair;
    const atCorner = q.day >= 3 && q.order;
    if (!script && atCorner && !guest && !departing && q.visit !== 'waiting') {
      kenta.g.style.display = ''; kenta.walkTo(CORNER[0] + 38, 357); kenta.want.wave = 0;
      kenta.want.raise = q.day >= 5 ? .65 : 0;
    }
    if (!script) hana.walkTo(atCorner ? CORNER[0] - 16 : HANA[0], atCorner ? 356 : HANA[1]);
    hana.faceTarget = !c.inside && Math.abs(player.x - hana.x) < 100 ? player.x : null;
    hana.draw(c.t, c.dt);
    neighbors.forEach(n => { n.visible = q.festivalArt && !c.fair && !c.inside; n.faceTarget = player.x; n.draw(c.t, c.dt); });
    memento.style.display = q.gathering && q.tookMemento ? '' : 'none';
    cushion.style.display = q.souvenir === 'cushion' ? '' : 'none'; bowl.style.display = q.souvenir === 'water' ? '' : 'none';
    bowlWater.setAttribute('fill', q.giftUsed ? '#b7d2d1' : '#eee2cc');
    bowlBird.setAttribute('opacity', q.giftUsed ? '1' : '0');
    bowlBird.setAttribute('transform', `rotate(${f(q.giftUsed ? Math.sin(c.t * 1.4) * 6 : 0)} 12 -5)`);
    const bx = q.chimePlace === 'corner' ? CORNER[0] + 32 : 468, by = q.chimePlace === 'corner' ? 292 : 266;
    bell.style.display = q.chime ? '' : 'none'; bell.setAttribute('data-place', q.chimePlace);
    bellImpulse = Math.max(0, bellImpulse - c.dt * .6);
    bell.setAttribute('transform', `translate(${bx} ${by}) rotate(${f(Math.sin(c.t * 2.8) * (c.wind * 4 + bellImpulse * 17))})`);
    bellT += c.dt;
    if (q.chime && !c.inside && !c.fair && Math.abs(player.x - bx) < 70 && bellT > 15 && mode === 'walk') { bellT = 0; sfx.chime(); }
    if (drawnChime !== JSON.stringify(art.chime)) {
      drawnChime = JSON.stringify(art.chime);
      bell.querySelector('[data-chime-art]')!.innerHTML = fitDrawing(art.chime, 0, 25, 7).map(l => `<path d="${linePath(l)}" fill="none" stroke="#b65042" stroke-width=".45"/>`).join('');
    }
    doorSeal.setAttribute('d', fitDrawing(art.seal, 0, 0, 6).map(l => linePath(l)).join(' '));
    personal.style.display = art.portrait.length ? '' : 'none';
    if (!portraitDrawn && q.created) { portraitDrawn = true; personal.innerHTML += art.portrait.map(l => `<path d="${linePath(l)}" fill="none" stroke="#443c30" stroke-width="3"/>`).join(''); }
    const projectKey = [q.project, q.festivalArt, q.gathering, q.tookMemento, art.project.length, art.invitation.length].join(':');
    if (q.project && drawnProject !== projectKey) {
      drawnProject = projectKey;
      const tea = q.project === 'tea';
      projectInk.innerHTML = '<path d="M-50 285V352M50 285V352" fill="none" stroke="#9a7854" stroke-width="3"/><path d="M-57 291L-44 271H44L57 291Q28 287 0 292Q-28 287-57 291Z" fill="#e9d7b5" stroke="currentColor" stroke-width=".8"/>';
      const pattern = el('g', { transform: 'translate(0 281) scale(1 .18)', 'data-awning-art': '' }, projectInk);
      fitDrawing(art.project, 0, 0, 74).forEach(l => el('path', { d: linePath(l), fill: 'none', stroke: '#ae5042', 'stroke-width': 1.5 }, pattern));
      if (tea) projectInk.innerHTML += '<path d="M-27 343H27L25 349H-25ZM-23 349V360M23 349V360" fill="#b99369" stroke="currentColor" stroke-width=".8"/><path d="M-18 338v-5h5v5q-2 3-5 0m31 0v-5h5v5q-2 3-5 0" fill="#e1c99c" stroke="currentColor" stroke-width=".7"/>';
      else projectInk.innerHTML += '<path d="M-43 337Q-25 329-7 337L-5 343H-45ZM6 337Q24 329 42 337L44 343H4Z" fill="#b66a54" stroke="currentColor" stroke-width=".7"/><path d="M15 348q7 8 14 0Z" fill="#d5c4a4" stroke="currentColor" stroke-width=".6"/>';
      if (q.festivalArt) {
        projectInk.innerHTML += '<path d="M-51 299Q0 310 51 299" fill="none" stroke="currentColor" stroke-width=".6"/>';
        const collection = [[kiteLine], art.invitation, art.project];
        [-32,0,32].forEach((x, i) => {
          el('path', { d: `M${x-11} 302h22v22l-11-4-11 4Z`, fill: '#fff5df', stroke: 'currentColor', 'stroke-width': .5 }, projectInk);
          fitDrawing(collection[i], x, 311, 14).forEach(l => el('path', { d: linePath(l), fill: 'none', stroke: '#ad4c40', 'stroke-width': .6, 'data-gathering-art': i }, projectInk));
        });
      }
      memento.innerHTML = '<path d="M-14 -12H14V14H-14Z" fill="#fff5df" stroke="currentColor" stroke-width=".7"/><path d="M-4 -12V-16H4V-12" fill="none" stroke="currentColor" stroke-width=".6"/>';
      fitDrawing(art.invitation, 0, 0, 20).forEach(l => el('path', { d: linePath(l), fill: 'none', stroke: '#ad4c40', 'stroke-width': .8 }, memento));
    }
    projectG.style.display = q.project ? '' : 'none';
  }

  // ------------------------------------------------------------------ api
  if (q.kite === 'done' && !q.guideMet) q.guideMet = craneOut = true;
  if (!q.created || !q.walkLearned) run(intro(), false);
  else { mode = 'walk'; if (q.kite !== 'done') setObj(kentaHead, () => nearKenta(), false); }
  refreshDots();
  return {
    /** a scene is playing on the street: nobody else should wander through it */
    get hush() { return mode === 'cine' || mode === 'alley' || mode === 'brush' && purpose === 'kite' || q.homeShown && !alley.built || !q.met && q.walkLearned; },
    get freeze() { return mode !== 'walk' || notebook.isOpen || paper.isOpen || !!env.localModal?.(); },
    get clockRate() {
      const base = timeRate(mode, q.day, q.kite === 'done', notebook.isOpen || paper.isOpen || handwork.isOpen || !!env.localModal?.());
      // Completed work lets the light drift into evening; there is no skip-time menu.
      if(ctx?.fair) return base;
      const target = eveningTarget(q, home.step === 6, q.dinner === 'kenta' && ['planned', 'waiting'].includes(q.visit));
      // The quiet afternoon may pass quickly, but the light never hurries: the drift slows down
      // smoothly through late afternoon and is back to normal by 16:48, so dusk, sunset and the
      // evening (17:00 onwards) always run at the ordinary pace (one game hour ≈ 37 s).
      const stop = Math.min(target, .70), k = q.day === 1 ? home.step === 6 && !q.sushi ? 18 : 12 : 24;
      if (base !== 1 || !ctx || ctx.tau >= stop) return base;
      return 1 + (k - 1) * Math.min(1, (stop - ctx.tau) / .04);
    },
    get canSnapshot() { return q.created && q.walkLearned && !notebook.isOpen && !home.busy && (mode === 'walk' && !script || handwork.isOpen || paper.isOpen || closeup.isOpen); },
    get canSave() { return q.created && q.walkLearned && mode === 'walk' && !script && !paper.isOpen && !home.busy; },
    snapshot() { return { story: { ...q, fresh: [...q.fresh] }, art: { ...art, kite: kiteLine, lantern: lanternLines, toy: toy.line, cooking: closeup.snapshot() } }; },
    get cam() { return cam; },
    get sitting() { return seated ? 1 : 0; },
    get facing() { if (mode === 'alley') return Math.atan2((292 - STAND[1]) * .6, DOOR_X - STAND[0]); if (!focusOn) return null; const p = focusOn(); return Math.atan2((p[1] - player.y) * .6, p[0] - player.x); },
    get mode() { return mode; },
    get closeupOpen() { return closeup.isOpen; },
    /** what the action button says, if the story has something to offer */
    prompt(): string | null {
      if (paper.isOpen || notebook.isOpen) return '';
      // the kite is a promise to a friend: there is no giving up on it, only drawing
      if (mode === 'brush') return purpose === 'kite' ? '' : purpose === 'lantern' && lanternStrokes > 0 ? 'Bitti' : 'Vazgeç';
      if (mode !== 'walk') return '';
      return offer()?.label ?? null;
    },
    act(): boolean {
      if (paper.isOpen || notebook.isOpen) return true;
      if (mode === 'brush') { if (purpose !== 'kite') endBrush(); return true; }
      if (mode !== 'walk') return true;
      const o2 = offer();
      if (o2) { sfx.tap(); o2.go(); return true; }
      return false;
    },
    opened(name = '') { q.name = name.trim().slice(0, 14); sfx.paper(); setTimeout(() => sfx.chime(), 500); },
    /** first steps into the fair */
    onFair() {
      q.fair = true; mark('fair');
      setTimeout(() => env.banner('Yaz Panayırı', 'Fenerler, davul, takoyaki kokusu…'), 900);
    },
    /** the home asks the story to take over */
    /** the market's greengrocer stall asks the story to open */
    shop() {
      if (mode !== 'walk') return;
      if (q.basket.length) { env.tip('Elinde hâlâ bir bohça var. Önce eve, dolaba.'); return; }
      mode = 'cook'; ui.hint(playerHead, null); grocer.open(q.pantry, q.shopping as Item[]);
    },
    get carryingGroceries() { return q.basket.length > 0; },
    onHome(what: 'cook' | 'sleep' | 'icebox') { if (what === 'cook') run(cookIn()); else if (what === 'icebox') run(iceboxIn()); else run(sleep()); },
    onMemory(id:string){mark(id);},
    get canVisitFair() { return q.day >= 6 || q.gathering; },
    sortables(): { g: SVGGElement; y: number }[] { return ctx && !ctx.inside && !ctx.fair ? [kenta, hana, fox, ...neighbors].filter((c) => c.g.style.display !== 'none') : []; },

    update(c: Ctx) {
      ctx = c;
      const { t, dt, P, wind } = c;
      card.classList.toggle('modal-open', paper.isOpen || notebook.isOpen || mode === 'desk' || mode === 'craft' || closeup.isOpen || icebox.isOpen || grocer.isOpen || !!env.localModal?.());
      syncControls();
      if (guideUntil > 0 && t > guideUntil) { ui.guide(null); guideCaption(null); guideUntil = 0; }
      ui.companionVisible(craneOut && env.isOpened() && !arrival.classList.contains('show') && !paper.isOpen && !notebook.isOpen && !closeup.isOpen && !icebox.isOpen && !grocer.isOpen && !env.localModal?.() && mode !== 'desk' && mode !== 'craft' && mode !== 'brush');
      help.hidden = !env.isOpened() || !q.guideMet || mode !== 'walk' || !ui.companionDocked || !!env.localModal?.();
      // you never walk past Kenta before you have met: you stop at his left and the kite scene begins
      if (!q.met && q.kite === 'sad' && !c.inside && !c.fair && kenta.g.style.display !== 'none' && player.x > kenta.x - 120 && player.x < kenta.x + 40) player.x = Math.min(player.x, kenta.x - MEET_GAP);
      if (mode === 'walk' && (!script || !blocks) && q.walkLearned && !q.met && !c.inside && !c.fair && player.x > kenta.x - MEET_GAP - 14 && player.x < kenta.x + 40) run(talk());
      refreshObjective();
      if (q.day >= 2 && q.dayIntro < q.day && mode === 'walk' && !script && !c.fair) run(secondMorning());
      if (script) { if (waitFn) { if (waitFn()) { waitFn = null; advance(); } } else { waitT -= dt; if (waitT <= 0) advance(); } }
      // the stepping stones: the ring, the step onto each pressed stone, the notes on the way home
      alley.update(t, dt);
      if (meetStep) { player.x = approach(player.x, kenta.x - MEET_GAP, 5, dt); player.y = approach(player.y, kenta.y + 6, 5, dt); }
      const hold = mode === 'alley' ? STAND : alley.hold;
      if (hold && !c.inside && !c.fair) { player.x = approach(player.x, hold[0], 6, dt); player.y = approach(player.y, hold[1], 6, dt); }
      if (!c.inside && !c.fair) alley.stepOn(player.y, alleyY || player.y);
      alleyY = c.inside || c.fair ? 0 : player.y;
      if (!c.inside && !c.fair) alley.gate(player.y, dt, P.lamp);
      if (c.inside) alley.openGate();
      if (!alley.built && mode === 'walk' && !script && q.homeShown && !c.inside && !c.fair && atStand()) run(buildAlley());

      if (!q.met && q.kite === 'sad' && Math.abs(player.x - kenta.x) < 145 && !c.inside) stuck.release();
      // Kenta takes the actual kite away; he returns on a later day or for dinner.
      if (q.visit === 'waiting') kenta.g.style.display = '';
      if (kenta.g.style.display !== 'none') {
        if (mode === 'walk' && q.day < 3 && !script && !departing && q.visit !== 'waiting' && q.kite === 'done' && !kenta.walking && Math.random() < dt * .2) kenta.walkTo(265 + Math.random() * 45, 353 + Math.random() * 8);
        kenta.speed = departing ? 58 : q.day >= 3 ? 32 : q.kite === 'done' ? 14 : 20;
        if (departing && t > nextHop) { nextHop = t + .58; kenta.hop(); }
        if (departing && (kenta.x > 590 || kenta.x > player.x + 260)) { departing = false; q.kentaAway = true; kenta.g.style.display = 'none'; }
        kenta.faceTarget = !departing && (q.kite !== 'done' || !!focusOn) ? player.x : null;
        kenta.want.talk = !departing && focusOn && !c.inside ? 1 : 0;
        kenta.draw(t, dt, P);
        if (q.visit === 'waiting') { kenta.walkTo(DOOR_X, 347); kenta.want.wave = .4; }
        else if ((q.kentaAway && q.day === 1) || (P.night > .5 && q.kite === 'done' && mode === 'walk')) kenta.g.style.display = 'none';
      }
      if (c.inside && !q.visitedHome) { q.visitedHome = true; env.tip(null); }
      // the seal over the gate: stamped when the alley is first shown, there until you have been home
      const sealOn = q.homeShown && !q.visitedHome && !c.inside && !c.fair && (sealAt >= 0 || alley.built);
      if (sealOn && sealAt < 0) sealAt = 1;
      if (sealAt >= 0) {
        const was = sealAt; sealAt += dt;
        const u = clamp01(sealAt / .22);
        if (was < .22 && sealAt >= .22) { sfx.knock(); haptic(14); }
        const sc = lerp(2.2, 1, easeIn(u)), bob = u >= 1 ? Math.sin(t * 1.6) * .5 : 0;
        sealG.setAttribute('transform', `translate(457 ${f(265 + bob)}) rotate(-4) scale(${f(sc)})`);
        sealG.setAttribute('opacity', f(u));
        const sp = clamp01((sealAt - .22) / .5);
        sealSplash.setAttribute('transform', 'translate(457 265)'); sealSplash.setAttribute('rx', f(5 + sp * 6)); sealSplash.setAttribute('ry', f(5 + sp * 6)); sealSplash.setAttribute('opacity', f(sp > 0 && sp < 1 ? .7 * (1 - sp) : 0));
      }
      homeBeacon.setAttribute('opacity', sealOn ? '1' : '0');
      // the spot to stop at, on the pavement, until the alley is drawn
      const markOn = q.homeShown && !alley.built && mode === 'walk' && !c.inside && !c.fair && Math.abs(player.x - STAND[0]) < 190;
      standMark.setAttribute('opacity', f(approach(+(standMark.getAttribute('opacity') ?? 0), markOn ? 1 : 0, 6, dt)));
      const pu = (t * .8) % 1;
      markPulse.setAttribute('rx', f(9 + pu * 9)); markPulse.setAttribute('ry', f(2.8 + pu * 2.8)); markPulse.setAttribute('opacity', f(1 - pu));
      const far = clamp01((Math.hypot(player.x - STAND[0], player.y - STAND[1]) - 12) / 20);
      markDrop.setAttribute('transform', `translate(0 ${f(-Math.abs(Math.sin(t * 3)) * 3)})`); markDrop.setAttribute('opacity', f(far));
      if (mode === 'brush' && purpose === 'kite' && !drawing) {
        brushIdle += dt;
        if (brushIdle > 9 && brushIdle < 9 + dt * 2) {
          const [x, y] = drawingAt(); ui.showGesture('path', () => [[x, y - 24], [x + 18, y], [x, y + 24], [x - 18, y], [x, y - 24]]);
        }
      }
      stuck.draw(t, dt, wind);
      kite.draw(t, dt, wind, kenta.g.style.display === 'none' ? null : kenta.hand);
      stroke.draw(dt);
      // drawing on the lantern: step aside so you don't stand in front of it
      if (mode === 'brush' && purpose === 'lantern') { player.x = approach(player.x, L.x + 24, 4, dt); player.faceTo = Math.PI - 0.5; }
      else if (mode === 'walk' && player.faceTo !== null && !script) player.faceTo = null;

      // the lantern at your door glows at night, your drawing dark against the light
      const lit = smooth(0.12, 0.32, P.lamp);
      lanternBody.setAttribute('fill', rgb(mix(P.paper, WARM, lit * 0.95)));
      lanternGlow.setAttribute('opacity', f(lit * 0.9 * (0.92 + 0.08 * Math.sin(t * 6.3) * Math.sin(t * 2.9))));
      lanternArt.style.color = lit > 0.3 ? rgb(mix([28, 28, 28], [120, 50, 20], 0.3)) : '';

      // the toy: falls, bounces, tumbles
      if (toy.on) {
        toy.t += dt;
        toy.v[1] += 220 * dt; toy.p[0] += toy.v[0] * dt; toy.p[1] += toy.v[1] * dt;
        toy.rot += toy.w * dt; toy.w = approach(toy.w, 0, 1.5, dt);
        if (toy.p[1] > toy.ground) { toy.p[1] = toy.ground; toy.v[1] = -toy.v[1] * 0.35; toy.v[0] *= 0.7; if (Math.abs(toy.v[1]) < 8) toy.v[1] = 0; }
        toy.p[0] = Math.max(BENCH.x0 - 30, Math.min(BENCH.x1 + 30, toy.p[0]));
        const sq = 1 - clamp01(1 - toy.t / 0.4) * 0.3;
        toyG.setAttribute('transform', `translate(${f(toy.p[0])} ${f(toy.p[1])}) rotate(${f(toy.rot)}) scale(${f(backOut(clamp01(toy.t / 0.4)) * sq)})`);
      }

      if (guest) {
        guest.faceTarget = guest.seated || mode === 'cine' ? player.x : null; guest.want.talk = mode === 'cine' ? 1 : 0;
        guest.reach = home.guestReach; guest.want.eat = guest.want.food = 0; home.diningGuest = guest;
        guest.draw(t, dt, P);
        if (player.g.parentNode === home.actors) {
          const front = guest.y > player.y;
          if (front && guest.g.previousElementSibling !== player.g) home.actors.appendChild(guest.g);
          if (!front && guest.g.nextElementSibling !== player.g) home.actors.insertBefore(guest.g, player.g);
        }

      }
      closeup.draw(t, dt, P);
      shodo.draw(t, dt); handwork.draw(dt); icebox.draw(t, dt); grocer.draw(t, dt);
      // the market bundle rides in your hands, wherever the traveller is drawn
      sack.setAttribute('opacity', q.basket.length ? '1' : '0');
      if (q.basket.length) {
        if (player.g.nextSibling !== sack) player.g.after(sack);
        const [hx, hy] = (player as unknown as { hands: Vec }).hands;
        sack.setAttribute('transform', `translate(${f(hx)} ${f(hy + 4)}) scale(${f((player as unknown as { scale?: number }).scale ?? 1)})`);
      }
      // what the icebox offers right now
      const plate = home.plate;
      home.iceboxPrompt = home.busy || mode !== 'walk' ? null
        : home.step === 5 ? (q.dishes.length < DISH_BOXES && plate.length ? 'Dolaba koy' : null)
        : q.basket.length && home.prep !== 1 && (home.step === 0 || home.step === 6) ? 'Alışverişi yerleştir'
        : home.step === 0 && home.prep === 0 ? 'Dolabı aç' : null;

      // A missed appointment leaves a recoverable trace rather than blocking the day.
      const visit = q.invitedDay > q.day ? q.visit : nextVisit(q.visit, c.tau, c.inside);
      if (visit !== q.visit) {
        q.visit = visit;
        if (visit === 'waiting') { env.tip('Kenta kapına geldi. Bir süre seni bekleyecek.'); sfx.chime(); }
        if (visit === 'missed') { q.missedNote = false; kenta.g.style.display = 'none'; env.tip('Kapına küçük bir not bırakıldı.'); }
      }
      if (q.visit === 'planned' && c.tau >= .64 && !q.reminded && mode === 'walk') { q.reminded = true; think('Kenta bu akşam gelecekti.', 2.6); }
      if (q.visit === 'inside' && c.inside && !guest && !script && mode === 'walk') run(guestArrives());
      const couldEat = home.canEat;
      home.canEat = q.invitedDay > q.day || (q.visit === 'inside' ? !!guest && !guest.walking && guest.seated : q.visit !== 'planned' && q.visit !== 'waiting');
      if (q.day === 1 && q.dinner !== 'kenta' && !q.sushi && home.step === 6 && c.tau < .69) home.canEat = false;
      if (!couldEat && home.canEat && home.step === 6) env.tip(guest ? 'Kenta geldi. Sofrada birlikte yiyebilirsiniz.' : 'Günün ışığı yumuşadı. Sofrana oturabilirsin.', true);
      if (guest && home.eaten > guestAte) { guestAte = home.eaten; ui.heart(guestHead()); sfx.pop(); }
      if (guest && home.step === 0 && guestAte >= 1 && !script && !q.sushi) run(guestLeaves());
      if (!guest && home.eaten > ateSeen) ateSeen = home.eaten;
      if (!guest && q.kite === 'done' && !q.sushi && c.inside && home.step === 0 && ateSeen >= 1 && !script) run(dinnerAlone());
      drawNeighborhood(c);

      // show once how to walk into the alley (that is the way home) and out of the house again
      const calm = mode === 'walk' && !(script && blocks);
      if (alleyTaught === 0 && calm && alley.built && !c.inside && !c.fair && q.kite === 'done' && Math.abs(player.x - DOOR_X) < 16) {
        alleyTaught = t + 60; env.tip('Bu taşlı ara sokağa, yukarı doğru yürü. Evin orada.', true);
        ui.showGesture('path', () => [[DOOR_X + 2, 380], [DOOR_X + 2, 338]], { period: 2 });
      }
      if (alleyTaught > 0 && c.inside) { alleyTaught = -1; ui.hideGesture(); env.tip(null); }
      insideT = c.inside ? insideT + dt : 0;
      if (exitTaught === 0 && calm && c.inside && insideT > 12 && Math.abs(player.x - (IX + 40)) < 26) {
        exitTaught = t + 5; env.tip('Dışarı çıkmak için kapıya doğru yürü.');
        ui.showGesture('path', () => [[IX + 40, 378], [IX + 40, 352]], { period: 2 });
      }
      if (exitTaught > 0 && (!c.inside || t > exitTaught)) { exitTaught = -1; ui.hideGesture(); }
      // the old bath house: just a passing thought
      if (!bathSeen && q.kite === 'done' && !c.inside && !c.fair && Math.abs(player.x - BATH_X) < 40 && mode === 'walk' && !script) { bathSeen = true; think('Mahallenin hamamı. Akşamları bacasından buhar tüter.', 3.2); }
      // first time at your door
      if (!arrived && q.kite === 'done' && !c.inside && !c.fair && Math.abs(player.x - DOOR_X) < 30 && player.y > 350 && mode === 'walk' && !script) { arrived = q.homeSeen = true; }

      // night: the fox under the lamp
      fox.draw(t, dt, { inkT: P.inkT, night: P.night });
      if (q.day >= 4 && q.chime && !q.fox && !c.inside && !c.fair && mode === 'walk') {
        const isNight = c.tau > .68;
        const atLamp = Math.abs(player.x - CORNER[0]) < 34;
        if (isNight && atLamp) {
          const still = !c.stickActive && player.moving < 0.05;
          if (!toldStill) { toldStill = true; ui.heart([CORNER[0] + 45, 364]); }
          if (still) stillT += dt; else {
            if (fox.state === 'come' || fox.state === 'sit') { fox.startle(); sfx.nope(); think('Ürktü… bir daha deneyelim.', 2.6); }
            stillT = 0; foxSit = 0;
          }
          // A quiet discovery, without a timer or an instruction to wait.
          if (stillT > 3 && fox.state === 'away') fox.come(CORNER[0] + 120, player.x + 26, player.y + 4);
          cam = stillT > 1 ? fit(player.x - 70 + stillT * 2, 250, player.x + 120 - stillT * 2, 392, 2.4) : null;
          if (fox.state === 'sit') { foxSit += dt; if (foxSit > 2.6 && foxDone === 0) { foxDone = 1; run(foxMoment()); } }
        } else { ui.stillness(null); if (mode === 'walk' && !script) cam = null; stillT = 0; }
      }
      if (c.tau > .94 && !q.nightHint && mode === 'walk' && !script) { q.nightHint = true; env.tip('Gece ilerledi. Evdeki futonda uyuyabilirsin.'); }
      home.canSleep = c.inside && mode === 'walk' && (c.tau > .78 || (dayComplete(q) && c.tau > .68));
      home.canCook = !q.sushi;

      // inside: the next place for the recipe; outside: the way home
      if (q.kite === 'done' && !q.sushi && (q.day === 1 || (q.invitedDay === q.day && ['planned', 'waiting', 'inside'].includes(q.visit))) && mode === 'walk' && !script) {
        if (c.inside) {
          const s = home.step, pr = home.prep;
          const key = s === 0 && pr === 0 ? 'icebox' : s < 4 && pr === 1 ? 'place' : s < 4 ? 'cook' : s === 4 ? 'take' : s === 5 ? 'table' : 'eat';
          if (key !== insideKey) {
            const first = insideKey === '';
            insideKey = key;
            const counter = () => setObj(() => [IX + 292, 300], () => Math.abs(player.x - (IX + 291)) < 24, true);
            if (key === 'icebox') { setObj(() => [IX + 354, 286], () => Math.abs(player.x - (IX + 354)) < 18, true); env.tip(q.dishes.length ? 'Dolapta hazır yemeğin de var. Dolabı aç, seç.' : canFeed(q.pantry, q.dishes) ? 'Malzemeler dolapta. Yanına gidip dolabı aç.' : 'Dolap boş. Söğüt Pazarı’nda Ume’ye uğrayalım.'); }
            else if (key === 'place') { counter(); env.tip('Tezgâha doğru yürü; balığı oraya bırakacaksın.'); }
            else if (key === 'cook') { counter(); env.tip('Tezgâhta suşi hazırla.'); }
            else if (key === 'take') { counter(); }
            else if (key === 'table') { setObj(() => [IX + 186, 316], () => Math.abs(player.x - (IX + 186)) < 30, true); env.tip('Masaya doğru yürü; tabağı bırakacaksın.'); }
            else { setObj(() => [IX + 186, 305], () => Math.abs(player.x - IX - 186) < 30, true); if (!home.canEat) env.tip('Sofra hazır. Akşam ışığı inince oturursun; dolabı doldurabilir ya da biraz dışarı çıkabilirsin.', true); else env.tip('Sofraya oturup yiyebilirsin.', true); }
          }
        } else if (!c.fair) {
          insideKey = '';
          if (!obj || obj.inside) toDoor();
        }
      }

      // guide crane and the hint ladder
      if (obj && mode === 'walk' && !(script && blocks)) {
        obj.since += dt;
        const inScene = obj.inside === c.inside && !c.fair;
        const isNear = obj.near();
        if (!obj.guided && inScene && obj.since > 35) { obj.guided = true; env.tip(nextChapter(q) === 'kite' ? contextDirection() : !q.visitedHome ? 'Evim bu taşlı ara sokağın sonunda.' + (q.guideMet ? ' Turna da yol gösterir.' : '') : contextDirection(), true); }
        if (isNear && ui.guiding) ui.guide(null);

        ui.sparkle(isNear && obj.since > 6 ? obj.at : null);
      } else if (mode !== 'walk' && mode !== 'intro' && !craneScene) ui.guide(null);
      if (q.kite === 'talked' && mode === 'walk' && !script) ui.sparkle(() => [kenta.x, kenta.y - 30]);
    },
    /** called on any touch: a ring and a sound, everywhere */
    touch(e: PointerEvent) { wakeAudio(); inkRing(card, e.clientX, e.clientY); if (mode === 'alley') alley.tap(ctx.t); },
    /** the stepping stones still to be pressed: the alley is closed until then */
    get alleyOpen() { return alley.built || mode === 'alley'; },
    // debug hooks for headless checks
    _dbg: { alley, q, kenta, hana, fox, closeup, icebox, grocer, shodo, handwork, run, startBrush, get mode() { return mode; }, get picked() { return picked; }, drawingAt },
  };
}
export type Story = ReturnType<typeof createStory>;
