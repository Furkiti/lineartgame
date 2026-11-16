// The story's in-world signs, drawn in the scene's own pen: speech balloons over heads,
// the red guide crane, a ghost hand that shows a gesture once, the breathing ring that
// says "stay still", hearts and a twinkle on things worth a look.
// Everything is placed in scene units and counter-scaled by the camera, so it reads the
// same size on a phone held upright, sideways, or zoomed in.
import { el, f, pt, PAPER, type Vec } from '../lib/ink.ts';
import { backOut, easeOut, easeInOut, elasticOut, clamp01, lerp, approach } from './fx.ts';

const SERIF = '"Iowan Old Style", "Hiragino Mincho ProN", Georgia, serif';
type Anchor = () => Vec;

export function createUI(svg: SVGSVGElement) {
  const root = el('g', { style: 'pointer-events:none' }, svg);
  let k = 1; // counter-scale: 1 at the phone's usual zoom
  let view = { x: 0, y: 0, w: 960, h: 480 };
  const place = (g: Element, p: Vec, s = 1, rot = 0) => g.setAttribute('transform', `translate(${f(p[0])} ${f(p[1])}) scale(${f(s * k)})${rot ? ` rotate(${f(rot)})` : ''}`);

  // ------------------------------------------------------------------ speech balloons
  // One hand for every line in the game: italic serif on a paper balloon. People speak through
  // a tail; the traveller's thoughts (and the gentle "what now") rise in a cloud with two little
  // bubbles. Words arrive one by one like ink soaking into paper: each word blooms from a pale
  // wash, settles a hair downward, and longer words and punctuation take their own breath.
  type Word = { n: SVGTSpanElement; at: number; done: boolean };
  type Balloon = { g: SVGGElement; at: Anchor; words: Word[]; full: string[]; t: number; dur: number; w: number; h: number; reveal: number; thought: boolean; settled: boolean };
  const balloons: Balloon[] = [];
  let hintBalloon: Balloon | null = null;
  function hint(at: Anchor, text: string | null, sticky = false) {
    if (hintBalloon) { const old = hintBalloon; old.dur = Math.min(old.dur, old.t + .25); hintBalloon = null; }
    if (text) { hintBalloon = say(at, text, sticky ? Infinity : undefined, 'thought'); hintBalloon.g.setAttribute('data-world-hint', ''); }
  }
  function wrap(s: string, max = 22) {
    const out: string[] = []; let line = '';
    for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }
    if (line) out.push(line);
    return out;
  }
  /** how long a word holds the pen before the next one starts */
  function wordBeat(w: string) {
    let d = .085 + Math.min(10, w.length) * .022;
    if (/…$|\.\.\.$/.test(w)) d += .42; else if (/[.!?]$/.test(w)) d += .3; else if (/[,;:—]$/.test(w)) d += .16;
    return d;
  }
  const LH = 8.8;
  function say(at: Anchor, text: string, dur?: number, kind: 'speech' | 'thought' = 'speech') {
    // one balloon per speaker: a new line replaces the old
    balloons.filter((b) => b !== hintBalloon && b.at === at).forEach((b) => { b.dur = Math.min(b.dur, b.t + .25); });
    const thought = kind === 'thought';
    const g = el('g', { opacity: 0, 'data-balloon': kind }, root);
    const body = el('path', { fill: PAPER, stroke: 'currentColor', 'stroke-width': .8, 'stroke-linejoin': 'round' }, g);
    const full = wrap(text, thought ? 24 : 22);
    const words: Word[] = [];
    let clock = .16;
    const lines = full.map((line, i) => {
      const n = el('text', { x: 0, y: f(-14 - (full.length - 1 - i) * LH), 'font-size': 7.2, 'font-family': SERIF, 'font-style': 'italic', fill: 'currentColor', 'text-anchor': 'middle' }, g);
      line.split(' ').forEach((w, j, all) => {
        const sp = el('tspan', { 'fill-opacity': 0 }, n) as SVGTSpanElement;
        sp.textContent = j < all.length - 1 ? w + ' ' : w;
        words.push({ n: sp, at: clock, done: false });
        clock += wordBeat(w);
      });
      return n;
    });
    const reveal = clock + .25;
    // measure with every word in place (they are only transparent), then size the paper
    let w = 0; lines.forEach((n, i) => { w = Math.max(w, n.getComputedTextLength?.() || full[i].length * 3.6); });
    w += thought ? 15 : 12; const h = full.length * LH + 7;
    const x0 = -w / 2, y1 = -7.5, y0 = y1 - h, r = thought ? 6.5 : 4;
    if (thought) {
      // a soft cloud: the rounded box with scalloped long edges, and two bubbles down to the head
      const bumps = Math.max(2, Math.round(w / 15)), bw = (w - 2 * r) / bumps;
      let d = `M${f(x0 + r)} ${f(y0)}`;
      for (let i = 0; i < bumps; i++) d += ` Q${f(x0 + r + bw * (i + .5))} ${f(y0 - 2.2)} ${f(x0 + r + bw * (i + 1))} ${f(y0)}`;
      d += ` Q${f(-x0)} ${f(y0)} ${f(-x0)} ${f(y0 + r)} L${f(-x0)} ${f(y1 - r)} Q${f(-x0)} ${f(y1)} ${f(-x0 - r)} ${f(y1)}`;
      for (let i = bumps - 1; i >= 0; i--) d += ` Q${f(x0 + r + bw * (i + .5))} ${f(y1 + 2.2)} ${f(x0 + r + bw * i)} ${f(y1)}`;
      d += ` Q${f(x0)} ${f(y1)} ${f(x0)} ${f(y1 - r)} L${f(x0)} ${f(y0 + r)} Q${f(x0)} ${f(y0)} ${f(x0 + r)} ${f(y0)}Z`;
      body.setAttribute('d', d);
      el('circle', { cx: 1.5, cy: f(y1 + 4.6), r: 1.7, fill: PAPER, stroke: 'currentColor', 'stroke-width': .7 }, g);
      el('circle', { cx: -.4, cy: f(y1 + 8.4), r: 1, fill: PAPER, stroke: 'currentColor', 'stroke-width': .6 }, g);
    } else body.setAttribute('d', `M${f(x0 + r)} ${f(y0)} L${f(-x0 - r)} ${f(y0)} Q${f(-x0)} ${f(y0)} ${f(-x0)} ${f(y0 + r)} L${f(-x0)} ${f(y1 - r)} Q${f(-x0)} ${f(y1)} ${f(-x0 - r)} ${f(y1)} L3.5 ${f(y1)} L0.5 ${f(y1 + 5)} L-1.5 ${f(y1)} L${f(x0 + r)} ${f(y1)} Q${f(x0)} ${f(y1)} ${f(x0)} ${f(y1 - r)} L${f(x0)} ${f(y0 + r)} Q${f(x0)} ${f(y0)} ${f(x0 + r)} ${f(y0)}Z`);
    // never take the paper away before the words have been read
    const read = Math.max(1.3, text.length * .045);
    const b: Balloon = { g, at, words, full, t: 0, dur: dur === undefined ? reveal + read : dur === Infinity ? Infinity : Math.max(dur, dur < 1 ? dur : reveal + .9), w, h, reveal, thought, settled: false };
    balloons.push(b);
    return b;
  }
  function inkWords(b: Balloon) {
    if (b.settled) return;
    let all = true, prev = 0, line: Node | null = null;
    for (const wd of b.words) {
      if (wd.n.parentNode !== line) { line = wd.n.parentNode; prev = 0; } // dy runs on within a line
      const u = clamp01((b.t - wd.at) / .38);
      if (u >= 1 && !wd.done) { wd.done = true; wd.n.setAttribute('fill-opacity', '1'); }
      if (!wd.done) all = false;
      // a pale wash first, then the ink darkens as it soaks in, settling a hair downward
      const off = wd.done ? 0 : -(1 - easeOut(u)) * 1.4;
      if (!wd.done) wd.n.setAttribute('fill-opacity', f(u <= 0 ? 0 : .28 + .72 * easeOut(u)));
      const dy = off - prev; prev = off;
      if (Math.abs(dy) > .001) wd.n.setAttribute('dy', f(dy)); else wd.n.removeAttribute('dy');
    }
    if (all) { b.words.forEach((wd) => { wd.n.removeAttribute('dy'); wd.n.removeAttribute('fill-opacity'); }); b.settled = true; }
  }
  function drawBalloons(dt: number) {
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      // Dialogue gets the reader's attention first; resume the route hint afterwards.
      // Keeping its timer paused also protects short hints from disappearing unread.
      if (b === hintBalloon && balloons.some(other => other !== b && other.t < other.dur)) {
        b.g.setAttribute('opacity', '0'); continue;
      }
      b.t += dt;
      const inT = clamp01(b.t / 0.32), outT = clamp01((b.t - (b.dur - 0.3)) / 0.3);
      const s = lerp(0.7, 1, backOut(inT, 1.2)) * lerp(1, 0.94, outT);
      // keep the balloon inside the view, the tail still pointing at the speaker
      const a = b.at();
      const half = (b.w / 2) * k, top = (b.h + 8) * k;
      const p: Vec = [Math.max(view.x + half + 3, Math.min(view.x + view.w - half - 3, a[0])), Math.max(view.y + top + 3, a[1] - outT * 2 * k)];
      place(b.g, p, s);
      b.g.setAttribute('opacity', f(easeOut(inT) * (1 - outT)));
      inkWords(b);
      if (b.t >= b.dur) { b.g.remove(); balloons.splice(i, 1); if (b === hintBalloon) hintBalloon = null; }
    }
  }

  // ------------------------------------------------------------------ the red guide crane
  const crane = el('g', { opacity: 0, 'data-companion': 'turna' }, root);
  const craneInner = el('g', {}, crane);
  const wingFar = el('path', { fill: '#a8352e', stroke: 'currentColor', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }, craneInner);
  el('path', { d: 'M-7.4 -0.6 L0 -3 L8 -1.6 L0.6 2.6Z', fill: '#c8423a', stroke: 'currentColor', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }, craneInner);
  el('path', { d: 'M5.6 -1.8 L10 -9 L12.6 -8.2 L10.4 -7.6 L7.6 -0.8Z M-6 -0.4 L-11.4 -6.4 L-3.6 -1.8Z', fill: '#c8423a', stroke: 'currentColor', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }, craneInner);
  const wingNear = el('path', { fill: '#d4524a', stroke: 'currentColor', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }, craneInner);
  // Screen coordinates keep a docked companion steady while the camera follows you.
  // Its target is still a world anchor, so the same figure can fly into the scene.
  const cr = { arrive: false, on: false, visible: false, initialized: false, target: null as Anchor | null, pos: [0, 0] as Vec, vel: [0, 0] as Vec, op: 0, face: 1, flap: 0, t: 0, dockDistance: 0 };
  function guide(target: Anchor | null) { cr.on = !!target; cr.target = target; }
  const toWorld = (p: Vec): Vec => [view.x + p[0] * k / 1.8, view.y + p[1] * k / 1.8];
  function drawCrane(dt: number) {
    cr.t += dt;
    const ppu = 1.8 / k, width = view.w * ppu, height = view.h * ppu;
    const dock: Vec = [50, height - 56];
    if (!cr.initialized) { cr.pos = [...dock]; cr.initialized = true; }
    // its first entrance: in from the top right, as if it had been flying over the roofs
    if (cr.arrive && cr.visible) { cr.arrive = false; cr.pos = [width + 30, 70]; cr.vel = [-140, 40]; cr.op = .0; }
    cr.op = approach(cr.op, cr.visible ? 1 : 0, 5, dt);
    crane.setAttribute('opacity', f(cr.op));
    crane.setAttribute('data-guiding', String(cr.on));
    cr.dockDistance = Math.hypot(cr.pos[0] - dock[0], cr.pos[1] - dock[1]);
    crane.setAttribute('data-docked', String(!cr.on && cr.dockDistance < 12));
    if (cr.op < .01 && !cr.visible) { if (!cr.arrive) { cr.pos = [...dock]; cr.vel = [0, 0]; } return; }
    let want: Vec;
    if (cr.target) {
      const tg = cr.target();
      want = [(tg[0] - view.x) * ppu + Math.cos(cr.t * 1.6) * 5, (tg[1] - view.y) * ppu - 22 + Math.sin(cr.t * 2.3) * 3];
      want = [Math.max(25, Math.min(width - 25, want[0])), Math.max(90, Math.min(height * .7, want[1]))];
    } else want = [dock[0] + Math.sin(cr.t * .8) * 3, dock[1] + Math.sin(cr.t * 1.3) * 3];
    for (const i of [0, 1]) { cr.vel[i] += ((want[i] - cr.pos[i]) * 7 - cr.vel[i] * 3.4) * dt; cr.pos[i] += cr.vel[i] * dt; }
    const direction = Math.abs(cr.vel[0]) > 2 ? Math.sign(cr.vel[0]) : cr.face;
    cr.face = approach(cr.face, direction, 6, dt);
    cr.flap += dt * (cr.on || cr.dockDistance > 12 ? 7 : 2.2);
    const w = Math.sin(cr.flap);
    wingFar.setAttribute('d', `M-2 -1.6 L3 -1.8 L${f(-2.4 + w * .6)} ${f(-10 * w - 2.4)}Z`);
    wingNear.setAttribute('d', `M-1.4 -1.2 L3.6 -1.4 L${f(1.2 - w)} ${f(-11 * w - 1.6)}Z`);
    place(crane, toWorld(cr.pos));
    craneInner.setAttribute('transform', `scale(${f(cr.face)} 1) rotate(${f(-cr.vel[1] * .035)})`);
  }

  // ------------------------------------------------------------------ ghost hand: shows a gesture once
  const hand = el('g', { opacity: 0, 'data-gesture-hand': '' }, root);
  const handTrail = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 1, 'stroke-linecap': 'round', 'stroke-dasharray': '0.1 3', opacity: 0.6 }, root);
  const handInner = el('g', {}, hand);
  el('path', { d: 'M0 0 Q-1.6 -0.4 -1.6 1.6 L-1.4 9 Q-4.6 7 -6 8.6 Q-6.8 10 -4.8 12 L0.4 18 Q2.6 20.6 6.6 20.6 L10 20.6 Q14.6 20.4 15 15.6 L15.4 9.6 Q15.4 7.6 13.4 7.6 Q12.2 7.6 11.8 8.8 Q11.8 6.6 9.8 6.6 Q8.4 6.6 8 8 Q8 6 6 6 Q4.4 6 4 7.4 L1.8 1.6 Q1.6 0 0 0Z', fill: PAPER, stroke: 'currentColor', 'stroke-width': 0.9, 'stroke-linejoin': 'round', opacity: 0.92 }, handInner);
  el('path', { d: 'M8 8 L8.2 10.6 M11.8 8.8 L11.8 11', fill: 'none', stroke: 'currentColor', 'stroke-width': 0.6, 'stroke-linecap': 'round' }, handInner);
  const pressRing = el('circle', { r: 4, fill: 'none', stroke: '#c8423a', 'stroke-width': 1, opacity: 0 }, root);
  type Gesture = { kind: 'tap' | 'path' | 'hold'; pts: () => Vec[]; loop: boolean; t: number; period: number };
  let gesture: Gesture | null = null, handOp = 0;
  function showGesture(kind: Gesture['kind'], pts: () => Vec[], { loop = true, period = kind === 'tap' ? 1.4 : kind === 'hold' ? 2.4 : 2.2 } = {}) {
    gesture = { kind, pts, loop, t: 0, period };
  }
  const hideGesture = () => { gesture = null; };
  function drawHand(dt: number) {
    handOp = approach(handOp, gesture ? 1 : 0, 6, dt);
    hand.setAttribute('opacity', f(handOp)); handTrail.setAttribute('opacity', f(handOp * 0.6));
    if (!gesture) { pressRing.setAttribute('opacity', '0'); return; }
    gesture.t += dt;
    const u = (gesture.t % gesture.period) / gesture.period;
    const pts = gesture.pts();
    let p: Vec = pts[0], press = 0, alpha = 1;
    if (gesture.kind === 'tap') {
      press = u > 0.35 && u < 0.5 ? 1 : 0;
      const lift = u < 0.35 ? easeInOut(u / 0.35) : u > 0.5 ? 1 - easeInOut((u - 0.5) / 0.4) : 1;
      p = [pts[0][0] + 6 * (1 - lift), pts[0][1] + 8 * (1 - lift)];
      alpha = u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1;
      handTrail.setAttribute('d', '');
    } else if (gesture.kind === 'hold') {
      press = u > 0.2 && u < 0.85 ? 1 : 0;
      p = pts[0];
      handTrail.setAttribute('d', '');
    } else {
      // move along the path, press while moving
      const s = clamp01((u - 0.12) / 0.7);
      press = u > 0.1 && u < 0.84 ? 1 : 0;
      const seg = (pts.length - 1) * easeInOut(s), i = Math.min(pts.length - 2, Math.floor(seg)), fr = seg - i;
      p = [lerp(pts[i][0], pts[i + 1][0], fr), lerp(pts[i][1], pts[i + 1][1], fr)];
      alpha = u > 0.9 ? 1 - (u - 0.9) / 0.1 : u < 0.08 ? u / 0.08 : 1;
      handTrail.setAttribute('d', 'M' + pts.map(pt).join('L'));
    }
    hand.setAttribute('opacity', f(handOp * alpha));
    place(hand, [p[0], p[1]], press ? 0.92 : 1);
    pressRing.setAttribute('cx', f(p[0])); pressRing.setAttribute('cy', f(p[1]));
    pressRing.setAttribute('r', f((4 + (gesture.kind === 'hold' ? Math.sin(gesture.t * 6) * 1.5 + 3 : 0)) * k));
    pressRing.setAttribute('stroke-width', f(k));
    pressRing.setAttribute('opacity', f(press * handOp * alpha * 0.8));
    if (!gesture.loop && gesture.t > gesture.period) gesture = null;
  }

  // ------------------------------------------------------------------ breathing ring: "stay still"
  const breath = el('g', { opacity: 0 }, root);
  const breathC = el('circle', { r: 16, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.7, opacity: 0.55 }, breath);
  const breathArc = el('path', { fill: 'none', stroke: '#c8423a', 'stroke-width': 1.2, 'stroke-linecap': 'round' }, breath);
  let breathOn: Anchor | null = null, breathProg = 0, breathOp = 0, breathT = 0;
  function stillness(at: Anchor | null, prog = 0) { breathOn = at; breathProg = prog; }
  function drawBreath(dt: number) {
    breathOp = approach(breathOp, breathOn ? 1 : 0, 3, dt);
    breath.setAttribute('opacity', f(breathOp));
    if (breathOp < 0.01) return;
    breathT += dt;
    const r = 15 + Math.sin(breathT * 1.25) * 3; // ~5 s per breath
    breathC.setAttribute('r', f(r));
    const a = clamp01(breathProg) * Math.PI * 2 - 1e-4;
    breathArc.setAttribute('d', breathProg > 0.01 ? `M0 ${f(-r - 3)} A${f(r + 3)} ${f(r + 3)} 0 ${a > Math.PI ? 1 : 0} 1 ${f(Math.sin(a) * (r + 3))} ${f(-Math.cos(a) * (r + 3))}` : '');
    if (breathOn) place(breath, breathOn(), 1);
  }

  // ------------------------------------------------------------------ hearts and twinkles
  type Pop = { g: SVGGElement; at: Vec; t: number };
  const pops: Pop[] = [];
  function heart(at: Vec) {
    const g = el('g', {}, root);
    el('path', { d: 'M0 3 C-6 -1 -6 -6.4 -2.6 -6.4 C-1.2 -6.4 -0.4 -5.4 0 -4.4 C0.4 -5.4 1.2 -6.4 2.6 -6.4 C6 -6.4 6 -1 0 3Z', fill: '#c8423a', stroke: 'currentColor', 'stroke-width': 0.7, 'stroke-linejoin': 'round' }, g);
    pops.push({ g, at, t: 0 });
  }
  function drawPops(dt: number) {
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.t += dt;
      const s = elasticOut(p.t / 0.7) * (1 - clamp01((p.t - 1.4) / 0.4) * 0.3);
      place(p.g, [p.at[0], p.at[1] - easeOut(p.t / 1.8) * 16], s * 1.2);
      p.g.setAttribute('opacity', f(1 - clamp01((p.t - 1.4) / 0.4)));
      if (p.t > 1.8) { p.g.remove(); pops.splice(i, 1); }
    }
  }
  const twinkle = el('g', { opacity: 0 }, root);
  const stars = [0, 1, 2].map(() => el('path', { d: 'M0 -3 L0.7 -0.7 L3 0 L0.7 0.7 L0 3 L-0.7 0.7 L-3 0 L-0.7 -0.7Z', fill: '#c8423a' }, twinkle));
  let twinkleAt: Anchor | null = null, twOp = 0, twT = 0;
  function sparkle(at: Anchor | null) { twinkleAt = at; }
  function drawTwinkle(dt: number) {
    twOp = approach(twOp, twinkleAt ? 1 : 0, 3, dt); twT += dt;
    twinkle.setAttribute('opacity', f(twOp));
    if (!twinkleAt || twOp < 0.01) return;
    const a = twinkleAt();
    stars.forEach((s, i) => {
      const ph = twT * 1.4 + i * 2.1, sc = Math.max(0, Math.sin(ph)) * k;
      s.setAttribute('transform', `translate(${f(a[0] + Math.cos(i * 2.4 + 1) * 12 * k)} ${f(a[1] + Math.sin(i * 2.4 + 1) * 8 * k)}) scale(${f(sc)}) rotate(${f(ph * 20)})`);
    });
  }

  return {
    root, say, hint, guide,
    showWalkingGesture() {
      hand.setAttribute('data-tutorial', 'walk');
      showGesture('path', () => Array.from({ length: 49 }, (_, i) => {
        const a = i / 48 * Math.PI * 2;
        return [view.x + view.w * (.42 + Math.sin(a) * .09), view.y + view.h * (.82 + Math.sin(a * 2) * .023)] as Vec;
      }), { period: 3.1 });
    },
    dismissDialogue() { balloons.filter(b => b !== hintBalloon).forEach(b => { b.dur = Math.min(b.dur, b.t + .25); }); },
    get typing() { return balloons.some(b => b !== hintBalloon && b.t < b.reveal); },
    companionVisible(show: boolean) { cr.visible = show; },
    companionArrive() { cr.arrive = true; cr.initialized = true; },
    get companionDocked() { return !cr.on && cr.dockDistance < 12; }, showGesture, hideGesture, stillness, heart, sparkle,
    get guiding() { return cr.on; },
    /** where the guide crane is (for its own speech balloon) */
    craneAt(): Vec { const p = toWorld(cr.pos); return [p[0], p[1] - 6 * k]; },
    get speaking() { return balloons.length > 0; },
    /** call each frame: px per scene unit, and the visible rect */
    draw(dt: number, pxPerUnit: number, v: { x: number; y: number; w: number; h: number }) {
      k = 1.8 / Math.max(0.3, pxPerUnit); view = v;
      drawBalloons(dt); drawCrane(dt); drawHand(dt); drawBreath(dt); drawPops(dt); drawTwinkle(dt);
    },
  };
}
export type UI = ReturnType<typeof createUI>;
