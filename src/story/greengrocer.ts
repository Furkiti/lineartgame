// Ume's greengrocer stall in the willow market, up close. You choose by drawing: a ring around
// what you want lifts it out of its crate onto your furoshiki. Touch something on the cloth to
// put it back. When you are done, the four corners of the cloth are tied over it.
// There is no price: Ume keeps a neighbour's account (a drawing, some day). The only limits are
// what the cloth holds and what your icebox has room for — both are said, never punished.
import { f, pt, type Vec } from '../lib/ink.ts';
import { sfx, haptic, clamp01, lerp, easeOut, easeInOut, backOut, approach } from './fx.ts';
import { ITEMS, BUNDLE, bundleFits, room, type Item, type Pantry } from './pantry.ts';

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

// four crates on a stepped counter, the cloth spread in front
const CRATES: { item: Item; x: number; y: number; slots: Vec[] }[] = [
  { item: 'salatalık', x: 92, y: 214, slots: [[-26, -6], [0, -9], [26, -6], [-13, 6], [13, 6]] },
  { item: 'mandalina', x: 228, y: 214, slots: [[-28, -4], [-9, -8], [10, -8], [29, -4], [-18, 8], [1, 6], [20, 8]] },
  { item: 'yumurta', x: 92, y: 330, slots: [[-24, -2], [-8, -6], [8, -6], [24, -2], [-16, 9], [0, 7], [16, 9]] },
  { item: 'somon', x: 228, y: 330, slots: [[-20, -6], [20, -6], [0, 8]] },
];
const CLOTH: Vec = [160, 448];
const clothPos = (i: number): Vec => [CLOTH[0] + (i - 1.5) * 34, CLOTH[1] - 4 + (i % 2) * 6];

function drawItem(g: Element, item: Item) {
  if (item === 'somon') { fill(g, rect(-16, -7, 16, 8), '#ec8c5f', 1.5); ink(g, 'M-10 6 L-4 -5 M-1 6 L5 -5 M8 6 L12 -2', 1.6, { stroke: '#fff3e6' }); }
  else if (item === 'yumurta') fill(g, ell(0, 0, 7, 9), '#fbf6ea', 1.4);
  else if (item === 'mandalina') { fill(g, ell(0, 0, 9, 8.5), '#f0a046', 1.4); fill(g, 'M0 -8 q3 -5 7 -4 q-2 4 -7 4Z', '#6e9a4e', .9); }
  else { fill(g, 'M-17 1 Q-18 -4 -13 -5 L14 -5 Q18 -4 18 0 Q18 4 14 4 L-13 4 Q-17 4 -17 1Z', '#6f9d45', 1.4); ink(g, 'M-9 -1 l1 0 M0 1 l1 0 M9 -1 l1 0', 1.6, { stroke: '#d9e9bf' }); }
}

export function createGrocer(card: HTMLElement, { onDone, onExit }: { onDone: (items: Item[]) => void; onExit: () => void }) {
  const svg = mk('svg', { class: 'icebox-view', viewBox: '0 0 320 540', preserveAspectRatio: 'xMidYMid meet', 'data-grocer': '' }) as SVGSVGElement;
  svg.style.display = 'none'; svg.style.opacity = '0';
  card.appendChild(svg);
  const back = document.createElement('button'); back.className = 'cu-back'; back.type = 'button'; back.textContent = '‹ Geri'; card.appendChild(back);
  const title = document.createElement('div'); title.className = 'cu-title'; card.appendChild(title);
  const tip = document.createElement('div'); tip.className = 'cu-tip'; card.appendChild(tip);
  const tie = document.createElement('button'); tie.type = 'button'; tie.className = 'cu-serve'; tie.textContent = 'Bohçayı bağla'; card.appendChild(tie);
  [back, title, tip].forEach(n => (n.style.display = 'none'));

  const world = mk('g', {}, svg);
  mk('rect', { x: -400, y: -400, width: 1120, height: 1400, fill: '#f8efdb' }, world);
  // the awning and the posts
  fill(world, 'M-20 70 Q160 50 340 70 L330 112 Q160 96 -10 112Z', '#7d9a5a', 2.2);
  const stripes: string[] = []; for (let x = 0; x <= 320; x += 32) stripes.push(`M${x} ${66 - Math.sin(x / 320 * Math.PI) * 14}l-4 ${f(44 - Math.sin(x / 320 * Math.PI) * 4)}`);
  ink(world, stripes.join(''), 1, { opacity: .5 });
  mk('text', { x: 160, y: 95, 'text-anchor': 'middle', 'font-size': 15, 'font-family': '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif', fill: PAPER }, world).textContent = '八百屋';
  ink(world, 'M22 100V520 M298 100V520', 3);
  // Ume behind the counter: a calm face and a headscarf, drawn small
  const ume = mk('g', { transform: 'translate(160 150)' }, world);
  fill(ume, 'M-22 40 Q-24 6 0 4 Q24 6 22 40Z', '#5d6f86', 1.8);
  fill(ume, ell(0, -10, 13, 14), '#f6e8d6', 1.8);
  fill(ume, 'M-15 -12 Q-14 -30 0 -29 Q14 -30 15 -12 Q8 -20 0 -20 Q-8 -20 -15 -12Z', '#c8423a', 1.6);
  ink(ume, 'M-5 -9 q2 -2 4 0 M2 -9 q2 -2 4 0 M-3 -1 q3 3 6 0', 1.3);
  // counter steps
  fill(world, rect(30, 240, 290, 252), '#b98c58', 2);
  fill(world, rect(30, 356, 290, 368), '#b98c58', 2);
  // crates
  const crates = CRATES.map(c => {
    const g = mk('g', { transform: `translate(${c.x} ${c.y})`, 'data-crate': c.item }, world);
    fill(g, 'M-56 -6 L56 -6 L52 24 L-52 24Z', '#d9b380', 1.8);
    ink(g, 'M-54 6H54 M-30 -6V24 M30 -6V24', .8, { opacity: .5 });
    fill(g, rect(-34, 14, 34, 24), PAPER, 1);
    mk('text', { x: 0, y: 22, 'text-anchor': 'middle', 'font-size': 8, 'font-style': 'italic', 'font-family': '"Iowan Old Style", Georgia, serif', fill: INK }, g).textContent = ITEMS[c.item].name.toLowerCase();
    if (c.item === 'somon') fill(g, 'M-50 -6 Q0 -16 50 -6', '#e3eeec', 1.2);
    const tag = mk('g', { 'data-wanted': c.item, opacity: 0 }, g);
    ink(tag, 'M44 14 L52 4', 1, { stroke: '#c8423a' }); fill(tag, 'M50 -2 L62 -2 L62 8 L50 8Z', '#c8423a', 1); mk('text', { x: 56, y: 6, 'text-anchor': 'middle', 'font-size': 7, fill: PAPER }, tag).textContent = '✓';
    return g;
  });
  // the cloth: indigo with a white wave pattern
  const cloth = mk('g', {}, world);
  const clothBody = fill(cloth, `M${CLOTH[0] - 92} ${CLOTH[1] - 30} L${CLOTH[0] + 92} ${CLOTH[1] - 30} L${CLOTH[0] + 100} ${CLOTH[1] + 30} L${CLOTH[0] - 100} ${CLOTH[1] + 30}Z`, '#34507a', 2);
  const clothWaves = ink(cloth, `M${CLOTH[0] - 80} ${CLOTH[1] + 18} q10 -8 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0`, 1.2, { stroke: '#e8eef4', opacity: .7 });
  const knot = fill(cloth, `M${CLOTH[0] - 10} ${CLOTH[1] - 40} q-14 -14 -4 -18 q8 0 14 12 q6 -12 14 -12 q10 4 -4 18Z`, '#34507a', 1.6, { opacity: 0 });
  const capText = mk('text', { x: CLOTH[0], y: CLOTH[1] - 40, 'text-anchor': 'middle', 'font-size': 11, 'font-style': 'italic', 'font-family': '"Iowan Old Style", Georgia, serif', fill: INK }, world);

  // the goods
  const goods = mk('g', {}, world);
  type Good = { item: Item; crate: number; slot: number; g: SVGGElement; pos: Vec; on: number; lift: number };
  let all: Good[] = [];
  const ring = ink(world, '', 2.2, { opacity: 0, stroke: '#c8423a' });
  const noteG = mk('g', { opacity: 0, 'pointer-events': 'none' }, world);
  const noteBody = fill(noteG, '', PAPER, 1.1);
  const noteText = mk('text', { x: 0, y: -2, 'text-anchor': 'middle', 'font-size': 11, 'font-style': 'italic', 'font-family': '"Iowan Old Style", Georgia, serif', fill: INK }, noteG);
  let noteT = -1, noteAt: Vec = [0, 0];
  function note(at: Vec, text: string) {
    noteText.textContent = text; noteAt = [Math.max(80, Math.min(240, at[0])), at[1] - 24]; noteT = 0;
    const w = text.length * 5.6 + 22;
    noteBody.setAttribute('d', `M${f(-w / 2)} -16 h${f(w)} v20 h${f(-w / 2 + 4)} l-4 6 l-4 -6 h${f(-w / 2 + 4)}Z`);
  }

  // ghost finger
  const ghostG = mk('g', { opacity: 0, 'pointer-events': 'none' }, svg);
  const ghostTrail = mk('path', { fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-dasharray': '.1 5', opacity: .55 }, ghostG);
  const ghostHand = mk('g', {}, ghostG);
  mk('path', { d: 'M0 0 Q-1.6 -0.4 -1.6 1.6 L-1.4 9 Q-4.6 7 -6 8.6 Q-6.8 10 -4.8 12 L0.4 18 Q2.6 20.6 6.6 20.6 L10 20.6 Q14.6 20.4 15 15.6 L15.4 9.6 Q15.4 7.6 13.4 7.6 Q12.2 7.6 11.8 8.8 Q11.8 6.6 9.8 6.6 Q8.4 6.6 8 8 Q8 6 6 6 Q4.4 6 4 7.4 L1.8 1.6 Q1.6 0 0 0Z', fill: PAPER, stroke: INK, 'stroke-width': .9, 'stroke-linejoin': 'round', transform: 'scale(1.9)' }, ghostHand);
  let ghostT = 0, ghostOn = false, ghostOp = 0;
  const ghostPts = (): Vec[] => Array.from({ length: 22 }, (_, i) => { const a = i / 21 * Math.PI * 2 - Math.PI / 2; return [CRATES[2].x + Math.cos(a) * 18, CRATES[2].y - 2 + Math.sin(a) * 15] as Vec; });

  // ------------------------------------------------------------------ state
  let open = false, op = 0, pantry: Pantry | null = null, drawing = false, stroke: Vec[] = [], ringOp = 0, tieT = -1, idle = 0, openT = 0, closeT = -1;
  const picked = () => all.filter(g => g.on >= 0).sort((a, b) => a.on - b.on);
  const relay = () => picked().forEach((g, i) => (g.on = i));
  const home = (g: Good): Vec => g.on >= 0 ? clothPos(g.on) : [CRATES[g.crate].x + CRATES[g.crate].slots[g.slot][0], CRATES[g.crate].y + CRATES[g.crate].slots[g.slot][1]];
  const local = (e: PointerEvent): Vec => { const m = svg.getScreenCTM(); const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const r = m ? p.matrixTransform(m.inverse()) : p; return [r.x, r.y]; };
  const inside = (p: Vec, poly: Vec[]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };

  function lasso(poly: Vec[]) {
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const gap = Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]);
    if (size < 12) return false;
    if (gap > Math.max(26, size * .55)) { note(poly[0], 'Halkanın uçlarını birleştir'); return true; }
    const caught = all.filter(g => g.on < 0 && inside(g.pos, poly));
    if (!caught.length) { note(poly[0], 'Halkanın içine bir şey al'); return true; }
    let took = 0, why = '';
    for (const g of caught) {
      const now = picked().map(x => x.item);
      if (pantry && !bundleFits(pantry, now, g.item)) { why = now.length >= BUNDLE ? 'Bohça dolu' : `Dolabında ${ITEMS[g.item].name.toLowerCase()} için yer yok`; continue; }
      g.on = now.length; took++;
    }
    if (took) { sfx.chime(); haptic(10); } else sfx.nope();
    if (why) note(caught[0].pos, why);
    return true;
  }

  svg.addEventListener('pointerdown', (e) => {
    if (!open || tieT >= 0 || drawing) return;
    e.preventDefault(); svg.setPointerCapture(e.pointerId);
    const p = local(e); idle = 0; ghostOn = false;
    // touching something on the cloth puts it back
    const back = picked().find(g => Math.hypot(g.pos[0] - p[0], g.pos[1] - p[1]) < 16);
    if (back) { back.on = -1; relay(); sfx.tap(); return; }
    drawing = true; stroke = [p]; ringOp = 1; sfx.paper();
  });
  svg.addEventListener('pointermove', (e) => { if (drawing) stroke.push(local(e)); });
  const up = () => { if (!drawing) return; drawing = false; if (stroke.length > 3) lasso(stroke); };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  back.addEventListener('click', () => { if (open) api.close(false); });
  tie.addEventListener('click', () => { if (!open || tieT >= 0 || !picked().length) return; tieT = 0; sfx.paper(); haptic(12); tip.classList.remove('show'); });

  const api = {
    get isOpen() { return open; },
    get picked() { return picked().map(g => g.item); },
    _client(p: Vec): Vec { const m = svg.getScreenCTM()!; const q = svg.createSVGPoint(); q.x = p[0]; q.y = p[1]; const r = q.matrixTransform(m); return [r.x, r.y]; },
    get _goods() { return all.map(g => ({ item: g.item, pos: g.pos, on: g.on })); },
    open(p: Pantry, wanted: Item[] = []) {
      open = true; op = 0; pantry = p; tieT = closeT = -1; idle = 0; openT = 0; ghostOn = false; drawing = false; stroke = [];
      all.forEach(g => g.g.remove()); all = [];
      CRATES.forEach((c, ci) => c.slots.forEach((_, si) => { const g = mk('g', { 'data-good': c.item }, goods); drawItem(g, c.item); const it: Good = { item: c.item, crate: ci, slot: si, g, pos: [0, 0], on: -1, lift: 0 }; it.pos = home(it); all.push(it); }));
      svg.style.display = 'block'; svg.classList.add('show');
      [back, title, tip].forEach(n => (n.style.display = 'block')); back.classList.add('show');
      title.innerHTML = '<span>Söğüt Pazarı · Ume</span> Taze manav'; title.classList.remove('show'); void title.offsetWidth; title.classList.add('show');
      tip.classList.remove('show');
      [clothBody, clothWaves].forEach(n => n.setAttribute('transform', '')); knot.setAttribute('opacity', '0');
      // what you noted at the icebox wears a little red tag
      crates.forEach((g, i) => g.querySelector('[data-wanted]')?.setAttribute('opacity', wanted.includes(CRATES[i].item) ? '1' : '0'));
    },
    close(done: boolean) {
      const items = done ? picked().map(g => g.item) : [];
      open = false; drawing = false; svg.classList.remove('show'); svg.style.display = 'none'; svg.style.opacity = '0';
      [back, title, tip].forEach(n => { n.classList.remove('show'); n.style.display = 'none'; }); tie.classList.remove('show');
      if (done) onDone(items); else onExit();
    },
    draw(t: number, dt: number) {
      if (!open) return;
      op = approach(op, closeT >= 0 ? 0 : 1, 7, dt); svg.style.opacity = f(easeOut(op));
      openT += dt; idle += dt;
      if (openT > .7 && !tip.classList.contains('show') && tieT < 0) { tip.textContent = 'İstediğin şeyin etrafına bir halka çiz. Bohçaya geçer.'; tip.classList.add('show'); if (openT < 1) ghostOn = true; }
      if (idle > 7 && !picked().length && !drawing) { ghostOn = true; idle = 0; }
      // the ring you draw
      ringOp = approach(ringOp, drawing ? 1 : 0, 4, dt);
      if (stroke.length > 1) ring.setAttribute('d', 'M' + stroke.map(pt).join('L'));
      ring.setAttribute('opacity', f(ringOp * .9));
      // goods glide to the cloth and back
      for (const g of all) {
        const h = home(g); g.pos = [approach(g.pos[0], h[0], 9, dt), approach(g.pos[1], h[1], 9, dt)];
        const flying = Math.hypot(g.pos[0] - h[0], g.pos[1] - h[1]);
        g.lift = approach(g.lift, flying > 4 ? 1 : 0, 10, dt);
        const shrink = tieT >= 0 && g.on >= 0 ? 1 - easeInOut(clamp01(tieT / .6)) * .6 : 1;
        g.g.setAttribute('transform', `translate(${f(g.pos[0])} ${f(g.pos[1] - g.lift * 10)}) scale(${f((1 + g.lift * .1) * shrink)})`);
        g.g.setAttribute('opacity', f(tieT >= 0 && g.on >= 0 ? 1 - clamp01((tieT - .4) / .3) : 1));
      }
      const n = picked().length;
      capText.textContent = pantry ? `${n} / ${BUNDLE}` + (n ? ' · ' + picked().map(g => ITEMS[g.item].name.toLowerCase()).join(', ') : '') : '';
      tie.classList.toggle('show', n > 0 && tieT < 0);
      // tying: the cloth gathers its corners and knots over what you chose
      if (tieT >= 0) {
        tieT += dt;
        const u = easeInOut(clamp01(tieT / .7));
        clothBody.setAttribute('transform', `translate(${CLOTH[0]} ${CLOTH[1]}) scale(${f(1 - u * .55)} ${f(1 - u * .2)}) translate(${-CLOTH[0]} ${-CLOTH[1]})`);
        clothWaves.setAttribute('transform', clothBody.getAttribute('transform')!);
        knot.setAttribute('opacity', f(clamp01((tieT - .5) / .2)));
        knot.setAttribute('transform', `translate(0 ${f((1 - backOut(clamp01((tieT - .5) / .4))) * 10)})`);
        if (tieT > .9 && tieT - dt <= .9) sfx.success();
        if (tieT > 1.5 && closeT < 0) closeT = 0;
      }
      if (closeT >= 0) { closeT += dt; if (closeT > .5) { api.close(true); return; } }
      if (noteT >= 0) { noteT += dt; if (noteT > 2.4) noteT = -1; }
      noteG.setAttribute('opacity', f(noteT >= 0 ? Math.min(1, noteT * 5) * (1 - clamp01((noteT - 2) / .4)) : 0));
      noteG.setAttribute('transform', `translate(${f(noteAt[0])} ${f(noteAt[1])})`);
      // the ghost finger draws a ring around the eggs
      ghostOp = approach(ghostOp, ghostOn && !drawing ? 1 : 0, 6, dt);
      ghostG.setAttribute('opacity', f(ghostOp));
      if (ghostOn) {
        ghostT += dt; const pts = ghostPts(); const u = (ghostT % 2.8) / 2.8, k = clamp01((u - .1) / .7), seg = (pts.length - 1) * easeInOut(k), i = Math.min(pts.length - 2, Math.floor(seg)), fr = seg - i;
        const p: Vec = [lerp(pts[i][0], pts[i + 1][0], fr), lerp(pts[i][1], pts[i + 1][1], fr)];
        ghostTrail.setAttribute('d', 'M' + pts.map(pt).join('L')); ghostHand.setAttribute('transform', `translate(${f(p[0])} ${f(p[1])})`);
        if (ghostT > 6) ghostOn = false;
      } else ghostT = 0;
      void room; void crates;
    },
  };
  return api;
}
export type Grocer = ReturnType<typeof createGrocer>;
