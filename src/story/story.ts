// One unhurried day in the ink street. Some things you must do because they are the fun
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
import { createNotebook, SKETCH, type Entry } from './notebook.ts';
import { sfx, haptic, wakeAudio, inkRing, approach, clamp01, easeOut, backOut } from './fx.ts';

type Home = {
  actors: SVGGElement; step: number; eaten: number; canSleep: boolean; prep: number; bagHung: boolean; catHome: boolean;
  setStep(n: number): void; prompt(pl: unknown): string | null;
};
type Player = { x: number; y: number; heading: number; moving: number; faceTo: number | null; carryBundle: boolean; setHeading(h: number): void; g: SVGGElement };
type Cat = { g: SVGGElement; poke(): void };
type Ctx = {
  t: number; dt: number; P: { inkT: number; night: number; lamp: number; paper: number[] }; wind: number; tau: number; inside: boolean;
  base: { w: number; h: number }; stickActive: boolean; stickTouched: boolean;
};
type Cam = { cx: number; cy: number; z: number } | null;
type Wait = number | (() => boolean);
type Scene = Generator<Wait, void, unknown>;

const KENTA_HOME: Vec = [436, 357];
const STUCK: Vec = [486, 196];
const LAMP: Vec = [446, 352];
const DOOR_X = 826;
const PLATE: Vec = [861, 307];           // the nameplate by your door
const LANTERN = { x: 760, top: 293, cy: 309, r: 8.2, h: 22 };
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
  svg: SVGSVGElement; card: HTMLElement; ui: UI; home: Home; player: Player; cat: Cat;
  layers: { front: Element; walkers: Element; glow: Element; stroke: Element };
  env: { setTau(v: number): void; fade(v: number): void; isFaded(): boolean; tip(text: string | null, sticky?: boolean): void; banner(a: string, b: string): void };
}) {
  const { svg, card, ui, home, player, cat, layers, env } = o;

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
  el('path', { d: 'M870 302 L884 302 L884 315 L870 315Z M872 306 L882 306', fill: '#a8794d', stroke: 'currentColor', 'stroke-width': 0.6 }, homeFront);
  el('path', { d: 'M884 303 L884 296 L889 297.6 L884 299.4', fill: '#c8423a', stroke: 'currentColor', 'stroke-width': 0.4 }, homeFront);
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

  // the toy you draw for the cat
  const toyG = el('g', {}, layers.front);
  const toy = { on: false, p: [0, 0] as Vec, v: [0, 0] as Vec, rot: 0, w: 0, t: 0, ground: 352, line: [] as Vec[] };

  // ------------------------------------------------------------------ notebook
  const notebook = createNotebook(card);
  const q = {
    kite: 'sad' as 'sad' | 'talked' | 'done', dinner: '' as '' | 'kenta' | 'alone', sushi: false, fox: false,
    lantern: false, toy: false, catHome: false, fresh: new Set<string>(), day: 1, slept: 0,
  };
  let kiteLine: Vec[] = [];
  const entries = (): Entry[] => [
    { id: 'kite', title: 'Kenta’nın uçurtması', hint: 'Kiraz ağacının altında biri üzgün.', sketch: kiteLine.length ? sketchOf([[...kiteLine, kiteLine[0]]]) : SKETCH.kite, done: q.kite === 'done', fresh: q.fresh.has('kite') },
    { id: 'lantern', title: 'Kapımın feneri', hint: 'Kapının yanındaki fener bomboş.', sketch: q.lantern ? sketchOf(lanternLines) : SKETCH.lantern, done: q.lantern, fresh: q.fresh.has('lantern') },
    { id: 'toy', title: q.catHome ? 'Eve gelen kedi' : 'Kedinin oyuncağı', hint: 'Bankta bir kedi uyukluyor.', sketch: q.toy ? sketchOf([toy.line]) : SKETCH.cat, done: q.toy, fresh: q.fresh.has('toy') },
    { id: 'sushi', title: q.dinner === 'kenta' ? 'Kenta’yla akşam yemeği' : q.dinner === 'alone' ? 'Sessiz bir akşam yemeği' : 'Akşam yemeği', hint: 'Mutfakta suşi yap.', sketch: SKETCH.sushi, done: q.sushi, fresh: q.fresh.has('sushi') },
    { id: 'fox', title: 'Gece misafiri', hint: 'Gece fenerin altında… sessizce.', sketch: SKETCH.fox, done: q.fox, fresh: q.fresh.has('fox') },
  ];
  const defterBtn = document.createElement('button');
  defterBtn.type = 'button'; defterBtn.className = 'defter-btn'; defterBtn.setAttribute('aria-label', 'Defter');
  defterBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 3h11a3 3 0 0 1 3 3v15H8a3 3 0 0 1-3-3Z M8 3v18 M11 8h5 M11 11h5"/></svg><span class="dots">${'<i></i>'.repeat(5)}</span>`;
  card.appendChild(defterBtn);
  const dots = [...defterBtn.querySelectorAll('.dots i')] as HTMLElement[];
  const refreshDots = () => { [q.kite === 'done', q.lantern, q.toy, q.sushi, q.fox].forEach((d, i) => dots[i].classList.toggle('on', d)); };
  defterBtn.addEventListener('click', () => {
    sfx.tap();
    notebook.show({ dayN: q.day, subtitle: 'bugün', entries: entries(), sentence: daySentence(false), button: 'Kapat' });
  });
  const mark = (id: string) => {
    q.fresh.add(id); refreshDots();
    defterBtn.classList.remove('bump'); void defterBtn.offsetWidth; defterBtn.classList.add('bump');
  };
  function daySentence(end: boolean) {
    const s: string[] = [];
    if (q.kite === 'done') s.push('Kenta’ya bir uçurtma çizdim');
    if (q.lantern) s.push('kapımın fenerine resim yaptım');
    if (q.toy) s.push(q.catHome ? 'bir kedi eve geldi' : 'bankta bir kediyle oynadık');
    if (q.sushi) s.push(q.dinner === 'kenta' ? 'Kenta’yla suşi yedik' : 'akşamı sessizce, suşiyle geçirdim');
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
  let mode: 'walk' | 'cine' | 'brush' | 'cook' | 'sleep' = 'walk';
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
  function* intro(): Scene {
    yield 0.6;
    env.banner(`${q.day}. gün`, 'Sabah. Sokak yavaşça uyanıyor.');
    yield 3;
    // teach walking once: a ghost hand drags on the ground beside you
    if (!ctx.stickTouched) {
      env.tip('Ekranda bir yere bas ve sürükle.', true);
      ui.showGesture('path', () => [[player.x - 4, player.y + 14], [player.x + 26, player.y + 14]]);
      yield () => ctx.stickTouched;
      ui.hideGesture(); env.tip(null);
    }
    yield 1.4;
    // the paper crane comes to say hello, and to say what it is for
    ui.guide(() => [player.x + 12, player.y - 62]);
    yield 2.2;
    ui.say(() => ui.craneAt(), 'Günaydın! Ben kâğıt turna.', 2.8);
    yield 3;
    ui.say(() => ui.craneAt(), 'Ne zaman kırmızı kanatlarımı görürsen beni takip et.', 3.6);
    yield 3.8;
    ui.say(() => ui.craneAt(), 'Seni gitmen gereken yere götürürüm. Acele yok.', 3.2);
    yield 3.2;
    env.tip('Kırmızı turnayı takip et.');
    setObj(kentaHead, () => Math.abs(player.x - kenta.x) < 60, false);
    obj!.guided = true; ui.guide(kentaHead);
  }

  function* talk(): Scene {
    mode = 'cine'; obj = null; ui.guide(null);
    const x0 = Math.min(player.x, kenta.x), x1 = Math.max(player.x, kenta.x);
    cam = fit(x0 - 45, 268, x1 + 45, 382, 2.2);
    player.faceTo = kenta.x > player.x ? 0.25 : Math.PI - 0.25;
    kenta.dir = player.x < kenta.x ? -1 : 1;
    kenta.want.sad = 0.4;
    yield 0.8;
    ui.say(kentaHead, 'Uçurtmam ağaca takıldı…');
    yield 2.8;
    kenta.want.look = 1;
    cam = fit(STUCK[0] - 70, STUCK[1] - 60, STUCK[0] + 70, STUCK[1] + 80, 2.4);
    yield 2.4;
    cam = fit(x0 - 45, 268, x1 + 45, 382, 2.2);
    kenta.want.look = 0; kenta.want.sad = 0.7;
    ui.say(kentaHead, 'Yenisini çizebilen biri olsa…');
    yield 3;
    q.kite = 'talked';
    think('Bohçamda bir fırça vardı…', 3);
    ui.sparkle(() => [player.x - (Math.cos(player.heading) >= 0 ? 6 : -6), player.y - 30]);
    sfx.chime();
    yield 1.6;
    player.faceTo = null; mode = 'walk'; cam = null;
  }

  // the brush, for one of three things
  function startBrush(what: Purpose) {
    if (!player.carryBundle) { think('Fırçam bohçada… bohçam evde, askıda.', 3); sfx.nope(); return; }
    purpose = what; mode = 'brush'; ui.sparkle(null); fails = 0; lanternStrokes = 0; obj = null; ui.guide(null);
    pad.classList.add('show');
    // the same line weight on screen however close the camera is
    stroke.setScale(what === 'lantern' ? 0.32 : what === 'toy' ? 0.62 : 1);
    if (what === 'kite') {
      cam = fit(372, 148, 524, 388, 2.4);
      kenta.dir = 1;
      env.tip('Kenta’ya bir uçurtma çiz. Nasıl çizersen öyle olur.', true);
      const c: Vec = [kenta.x + 36, 292];
      ui.showGesture('path', () => [[c[0], c[1] - 18], [c[0] + 13, c[1]], [c[0], c[1] + 18], [c[0] - 13, c[1]], [c[0], c[1] - 18]], { period: 3 });
    } else if (what === 'lantern') {
      cam = fit(L.x - 26, L.top - 8, L.x + 26, L.top + L.h + 14, 6);
      env.tip('Fenerin üstüne ne istersen çiz.', true);
      ui.showGesture('path', () => [[L.x - 4, L.cy - 6], [L.x + 3, L.cy - 2], [L.x - 3, L.cy + 3], [L.x + 4, L.cy + 7]], { period: 2.6 });
    } else {
      cam = fit(500, 262, 600, 362, 3);
      env.tip('Kediye bir oyuncak çiz: top, balık, ne istersen.', true);
      ui.showGesture('path', () => Array.from({ length: 13 }, (_, i) => [CAT[0] - 24 + Math.cos(i / 12 * 6.283) * 6, CAT[1] - 18 + Math.sin(i / 12 * 6.283) * 6] as Vec), { period: 2.6 });
    }
  }
  function endBrush() {
    pad.classList.remove('show'); ui.hideGesture(); env.tip(null);
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
      run(toyBorn(pts.slice(), r.size)); return;
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
    mode = 'cine'; pad.classList.remove('show'); env.tip(null); ui.hideGesture();
    kiteLine = pts;
    stroke.vanish(); kite.birth(pts); stuck.remove();
    sfx.chime(); haptic(16);
    yield 1.1;
    kenta.hop(); kenta.want.raise = 1; kenta.want.sad = 0; kenta.want.look = 0.6;
    sfx.pop(); ui.heart(kentaHead());
    cam = fit(360, 110, 530, 388, 2.2);
    yield 1.8;
    ui.say(kentaHead, corners <= 1 ? 'Yuvarlak bir uçurtma! Hiç görmemiştim!' : corners >= 5 ? 'Yıldız gibi bir uçurtma! Çok güzel!' : corners === 2 ? 'Ne tuhaf, ne güzel bir uçurtma!' : 'Tam bir uçurtma! Benim uçurtmam!');
    q.kite = 'done'; mark('kite'); sfx.success();
    yield 3.2;
    kenta.want.look = 0;
    cam = fit(Math.min(player.x, kenta.x) - 45, 268, Math.max(player.x, kenta.x) + 45, 382, 2.2);
    ui.say(kentaHead, 'Bir şey sorabilir miyim?');
    yield 2.4;
    ui.say(kentaHead, 'Akşam yemeğe sana gelebilir miyim?', 60);
    const a = yield* choose(['Tabii, gel!', 'Bu akşam olmaz']);
    if (a === 0) {
      q.dinner = 'kenta'; kenta.hop(); ui.heart(kentaHead()); sfx.pop();
      ui.say(kentaHead, 'Yaşasın! Akşam görüşürüz!');
    } else {
      q.dinner = 'alone'; kenta.want.sad = 0.5;
      ui.say(kentaHead, 'Olsun… Uçurtmam bana yeter!');
      yield 2.4; kenta.want.sad = 0;
    }
    yield 2.4;
    mode = 'walk'; cam = null;
    toDoor();
    env.tip('Turna seni evine götürüyor.');
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
    mode = 'cine'; pad.classList.remove('show'); env.tip(null); ui.hideGesture();
    // the shape you drew, as you drew it, becomes a toy that drops onto the bench
    const n = stroke.copy(toyG); n.setAttribute('fill', 'currentColor');
    const closed = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < Math.max(8, size * 0.45);
    if (closed) el('path', { d: 'M' + pts.map(pt).join('L') + 'Z', fill: '#c8423a', opacity: 0.85 }, toyG).parentNode!.insertBefore(toyG.lastChild!, toyG.firstChild);
    stroke.clear();
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    toyG.setAttribute('transform', '');
    [...toyG.children].forEach((c) => c.setAttribute('transform', `translate(${f(-cx)} ${f(-cy)})`));
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
    if (!q.lantern) { ui.sparkle(() => [L.x, L.cy]); think('Kapımın feneri bomboş…', 2.6); yield 2.4; ui.sparkle(null); }
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
    guest = createKenta(home.actors, IX + 30, 356); guestAte = 0;
    guest.want.sad = 0; guest.dir = 1; guest.speed = 20;
    guest.g.setAttribute('opacity', '0');
    kenta.g.style.display = 'none'; kite.draw(0, 0, 0, null); // the street Kenta has come over
    yield 0.6;
    guest.g.setAttribute('opacity', '1'); sfx.tap();
    ui.say(guestHead, 'Konbanwa! Kokusu buraya kadar geliyor!');
    guest.walkTo(IX + 214, 353);
    yield () => !guest!.walking;
    guest.dir = -1;
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
    q.sushi = true; mark('sushi');
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

  let stillT = 0, foxSit = 0, foxDone = 0, toldStill = false, sunTaught = false, insideKey = '', arrived = false, ateSeen = 0;
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
    notebook.show({ dayN: q.day, subtitle: 'gün bitti', entries: entries(), sentence: daySentence(true), button: 'Günaydın', then: () => { closed = true; } });
    q.fresh.clear();
    yield () => closed;
    q.slept = q.day; q.day++;
    env.setTau(0.27);
    cam = null;
    env.fade(0);
    yield 1;
    env.banner(`${q.day}. gün`, q.dinner === 'kenta' ? 'Devamı yakında: Kenta kapını çalacak…' : 'Devamı yakında: mektuplar, Hana’nın feneri…');
    mode = 'walk';
  }

  // ------------------------------------------------------------------ what the action button offers on the street
  const nearKenta = () => Math.abs(player.x - kenta.x) < 34 && Math.abs(player.y - kenta.y) < 18 && kenta.g.style.display !== 'none';
  const nearLantern = () => Math.abs(player.x - L.x) < 20;
  const nearCat = () => Math.abs(player.x - CAT[0]) < 30 && cat.g.style.display !== 'none';
  function offer(): { label: string; go: () => void } | null {
    if (ctx.inside || (script && blocks)) return null;
    if (q.kite !== 'done' && nearKenta()) return q.kite === 'sad' ? { label: 'Kenta ile konuş', go: () => run(talk()) } : { label: 'Fırçayı çıkar', go: () => startBrush('kite') };
    if (q.kite === 'done' && !q.lantern && nearLantern()) return { label: 'Fenere bir şey çiz', go: () => startBrush('lantern') };
    if (q.kite === 'done' && !q.toy && nearCat()) return { label: 'Kediye oyuncak çiz', go: () => startBrush('toy') };
    return null;
  }

  // ------------------------------------------------------------------ api
  run(intro(), false);
  refreshDots();
  return {
    get freeze() { return mode !== 'walk'; },
    get cam() { return cam; },
    get mode() { return mode; },
    get closeupOpen() { return closeup.isOpen; },
    /** what the action button says, if the story has something to offer */
    prompt(): string | null {
      if (mode === 'brush') return purpose === 'lantern' && lanternStrokes > 0 ? 'Bitti' : 'Vazgeç';
      if (mode !== 'walk') return '';
      return offer()?.label ?? null;
    },
    act(): boolean {
      if (mode === 'brush') { endBrush(); return true; }
      if (mode !== 'walk') return true;
      const o2 = offer();
      if (o2) { sfx.tap(); o2.go(); return true; }
      return false;
    },
    /** the home asks the story to take over */
    onHome(what: 'cook' | 'sleep') { if (what === 'cook') run(cookIn()); else run(sleep()); },
    sortables(): { g: SVGGElement; y: number }[] { return ctx && !ctx.inside ? [kenta, fox].filter((c) => c.g.style.display !== 'none') : []; },

    update(c: Ctx) {
      ctx = c;
      const { t, dt, P, wind } = c;
      if (script) { if (waitFn) { if (waitFn()) { waitFn = null; advance(); } } else { waitT -= dt; if (waitT <= 0) advance(); } }

      // street Kenta: sad under the tree, then flying his kite, wandering a little
      if (kenta.g.style.display !== 'none') {
        if (q.kite === 'done' && !kenta.walking && Math.random() < dt * 0.2) kenta.walkTo(410 + Math.random() * 60, 353 + Math.random() * 8);
        kenta.speed = q.kite === 'done' ? 14 : 20;
        kenta.draw(t, dt, P);
        if (q.kite !== 'done' && mode === 'walk' && !(script && blocks)) {
          kenta.dir = player.x < kenta.x ? -1 : 1;
          if (Math.random() < dt * 0.16 && Math.abs(player.x - kenta.x) > 40 && !ui.speaking) ui.say(kentaHead, '…', 2);
        }
        // at night he goes home (unless he is coming to yours)
        if (P.night > 0.5 && q.kite === 'done' && mode === 'walk') kenta.g.style.display = 'none';
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
        if (!c.inside && !q.sushi && home.step === 0 && guest.walking) { guest.g.remove(); guest = null; script = null; mode = 'walk'; cam = null; q.sushi = true; mark('sushi'); toLamp(); }
      }
      closeup.draw(t, dt, P);

      // dinner: with Kenta if you said yes; a quiet one if not
      if (q.kite === 'done' && !q.sushi && c.inside && home.step === 6 && q.dinner === 'kenta' && !guest && !script) run(guestArrives());
      if (guest && home.eaten > guestAte) {
        guestAte = home.eaten; guest.hop(); ui.heart(guestHead()); sfx.pop();
        if (guestAte === 1) ui.say(guestHead, 'Oishii!');
        if (guestAte === 2) ui.say(guestHead, 'Bu somon ağızda eriyor!');
      }
      if (guest && home.step === 0 && !script && !q.sushi) run(guestLeaves());
      if (q.dinner !== 'kenta' && c.inside && home.step === 6 && home.eaten > ateSeen) { ateSeen = home.eaten; if (ateSeen === 1) think('Mm. Pirinç tam kıvamında.', 2.4); }
      if (q.dinner !== 'kenta' && q.kite === 'done' && !q.sushi && c.inside && home.step === 0 && ateSeen >= 3 && !script) run(dinnerAlone());

      // first time at your door
      if (!arrived && q.kite === 'done' && !c.inside && Math.abs(player.x - DOOR_X) < 50 && mode === 'walk' && !script) { arrived = true; run(homeArrive()); }

      // night: the fox under the lamp
      fox.draw(t, dt, { inkT: P.inkT, night: P.night });
      if (q.sushi && !q.fox && !c.inside && mode === 'walk') {
        const isNight = P.night > 0.45;
        if (!isNight && !sunTaught && !script) {
          sunTaught = true;
          const u = (c.tau - 0.225) / 0.55;
          if (u > 0 && u < 1) {
            const sun = (v: number): Vec => [40 + 880 * v, 300 - 236 * Math.sin(Math.PI * v)];
            env.tip('Geceyi beklemek istemezsen güneşi sürükle.');
            ui.showGesture('path', () => { const uu = Math.max(0.02, Math.min(0.98, (ctx.tau - 0.225) / 0.55)); return [sun(uu), sun(Math.min(1, uu + 0.12)), sun(Math.min(1, uu + 0.24))]; }, { period: 2.6 });
            hideSunHintAt = t + 7;
          }
        }
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
      if (hideSunHintAt > 0 && t > hideSunHintAt) { hideSunHintAt = -1; ui.hideGesture(); env.tip(null); }
      home.canSleep = c.inside && mode === 'walk' && (c.tau > 0.75 || c.tau < 0.21 || (q.fox && q.slept < q.day));

      // inside: the next place for the recipe; outside: the way home
      if (q.kite === 'done' && !q.sushi && mode === 'walk' && !script) {
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
        } else {
          insideKey = '';
          if (!obj || obj.inside) toDoor();
        }
      }

      // guide crane and the hint ladder
      if (obj && mode === 'walk' && !(script && blocks)) {
        obj.since += dt;
        const inScene = obj.inside === c.inside;
        const isNear = obj.near();
        if (!obj.guided && inScene && obj.since > 0.4) { obj.guided = true; ui.guide(obj.at); }
        if (isNear && ui.guiding) ui.guide(null);
        if (!isNear && !ui.guiding && obj.since > 22 && inScene) { ui.guide(obj.at); obj.since = 0; }
        ui.sparkle(isNear && obj.since > 6 ? obj.at : null);
      } else if (mode !== 'walk') ui.guide(null);
      if (q.kite === 'talked' && mode === 'walk' && !script) ui.sparkle(() => [kenta.x, kenta.y - 30]);
    },
    /** called on any touch: a ring and a sound, everywhere */
    touch(e: PointerEvent) { wakeAudio(); inkRing(card, e.clientX, e.clientY); },
    // debug hooks for headless checks
    _dbg: { q, kenta, fox, closeup, run, startBrush, get mode() { return mode; }, get picked() { return picked; } },
  };
}
let hideSunHintAt = -1;
export type Story = ReturnType<typeof createStory>;
