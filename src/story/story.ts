// Three unhurried days in the ink street. Some things you must do because they are the fun
// part (draw Kenta's kite, cook dinner); others are yours to choose (decorate the lantern
// at your door, draw the cat a toy and take it home, wait for the fox). A few questions
// have two answers, and the evening goes the way you answered.
//   morning  — the paper crane introduces itself; Kenta's kite is stuck in the cherry tree
//   day      — your home (the nameplate says so), the blank lantern, the cat on the bench
//   evening  — hang up your bundle, fish from the icebox, sushi up close, dinner (with Kenta?)
//   night    — stand still under the street lamp; a shy fox; sleep, and the notebook's page
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
import { createNotebook, SKETCH, type Entry } from './notebook.ts';
import { createPaper, fitLine, linePath } from './paper.ts';
import { nextVisit, timeRate, type Visit } from './schedule.ts';
import { type SavedGame, SAVE_KEY } from './save.ts';
import { sfx, haptic, wakeAudio, inkRing, approach, clamp01, easeOut, backOut } from './fx.ts';

type Home = {
  root: SVGGElement; newDay(): void; canEat: boolean; busy: boolean;
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

const KENTA_HOME: Vec = [392, 357];
const STUCK: Vec = [486, 196];
const LAMP: Vec = [400, 352];          // the street lamp on the pole
// home is down the alley in the middle of the street: the little gate at its end
const DOOR_X = 457;
const PLATE: Vec = [441, 302];           // the nameplate on the alley wall
const LANTERN = { x: 475, top: 272, cy: 287, r: 8.2, h: 22 };
const BATH_X = 826;                      // the big building at the east end is the neighbourhood bath
const CAT: Vec = [548, 330];
const BENCH = { x0: 516, x1: 600, y: 330 };
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
  env: { setTau(v: number): void; fade(v: number): void; isFaded(): boolean; isOpened(): boolean; tip(text: string | null, sticky?: boolean): void; banner(a: string, b: string): void };
}) {
  const { svg, card, ui, home, player, cat, layers, env } = o;
  const paper = createPaper(card);
  const art = { portrait: [] as Vec[][], seal: [] as Vec[][], head: [] as Vec[], body: [] as Vec[], sign: [] as string[], project: [] as Vec[][], ...(o.saved?.art ?? {}) };
  const drawOnPaper = (options: Parameters<typeof paper.open>[0]) => { paper.open({ ...options, then: lines => { options.then(lines); } }); };
  function applyIdentity() { player.identity = { head: linePath(fitLine(art.head, 0, 0, 8), true), body: linePath(fitLine(art.body, 0, 0, 12)), mark: art.seal.map(l => linePath(fitLine(l, 0, 0, 5))).join(' ') }; }
  applyIdentity();

  // ------------------------------------------------------------------ cast & props
  const kenta = createKenta(layers.walkers, KENTA_HOME[0], KENTA_HOME[1]);
  kenta.want.sad = 1;
  const stuck = createStuckKite(layers.front, STUCK);
  const kite = createKite(layers.front);
  const stroke = createStroke(layers.stroke);
  const fox = createFox(layers.walkers, layers.glow);
  let guest: Kenta | null = null, guestAte = 0;

  // your home, from outside: a wooden nameplate, a mailbox, and a blank paper lantern
  const homeFront = el('g', {}, layers.front);
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
    onExit: () => { if (mode === 'desk') { mode = 'walk'; cam = null; } },
  });

  // guided toys for the cat: pick one, then go over its outline (your hand stays in it)
  const TOYS: { name: string; c: string; pts: Vec[]; deco: string }[] = [
    { name: 'Top', c: '#c8423a', pts: Array.from({ length: 25 }, (_, i) => [Math.sin(i / 24 * 6.283) * 7, -Math.cos(i / 24 * 6.283) * 7] as Vec), deco: 'M-7 0 Q0 -3 7 0 M-4.6 -5 Q0 -7 4.6 -5' },
    { name: 'Balık', c: '#e8743a', pts: [[-9, 0], [-5, -4.6], [2, -4.4], [6, -1.4], [10, -5], [10, 5], [6, 1.4], [2, 4.4], [-5, 4.6], [-9, 0]], deco: 'M-5.6 -1 l0.1 0 M2 -4 Q0.6 0 2 4 M-1 -3 l0 1 M-1 2 l0 1' },
    { name: 'Fare', c: '#bdb6a8', pts: [[-9, 2], [-6, -3], [0, -5.6], [6, -3.6], [8, 1], [6, 4], [-6, 4], [-9, 2]], deco: 'M-5.6 -0.6 l0.1 0 M-1 -5 a2.4 2.4 0 1 1 -0.1 0 M8 1 Q14 0 13 -5 Q12 -8 15 -9' },
  ];
  const TOY_AT: Vec = [530, 312];
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
    created: false, walkLearned: false, met: false, homeSeen: false, nightHint: false,
    visit: 'none' as Visit, invitedDay: 0, missedNote: false, reminded: false,
    day2Seen: false, day3Seen: false, souvenir: '' as '' | 'cushion' | 'water', coins: 0,
    project: '' as '' | 'tea' | 'lanterns', gathering: false, keepsake: false, tookMemento: false,
    history: [] as { dayN: number; entries: Entry[]; sentence: string }[],
  };
  if (o.saved) { const { fresh, ...state } = o.saved.story; Object.assign(q, state); q.fresh = new Set(Array.isArray(fresh) ? fresh : []); }
  let kiteLine: Vec[] = o.saved?.art.kite ?? [];
  if (kiteLine.length && q.kite === 'done') { kite.birth(kiteLine); stuck.remove(); kenta.want.sad = 0; kenta.want.raise = 1; }
  for (const d of art.sign) el('path', { d, fill: 'currentColor' }, signInk);
  if (q.order) signWait.setAttribute('opacity', '0');
  for (const line of o.saved?.art.lantern ?? []) { lanternLines.push(line); el('path', { d: brush(line, .5), fill: 'currentColor' }, lanternArt); }
  home.catHome = q.catHome; if (q.catHome) cat.g.style.display = 'none';
  if (q.toy && o.saved?.art.toy?.length) {
    toy.line = o.saved.art.toy; toy.on = true; toy.p = [548, 324]; toy.ground = 324; toy.t = 2;
    const points = fitLine(toy.line, 0, 0, 15);
    el('path', { d: linePath(points, true), fill: TOYS[q.toyKind]?.c ?? '#c8423a', stroke: 'currentColor', 'stroke-width': .7 }, toyG);
  }
  const entries = (): Entry[] => [
    { id: 'self', title: 'Benim çizgim', hint: '', sketch: sketchOf(art.portrait), done: q.created },
    { id: 'kite', title: 'Kenta’nın uçurtması', hint: 'Kiraz ağacının altında biri üzgün.', sketch: kiteLine.length ? sketchOf([[...kiteLine, kiteLine[0]]]) : SKETCH.kite, done: q.kite === 'done', fresh: q.fresh.has('kite') },
    { id: 'order', title: 'İlk sipariş', hint: 'Atölyemde bir sipariş fişi var.', sketch: CHA.map((c) => 'M' + c.pts.map((p) => pt([8 + p[0] * 0.44, 8 + p[1] * 0.44])).join('L')).join(' '), done: q.order, fresh: q.fresh.has('order') },
    { id: 'lantern', title: 'Kapımın feneri', hint: 'Kapının yanındaki fener bomboş.', sketch: q.lantern ? sketchOf(lanternLines) : SKETCH.lantern, done: q.lantern, fresh: q.fresh.has('lantern') },
    { id: 'toy', title: q.catHome ? 'Eve gelen kedi' : 'Kedinin oyuncağı', hint: 'Bankta bir kedi uyukluyor.', sketch: q.toy ? sketchOf([toy.line]) : SKETCH.cat, done: q.toy, fresh: q.fresh.has('toy') },
    { id: 'fair', title: 'Yaz panayırı', hint: q.letter ? 'Sokağın batı ucunda, akşam.' : 'Posta kutusunda bir şey var.', sketch: SKETCH.fair, done: q.fair, fresh: q.fresh.has('fair') },
    { id: 'sushi', title: q.dinner === 'kenta' ? 'Kenta’yla akşam yemeği' : q.dinner === 'alone' ? 'Sessiz bir akşam yemeği' : 'Akşam yemeği', hint: 'Mutfakta suşi yap.', sketch: SKETCH.sushi, done: q.sushi, fresh: q.fresh.has('sushi') },
    { id: 'corner', title: q.souvenir === 'water' ? 'Pencere misafirleri' : 'Pencere köşem', hint: 'Çay evinin siparişiyle başlar.', sketch: q.souvenir === 'water' ? 'M10 36 Q30 50 50 36 M14 36 Q30 29 46 36 M28 22 q4 -8 9 -2 l5 0' : 'M10 34 Q30 28 50 34 L48 46 Q30 50 12 46Z', done: !!q.souvenir },
    { id: 'project', title: q.project === 'tea' ? 'Mahallenin çay köşesi' : 'Birlikte çizdiğimiz fenerler', hint: 'Üçüncü gün, ağacın altında.', sketch: sketchOf(art.project), done: !!q.project },
    { id: 'fox', title: 'Gece misafiri', hint: 'Gece fenerin altında… sessizce.', sketch: SKETCH.fox, done: q.fox, fresh: q.fresh.has('fox') },
  ].filter(e => e.done || e.id === 'kite' || (q.day >= 2 && e.id === 'order') || (q.day >= 3 && e.id === 'project'));
  const defterBtn = document.createElement('button');
  defterBtn.type = 'button'; defterBtn.className = 'defter-btn'; defterBtn.setAttribute('aria-label', 'Defter');
  defterBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 3h11a3 3 0 0 1 3 3v15H8a3 3 0 0 1-3-3Z M8 3v18 M11 8h5 M11 11h5"/></svg><span class="dots">${'<i></i>'.repeat(7)}</span>`;
  card.appendChild(defterBtn);
  const dots = [...defterBtn.querySelectorAll('.dots i')] as HTMLElement[];
  const refreshDots = () => { [q.kite === 'done', q.order, q.lantern, q.toy, q.fair, q.sushi, q.fox].forEach((d, i) => dots[i].classList.toggle('on', d)); };
  defterBtn.addEventListener('click', () => {
    if (mode !== 'walk' || paper.isOpen || script) return;
    sfx.tap();
    notebook.show({ dayN: q.day, subtitle: 'bugün', entries: entries(), sentence: daySentence(false), button: 'Kapat', history: q.history, seal: sketchOf(art.seal) });
  });
  const mark = (id: string) => {
    q.fresh.add(id); refreshDots();
    defterBtn.classList.remove('bump'); void defterBtn.offsetWidth; defterBtn.classList.add('bump');
  };
  function daySentence(end: boolean) {
    const s: string[] = [];
    if (q.kite === 'done') s.push('Kenta’ya bir uçurtma çizdim');
    if (q.order) s.push('çay evinin tabelasını yazdım');
    if (q.lantern) s.push('kapımın fenerine resim yaptım');
    if (q.toy) s.push(q.catHome ? 'bir kedi eve geldi' : 'bankta bir kediyle oynadık');
    if (q.fair) s.push('panayırın fenerleri altında dolaştım');
    if (q.sushi) s.push(q.dinner === 'kenta' ? 'Kenta’yla suşi yedik' : 'akşamı sessizce, suşiyle geçirdim');
    if (q.souvenir) s.push(q.souvenir === 'water' ? 'pencereme kuşlar uğradı' : 'kendime bir pencere köşesi yaptım');
    if (q.project) s.push(q.project === 'tea' ? 'mahalleye bir çay köşesi kurdum' : 'birlikte fenerler çizdik');
    if (q.visit === 'missed') s.push('Kenta kapıma bir not bıraktı');
    if (q.fox) s.push('gece bir tilki yanıma oturdu');
    if (!s.length) return end ? 'Sakin bir gün.' : 'Sayfa henüz boş.';
    const txt = s.join(', ').replace(/, ([^,]*)$/, ' ve $1') + '.';
    return txt[0].toUpperCase() + txt.slice(1);
  }

  // ------------------------------------------------------------------ choices: two answers, both fine
  const choiceBox = document.createElement('div'); choiceBox.className = 'choices'; card.appendChild(choiceBox);
  let picked = -1;
  function* choose(opts: string[]): Generator<Wait, number, unknown> {
    picked = -1;
    choiceBox.innerHTML = opts.map((s, i) => `<button type="button" data-i="${i}" class="${i ? 'alt' : ''}" style="--i:${i}">${s}</button>`).join('');
    choiceBox.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { picked = +(b as HTMLElement).dataset.i!; sfx.tap(); haptic(8); }));
    choiceBox.classList.add('show');
    yield () => picked >= 0;
    choiceBox.classList.remove('show');
    return picked;
  }

  // ------------------------------------------------------------------ the brush pad
  type Purpose = 'kite' | 'lantern' | 'toy';
  let purpose: Purpose = 'kite';
  const pad = document.createElement('div'); pad.className = 'brushpad'; card.appendChild(pad);
  const toWorld = (cx: number, cy: number): Vec => { const p = svg.createSVGPoint(); p.x = cx; p.y = cy; const m = svg.getScreenCTM(); const r = m ? p.matrixTransform(m.inverse()) : p; return [r.x, r.y]; };
  let drawing = false, lastPt: { p: Vec; t: number } | null = null, fails = 0, lanternStrokes = 0;
  pad.addEventListener('pointerdown', (e) => {
    if (mode !== 'brush') return;
    e.preventDefault(); pad.setPointerCapture(e.pointerId); wakeAudio();
    drawing = true; stroke.clear(); ui.hideGesture(); env.tip(null);
    const p = toWorld(e.clientX, e.clientY); stroke.add(p, 0); lastPt = { p, t: performance.now() };
    sfx.paper();
  });
  pad.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = toWorld(e.clientX, e.clientY), now = performance.now();
    const sp = lastPt ? Math.hypot(p[0] - lastPt.p[0], p[1] - lastPt.p[1]) / Math.max(1, now - lastPt.t) * 1000 : 0;
    stroke.add(p, sp); lastPt = { p, t: now };
  });
  const lift = () => { if (!drawing) return; drawing = false; judge(); };
  pad.addEventListener('pointerup', lift); pad.addEventListener('pointercancel', lift);

  // ------------------------------------------------------------------ kitchen close-up
  const closeup = createCloseup(card, {
    onStep: (n) => home.setStep(n),
    onDone: () => { env.tip('Tabağı al, masaya götür.'); },
    onExit: () => { mode = 'walk'; cam = null; },
  });

  // ------------------------------------------------------------------ state & a tiny script runner
  let mode: 'intro' | 'walk' | 'cine' | 'brush' | 'cook' | 'sleep' | 'desk' = q.created ? 'walk' : 'intro';
  let cam: Cam = null;
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
  const think = (s: string, d?: number) => ui.say(playerHead, `(${s})`, d);
  const catHead = (): Vec => [CAT[0], CAT[1] - 14];

  // objectives drive the guide crane and the hint ladder
  type Obj = { at: () => Vec; near: () => boolean; inside: boolean; since: number; guided: boolean } | null;
  let obj: Obj = null;
  const setObj = (at: () => Vec, near: () => boolean, inside: boolean) => { obj = { at, near, inside, since: 0, guided: false }; };
  const toLamp = () => setObj(() => [LAMP[0], LAMP[1] - 60], () => !ctx.inside && Math.abs(player.x - LAMP[0]) < 40, false);
  const toDoor = () => setObj(() => [DOOR_X, 300], () => ctx.inside, false);

  // ------------------------------------------------------------------ scenes
  const CIRCLE: Vec[] = Array.from({ length: 41 }, (_, i) => [120 + Math.sin(i / 40 * Math.PI * 2) * 35, 75 - Math.cos(i / 40 * Math.PI * 2) * 35]);
  const PERSON: Vec[] = [[120, 110], [120, 185], [90, 235], [120, 185], [150, 235], [120, 185], [120, 135], [77, 165], [120, 135], [163, 165]];
  const SEAL: Vec[] = [[120, 80], [150, 125], [120, 170], [90, 125], [120, 80]];
  function* intro(): Scene {
    mode = 'intro';
    yield () => env.isOpened();
    if (!q.created) {
      let done = false;
      drawOnPaper({ kicker: 'Bir yolcu eksik.', title: 'İlk çizgi sensin.', tip: 'Bir baş çiz. Kusursuz olması gerekmiyor.', example: CIRCLE, then: lines => { art.head = lines[0]; art.portrait = lines; done = true; } });
      yield () => done;
      done = false;
      drawOnPaper({ kicker: 'Biraz mürekkep, biraz sen.', title: 'Ayağa kalkalım.', tip: 'Bir gövde, iki kol, iki bacak. Tek çizgi de olur.', example: PERSON, preview: `<path d="${linePath(art.head, true)}"/>`, then: lines => { art.body = lines[0]; art.portrait.push(...lines); done = true; } });
      yield () => done;
      done = false;
      drawOnPaper({ kicker: 'Senin küçük imzan.', title: 'Bir işaret bırak.', tip: 'Ceketinde ve defterinde kalacak kendi mührün.', example: SEAL, guide: false, done: 'Artık buradayım', then: lines => { art.seal = lines; done = true; } });
      yield () => done;
      q.created = true; applyIdentity(); sfx.chime();
    }
    cam = fit(300, 245, 440, 398, 2);
    ui.guide(() => [player.x + 18, player.y - 48]);
    ui.say(() => ui.craneAt(), 'Ben Turna. Kaybolursan bana dokun.', 3);
    yield 2.7;
    ui.guide(null); cam = null; mode = 'walk';
    if (!q.walkLearned) {
      env.tip('Bir yere bas, parmağını sürükle.', true);
      ui.showGesture('path', () => [[player.x, player.y + 12], [player.x + 30, player.y + 12]]);
      const x = player.x;
      yield () => Math.abs(player.x - x) > 7 || Math.abs(player.y - 368) > 7;
      q.walkLearned = true; ui.hideGesture(); env.tip(null);
    }
    env.banner('Mürekkep Sokağı', 'Mahalleye bir çizgi daha geldi.');
  }

  function* talk(): Scene {
    mode = 'cine'; obj = null; ui.guide(null);
    const x0 = Math.min(player.x, kenta.x), x1 = Math.max(player.x, kenta.x);
    cam = fit(x0 - 45, 268, x1 + 45, 382, 2.2);
    player.faceTo = kenta.x > player.x ? 0.25 : Math.PI - 0.25;
    kenta.dir = player.x < kenta.x ? -1 : 1;
    kenta.want.sad = 0.4;
    q.met = true;
    yield .5;
    ui.say(kentaHead, 'Pardon! Uçurtmam yukarı kaçtı.', 2.6);
    yield 2.3;
    cam = fit(STUCK[0] - 70, STUCK[1] - 60, STUCK[0] + 70, STUCK[1] + 80, 2.4);
    kenta.want.look = 1;
    yield 1.2;
    q.kite = 'talked'; kenta.want.look = 0;
    cam = null; ui.say(() => ui.craneAt(), 'Yenisini çizebiliriz.', 2);
    yield 1;
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
      pad.classList.remove('show'); card.classList.remove('brush-focus');
      const openKite = () => drawOnPaper({ title: 'Bir uçurtma çiz.', tip: 'Bir şekil çiz. Uçlarını birleştir.', example: [[120, 45], [185, 120], [120, 205], [55, 120], [120, 45]], guide: false, done: 'Uçuralım', then: lines => {
        const pts = lines.reduce((a, b) => a.length > b.length ? a : b, [] as Vec[]);
        const r = recognise(pts), gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
        if (r.size < 12 || gap > Math.max(24, r.size * .55)) { openKite(); paper.hint('Bir ucunu ötekine kavuştur.'); return; }
        const world = fitLine(pts, kenta.x + 26, 270, 46);
        run(kiteBorn(world, r.corners));
      } });
      openKite();
    } else if (what === 'lantern') {
      pad.classList.remove('show'); card.classList.remove('brush-focus');
      drawOnPaper({ title: 'Fenerine bir iz bırak.', tip: 'Gece bu çizgilerin arasından ışık vuracak.', example: [[90, 90], [150, 110], [90, 150], [150, 175]], guide: false, done: 'Fenere asalım', then: lines => {
        for (const line of lines) {
          const points = line.map(p => [L.x + (p[0] - 120) * .055, L.top + 4 + (p[1] - 10) / 240 * L.h] as Vec);
          lanternLines.push(points); el('path', { d: brush(points, .5), fill: 'currentColor' }, lanternArt);
        }
        run(lanternDone());
      } });
    } else {
      pad.classList.remove('show'); card.classList.remove('brush-focus');
      const openToy = () => drawOnPaper({ title: `Kediye bir ${TOYS[q.toyKind].name.toLowerCase()}.`, tip: 'Silik çizginin üstünden geç. Sonra birlikte oynayın.', example: fitLine(TOYS[q.toyKind].pts, 120, 125, 150), done: 'Pisiye verelim', then: lines => {
        const line = lines.reduce((a, b) => a.length > b.length ? a : b, [] as Vec[]);
        const world = fitLine(line, TOY_AT[0], TOY_AT[1], q.toyKind === 0 ? 14 : q.toyKind === 1 ? 19 : 17);
        const match = matchLoop(world, tmplWorld(q.toyKind));
        if (match.err > 6) { openToy(); paper.hint('Biraz daha silik çizgiye yaklaşalım.'); return; }
        run(toyBorn(match.blend, 15));
      } });
      openToy();
    }
  }

  function endBrush() {
    pad.classList.remove('show'); card.classList.remove('brush-focus'); ui.hideGesture(); env.tip(null);
    if (purpose === 'lantern' && lanternStrokes > 0 && mode === 'brush') { run(lanternDone()); return; }
    if (mode === 'brush') { mode = 'walk'; cam = null; }
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
    ui.say(kentaHead, r.kind === 'stick' ? 'Bir sopa mı? Uçurtmanın kenarları kapanmalı.' : 'Hmm… uçlarını birleştirirsen uçar belki!');
  }

  function* kiteBorn(pts: Vec[], corners: number): Scene {
    mode = 'cine'; pad.classList.remove('show'); card.classList.remove('brush-focus'); env.tip(null); ui.hideGesture();
    kiteLine = pts;
    stroke.vanish(); kite.birth(pts); stuck.remove();
    sfx.chime(); haptic(16);
    yield 1.1;
    kenta.hop(); kenta.want.raise = 1; kenta.want.sad = 0; kenta.want.look = 0.6;
    sfx.pop(); ui.heart(kentaHead());
    cam = fit(330, 110, 510, 388, 2.2);
    yield 1.8;
    ui.say(kentaHead, corners <= 1 ? 'Yuvarlak bir uçurtma! Hiç görmemiştim!' : corners >= 5 ? 'Yıldız gibi bir uçurtma! Çok güzel!' : corners === 2 ? 'Ne tuhaf, ne güzel bir uçurtma!' : 'Tam bir uçurtma! Benim uçurtmam!');
    q.kite = 'done'; mark('kite'); sfx.success();
    yield 2;
    kenta.want.look = 0;
    cam = fit(Math.min(player.x, kenta.x) - 45, 268, Math.max(player.x, kenta.x) + 45, 382, 2.2);
    ui.say(kentaHead, 'Akşam yemeğe sana gelebilir miyim?', 60);
    const a = yield* choose(['Gel, birlikte yeriz.', 'Başka akşam olsun.']);
    if (a === 0) {
      q.dinner = 'kenta'; q.visit = 'planned'; q.invitedDay = q.day; kenta.hop(); ui.heart(kentaHead()); sfx.pop();
      ui.say(kentaHead, 'Yaşasın! Akşam görüşürüz!');
    } else {
      q.dinner = 'alone'; kenta.want.sad = 0.5;
      ui.say(kentaHead, 'Olur. Yarın uçururken görüşürüz!');
      yield 2.4; kenta.want.sad = 0;
    }
    yield 2.4;
    mode = 'walk'; cam = null;
    cam = fit(410, 260, 490, 385, 2);
    ui.say(kentaHead, 'Evin şu taşlı sokağın sonunda.', 2.4);
    yield 2.2; cam = null;
    toDoor(); env.tip('Evin taşlı ara sokağın sonunda. Yardım için Turna’ya dokun.');
  }

  function* toyPick(): Scene {
    mode = 'cine';
    cam = fit(500, 262, 600, 362, 3);
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
    mode = 'desk'; obj = null; ui.guide(null);
    player.faceTo = -Math.PI / 2;
    cam = fit(ATELIER_X - 40, 270, ATELIER_X + 40, 330, 4);
    yield 0.9;
    shodo.open();
    player.faceTo = null;
  }

  function* orderDelivered(score: number): Scene {
    mode = 'cine';
    cam = fit(SIGN.x - 46, SIGN.y - 30, SIGN.x + 46, SIGN.y + 60, 4);
    yield 1.4;
    ui.sparkle(() => [SIGN.x, SIGN.y]); sfx.chime();
    yield 1.4;
    const owner = (): Vec => [SIGN.x + 30, 300];
    ui.say(owner, score > 0.62 ? 'Bu tabelaya bakan içeri girmeden duramaz!' : 'Ne güzel bir el yazısı! Teşekkürler!', 3.6);
    yield 3.8;
    ui.sparkle(null);
    q.order = true; q.coins += 4; mark('order'); sfx.success();
    think('Sokakta artık benim yazım var. İlk kazancım da cebimde.', 3.2);
    yield 3;
    mode = 'walk'; cam = null;
    yield* chooseSouvenir();
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
    el('path', { d: T.deco, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.6, 'stroke-linecap': 'round', transform: `translate(${f(TOY_AT[0] - cx)} ${f(TOY_AT[1] - cy)})` }, toyG);
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

  function* homeArrive(): Scene {
    // the first time you reach your door: the nameplate says whose house this is
    mode = 'cine'; ui.guide(null);
    cam = fit(PLATE[0] - 60, 250, PLATE[0] + 40, 380, 2.6);
    ui.sparkle(() => [PLATE[0], PLATE[1]]);
    yield 1.0;
    think('Kapıdaki levhada adım yazıyor. Burası benim evim.', 3.4);
    yield 3.4;
    ui.sparkle(null);
    env.tip('Taşlı yoldan yukarı yürü; kapın açık.');
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

  function* cookIn(): Scene {
    mode = 'cook'; obj = null; ui.guide(null); env.tip(null);
    player.faceTo = -0.66;
    cam = fit(IX + 250, 286, IX + 334, 340, 4);
    yield 0.9;
    closeup.open(Math.min(3, home.step));
    player.faceTo = null;
  }

  function* guestArrives(): Scene {
    mode = 'walk';
    guest = createKenta(home.actors, IX + 30, 356); guestAte = 0;
    guest.want.sad = 0; guest.dir = 1; guest.speed = 20;
    guest.g.setAttribute('opacity', '0');
    kenta.g.style.display = 'none'; kite.draw(0, 0, 0, null); // the street Kenta has come over
    yield 0.6;
    guest.g.setAttribute('opacity', '1'); sfx.tap();
    ui.say(guestHead, home.step < 4 ? 'Geldim! Birlikte hazırlarız.' : 'Geldim! Ne güzel kokuyor.');
    guest.walkTo(IX + 214, 353);
    yield () => !guest || !guest.walking;
    if (!guest) return; guest.dir = -1;
    ui.say(guestHead, 'Itadakimasu!');
  }

  function* guestLeaves(): Scene {
    mode = 'cine';
    cam = fit(IX + 140, 276, IX + 240, 372, 2.6);
    yield 1.4;
    ui.say(guestHead, 'Çok teşekkürler! Sana bir sır vereyim…');
    yield 3;
    ui.say(guestHead, 'Gece fenerin altına bir tilki gelirmiş. Ama sadece kıpırdamadan bekleyene.');
    yield 4.6;
    ui.say(guestHead, 'Oyasumi!');
    guest!.speed = 30;
    guest!.walkTo(IX + 30, 356);
    mode = 'walk'; cam = null;
    yield () => !guest!.walking;
    guest!.g.remove(); guest = null;
    q.visit = 'done'; q.sushi = true; mark('sushi');
    toLamp();
  }

  function* dinnerAlone(): Scene {
    // nobody came: a quiet meal, and something outside the window
    mode = 'cine';
    cam = fit(IX + 140, 250, IX + 240, 372, 2.6);
    yield 1.2;
    think('Sessiz bir akşam. Fena değil.', 2.6);
    yield 2.8;
    cam = fit(IX + 150, 250, IX + 230, 310, 3);
    yield 1.4;
    think('Pencereden bir gölge geçti… sokak lambasına doğru.', 3.2);
    yield 3.4;
    q.sushi = true; mark('sushi');
    mode = 'walk'; cam = null;
    toLamp();
  }

  let stillT = 0, foxSit = 0, foxDone = 0, toldStill = false, insideKey = '', arrived = q.homeSeen, ateSeen = 0, bathSeen = false;
  let alleyTaught = 0, exitTaught = 0, insideT = 0; // 0 not yet · >0 showing until this time · -1 done
  function* foxMoment(): Scene {
    mode = 'cine';
    q.fox = true; mark('fox'); sfx.chime(); haptic(12);
    ui.heart([fox.x, fox.y - 26]);
    cam = fit(Math.min(player.x, fox.x) - 50, 290, Math.max(player.x, fox.x) + 50, 380, 2.6);
    yield 3.6;
    fox.leave();
    yield 2.4;
    ui.stillness(null);
    think('Uykum geldi. Eve döneyim.', 2.6);
    mode = 'walk'; cam = null;
    toDoor();
  }

  function* sleep(): Scene {
    mode = 'sleep'; obj = null; ui.guide(null);
    cam = fit(IX + 150, 250, IX + 230, 310, 3);
    yield 1.8;
    env.fade(1);
    yield () => env.isFaded();
    let closed = false;
    const page = { dayN: q.day, entries: entries().map(e => ({ ...e, fresh: false })), sentence: daySentence(true) };
    q.history = [...q.history.filter(p => p.dayN !== q.day), page];
    notebook.show({ dayN: q.day, subtitle: 'gün bitti', entries: page.entries, sentence: page.sentence, button: 'Günaydın', seal: sketchOf(art.seal), then: () => { closed = true; } });
    q.fresh.clear();
    yield () => closed;
    q.slept = q.day; q.day++;
    home.newDay(); guest?.g.remove(); guest = null; ateSeen = guestAte = 0;
    q.sushi = false; q.reminded = false; q.nightHint = false; insideKey = '';
    if ((q.visit === 'planned' || q.visit === 'waiting') && q.invitedDay < q.day) q.visit = 'missed';
    if (q.visit === 'inside') q.visit = 'done';
    kenta.g.style.display = ''; kenta.walkTo(392, 357);
    player.carryBundle = !home.bagHung;
    env.setTau(0.27);
    cam = null;
    env.fade(0);
    yield 1;
    env.banner(`${q.day}. gün`, q.day === 2 ? 'Dünkü çizgiler bugün de yaşıyor.' : q.day === 3 ? 'Yağmurun ardından, ağacın altında bir buluşma.' : 'Sokak seni hatırlıyor.');
    mode = 'walk';
  }

  // ------------------------------------------------------------------ what the action button offers on the street
  const nearKenta = () => Math.abs(player.x - kenta.x) < 34 && Math.abs(player.y - kenta.y) < 18 && kenta.g.style.display !== 'none';
  const nearLantern = () => Math.abs(player.x - L.x) < 6;
  const nearCat = () => Math.abs(player.x - CAT[0]) < 30 && cat.g.style.display !== 'none';
  function offer(): { label: string; go: () => void } | null {
    if (ctx.inside || ctx.fair || (script && blocks)) return null;
    if (q.visit === 'missed' && !q.missedNote && Math.abs(player.x - MAIL_X) < 18) return { label: 'Kenta’nın notu', go: () => run(missedNote()) };
    if (q.day >= 2 && q.visit === 'missed' && nearKenta()) return { label: 'Başka akşam birlikte?', go: () => run(reinvite()) };
    if (q.day >= 3 && !q.project && Math.abs(player.x - 510) < 32) return { label: 'Birlikte bir köşe kuralım', go: () => run(neighborhoodProject()) };
    if (q.project && !q.gathering && ctx.tau >= .7 && Math.abs(player.x - 510) < 45) return { label: 'Buluşmaya katıl', go: () => run(gathering()) };
    if (q.day >= 2 && !q.letter && Math.abs(player.x - MAIL_X) < 8) return { label: 'Mektubu al', go: () => run(readLetter()) };
    if (q.kite !== 'done' && nearKenta()) return q.kite === 'sad' ? { label: 'Kenta ile konuş', go: () => run(talk()) } : { label: 'Fırçayı çıkar', go: () => startBrush('kite') };
    if (q.kite === 'done' && !q.lantern && nearLantern()) return { label: 'Fenere bir şey çiz', go: () => startBrush('lantern') };
    if (q.kite === 'done' && !q.toy && nearCat()) return { label: 'Kediye oyuncak çiz', go: () => run(toyPick()) };
    if (q.day >= 2 && q.kite === 'done' && !q.order && Math.abs(player.x - ATELIER_X) < 20) return { label: 'Atölyeye gir', go: () => run(workshop()) };
    return null;
  }


  let guideUntil = 0;
  const help = document.createElement('button'); help.type = 'button'; help.className = 'street-help';
  help.setAttribute('aria-label', 'Turna: yol göster');
  help.innerHTML = `<svg viewBox="-16 -16 32 32" aria-hidden="true"><path d="M-12 0L-3 -3L-6 -13L4 -4L11 -12L12 -8L8 1L0 5Z" fill="#c8423a" stroke="#6f352e" stroke-width=".8"/><path d="M-3 -3L3 2L-8 12Z" fill="#df6558"/></svg><span>Turna</span>`;
  card.appendChild(help);
  help.addEventListener('click', () => {
    if (mode !== 'walk' || notebook.isOpen) return;
    if (obj && obj.inside === ctx.inside && !ctx.fair) { ui.guide(obj.at); guideUntil = ctx.t + 9; env.tip(ctx.inside ? 'İçerideki küçük parıltıya bak.' : q.visit === 'waiting' ? 'Kenta evinin kapısında.' : 'Şu yöne bakalım.'); }
    else if (!ctx.inside && !ctx.fair) {
      const target: Vec = q.kite !== 'done' ? [kenta.x, kenta.y - 30] : q.day >= 3 && !q.project ? [510, 310] : q.day >= 2 && !q.order ? [ATELIER_X, 300] : [DOOR_X, 300];
      ui.guide(() => target); guideUntil = ctx.t + 9;
      env.tip(q.day >= 3 && !q.project ? 'Ağacın altında birlikte bir köşe kuralım.' : q.day >= 2 && !q.order ? 'Atölyende bir sipariş var.' : 'Evin taşlı ara sokağın sonunda.');
    } else env.tip('Acele yok. Yakınındaki eşyaları keşfet.');
    sfx.paper();
  });
  const pocket = document.createElement('button'); pocket.type = 'button'; pocket.className = 'street-pocket'; pocket.setAttribute('aria-label', 'Cep ve küçük dükkân'); card.appendChild(pocket);
  pocket.addEventListener('click', () => { if (mode === 'walk' && !script && !notebook.isOpen) run(shop()); });
  const settings = document.createElement('button'); settings.type = 'button'; settings.className = 'street-settings'; settings.textContent = 'Yeni sayfa'; card.appendChild(settings);
  settings.addEventListener('click', () => { if (mode === 'walk' && !script && !notebook.isOpen) run(restart()); });
  function* restart(): Scene {
    mode = 'cine'; think('Bu mahalledeki çizgilerini silip baştan başlamak ister misin?', 60);
    const a = yield* choose(['Burada kalayım', 'Yeni bir başlangıç']);
    if (a === 1) { localStorage.removeItem(SAVE_KEY); location.reload(); }
    mode = 'walk';
  }
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
    mode = 'cine'; q.day2Seen = true;
    think(q.visit === 'done' ? 'Kenta tabağı geri bırakmış. Yanında küçük bir teşekkür çizimi.' : 'Dün çizdiğim uçurtma… hâlâ gökyüzünde.', 3);
    yield 2.8;
    env.tip('Çay evi uçurtmanı görmüş. Atölyende ilk siparişin var.');
    if (!q.order) setObj(() => [ATELIER_X, 300], () => Math.abs(player.x - ATELIER_X) < 20 && !ctx.inside, false);
    mode = 'walk';
  }
  function* chooseSouvenir(): Scene {
    if (q.souvenir) return;
    mode = 'cine'; think('Çay evinden küçük bir teşekkür hediyesi. Hangisi evime yakışır?', 60);
    const a = yield* choose(['Pencere minderi', 'Kuşlar için su kabı']);
    q.souvenir = a === 0 ? 'cushion' : 'water';
    env.tip(a === 0 ? 'Evde pencere kenarında sana bir yer var.' : 'Kapının yanına su kabını bıraktın. Kimler uğrayacak?');
    mode = 'walk';
  }
  function* shop(): Scene {
    mode = 'cine';
    if (q.coins < 2 || q.keepsake) {
      think(q.keepsake ? 'Fırçam, çizgilerim ve küçük bir rüzgâr çanı. Yeter.' : 'İlk siparişin kazancıyla evine küçük bir şey alabilirsin.', 3);
      yield 2.8;
    } else {
      think('Küçük dükkânda bir rüzgâr çanı var. İki sikke.', 60);
      const a = yield* choose(['Çanı al · 2 sikke', 'Şimdilik kalsın']);
      if (a === 0) { q.coins -= 2; q.keepsake = true; sfx.chime(); env.tip('Çan evinin kapısında. Rüzgâr geldikçe çalacak.'); }
    }
    mode = 'walk';
  }
  function* neighborhoodProject(): Scene {
    mode = 'cine'; obj = null; ui.guide(null);
    think('Şu boş köşe hepimizin olabilir.', 2.2); yield 2;
    const a = yield* choose(['Bir çay köşesi kuralım', 'Birlikte fener çizelim']);
    let done = false;
    drawOnPaper({ kicker: 'Mahallede senin elinden.', title: a === 0 ? 'Örtüye bir desen.' : 'İlk fener senden.', tip: 'Bir çizgi, bir çiçek… Nasıl istersen.', example: [[65, 140], [90, 110], [120, 140], [150, 110], [180, 140]], guide: false, done: 'Mahalleye bırakalım', then: lines => { art.project = lines; q.project = a === 0 ? 'tea' : 'lanterns'; q.coins += 2; done = true; } });
    yield () => done;
    sfx.success(); ui.heart([510, 305]);
    think(a === 0 ? 'Akşam burada çay kokacak.' : 'Akşam bu çizgiler ışık olacak.', 2.6); yield 2.5;
    mode = 'walk';
  }
  function* gathering(): Scene {
    mode = 'cine'; cam = fit(470, 260, 570, 390, 2.4);
    ui.say(() => [510, 306], q.project === 'tea' ? 'Çay hazır. Yanımıza otur!' : 'Benim fenerim de seninkine benzesin!', 3);
    sfx.chime(); yield 2.8;
    const a = yield* choose(['Bu köşe burada kalsın.', 'Bir hatırasını eve alayım.']);
    q.gathering = true; q.tookMemento = a === 1;
    think(a === 0 ? 'Yarın da burada buluşabiliriz.' : 'Evde bu akşamdan bir iz kalacak.', 2.7);
    yield 2.5; mode = 'walk'; cam = null;
  }
  const personal = el('g', { transform: `translate(${IX + 90} 278) scale(.14)`, 'pointer-events': 'none' }, home.root);
  personal.innerHTML = `<rect x="-3" y="-3" width="246" height="266" fill="#fdf7e8" stroke="#5d4e39" stroke-width="5"/>${art.portrait.map(l => `<path d="${linePath(l)}" fill="none" stroke="#443c30" stroke-width="3"/>`).join('')}`;
  const thanks = el('g', { transform: `translate(${IX + 165} 329) rotate(-8)` }, home.root);
  thanks.innerHTML = '<path d="M-12 -9H12V7H-12Z" fill="#fff6df" stroke="currentColor" stroke-width=".5"/><path d="M0 -7L5 -2 0 3 -5 -2ZM0 3q-3 3 1 4" fill="none" stroke="#bd5143" stroke-width=".6"/>';
  const doorSeal = el('path', { fill: 'none', stroke: '#b8483d', 'stroke-width': .7, transform: `translate(${PLATE[0]} ${PLATE[1]})` }, homeFront);
  const cushion = el('g', { transform: `translate(${IX + 185} 351)` }, home.root);
  cushion.innerHTML = `<path d="M-20 -3Q0 -10 20 -3L18 5Q0 9 -18 5Z" fill="#b54d42" stroke="#4d3c32" stroke-width=".8"/><path d="M-10 -1Q0 3 10 -1" fill="none" stroke="#e4c8a8" stroke-width=".7"/>`;
  const bowl = el('g', { transform: 'translate(490 346)' }, layers.front);
  bowl.innerHTML = `<path d="M-9 -3Q0 8 9 -3Z" fill="#c9b59b" stroke="currentColor" stroke-width=".7"/><ellipse cx="0" cy="-3" rx="9" ry="2.7" fill="#b7d2d1" stroke="currentColor" stroke-width=".6"/><path d="M7 -8q5 -7 10 -1l3 0-3 2q-2 5-8 2Z" fill="#e4d7b6" stroke="currentColor" stroke-width=".5"/><path d="M-6 6l-1 2m3 -1-1 2m-7 -1-1 2" stroke="currentColor" fill="none" stroke-width=".6"/>`;
  const bell = el('g', { transform: 'translate(468 266)' }, homeFront);
  bell.innerHTML = `<path d="M0 -8V0M-4 7Q-5 -1 0 -1Q5 -1 4 7Z" fill="#d0d6c4" stroke="currentColor" stroke-width=".6"/><path d="M0 6V19l3 1v10l-6 -1V19Z" fill="#f4e7c9" stroke="currentColor" stroke-width=".5"/>`;
  const rain = el('path', { fill: 'none', stroke: '#6d8d98', 'stroke-width': .5, opacity: .3, 'pointer-events': 'none' }, layers.front);
  const puddle = el('g', { style: 'cursor:pointer' }, layers.front);
  puddle.innerHTML = '<ellipse cx="440" cy="380" rx="19" ry="3" fill="#b9d6db" opacity=".38"/><ellipse cx="440" cy="380" rx="10" ry="1.5" fill="none" stroke="#72929c" stroke-width=".5"/>';
  puddle.addEventListener('pointerdown', () => { ui.heart([440, 375]); sfx.tap(); });
  const projectG = el('g', {}, layers.front), projectInk = el('g', {}, projectG);
  const memento = el('g', { transform: `translate(${IX + 210} 285)` }, home.root);
  memento.innerHTML = '<path d="M-8 -8L8 -8Q13 2 8 12H-8Q-13 2-8-8Z" fill="#edd2a1" stroke="currentColor" stroke-width=".8"/><path d="M0 -14V-8" stroke="currentColor"/>';
  const neighbors = [createKenta(layers.walkers, 484, 362), createKenta(layers.walkers, 540, 359)];
  neighbors.forEach(n => { n.want.sad = 0; n.g.style.display = 'none'; });
  let drawnProject = '', portraitDrawn = q.created, bellT = 0;
  function drawNeighborhood(c: Ctx) {
    thanks.style.display = q.day >= 2 && q.visit === 'done' ? '' : 'none';
    const wet = q.day === 3 && c.tau < .66 && !c.inside && !c.fair;
    rain.style.display = puddle.style.display = wet ? '' : 'none';
    if (wet) rain.setAttribute('d', Array.from({ length: 48 }, (_, i) => { const x = (i * 83.7 + c.t * 17) % 960, y = 150 + (i * 41 + c.t * 95) % 240; return `M${f(x)} ${f(y)}l-2 7`; }).join(' '));
    memento.style.display = q.tookMemento ? '' : 'none';
    neighbors.forEach((n, i) => { const show = !!q.project && c.tau >= .7 && c.tau < .94 && !c.inside && !c.fair; n.g.style.display = show ? '' : 'none'; if (show) { n.dir = i ? -1 : 1; n.want.wave = q.project === 'tea' ? 0 : .4; n.draw(c.t, c.dt, c.P); } });
    cushion.style.display = q.souvenir === 'cushion' ? '' : 'none'; bowl.style.display = q.souvenir === 'water' ? '' : 'none';
    bowl.setAttribute('transform', `translate(490 346) rotate(${Math.sin(c.t * 2) * .8})`);
    bell.style.display = q.keepsake ? '' : 'none'; bell.setAttribute('transform', `translate(468 266) rotate(${Math.sin(c.t * 2.8) * c.wind * 4})`);
    bellT += c.dt;
    if (q.keepsake && !c.inside && !c.fair && Math.abs(player.x - 468) < 55 && bellT > 14 && mode === 'walk') { bellT = 0; sfx.chime(); }
    doorSeal.setAttribute('d', art.seal.map(l => linePath(fitLine(l, 0, 0, 6))).join(' '));
    if (!portraitDrawn && q.created) { portraitDrawn = true; personal.innerHTML += art.portrait.map(l => `<path d="${linePath(l)}" fill="none" stroke="#443c30" stroke-width="3"/>`).join(''); }
    if (q.project && drawnProject !== q.project) {
      drawnProject = q.project;
      const tea = q.project === 'tea';
      projectInk.innerHTML = tea ? `<path d="M487 344L533 344L530 352L490 352ZM492 352V362M528 352V362" fill="#b99369" stroke="currentColor" stroke-width="1"/><path d="M489 339L531 339L529 347L491 347Z" fill="#e8d9bd" stroke="currentColor" stroke-width=".7"/><path d="M497 335v-4h5v4q-2 3-5 0m21 0v-4h5v4q-2 3-5 0" fill="#e1c99c" stroke="currentColor" stroke-width=".7"/>` : `<path d="M478 303Q510 316 542 303" fill="none" stroke="currentColor" stroke-width=".7"/>${[487,510,533].map(x => `<path d="M${x} 308v5m-5 2q-4 9 0 18h10q4-9 0-18Z" fill="#efd4a2" stroke="currentColor" stroke-width=".7"/>`).join('')}`;
      art.project.forEach(l => el('path', { d: linePath(fitLine(l, 510, tea ? 342 : 323, tea ? 25 : 8)), fill: 'none', stroke: '#b54438', 'stroke-width': .7 }, projectInk));
    }
    projectG.style.display = q.project ? '' : 'none';
  }

  // ------------------------------------------------------------------ api
  if (!q.created || !q.walkLearned) run(intro(), false);
  else { mode = 'walk'; if (q.kite !== 'done') setObj(kentaHead, () => nearKenta(), false); }
  refreshDots();
  return {
    get freeze() { return mode !== 'walk' || notebook.isOpen || paper.isOpen; },
    get clockRate() { return timeRate(mode, q.day, q.kite === 'done', notebook.isOpen || paper.isOpen && mode === 'intro'); },
    get canSave() { return q.created && mode === 'walk' && !script && !paper.isOpen && !home.busy; },
    snapshot() { return { story: { ...q, fresh: [...q.fresh] }, art: { ...art, kite: kiteLine, lantern: lanternLines, toy: toy.line } }; },
    get cam() { return cam; },
    get mode() { return mode; },
    get closeupOpen() { return closeup.isOpen; },
    /** what the action button says, if the story has something to offer */
    prompt(): string | null {
      if (paper.isOpen || notebook.isOpen) return '';
      if (mode === 'brush') return purpose === 'lantern' && lanternStrokes > 0 ? 'Bitti' : 'Vazgeç';
      if (mode !== 'walk') return '';
      return offer()?.label ?? null;
    },
    act(): boolean {
      if (paper.isOpen || notebook.isOpen) return true;
      if (mode === 'brush') { endBrush(); return true; }
      if (mode !== 'walk') return true;
      const o2 = offer();
      if (o2) { sfx.tap(); o2.go(); return true; }
      return false;
    },
    opened() { sfx.paper(); setTimeout(() => sfx.chime(), 500); },
    /** first steps into the fair */
    onFair() {
      q.fair = true; mark('fair');
      setTimeout(() => env.banner('Yaz Panayırı', 'Fenerler, davul, takoyaki kokusu…'), 900);
    },
    /** the home asks the story to take over */
    onHome(what: 'cook' | 'sleep') { if (what === 'cook') run(cookIn()); else run(sleep()); },
    sortables(): { g: SVGGElement; y: number }[] { return ctx && !ctx.inside && !ctx.fair ? [kenta, fox, ...neighbors].filter((c) => c.g.style.display !== 'none') : []; },

    update(c: Ctx) {
      ctx = c;
      const { t, dt, P, wind } = c;
      card.classList.toggle('modal-open', paper.isOpen || notebook.isOpen || mode === 'desk' || closeup.isOpen);
      card.classList.toggle('controls-locked', mode !== 'walk');
      help.hidden = !q.created || mode !== 'walk'; pocket.textContent = `Sikke · ${q.coins}`; pocket.hidden = q.day < 2;
      if (mode === 'walk' && !script && q.walkLearned && !q.met && !c.inside && !c.fair && (Math.abs(player.x - kenta.x) < 35 || player.x > kenta.x)) run(talk());
      if (q.day >= 2 && !q.day2Seen && mode === 'walk' && !script) run(secondMorning());
      if (q.day >= 3 && !q.day3Seen && mode === 'walk' && !script) { q.day3Seen = true; setObj(() => [510, 310], () => Math.abs(player.x - 510) < 30 && !c.inside, false); env.tip('Ağacın altında bir buluşma hazırlığı var.'); }
      if (script) { if (waitFn) { if (waitFn()) { waitFn = null; advance(); } } else { waitT -= dt; if (waitT <= 0) advance(); } }

      // street Kenta: sad under the tree, then flying his kite, wandering a little
      if (kenta.g.style.display !== 'none') {
        if (q.visit !== 'waiting' && q.kite === 'done' && !kenta.walking && Math.random() < dt * 0.2) kenta.walkTo(366 + Math.random() * 50, 353 + Math.random() * 8);
        kenta.speed = q.kite === 'done' ? 14 : 20;
        kenta.draw(t, dt, P);
        if (q.kite !== 'done' && mode === 'walk' && !(script && blocks)) {
          kenta.dir = player.x < kenta.x ? -1 : 1;
          if (Math.random() < dt * 0.16 && Math.abs(player.x - kenta.x) > 40 && !ui.speaking) ui.say(kentaHead, '…', 2);
        }
        // at night he goes home (unless he is coming to yours)
        if (q.visit === 'waiting') { kenta.g.style.display = ''; kenta.walkTo(DOOR_X, 347); kenta.want.wave = .4; }
        else if (P.night > 0.5 && q.kite === 'done' && mode === 'walk') kenta.g.style.display = 'none';
        else if (!guest && q.visit !== 'inside') kenta.g.style.display = '';
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
        guest.draw(t, dt, P);
        if (player.g.parentNode === home.actors) {
          const front = guest.y > player.y;
          if (front && guest.g.previousElementSibling !== player.g) home.actors.appendChild(guest.g);
          if (!front && guest.g.nextElementSibling !== player.g) home.actors.insertBefore(guest.g, player.g);
        }

      }
      closeup.draw(t, dt, P);
      shodo.draw(t, dt);

      // A missed appointment leaves a recoverable trace rather than blocking the day.
      const visit = q.invitedDay > q.day ? q.visit : nextVisit(q.visit, c.tau, c.inside);
      if (visit !== q.visit) {
        q.visit = visit;
        if (visit === 'waiting') { env.tip('Kenta kapına geldi. Bir süre seni bekleyecek.'); sfx.chime(); }
        if (visit === 'missed') { q.missedNote = false; kenta.g.style.display = 'none'; env.tip('Kapına küçük bir not bırakıldı.'); }
      }
      if (q.visit === 'planned' && c.tau >= .64 && !q.reminded && mode === 'walk') { q.reminded = true; think('Kenta bu akşam gelecekti.', 2.6); }
      if (q.visit === 'inside' && c.inside && !guest && !script && mode === 'walk') run(guestArrives());
      home.canEat = q.invitedDay > q.day || (q.visit !== 'planned' && q.visit !== 'waiting');
      if (guest && home.eaten > guestAte) { guestAte = home.eaten; guest.hop(); ui.heart(guestHead()); sfx.pop(); }
      if (guest && home.step === 0 && guestAte >= 3 && !script && !q.sushi) run(guestLeaves());
      if (!guest && home.eaten > ateSeen) ateSeen = home.eaten;
      if (!guest && q.kite === 'done' && !q.sushi && c.inside && home.step === 0 && ateSeen >= 3 && !script) run(dinnerAlone());
      drawNeighborhood(c);

      // show once how to walk into the alley (that is the way home) and out of the house again
      const calm = mode === 'walk' && !(script && blocks);
      if (alleyTaught === 0 && calm && !c.inside && !c.fair && q.kite === 'done' && Math.abs(player.x - DOOR_X) < 16) {
        alleyTaught = t + 6; env.tip('Ara sokağa doğru yürü: eve gidersin.');
        ui.showGesture('path', () => [[DOOR_X + 2, 380], [DOOR_X + 2, 338]], { period: 2 });
      }
      if (alleyTaught > 0 && (c.inside || t > alleyTaught)) { alleyTaught = -1; ui.hideGesture(); }
      insideT = c.inside ? insideT + dt : 0;
      if (exitTaught === 0 && calm && c.inside && insideT > 12 && Math.abs(player.x - (IX + 40)) < 26) {
        exitTaught = t + 5; env.tip('Dışarı çıkmak için kapıya doğru yürü.');
        ui.showGesture('path', () => [[IX + 40, 378], [IX + 40, 352]], { period: 2 });
      }
      if (exitTaught > 0 && (!c.inside || t > exitTaught)) { exitTaught = -1; ui.hideGesture(); }
      // the old bath house: just a passing thought
      if (!bathSeen && q.kite === 'done' && !c.inside && !c.fair && Math.abs(player.x - BATH_X) < 40 && mode === 'walk' && !script) { bathSeen = true; think('Mahallenin hamamı. Akşamları bacasından buhar tüter.', 3.2); }
      // first time at your door
      if (!arrived && q.kite === 'done' && !c.inside && !c.fair && Math.abs(player.x - DOOR_X) < 30 && player.y > 350 && mode === 'walk' && !script) { arrived = q.homeSeen = true; run(homeArrive()); }

      // night: the fox under the lamp
      fox.draw(t, dt, { inkT: P.inkT, night: P.night });
      if (q.sushi && !q.fox && !c.inside && !c.fair && mode === 'walk') {
        const isNight = P.night > 0.45;
        const atLamp = Math.abs(player.x - LAMP[0]) < 30;
        if (isNight && atLamp) {
          const still = !c.stickActive && player.moving < 0.05;
          if (!toldStill) { toldStill = true; think('Kıpırdamadan bekle…', 3); }
          if (still) stillT += dt; else {
            if (fox.state === 'come' || fox.state === 'sit') { fox.startle(); sfx.nope(); think('Ürktü… bir daha deneyelim.', 2.6); }
            stillT = 0; foxSit = 0;
          }
          ui.stillness(() => [player.x, player.y - 22], Math.min(1, stillT / 10));
          if (stillT > 3 && fox.state === 'away') fox.come(LAMP[0] + 120, player.x + 26, player.y + 4);
          cam = stillT > 1 ? fit(player.x - 70 + stillT * 2, 250, player.x + 120 - stillT * 2, 392, 2.4) : null;
          if (fox.state === 'sit') { foxSit += dt; if (foxSit > 2.6 && foxDone === 0) { foxDone = 1; run(foxMoment()); } }
        } else { ui.stillness(null); if (mode === 'walk' && !script) cam = null; stillT = 0; }
      }
      if (c.tau > .94 && !q.nightHint && mode === 'walk' && !script) { q.nightHint = true; env.tip('Gece ilerledi. Evdeki futonda uyuyabilirsin.'); }
      home.canSleep = c.inside && mode === 'walk' && (c.tau > 0.78 || (q.fox && q.slept < q.day));

      // inside: the next place for the recipe; outside: the way home
      if (q.kite === 'done' && !q.sushi && (q.day === 1 || (q.invitedDay === q.day && ['planned', 'waiting', 'inside'].includes(q.visit))) && mode === 'walk' && !script) {
        if (c.inside) {
          const s = home.step, pr = home.prep;
          const key = s === 0 && pr === 0 ? 'icebox' : s < 4 && pr === 1 ? 'place' : s < 4 ? 'cook' : s === 4 ? 'take' : s === 5 ? 'table' : 'eat';
          if (key !== insideKey) {
            const first = insideKey === '';
            insideKey = key;
            const counter = () => setObj(() => [IX + 292, 300], () => Math.abs(player.x - (IX + 262)) < 24, true);
            if (key === 'icebox') { setObj(() => [IX + 354, 286], () => Math.abs(player.x - (IX + 354)) < 18, true); env.tip(first && player.carryBundle ? 'Bohçanı kapının yanındaki askıya asabilirsin. Balık buz dolabında.' : 'Önce dolaptan balığı al.'); }
            else if (key === 'place') { counter(); env.tip('Balığı tezgâha koy.'); }
            else if (key === 'cook') { counter(); env.tip('Tezgâhta suşi hazırla.'); }
            else if (key === 'take') { counter(); env.tip('Tabağı al.'); }
            else if (key === 'table') { setObj(() => [IX + 186, 316], () => Math.abs(player.x - (IX + 186)) < 30, true); env.tip('Tabağı masaya götür.'); }
            else obj = null;
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
        if (!obj.guided && inScene && obj.since > 35) { obj.guided = true; env.tip('Yön istersen Turna’ya dokun.'); }
        if (isNear && ui.guiding) ui.guide(null);
        if (guideUntil > 0 && t > guideUntil) { ui.guide(null); guideUntil = 0; }
        ui.sparkle(isNear && obj.since > 6 ? obj.at : null);
      } else if (mode !== 'walk') ui.guide(null);
      if (q.kite === 'talked' && mode === 'walk' && !script) ui.sparkle(() => [kenta.x, kenta.y - 30]);
    },
    /** called on any touch: a ring and a sound, everywhere */
    touch(e: PointerEvent) { wakeAudio(); inkRing(card, e.clientX, e.clientY); },
    // debug hooks for headless checks
    _dbg: { q, kenta, fox, closeup, shodo, run, startBrush, get mode() { return mode; }, get picked() { return picked; } },
  };
}
export type Story = ReturnType<typeof createStory>;
